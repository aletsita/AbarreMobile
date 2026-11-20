import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { STATUS_LABEL, type Order, type OrderStatus } from '../../api/types';

// Notificaciones del sistema (barra de notificaciones, con sonido) cuando cambia el estado de un pedido.
// Son locales: la app las muestra al recibir el cambio por la conexión en vivo con el servidor, así que
// llegan con la app abierta o en segundo plano, pero no si se cerró por completo.
// Con la app en primer plano el aviso es un toast dentro de la app (ver orders.tsx).
export type NotifyPermission = 'granted' | 'denied' | 'prompt' | 'no-disponible';

export const CHANNEL_ID = 'pedidos';
const ASKED = 'tendero.avisos.preguntado';

const BODY: Record<OrderStatus, string> = {
  pendiente: 'Recibimos tu pedido. Te avisamos cuando la tienda empiece a prepararlo.',
  preparando: 'La tienda ya está preparando tu pedido.',
  listo: 'Ya puedes pasar a recogerlo. Muestra tu código en la caja.',
  entregado: '¡Gracias por tu compra!',
  cancelado: 'La tienda canceló tu pedido. Toca para ver qué pasó.',
};

let foreground = true;
let handles: PluginListenerHandle[] = [];
let offVisibility: (() => void) | null = null;

export async function notifyPermission(): Promise<NotifyPermission> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'no-disponible'; // navegador sin notificaciones
  }
}

// ¿Ya se le explicó al cliente para qué son los avisos? (se pregunta una sola vez, tras su primer pedido)
export const alreadyAsked = async () => (await Preferences.get({ key: ASKED })).value === '1';
const markAsked = () => Preferences.set({ key: ASKED, value: '1' });

// Después de la explicación en la app. En Android 13 o superior aparece el diálogo del sistema.
export async function requestNotify(): Promise<NotifyPermission> {
  await markAsked();
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'no-disponible';
  }
}

export async function declineNotify() {
  await markAsked();
}

// Al entrar el cliente: canal de Android, tocar una notificación abre su pedido, y se lleva la cuenta
// de si la app está a la vista
export async function startNotify(onOpen: (orderId: string) => void) {
  await stopNotify();
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Pedidos',
      description: 'Avisos cuando la tienda cambia el estado de tus pedidos',
      importance: 4, // alta: suena y aparece arriba de la pantalla
      visibility: 1,
      vibration: true,
    }).catch(() => undefined);
  }
  if (Capacitor.isNativePlatform()) {
    handles = await Promise.all([
      LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
        const id = (notification.extra as { orderId?: string } | undefined)?.orderId;
        if (id) onOpen(id);
      }),
      App.addListener('appStateChange', ({ isActive }) => (foreground = isActive)),
    ]);
  } else {
    const onVisible = () => (foreground = document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisible);
    offVisibility = () => document.removeEventListener('visibilitychange', onVisible);
  }
}

// Al cerrar sesión: no quedan avisos de esta cuenta en la barra
export async function stopNotify() {
  await Promise.all(handles.map((h) => h.remove()));
  handles = [];
  offVisibility?.();
  offVisibility = null;
  await LocalNotifications.removeAllDeliveredNotifications().catch(() => undefined);
}

// Un número estable por pedido: cada estado nuevo reemplaza el aviso anterior del mismo pedido
function notificationId(orderId: string) {
  let h = 0;
  for (const ch of orderId) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % 2147483647 || 1;
}

// Cambió el estado de un pedido. Solo avisa en la barra si la app no está a la vista.
export async function notifyOrder(o: Order) {
  if (foreground || (await notifyPermission()) !== 'granted') return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId(o.id),
        title: `Pedido ${o.folio}: ${STATUS_LABEL[o.status]}`,
        body: o.cancel?.reason === 'sin-existencia' ? 'Se agotó un producto. Toca para quitar el pedido o elegir otro producto.' : BODY[o.status],
        channelId: CHANNEL_ID,
        extra: { orderId: o.id },
      },
    ],
  }).catch((e) => console.warn('[avisos] No se pudo mostrar la notificación', e));
}

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { api, SIMULATED } from '../../api';
import { SIM_PUSH_EVENT, SIM_TAP_EVENT, type SimPush } from '../../api/sim/events';

// Plugin propio (android/.../PushConfigPlugin.java): dice si la app se compiló con google-services.json.
// Sin ese archivo Firebase no arranca y PushNotifications.register() tumbaría la app.
const PushConfig = registerPlugin<{ status(): Promise<{ firebase: boolean }> }>('PushConfig');

// nativo: Firebase listo · simulado: el servidor simulado manda los avisos · no-disponible: sin push
export type PushMode = 'nativo' | 'simulado' | 'no-disponible';
export type PushPermission = 'granted' | 'denied' | 'prompt' | 'no-disponible';

export const CHANNEL_ID = 'pedidos';
const SIM_PERMISSION = 'tendero.sim.avisos';
const ASKED = 'tendero.avisos.preguntado';
const SIM_TOKEN = 'tendero.sim.tokenPush';

let modePromise: Promise<PushMode> | null = null;
export function pushMode(): Promise<PushMode> {
  return (modePromise ??= (async () => {
    if (Capacitor.getPlatform() === 'android') {
      try {
        if ((await PushConfig.status()).firebase) return 'nativo';
      } catch {
        /* plugin no disponible */
      }
      console.warn('[push] No hay android/app/google-services.json: las notificaciones push están desactivadas. Todo lo demás funciona.');
    }
    return SIMULATED ? 'simulado' : 'no-disponible';
  })());
}

export async function pushPermission(): Promise<PushPermission> {
  const mode = await pushMode();
  if (mode === 'no-disponible') return 'no-disponible';
  if (mode === 'simulado') {
    const { value } = await Preferences.get({ key: SIM_PERMISSION });
    return value === 'granted' || value === 'denied' ? value : 'prompt';
  }
  const { receive } = await PushNotifications.checkPermissions();
  return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
}

// ¿Ya se le explicó al cliente para qué son los avisos? (se pregunta una sola vez, tras su primer pedido)
export const alreadyAsked = async () => (await Preferences.get({ key: ASKED })).value === '1';
const markAsked = () => Preferences.set({ key: ASKED, value: '1' });

interface Handlers {
  onReceived: (orderId: string, title: string) => void; // app en primer plano
  onOpen: (orderId: string) => void; // tocaron la notificación
}

let token: string | null = null;
let handles: PluginListenerHandle[] = [];
let windowListeners: (() => void)[] = [];

async function registerToken() {
  const mode = await pushMode();
  if (mode === 'nativo') {
    await PushNotifications.register(); // el token llega en el evento 'registration'
  } else if (mode === 'simulado') {
    // Como un token FCM: el mismo para esta instalación mientras no se dé de baja
    const saved = (await Preferences.get({ key: SIM_TOKEN })).value;
    token = saved ?? `sim-${Math.random().toString(36).slice(2, 12)}`;
    if (!saved) await Preferences.set({ key: SIM_TOKEN, value: token });
    await api.registerPush(token, 'simulado').catch((e) => console.warn('[push] No se pudo registrar el token', e));
  }
}

// Al iniciar sesión (o abrir la app con sesión de cliente)
export async function startPush(h: Handlers) {
  await stopListeners();
  const mode = await pushMode();
  if (mode === 'nativo') {
    await PushNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Pedidos',
      description: 'Avisos cuando la tienda cambia el estado de tus pedidos',
      importance: 4, // alta: suena y aparece arriba de la pantalla
      visibility: 1,
      vibration: true,
    });
    handles = await Promise.all([
      PushNotifications.addListener('registration', ({ value }) => {
        token = value;
        api.registerPush(value, 'android').catch((e) => console.warn('[push] No se pudo registrar el token', e));
      }),
      PushNotifications.addListener('registrationError', (e) => console.warn('[push] Error al registrar', e)),
      PushNotifications.addListener('pushNotificationReceived', (n) => {
        const id = (n.data as { orderId?: string } | undefined)?.orderId;
        if (id) h.onReceived(id, n.title ?? '');
      }),
      PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const id = (notification.data as { orderId?: string } | undefined)?.orderId;
        if (id) h.onOpen(id);
      }),
    ]);
  } else if (mode === 'simulado') {
    const received = (e: Event) => {
      const d = (e as CustomEvent<SimPush>).detail;
      h.onReceived(d.data.orderId, d.title);
    };
    const tapped = (e: Event) => h.onOpen((e as CustomEvent<SimPush>).detail.data.orderId);
    window.addEventListener(SIM_PUSH_EVENT, received);
    window.addEventListener(SIM_TAP_EVENT, tapped);
    windowListeners = [() => window.removeEventListener(SIM_PUSH_EVENT, received), () => window.removeEventListener(SIM_TAP_EVENT, tapped)];
  }
  if ((await pushPermission()) === 'granted') await registerToken();
}

// Después de la explicación en la app. Devuelve el permiso final.
export async function requestPush(): Promise<PushPermission> {
  await markAsked();
  const mode = await pushMode();
  let result: PushPermission = 'no-disponible';
  if (mode === 'nativo') {
    // En Android 13 o superior aparece el diálogo del sistema (POST_NOTIFICATIONS); antes ya está concedido
    const { receive } = await PushNotifications.requestPermissions();
    result = receive === 'granted' ? 'granted' : 'denied';
  } else if (mode === 'simulado') {
    result = 'granted';
    await Preferences.set({ key: SIM_PERMISSION, value: result });
  }
  if (result === 'granted') await registerToken();
  return result;
}

export async function declinePush() {
  await markAsked();
}

async function stopListeners() {
  await Promise.all(handles.map((x) => x.remove()));
  handles = [];
  windowListeners.forEach((off) => off());
  windowListeners = [];
}

// Al cerrar sesión: el servidor deja de mandar avisos a este teléfono
export async function stopPush() {
  const t = token;
  token = null;
  if (t) await api.unregisterPush(t).catch(() => undefined);
  if ((await pushMode()) === 'nativo') await PushNotifications.unregister().catch(() => undefined);
  await stopListeners();
}

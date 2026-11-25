import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useIonRouter, useIonToast } from '@ionic/react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../../api';
import { errorMessage } from '../../api/errors';
import { hasIssue, STATUS_LABEL, type NewOrder, type Order } from '../../api/types';
import { useCatalog } from './catalog';
import { notifyOrder } from './notify';

interface OrdersState {
  orders: Order[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  live: boolean;
  refresh: () => Promise<void>;
  upsert: (o: Order) => void;
  // Pedido que cambió fuera de esta pantalla (en vivo): lo guarda y avisa si cambió su estado
  incoming: (o: Order) => void;
  // Acciones sobre un pedido: van al servidor y lo que responde queda en la lista
  create: (order: NewOrder, idempotencyKey: string) => Promise<Order>;
  load: (id: string) => Promise<Order>;
  change: (id: string, items: { productId: string; qty: number }[]) => Promise<Order>;
  cancel: (id: string) => Promise<Order>;
  dismiss: (id: string) => Promise<Order>;
  // Abre la página de pago del pedido (la misma si sigue vigente; si venció o falló, una nueva)
  pay: (id: string) => Promise<Order>;
}

const Ctx = createContext<OrdersState | null>(null);

// El estado del pago también cuenta: al confirmarse, el pedido sigue en pendiente pero ya tiene código
const stateOf = (o: Order) => `${hasIssue(o) ? `${o.status}:aviso:${o.issue!.at}` : o.status}:${o.payment?.status ?? ''}`;

function noticeOf(o: Order, before: string) {
  const name = o.folio ? `Pedido ${o.folio}` : 'Tu pedido';
  const payChanged = !before.endsWith(`:${o.payment?.status ?? ''}`);
  if (payChanged && o.payment?.status === 'pagado') return { text: `¡Pago confirmado! Tu código para recoger ya está en «Mis pedidos».`, color: 'success' };
  if (payChanged && o.payment?.status === 'fallido') return { text: `${name}: el pago no se completó. Puedes reintentarlo.`, color: 'warning' };
  if (payChanged && o.payment?.status === 'por_reembolsar') return { text: `${name}: no se pudo surtir. Te devolveremos tu dinero.`, color: 'warning' };
  if (hasIssue(o)) return { text: `${name}: se agotó un producto. Elige qué hacer.`, color: 'warning' };
  return { text: `${name}: ${STATUS_LABEL[o.status]}`, color: o.status === 'listo' ? 'success' : 'primary' };
}

const sortOrders = (list: Order[]) => [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// Mis pedidos: se cargan al entrar, se actualizan en vivo (SSE) mientras la app está abierta
// y se vuelven a pedir al regresar al primer plano.
export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [connection, setConnection] = useState(0);
  // Estado de cada pedido conocido; un aviso de producto agotado también cuenta como cambio
  const known = useRef(new Map<string, string>());
  const { setStore, applyStock, applyCatalog, refresh: refreshCatalog } = useCatalog();
  const [toast] = useIonToast();
  const router = useIonRouter();

  const remember = (list: Order[]) => list.forEach((o) => known.current.set(o.id, stateOf(o)));

  const upsert = useCallback((o: Order) => {
    known.current.set(o.id, stateOf(o));
    setOrders((list) => sortOrders([o, ...list.filter((x) => x.id !== o.id)]));
  }, []);

  const keep = useCallback(
    async (request: Promise<Order>) => {
      const o = await request;
      upsert(o);
      return o;
    },
    [upsert],
  );
  const create = useCallback((order: NewOrder, key: string) => keep(api.createOrder(order, key)), [keep]);
  const load = useCallback((id: string) => keep(api.order(id)), [keep]);
  const change = useCallback((id: string, items: { productId: string; qty: number }[]) => keep(api.changeOrder(id, items)), [keep]);
  const cancel = useCallback((id: string) => keep(api.cancelOrder(id)), [keep]);
  // Pedido cancelado por la tienda: el cliente lo pasa al historial
  const dismiss = useCallback((id: string) => keep(api.resolveOrder(id, 'quitar')), [keep]);
  // Sesión de pago: la abierta si sigue vigente o una nueva. La pantalla «Pagar pedido» la monta.
  const pay = useCallback((id: string) => keep(api.payOrder(id)), [keep]);

  // Un cambio que llega en vivo: aviso dentro de la app y, si no está a la vista, en la barra de notificaciones
  const incoming = useCallback(
    (o: Order) => {
      const before = known.current.get(o.id);
      upsert(o);
      if (before && before !== stateOf(o)) {
        void notifyOrder(o);
        const n = noticeOf(o, before);
        void toast({
          message: n.text,
          duration: n.color === 'warning' ? 6000 : 4000,
          color: n.color,
          position: 'top',
          cssClass: 'toast-app',
          buttons: [{ text: 'Ver', handler: () => router.push(`/cliente/pedido/${o.id}`) }],
        });
      }
    },
    [upsert],
  );

  const loadedRef = useRef(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.orders();
      remember(list);
      setOrders(sortOrders(list));
      setError(null);
      setLoaded(true);
      loadedRef.current = true;
    } catch (e) {
      setError(errorMessage(e, 'No pudimos cargar tus pedidos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Si la conexión en vivo se corta, al volver se recargan pedidos y existencias completos (lo perdido no llega solo)
  const wasLive = useRef(false);
  const onLive = useCallback(
    (ok: boolean) => {
      setLive(ok);
      if (ok && !wasLive.current && loadedRef.current) {
        void refresh();
        void refreshCatalog();
      }
      wasLive.current = ok;
    },
    [refresh, refreshCatalog],
  );

  useEffect(() => api.watchOrders(incoming, onLive, setStore, applyStock, applyCatalog), [incoming, connection, setStore, applyStock, applyCatalog, onLive]);

  // De vuelta al primer plano: pedidos y catálogo frescos (lo que cambió en segundo plano no llegó) y conexión nueva
  useEffect(() => {
    const resume = () => {
      void refresh();
      void refreshCatalog();
      setConnection((n) => n + 1);
    };
    if (Capacitor.isNativePlatform()) {
      const h = App.addListener('appStateChange', ({ isActive }) => isActive && resume());
      return () => void h.then((x) => x.remove());
    }
    const onVisible = () => document.visibilityState === 'visible' && resume();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh, refreshCatalog]);

  return <Ctx.Provider value={{ orders, loading, loaded, error, live, refresh, upsert, incoming, create, load, change, cancel, dismiss, pay }}>{children}</Ctx.Provider>;
}

export function useOrders() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOrders fuera de OrdersProvider');
  return ctx;
}

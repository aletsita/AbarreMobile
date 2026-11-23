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
}

const Ctx = createContext<OrdersState | null>(null);

const stateOf = (o: Order) => (hasIssue(o) ? `${o.status}:aviso:${o.issue!.at}` : o.status);

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
  const { setStore } = useCatalog();
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

  // Un cambio que llega en vivo: aviso dentro de la app y, si no está a la vista, en la barra de notificaciones
  const incoming = useCallback(
    (o: Order) => {
      const before = known.current.get(o.id);
      upsert(o);
      if (before && before !== stateOf(o)) {
        void notifyOrder(o);
        void toast({
          message: hasIssue(o) ? `Pedido ${o.folio}: se agotó un producto. Elige qué hacer.` : `Pedido ${o.folio}: ${STATUS_LABEL[o.status]}`,
          duration: hasIssue(o) ? 6000 : 4000,
          color: hasIssue(o) ? 'warning' : o.status === 'listo' ? 'success' : 'primary',
          position: 'top',
          cssClass: 'toast-app',
          buttons: [{ text: 'Ver', handler: () => router.push(`/cliente/pedido/${o.id}`) }],
        });
      }
    },
    [upsert],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.orders();
      remember(list);
      setOrders(sortOrders(list));
      setError(null);
      setLoaded(true);
    } catch (e) {
      setError(errorMessage(e, 'No pudimos cargar tus pedidos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => api.watchOrders(incoming, setLive, setStore), [incoming, connection, setStore]);

  // De vuelta al primer plano: datos frescos y conexión en vivo nueva
  useEffect(() => {
    const resume = () => {
      void refresh();
      setConnection((n) => n + 1);
    };
    if (Capacitor.isNativePlatform()) {
      const h = App.addListener('appStateChange', ({ isActive }) => isActive && resume());
      return () => void h.then((x) => x.remove());
    }
    const onVisible = () => document.visibilityState === 'visible' && resume();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  return <Ctx.Provider value={{ orders, loading, loaded, error, live, refresh, upsert, incoming, create, load, change, cancel, dismiss }}>{children}</Ctx.Provider>;
}

export function useOrders() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOrders fuera de OrdersProvider');
  return ctx;
}

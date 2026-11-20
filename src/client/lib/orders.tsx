import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useIonRouter, useIonToast } from '@ionic/react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../../api';
import { errorMessage } from '../../api/errors';
import { STATUS_LABEL, type Order } from '../../api/types';
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
}

const Ctx = createContext<OrdersState | null>(null);

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
  const known = useRef(new Map<string, Order['status']>());
  const [toast] = useIonToast();
  const router = useIonRouter();

  const remember = (list: Order[]) => list.forEach((o) => known.current.set(o.id, o.status));

  const upsert = useCallback((o: Order) => {
    known.current.set(o.id, o.status);
    setOrders((list) => sortOrders([o, ...list.filter((x) => x.id !== o.id)]));
  }, []);

  // Un cambio que llega en vivo: aviso dentro de la app y, si no está a la vista, en la barra de notificaciones
  const incoming = useCallback(
    (o: Order) => {
      const before = known.current.get(o.id);
      upsert(o);
      if (before && before !== o.status) {
        void notifyOrder(o);
        void toast({
          message: `Pedido ${o.folio}: ${STATUS_LABEL[o.status]}`,
          duration: 4000,
          color: o.status === 'listo' ? 'success' : 'primary',
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

  useEffect(() => api.watchOrders(incoming, setLive), [incoming, connection]);

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

  return <Ctx.Provider value={{ orders, loading, loaded, error, live, refresh, upsert, incoming }}>{children}</Ctx.Provider>;
}

export function useOrders() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOrders fuera de OrdersProvider');
  return ctx;
}

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../../api';
import { errorMessage } from '../../api/errors';
import type { CatalogProduct, StoreStatus } from '../../api/types';

// Respaldo por si la conexión en vivo no avisa que la tienda abrió o cerró
const STORE_POLL_MS = 20000;

interface CatalogState {
  products: CatalogProduct[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  byId: (id: string) => CatalogProduct | undefined;
  // null: todavía no se sabe (se deja pedir; el servidor lo vuelve a revisar)
  store: StoreStatus | null;
  closed: boolean;
  setStore: (s: StoreStatus) => void;
}

const Ctx = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [store, setStoreState] = useState<StoreStatus | null>(null);
  const wasOpen = useRef<boolean | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await api.catalog());
      setError(null);
    } catch (e) {
      setError(errorMessage(e, 'No pudimos cargar los productos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Al volver a abrir la tienda los precios y existencias pueden haber cambiado
  const setStore = useCallback(
    (s: StoreStatus) => {
      setStoreState(s);
      if (wasOpen.current === false && s.abierta) void refresh();
      wasOpen.current = s.abierta;
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const check = () => api.store().then(setStore, () => undefined);
    void check();
    const t = window.setInterval(check, STORE_POLL_MS);
    return () => window.clearInterval(t);
  }, [setStore]);

  const byId = useCallback((id: string) => products.find((p) => p.id === id), [products]);

  return (
    <Ctx.Provider value={{ products, loading, error, refresh, byId, store, closed: store ? !store.abierta : false, setStore }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCatalog() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCatalog fuera de CatalogProvider');
  return ctx;
}

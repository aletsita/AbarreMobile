import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../../api';
import { errorMessage } from '../../api/errors';
import type { CatalogProduct } from '../../api/types';

interface CatalogState {
  products: CatalogProduct[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  byId: (id: string) => CatalogProduct | undefined;
}

const Ctx = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byId = useCallback((id: string) => products.find((p) => p.id === id), [products]);

  return <Ctx.Provider value={{ products, loading, error, refresh, byId }}>{children}</Ctx.Provider>;
}

export function useCatalog() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCatalog fuera de CatalogProvider');
  return ctx;
}

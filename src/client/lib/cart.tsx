import { Preferences } from '@capacitor/preferences';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CatalogProduct, OrderConflict } from '../../api/types';

export interface CartLine {
  productId: string;
  name: string;
  category: string;
  photo?: string;
  price: number; // el que vio el cliente al agregar; si cambió, el servidor responde 409
  stock: number; // existencia que mostró el catálogo: tope de la cantidad
  qty: number;
}

interface Saved {
  lines: CartLine[];
  note: string;
}

interface CartState extends Saved {
  ready: boolean;
  count: number;
  total: number;
  // Clave de idempotencia del pedido: la misma mientras el carrito no cambie (un reintento no duplica el pedido)
  orderKey: string;
  qtyOf: (productId: string) => number;
  add: (p: CatalogProduct, qty?: number) => number;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  setNote: (note: string) => void;
  clear: () => void;
  applyConflict: (c: OrderConflict) => void;
}

const Ctx = createContext<CartState | null>(null);

const newKey = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
export const round = (n: number) => Math.round(n * 100) / 100;

// El carrito se guarda en el teléfono, uno por usuario. Al cerrar sesión se suelta de la memoria
// (este proveedor se desmonta) y vuelve a aparecer si la misma persona entra de nuevo.
export function CartProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const key = `tendero.carrito.${userId}`;
  const [saved, setSaved] = useState<Saved>({ lines: [], note: '' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    Preferences.get({ key })
      .then(({ value }) => {
        if (!alive || !value) return;
        const v = JSON.parse(value) as Partial<Saved>;
        setSaved({ lines: Array.isArray(v.lines) ? v.lines : [], note: typeof v.note === 'string' ? v.note : '' });
      })
      .catch(() => undefined)
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    if (ready) void Preferences.set({ key, value: JSON.stringify(saved) }).catch(() => undefined);
  }, [saved, ready, key]);

  const orderKey = useMemo(newKey, [saved]);
  const update = (fn: (lines: CartLine[]) => CartLine[]) => setSaved((s) => ({ ...s, lines: fn(s.lines) }));

  const value: CartState = {
    ...saved,
    ready,
    orderKey,
    count: saved.lines.reduce((n, l) => n + l.qty, 0),
    total: round(saved.lines.reduce((t, l) => t + l.price * l.qty, 0)),
    qtyOf: (id) => saved.lines.find((l) => l.productId === id)?.qty ?? 0,
    add: (p, qty = 1) => {
      const current = saved.lines.find((l) => l.productId === p.id)?.qty ?? 0;
      const added = Math.max(0, Math.min(qty, p.stock - current));
      if (!added) return 0;
      update((lines) =>
        current
          ? lines.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + added, stock: p.stock } : l))
          : [...lines, { productId: p.id, name: p.name, category: p.category, photo: p.photo, price: p.price, stock: p.stock, qty: added }],
      );
      return added;
    },
    setQty: (id, qty) => update((lines) => lines.map((l) => (l.productId === id ? { ...l, qty: Math.max(1, Math.min(qty, l.stock)) } : l))),
    remove: (id) => update((lines) => lines.filter((l) => l.productId !== id)),
    setNote: (note) => setSaved((s) => ({ ...s, note })),
    clear: () => setSaved({ lines: [], note: '' }),
    // Después de un 409: precios y existencias nuevas; lo que ya no hay se quita
    applyConflict: (c) =>
      update((lines) =>
        lines.flatMap((l) => {
          const p = c.products.find((x) => x.id === l.productId);
          if (!p || p.stock < 1 || c.changes.some((ch) => ch.kind === 'no-disponible' && ch.productId === l.productId)) return [];
          return [{ ...l, name: p.name, price: p.price, stock: p.stock, qty: Math.min(l.qty, p.stock) }];
        }),
      ),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart fuera de CartProvider');
  return ctx;
}

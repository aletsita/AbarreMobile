import { IonIcon, useIonRouter, useIonToast } from '@ionic/react';
import {
  addOutline,
  archiveOutline,
  basketOutline,
  cloudOfflineOutline,
  cubeOutline,
  fastFoodOutline,
  iceCreamOutline,
  leafOutline,
  moonOutline,
  nutritionOutline,
  removeOutline,
  trashOutline,
  restaurantOutline,
  sparklesOutline,
  waterOutline,
} from 'ionicons/icons';
import { categoryColor, money } from '../../data/models';
import { STATUS_LABEL, type CatalogProduct, type OrderStatus } from '../../api/types';
import { useCart } from '../lib/cart';
import { useCatalog } from '../lib/catalog';

const CATEGORY_ICON: Record<string, string> = {
  Abarrotes: basketOutline,
  Bebidas: waterOutline,
  Botanas: fastFoodOutline,
  Lácteos: iceCreamOutline,
  Panadería: leafOutline,
  Tortillería: restaurantOutline,
  Limpieza: sparklesOutline,
  Galletas: nutritionOutline,
  Enlatados: archiveOutline,
};

export const categoryIcon = (c: string) => CATEGORY_ICON[c] ?? cubeOutline;

// Color de la categoría mezclado para íconos y fondos suaves
export const categoryTint = (c: string, amount = 14) => {
  const color = categoryColor(c);
  return { color: `color-mix(in srgb, ${color} 80%, var(--ion-text-color))`, background: `color-mix(in srgb, ${color} ${amount}%, var(--t-surface))` };
};

// Foto del producto sobre fondo gris muy claro o, si no tiene, el ícono de su categoría
export function ProductImage({ product, size }: { product: { name: string; category: string; photo?: string }; size?: number }) {
  return (
    <span
      className="cl-img"
      style={{ ...(size ? { width: size, height: size } : {}), color: categoryTint(product.category).color }}
      aria-hidden="true"
    >
      {product.photo ? <img src={product.photo} alt="" /> : <IonIcon icon={categoryIcon(product.category)} />}
    </span>
  );
}

// Precio con los centavos en superíndice
export function Price({ value, className = '' }: { value: number; className?: string }) {
  const [int, cents] = value.toFixed(2).split('.');
  return (
    <span className={`cl-price ${className}`}>
      <span aria-hidden="true">
        ${Number(int).toLocaleString('es-MX')}
        <sup>{cents}</sup>
      </span>
      <span className="sr-only">{money(value)}</span>
    </span>
  );
}

// Al cliente no se le dice cuántas piezas hay: solo si está disponible, si quedan pocas o si se agotó
export const LOW_STOCK = 5;

export function Availability({ stock }: { stock: number }) {
  if (stock < 1) return <span className="cl-avail is-out">Agotado</span>;
  if (stock <= LOW_STOCK) return <span className="cl-avail is-low">¡Quedan pocas piezas!</span>;
  return <span className="cl-avail is-ok">Disponible</span>;
}

// Tarjeta compacta del catálogo: "+" para agregar y, ya en el carrito, selector de cantidad
export function ProductCard({ product: p }: { product: CatalogProduct }) {
  const cart = useCart();
  const { closed } = useCatalog();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const soldOut = p.stock < 1;
  const inCart = cart.qtyOf(p.id);
  const open = () => router.push(`/cliente/producto/${p.id}`);

  const add = () => {
    const added = cart.add(p);
    void toast({
      message: added ? `${p.name} en tu carrito` : `Ya tienes todas las piezas disponibles de ${p.name}`,
      duration: 1600,
      color: added ? 'success' : 'warning',
      position: 'top',
      cssClass: 'toast-app',
    });
  };

  return (
    <article className={`pc ${soldOut ? 'is-out' : ''}`}>
      <div className="pc-media">
        <button type="button" className="pc-open" onClick={open} aria-label={`${p.name}, ${money(p.price)}${soldOut ? ', agotado' : ''}`}>
          <ProductImage product={p} />
        </button>
        {soldOut ? (
          <span className="pc-soldout">Agotado</span>
        ) : inCart > 0 ? (
          <div className="pc-qty" role="group" aria-label={`Cantidad de ${p.name}`}>
            <button type="button" onClick={() => (inCart <= 1 ? cart.remove(p.id) : cart.setQty(p.id, inCart - 1))} aria-label={inCart <= 1 ? 'Quitar del carrito' : 'Quitar uno'}>
              <IonIcon icon={inCart <= 1 ? trashOutline : removeOutline} />
            </button>
            <output aria-live="polite">{inCart}</output>
            <button type="button" onClick={() => cart.add(p)} disabled={closed || inCart >= p.stock} aria-label="Agregar uno">
              <IonIcon icon={addOutline} />
            </button>
          </div>
        ) : closed ? null : (
          <button type="button" className="pc-add" onClick={add} aria-label={`Agregar ${p.name}`}>
            <IonIcon icon={addOutline} />
          </button>
        )}
      </div>
      <button type="button" className="pc-body" onClick={open} tabIndex={-1} aria-hidden="true">
        <Price value={p.price} className="pc-price" />
        <span className="pc-name">{p.name}</span>
        {!soldOut && p.stock <= LOW_STOCK && <span className="pc-left">Pocas piezas</span>}
      </button>
    </article>
  );
}

// La tienda no recibe pedidos: la caja no está conectada o ya cerró su turno
export function StoreClosed({ compact }: { compact?: boolean }) {
  const { store } = useCatalog();
  if (!store || store.abierta) return null;
  const shift = store.motivo === 'turno-cerrado';
  return (
    <section className={`cl-closed ${compact ? 'is-compact' : ''}`} role="status">
      <IonIcon icon={shift ? moonOutline : cloudOfflineOutline} aria-hidden="true" />
      <span>
        <strong>{shift ? 'La tienda está cerrada' : 'La tienda no está disponible'}</strong>
        <small>
          {shift ? 'Ya cerró su turno.' : 'Por ahora no tiene conexión.'} Puedes ver los productos, pero no hacer pedidos hasta que{' '}
          {shift ? 'vuelva a abrir' : 'se conecte de nuevo'}.
        </small>
      </span>
    </section>
  );
}

export function StatusChip({ status }: { status: OrderStatus }) {
  return <span className={`cl-chip is-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function QtyStepper({ value, min = 1, max, onChange, label }: { value: number; min?: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="cl-qty" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Quitar uno">
        <IonIcon icon={removeOutline} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Agregar uno">
        <IonIcon icon={addOutline} />
      </button>
    </div>
  );
}

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

import { IonIcon } from '@ionic/react';
import {
  addOutline,
  archiveOutline,
  basketOutline,
  cubeOutline,
  fastFoodOutline,
  iceCreamOutline,
  leafOutline,
  nutritionOutline,
  removeOutline,
  restaurantOutline,
  sparklesOutline,
  waterOutline,
} from 'ionicons/icons';
import { categoryColor } from '../../data/models';
import { STATUS_LABEL, type OrderStatus } from '../../api/types';

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

// Foto del producto o, si no tiene, el ícono de su categoría
export function ProductImage({ product, size }: { product: { name: string; category: string; photo?: string }; size?: number }) {
  const color = categoryColor(product.category);
  return (
    <span
      className="cl-img"
      style={{
        ...(size ? { width: size, height: size } : {}),
        color: `color-mix(in srgb, ${color} 80%, var(--ion-text-color))`,
        background: `color-mix(in srgb, ${color} 14%, var(--t-surface))`,
      }}
      aria-hidden="true"
    >
      {product.photo ? <img src={product.photo} alt="" /> : <IonIcon icon={CATEGORY_ICON[product.category] ?? cubeOutline} />}
    </span>
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

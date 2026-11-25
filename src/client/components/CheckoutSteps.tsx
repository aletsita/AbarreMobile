import { IonIcon } from '@ionic/react';
import { checkmark } from 'ionicons/icons';

const STEPS = ['Revisa', 'Paga', 'Recoge'] as const;

// Avance del pedido: revisar el carrito → pagar en línea → recoger en la tienda
export function CheckoutSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="cl-steps" aria-label="Pasos del pedido">
      {STEPS.map((s, i) => (
        <li key={s} className={i < current ? 'is-done' : i === current ? 'is-current' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="cl-steps-dot">{i < current ? <IonIcon icon={checkmark} aria-hidden="true" /> : i + 1}</span>
          <span className="cl-steps-label">{s}</span>
        </li>
      ))}
    </ol>
  );
}

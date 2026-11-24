import { IonButton, IonIcon, IonSpinner, useIonRouter, useIonToast } from '@ionic/react';
import { alertCircleOutline, cardOutline, checkmarkCircle, lockClosed, refreshOutline, returnDownBackOutline, timeOutline } from 'ionicons/icons';
import { useState } from 'react';
import { errorMessage } from '../../api/errors';
import { PAYMENT_STATUS_LABEL, type Order } from '../../api/types';
import { money } from '../../data/models';
import { useOrders } from '../lib/orders';

// Etiqueta corta para listas: "Pagado", "Pago pendiente"…
export function PaymentChip({ order }: { order: Order }) {
  if (!order.payment) return null;
  return <span className={`cl-pay-chip is-${order.payment.status}`}>{PAYMENT_STATUS_LABEL[order.payment.status]}</span>;
}

// Estado del pago en línea del pedido. La confirmación la da el servidor (webhook de Stripe): esta tarjeta
// solo la muestra, se actualiza en vivo y lleva a la pantalla de pago. `hero`: versión grande con el total,
// para la pantalla que se ve justo después de hacer el pedido.
export function PaymentStatus({ order, hero }: { order: Order; hero?: boolean }) {
  const { pay } = useOrders();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const [busy, setBusy] = useState(false);
  const p = order.payment;
  if (!p) return null;

  const retry = async () => {
    setBusy(true);
    try {
      await pay(order.id);
      router.push(`/cliente/pagar/${order.id}`);
    } catch (e) {
      void toast({ message: errorMessage(e, 'No pudimos abrir el pago.'), duration: 5000, color: 'danger', position: 'top', cssClass: 'toast-app' });
    } finally {
      setBusy(false);
    }
  };

  const pieces = order.items.reduce((n, i) => n + i.qty, 0);
  const amount = hero && (
    <div className="cl-paycard-amount">
      <span>Total</span>
      <strong className="money">{money(order.total)}</strong>
      <small>
        {pieces} {pieces === 1 ? 'pieza' : 'piezas'}
      </small>
    </div>
  );
  const safe = (
    <span className="cl-paycard-safe">
      <IonIcon icon={lockClosed} aria-hidden="true" /> Pago seguro con Stripe
    </span>
  );

  switch (p.status) {
    case 'pendiente_de_pago':
      return (
        <section className={`cl-paycard is-waiting ${hero ? 'is-hero' : ''}`} role="status">
          <span className="cl-paycard-icon">
            <IonIcon icon={hero ? cardOutline : timeOutline} aria-hidden="true" />
          </span>
          <h2>{hero ? 'Falta tu pago' : 'Esperando tu pago'}</h2>
          <p>Paga con tarjeta para que la tienda empiece tu pedido. Si ya pagaste, se confirma solo en unos segundos.</p>
          {amount}
          <IonButton expand="block" className="btn-lg" color="secondary" routerLink={`/cliente/pagar/${order.id}`}>
            <IonIcon slot="start" icon={cardOutline} />
            Pagar {money(order.total)}
          </IonButton>
          {safe}
        </section>
      );
    case 'fallido':
      return (
        <section className={`cl-paycard is-failed ${hero ? 'is-hero' : ''}`} role="alert">
          <span className="cl-paycard-icon">
            <IonIcon icon={alertCircleOutline} aria-hidden="true" />
          </span>
          <h2>El pago no se completó</h2>
          <p>No se te cobró nada. Inténtalo otra vez; la tienda verá tu pedido en cuanto se confirme el pago.</p>
          {amount}
          <IonButton expand="block" className="btn-lg" disabled={busy} onClick={() => void retry()}>
            {busy ? (
              <IonSpinner name="crescent" />
            ) : (
              <>
                <IonIcon slot="start" icon={refreshOutline} />
                Reintentar pago
              </>
            )}
          </IonButton>
          {safe}
        </section>
      );
    case 'pagado':
      return (
        <p className="cl-pay-ok">
          <span className="cl-pay-ok-icon">
            <IonIcon icon={checkmarkCircle} aria-hidden="true" />
          </span>
          <span>
            <strong>Pagado en línea · {money(p.amount ?? order.total)}</strong>
            <small>En la tienda no pagas nada: solo muestra tu código.</small>
          </span>
        </p>
      );
    case 'por_reembolsar':
    case 'reembolsado':
      return (
        <section className="cl-paycard is-refund" role="status">
          <span className="cl-paycard-icon">
            <IonIcon icon={returnDownBackOutline} aria-hidden="true" />
          </span>
          <h2>{p.status === 'reembolsado' ? 'Te devolvimos tu dinero' : 'Te devolveremos tu dinero'}</h2>
          <p>
            {p.status === 'reembolsado'
              ? `Se reembolsaron ${money(p.amount ?? order.total)} a tu tarjeta.`
              : `Tu pedido no se pudo surtir. La tienda devolverá ${money(p.amount ?? order.total)} a tu tarjeta; puede tardar algunos días en verse.`}
          </p>
        </section>
      );
  }
}

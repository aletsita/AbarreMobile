import { IonButton, IonIcon, IonSpinner, useIonRouter, useIonToast } from '@ionic/react';
import { alertCircleOutline, cardOutline, checkmarkCircle, refreshOutline, returnDownBackOutline } from 'ionicons/icons';
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

// Estado del pago en línea del pedido. La confirmación la da el servidor (webhook de Stripe): esta pantalla
// solo la muestra, se actualiza en vivo y deja abrir o reintentar el pago.
export function PaymentStatus({ order }: { order: Order }) {
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

  switch (p.status) {
    case 'pendiente_de_pago':
      return (
        <section className="card cl-pay is-waiting" role="status">
          <div className="cl-pay-head">
            <IonSpinner name="crescent" />
            <div>
              <h2>Esperando tu pago</h2>
              <p>Paga con tarjeta aquí mismo, en el recuadro seguro de Stripe. Si ya pagaste, la confirmación llega sola en unos segundos.</p>
            </div>
          </div>
          <IonButton expand="block" className="btn-lg" routerLink={`/cliente/pagar/${order.id}`}>
            <IonIcon slot="start" icon={cardOutline} />
            Pagar {money(order.total)}
          </IonButton>
        </section>
      );
    case 'fallido':
      return (
        <section className="card cl-pay is-failed" role="alert">
          <div className="cl-pay-head">
            <IonIcon icon={alertCircleOutline} aria-hidden="true" />
            <div>
              <h2>El pago no se completó</h2>
              <p>No se te cobró nada. Puedes intentarlo otra vez; la tienda no verá tu pedido hasta que se confirme el pago.</p>
            </div>
          </div>
          <IonButton expand="block" className="btn-lg" disabled={busy} onClick={() => void retry()}>
            {busy ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={refreshOutline} />Reintentar pago</>}
          </IonButton>
        </section>
      );
    case 'pagado':
      return (
        <p className="cl-pay-ok">
          <IonIcon icon={checkmarkCircle} aria-hidden="true" />
          <span>
            <strong>Pagado en línea</strong> · {money(p.amount ?? order.total)}. En la tienda no pagas nada: solo muestra tu código.
          </span>
        </p>
      );
    case 'por_reembolsar':
    case 'reembolsado':
      return (
        <section className="card cl-pay is-refund" role="status">
          <div className="cl-pay-head">
            <IonIcon icon={returnDownBackOutline} aria-hidden="true" />
            <div>
              <h2>{p.status === 'reembolsado' ? 'Te devolvimos tu dinero' : 'Te devolveremos tu dinero'}</h2>
              <p>
                {p.status === 'reembolsado'
                  ? `Se reembolsaron ${money(p.amount ?? order.total)} a tu tarjeta.`
                  : `Tu pedido no se pudo surtir. La tienda devolverá ${money(p.amount ?? order.total)} a tu tarjeta; puede tardar algunos días en verse.`}
              </p>
            </div>
          </div>
        </section>
      );
  }
}

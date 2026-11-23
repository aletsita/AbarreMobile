import { IonButton, IonContent, IonIcon, IonPage, useIonAlert, useIonToast } from '@ionic/react';
import { checkmarkCircle, cardOutline } from 'ionicons/icons';
import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { money } from '../../data/models';
import { PaymentStatus } from '../components/PaymentStatus';
import { PickupCode } from '../components/PickupCode';
import { StatusChip } from '../components/ui';
import { useOrders } from '../lib/orders';
import { alreadyAsked, declineNotify, notifyPermission, requestNotify } from '../lib/notify';

export default function PedidoCreado() {
  const { id } = useParams<{ id: string }>();
  const { orders } = useOrders();
  const order = orders.find((o) => o.id === id);
  const [alert] = useIonAlert();
  const [toast] = useIonToast();
  const asked = useRef(false);

  // Momento oportuno para pedir el permiso de notificaciones: justo después del primer pedido,
  // con una explicación antes del diálogo del sistema (Android 13+)
  useEffect(() => {
    // Se pide hasta que el pago esté confirmado: antes no hay nada que avisar
    if (!order || asked.current || (order.payment && order.payment.status !== 'pagado')) return;
    asked.current = true;
    void (async () => {
      if ((await notifyPermission()) !== 'prompt' || (await alreadyAsked())) return;
      await new Promise((r) => setTimeout(r, 700));
      void alert({
        header: '¿Te avisamos cuando esté listo?',
        message: 'Te mandamos una notificación cuando la tienda prepare tu pedido y cuando puedas pasar a recogerlo. Nada más.',
        backdropDismiss: false,
        buttons: [
          { text: 'Ahora no', role: 'cancel', handler: () => void declineNotify() },
          {
            text: 'Sí, avisarme',
            handler: () => {
              void requestNotify().then((p) => {
                if (p === 'denied') {
                  void toast({
                    message: 'No recibirás avisos. Puedes activarlos en Ajustes del teléfono › Apps › Abarré › Notificaciones. Mientras, revisa «Mis pedidos».',
                    duration: 6000,
                    color: 'warning',
                    position: 'top',
                    cssClass: 'toast-app',
                  });
                }
              });
            },
          },
        ],
      });
    })();
  }, [order?.id, order?.payment?.status]);

  const paying = !!order?.payment && order.payment.status !== 'pagado';

  return (
    <IonPage>
      <AppHeader title={paying ? 'Pagar pedido' : 'Pedido enviado'} />
      <IonContent>
        <div className="page-pad is-narrow">
          {order && paying ? (
            <div className="stack">
              <section className="card cl-created">
                <span className="cl-created-icon is-pay"><IonIcon icon={cardOutline} /></span>
                <h1>Falta tu pago</h1>
                <p className="muted">
                  {order.items.reduce((n, i) => n + i.qty, 0)} piezas · <span className="money">{money(order.total)}</span>
                </p>
              </section>
              <PaymentStatus order={order} />
              <IonButton expand="block" fill="clear" className="btn-lg" routerLink="/cliente/pedidos" routerDirection="root">
                Ver mis pedidos
              </IonButton>
            </div>
          ) : order ? (
            <section className="card cl-created">
              <span className="cl-created-icon"><IonIcon icon={checkmarkCircle} /></span>
              <h1>{order.payment ? '¡Pago confirmado!' : '¡Recibimos tu pedido!'}</h1>
              {order.folio && (
                <p className="cl-folio">
                  Folio <strong>{order.folio}</strong>
                </p>
              )}
              <StatusChip status={order.status} />
              <p className="muted">
                {order.items.reduce((n, i) => n + i.qty, 0)} piezas · <span className="money">{money(order.total)}</span>
                {order.payment ? ' pagados en línea.' : ' a pagar al recoger en la tienda.'}
              </p>
              {order.payment && <PickupCode order={order} />}
              <p className="muted">Te avisaremos cuando cambie de estado. También puedes verlo en «Mis pedidos».</p>
              <IonButton expand="block" className="btn-xl" routerLink={`/cliente/pedido/${order.id}`}>
                Ver mi pedido
              </IonButton>
              <IonButton expand="block" fill="clear" className="btn-lg" routerLink="/cliente/tienda" routerDirection="root">
                Seguir comprando
              </IonButton>
            </section>
          ) : (
            <EmptyState art="search" title="No encontramos ese pedido" action={<IonButton routerLink="/cliente/pedidos" routerDirection="root">Ver mis pedidos</IonButton>} />
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

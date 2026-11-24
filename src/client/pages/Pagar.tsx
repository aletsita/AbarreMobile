import { IonButton, IonContent, IonIcon, IonPage, IonSpinner, useIonRouter } from '@ionic/react';
import { alertCircleOutline, lockClosedOutline, refreshOutline } from 'ionicons/icons';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { errorMessage } from '../../api/errors';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { money } from '../../data/models';
import { useOrders } from '../lib/orders';
import { mountPayment } from '../lib/payment';

// Pantalla de pago dentro de la app. Stripe pinta el formulario de la tarjeta (con 3D Secure si el banco lo pide);
// al terminar regresa al pedido, que pasa a «Pagado» cuando el servidor recibe la confirmación de Stripe.
export default function Pagar() {
  const { id } = useParams<{ id: string }>();
  const { orders, pay, load } = useOrders();
  const order = orders.find((o) => o.id === id);
  const router = useIonRouter();
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'cargando' | 'listo' | 'terminado' | { error: string }>('cargando');
  const [attempt, setAttempt] = useState(0);

  const secret = order?.paymentClientSecret;
  const status = order?.payment?.status;
  const done = () => router.push(`/cliente/pedido-creado/${id}`, 'root', 'replace');

  // Ya pagado (por ejemplo, llegó la confirmación mientras estaba abierta): directo al pedido
  useEffect(() => {
    if (status === 'pagado' || status === 'por_reembolsar') done();
  }, [status]);

  // Sin sesión abierta (vencida o fallida) se pide una nueva al servidor; si sigue abierta regresa la misma
  useEffect(() => {
    if (!order || secret || status === 'pagado') return;
    setState('cargando');
    pay(id)
      .then((o) => !o.paymentClientSecret && o.payment?.status !== 'pagado' && setState({ error: 'El proveedor de pagos no respondió. Inténtalo en un momento.' }))
      .catch((e) => setState({ error: errorMessage(e, 'No pudimos abrir el pago.') }));
  }, [order?.id, secret, attempt]);

  useEffect(() => {
    if (!secret || !box.current) return;
    let destroy: (() => void) | undefined;
    let gone = false;
    setState('cargando');
    mountPayment(box.current, secret, () => {
      setState('terminado');
      // Pregunta al servidor de una vez (si el webhook tarda, el servidor lo confirma con Stripe)
      void load(id).catch(() => undefined);
      setTimeout(done, 1200);
    })
      .then((d) => {
        if (gone) d();
        else {
          destroy = d;
          setState('listo');
        }
      })
      .catch((e: unknown) => !gone && setState({ error: e instanceof Error ? e.message : 'No se pudo cargar el pago.' }));
    return () => {
      gone = true;
      destroy?.();
    };
  }, [secret, attempt]);

  if (!order) {
    return (
      <IonPage>
        <AppHeader title="Pagar pedido" backHref="/cliente/pedidos" />
        <IonContent>
          <EmptyState
            art="search"
            title="No encontramos ese pedido"
            action={<IonButton routerLink="/cliente/pedidos" routerDirection="root">Ver mis pedidos</IonButton>}
          />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <AppHeader title="Pagar pedido" backHref={`/cliente/pedido-creado/${id}`} />
      <IonContent>
        <div className="page-pad is-narrow stack">
          <section className="card cl-paybox-head">
            <span className="muted">Total a pagar</span>
            <strong className="money">{money(order.total)}</strong>
            <span className="muted cl-paybox-safe">
              <IonIcon icon={lockClosedOutline} aria-hidden="true" /> Pago seguro con Stripe · modo de pruebas
            </span>
          </section>

          {typeof state === 'object' ? (
            <section className="card cl-pay is-failed" role="alert">
              <div className="cl-pay-head">
                <IonIcon icon={alertCircleOutline} aria-hidden="true" />
                <div>
                  <h2>No se pudo abrir el pago</h2>
                  <p>{state.error}</p>
                </div>
              </div>
              <IonButton expand="block" className="btn-lg" onClick={() => setAttempt((n) => n + 1)}>
                <IonIcon slot="start" icon={refreshOutline} />
                Intentar otra vez
              </IonButton>
            </section>
          ) : state === 'terminado' ? (
            <div className="cl-paybox-wait" role="status">
              <IonSpinner name="crescent" />
              <p>Confirmando tu pago…</p>
            </div>
          ) : state === 'cargando' ? (
            <div className="cl-paybox-wait" role="status">
              <IonSpinner name="crescent" />
              <p>Cargando el pago…</p>
            </div>
          ) : null}

          {/* Stripe monta aquí su formulario; se oculta mientras carga o si hubo error */}
          <div ref={box} className="cl-paybox" hidden={state !== 'listo'} />
        </div>
      </IonContent>
    </IonPage>
  );
}

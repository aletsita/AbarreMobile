import { IonButton, IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/react';
import { alertCircleOutline, bagHandleOutline, checkmark, lockClosed, refreshOutline, storefrontOutline } from 'ionicons/icons';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { errorMessage } from '../../api/errors';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { money } from '../../data/models';
import { CheckoutSteps } from '../components/CheckoutSteps';
import { useOrders } from '../lib/orders';
import { mountPayment } from '../lib/payment';

type State = 'cargando' | 'listo' | 'confirmando' | 'tardando' | 'pagado' | { error: string };

// Cada cuánto se pregunta por el pedido después de pagar y cuánto se espera antes de dejar ir al cliente
const POLL_MS = 1500;
const SLOW_MS = 25000;

// Pantalla de pago dentro de la app. Stripe pinta el formulario de la tarjeta (con 3D Secure si el banco lo pide);
// al terminar se pregunta al servidor hasta que confirma el pago y se pasa al pedido con su código para recoger.
export default function Pagar() {
  const { id } = useParams<{ id: string }>();
  const { orders, pay, load } = useOrders();
  const order = orders.find((o) => o.id === id);
  const router = useIonRouter();
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>('cargando');
  const [attempt, setAttempt] = useState(0);

  const secret = order?.paymentClientSecret;
  const status = order?.payment?.status;
  const toOrder = () => router.push(`/cliente/pedido-creado/${id}`, 'root', 'replace');

  // Confirmado (por la consulta, por el aviso en vivo o porque ya estaba pagado): breve palomita y al pedido
  useEffect(() => {
    if (status !== 'pagado' && status !== 'por_reembolsar') return;
    setState('pagado');
    const t = setTimeout(toOrder, 900);
    return () => clearTimeout(t);
  }, [status]);

  // Sin sesión abierta (vencida o fallida) se pide una nueva al servidor; si sigue abierta regresa la misma
  useEffect(() => {
    if (!order || secret || status === 'pagado') return;
    let gone = false;
    setState('cargando');
    pay(id)
      .then((o) => {
        if (!gone && !o.paymentClientSecret && o.payment?.status !== 'pagado') setState({ error: 'El proveedor de pagos no respondió. Inténtalo en un momento.' });
      })
      .catch((e) => !gone && setState({ error: errorMessage(e, 'No pudimos abrir el pago.') }));
    return () => {
      gone = true;
    };
  }, [order?.id, secret, attempt]);

  useEffect(() => {
    if (!secret || !box.current || status === 'pagado') return;
    let gone = false;
    let destroy: (() => void) | undefined;
    setState('cargando');
    mountPayment(box.current, secret, () => !gone && setState('confirmando'), () => gone)
      .then((d) => {
        if (gone) return d();
        destroy = d;
        setState('listo');
      })
      .catch((e: unknown) => !gone && setState({ error: e instanceof Error ? e.message : 'No se pudo cargar el pago.' }));
    return () => {
      gone = true;
      destroy?.();
    };
  }, [secret, attempt]);

  // Tras pagar: se pregunta al servidor (que a su vez confirma con Stripe) hasta que el pedido sale pagado
  const waiting = state === 'confirmando' || state === 'tardando';
  useEffect(() => {
    if (!waiting) return;
    const ask = () => void load(id).catch(() => undefined);
    ask();
    const poll = setInterval(ask, POLL_MS);
    const slow = setTimeout(() => setState((s) => (s === 'confirmando' ? 'tardando' : s)), SLOW_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(slow);
    };
  }, [waiting]);

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

  const pieces = order.items.reduce((n, i) => n + i.qty, 0);
  const finishing = waiting || state === 'pagado';

  return (
    <IonPage>
      <AppHeader title="Pagar pedido" backHref={finishing ? undefined : `/cliente/pedido-creado/${id}`} />
      <IonContent>
        <div className="page-pad is-narrow stack">
          <CheckoutSteps current={state === 'pagado' ? 2 : 1} />

          {finishing ? (
            <section className={`card cl-confirming ${state === 'pagado' ? 'is-done' : ''}`} role="status" aria-live="polite">
              <span className="cl-confirming-ring">
                {state === 'pagado' ? <IonIcon icon={checkmark} aria-hidden="true" /> : <span className="cl-confirming-spin" aria-hidden="true" />}
              </span>
              <h1>{state === 'pagado' ? '¡Pago confirmado!' : state === 'tardando' ? 'Seguimos confirmando' : 'Confirmando tu pago'}</h1>
              <p className="muted">
                {state === 'pagado'
                  ? 'Ya tienes tu código para recoger.'
                  : state === 'tardando'
                    ? 'Tu pago está hecho; la confirmación está tardando un poco más. Te avisamos en cuanto llegue.'
                    : 'Esto toma solo unos segundos. No cierres la app.'}
              </p>
              <strong className="money cl-confirming-amount">{money(order.total)}</strong>
              {state === 'tardando' && (
                <IonButton expand="block" className="btn-lg" onClick={toOrder}>
                  Ver mi pedido
                </IonButton>
              )}
            </section>
          ) : (
            <>
              <section className="cl-payhero">
                <div className="cl-payhero-top">
                  <span className="cl-payhero-label">Total a pagar</span>
                  <span className="cl-payhero-safe">
                    <IonIcon icon={lockClosed} aria-hidden="true" /> Pago seguro
                  </span>
                </div>
                <strong className="money cl-payhero-amount">{money(order.total)}</strong>
                <div className="cl-payhero-meta">
                  <span>
                    <IonIcon icon={bagHandleOutline} aria-hidden="true" /> {pieces} {pieces === 1 ? 'pieza' : 'piezas'}
                  </span>
                  <span>
                    <IonIcon icon={storefrontOutline} aria-hidden="true" /> Recoges en la tienda
                  </span>
                </div>
              </section>

              {typeof state === 'object' && (
                <section className="cl-alert is-danger" role="alert">
                  <span className="cl-alert-icon">
                    <IonIcon icon={alertCircleOutline} aria-hidden="true" />
                  </span>
                  <div className="cl-alert-body">
                    <strong>No se pudo abrir el pago</strong>
                    <p>{state.error} No se te cobró nada.</p>
                    <IonButton size="small" className="cl-alert-btn" onClick={() => setAttempt((n) => n + 1)}>
                      <IonIcon slot="start" icon={refreshOutline} />
                      Intentar otra vez
                    </IonButton>
                  </div>
                </section>
              )}

              <section className="card cl-paybox" hidden={typeof state === 'object'}>
                {state === 'cargando' && (
                  <div className="cl-paybox-skeleton" role="status" aria-label="Cargando el pago">
                    <span />
                    <span />
                    <span className="is-half" />
                    <span className="is-btn" />
                  </div>
                )}
                {/* Stripe monta aquí su formulario */}
                <div ref={box} className="cl-paybox-frame" />
              </section>

              <p className="cl-paybox-foot">
                <IonIcon icon={lockClosed} aria-hidden="true" /> Stripe procesa tu tarjeta; la tienda nunca ve sus datos.
              </p>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

import { IonButton, IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, useIonAlert, useIonRouter, useIonToast } from '@ionic/react';
import { alertCircleOutline, cashOutline, checkmarkOutline, closeCircleOutline, createOutline, removeCircleOutline, swapHorizontalOutline, trashOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, errorMessage } from '../../api/errors';
import { hasIssue, ORDER_STEPS, STATUS_LABEL, type Order, type OrderStatus } from '../../api/types';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { money } from '../../data/models';
import { PickupCode } from '../components/PickupCode';
import { dateTime, StatusChip } from '../components/ui';
import { useCatalog } from '../lib/catalog';
import { useOrders } from '../lib/orders';

const STEP_TEXT: Record<OrderStatus, string> = {
  pendiente: 'La tienda recibió tu pedido.',
  preparando: 'Están juntando tus productos.',
  listo: 'Ya puedes pasar a recogerlo y pagar en la tienda. Muestra tu código en la caja.',
  entregado: 'Recogiste tu pedido. ¡Gracias!',
  cancelado: 'La tienda canceló tu pedido.',
};

// La tienda avisó que se agotó algo. El pedido sigue en pie: el cliente elige otro producto, quita lo
// agotado y sigue con lo demás, o cancela el pedido.
function IssueNotice({ order }: { order: Order }) {
  const { change, cancel: cancelOrder } = useOrders();
  const { closed } = useCatalog();
  const [alert] = useIonAlert();
  const [toast] = useIonToast();
  const [busy, setBusy] = useState(false);
  const missingIds = order.issue?.missing ?? [];
  const missing = order.items.filter((i) => missingIds.includes(i.productId));
  const kept = order.items.filter((i) => !missingIds.includes(i.productId));

  const run = async (fn: () => Promise<Order>, done: string) => {
    setBusy(true);
    try {
      await fn();
      void toast({ message: done, duration: 2500, color: 'success', position: 'top', cssClass: 'toast-app' });
    } catch (e) {
      void toast({ message: errorMessage(e, 'No pudimos avisar a la tienda.'), duration: 4000, color: 'danger', position: 'top', cssClass: 'toast-app' });
    } finally {
      setBusy(false);
    }
  };

  const removeMissing = () =>
    alert({
      header: 'Quitar lo agotado',
      message: `Tu pedido seguirá con ${kept.length} ${kept.length === 1 ? 'producto' : 'productos'}.`,
      buttons: [
        { text: 'Volver', role: 'cancel' },
        {
          text: 'Quitar y seguir',
          handler: () => void run(() => change(order.id, kept.map((i) => ({ productId: i.productId, qty: i.qty }))), 'Listo. La tienda sigue con tu pedido.'),
        },
      ],
    });

  const cancel = () =>
    alert({
      header: '¿Cancelar tu pedido?',
      message: 'La tienda dejará de prepararlo. No se te cobra nada.',
      buttons: [
        { text: 'Volver', role: 'cancel' },
        { text: 'Cancelar pedido', role: 'destructive', handler: () => void run(() => cancelOrder(order.id), `Cancelaste el pedido ${order.folio}`) },
      ],
    });

  return (
    <section className="card cl-cancel is-issue" role="alert">
      <div className="cl-cancel-head">
        <IonIcon icon={alertCircleOutline} aria-hidden="true" />
        <div>
          <h2>{missing.length === 1 ? 'Se agotó un producto de tu pedido' : 'Se agotaron productos de tu pedido'}</h2>
          <p>Tu pedido sigue en pie. Elige otro producto en su lugar (otra marca u otro tamaño), quítalo y sigue con lo demás, o cancela el pedido.</p>
        </div>
      </div>
      <ul>
        {missing.map((i) => (
          <li key={i.productId}>
            <strong>{i.qty} ×</strong> {i.name}
            <em>Agotado</em>
          </li>
        ))}
      </ul>
      {closed && <p className="cl-cancel-done">La tienda está cerrada por ahora. Podrás responder cuando vuelva a abrir.</p>}
      <IonButton expand="block" className="btn-lg" routerLink={`/cliente/pedido/${order.id}/cambiar`} disabled={busy || closed}>
        <IonIcon slot="start" icon={swapHorizontalOutline} />
        Elegir otro producto
      </IonButton>
      {kept.length > 0 && (
        <IonButton expand="block" fill="outline" className="btn-lg" disabled={busy || closed} onClick={removeMissing}>
          <IonIcon slot="start" icon={removeCircleOutline} />
          Quitar lo agotado y seguir
        </IonButton>
      )}
      <IonButton expand="block" fill="clear" color="danger" className="btn-lg" disabled={busy} onClick={cancel}>
        <IonIcon slot="start" icon={trashOutline} />
        Cancelar pedido
      </IonButton>
    </section>
  );
}

// Pedido cancelado (por la tienda o por el cliente)
// El cliente puede cancelar mientras la tienda no se lo entregue
function CancelButton({ order }: { order: Order }) {
  const { cancel } = useOrders();
  const [alert] = useIonAlert();
  const [toast] = useIonToast();
  const [busy, setBusy] = useState(false);

  const confirm = () =>
    alert({
      header: `¿Cancelar el pedido ${order.folio}?`,
      message: order.status === 'pendiente' ? 'La tienda todavía no lo empieza. No se te cobra nada.' : 'La tienda ya lo está preparando. Al cancelarlo deja de prepararlo y no se te cobra nada.',
      buttons: [
        { text: 'Volver', role: 'cancel' },
        {
          text: 'Cancelar pedido',
          role: 'destructive',
          handler: async () => {
            setBusy(true);
            try {
              await cancel(order.id);
              void toast({ message: `Cancelaste el pedido ${order.folio}`, duration: 2500, color: 'success', position: 'top', cssClass: 'toast-app' });
            } catch (e) {
              void toast({ message: errorMessage(e, 'No pudimos cancelar tu pedido.'), duration: 4000, color: 'danger', position: 'top', cssClass: 'toast-app' });
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    });

  return (
    <IonButton expand="block" fill="outline" color="danger" className="cl-cancel-order" disabled={busy} onClick={confirm}>
      <IonIcon slot="start" icon={closeCircleOutline} />
      Cancelar pedido
    </IonButton>
  );
}

function CancelNotice({ order }: { order: Order }) {
  const { dismiss } = useOrders();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const [busy, setBusy] = useState(false);
  const reason = order.cancel?.reason;
  const missing = order.items.filter((i) => order.cancel?.missing.includes(i.productId));

  const hide = async () => {
    setBusy(true);
    try {
      await dismiss(order.id);
      router.push('/cliente/pedidos', 'back');
    } catch (e) {
      void toast({ message: errorMessage(e), duration: 3500, color: 'danger', position: 'top', cssClass: 'toast-app' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card cl-cancel" role="alert">
      <div className="cl-cancel-head">
        <IonIcon icon={closeCircleOutline} aria-hidden="true" />
        <div>
          <h2>{reason === 'cliente' ? 'Cancelaste este pedido' : 'La tienda canceló tu pedido'}</h2>
          <p>
            {reason === 'cliente'
              ? 'La tienda ya no lo va a preparar. No se te cobró nada.'
              : order.cancel?.note
                ? `Motivo: ${order.cancel.note}`
                : reason === 'sin-existencia'
                  ? 'Se agotaron productos de tu pedido.'
                  : 'Si tienes dudas, llama a la tienda.'}
          </p>
        </div>
      </div>
      {missing.length > 0 && (
        <ul>
          {missing.map((i) => (
            <li key={i.productId}>
              <strong>{i.qty} ×</strong> {i.name}
              <em>Agotado</em>
            </li>
          ))}
        </ul>
      )}
      {!order.resolved && reason !== 'cliente' && (
        <IonButton expand="block" fill="outline" className="btn-lg" disabled={busy} onClick={() => void hide()}>
          <IonIcon slot="start" icon={checkmarkOutline} />
          Entendido, pasarlo al historial
        </IonButton>
      )}
    </section>
  );
}

export default function PedidoDetalle() {
  const { id } = useParams<{ id: string }>();
  const { orders, load: loadOrder } = useOrders();
  const order = orders.find((o) => o.id === id);
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState<string | null>(null);

  // Al abrir desde una notificación puede que la lista aún no lo tenga: se pide al servidor
  const load = async () => {
    try {
      await loadOrder(id);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? 'No encontramos ese pedido.' : errorMessage(e, 'No pudimos cargar el pedido.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  if (!order) {
    return (
      <IonPage>
        <AppHeader title="Pedido" backHref="/cliente/pedidos" />
        <IonContent>
          {loading ? (
            <div className="cl-center" role="status">
              <IonSpinner name="crescent" />
              Cargando pedido…
            </div>
          ) : (
            <EmptyState
              art={error === 'No encontramos ese pedido.' ? 'search' : 'error'}
              title={error ?? 'No encontramos ese pedido'}
              action={<IonButton routerLink="/cliente/pedidos" routerDirection="root">Ver mis pedidos</IonButton>}
            />
          )}
        </IonContent>
      </IonPage>
    );
  }

  const reached = ORDER_STEPS.indexOf(order.status);
  const at = (s: string) => order.history.find((h) => h.status === s)?.at;

  return (
    <IonPage>
      <AppHeader title={`Pedido ${order.folio}`} backHref="/cliente/pedidos" />
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void load().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="page-pad is-narrow stack">
          {error && <p className="cl-stale" role="status">No se pudo actualizar: {error}</p>}
          <section className="card cl-head">
            <div>
              <span className="muted">Hecho el {dateTime(order.createdAt)}</span>
              <StatusChip status={order.status} />
            </div>
            <strong className="money">{money(order.total)}</strong>
          </section>

          {hasIssue(order) && <IssueNotice order={order} />}
          {order.status === 'cancelado' && <CancelNotice order={order} />}
          {order.editedAt && !hasIssue(order) && order.status !== 'cancelado' && (
            <p className="cl-edited">
              <IonIcon icon={createOutline} aria-hidden="true" />
              Cambiaste los productos de tu pedido el {dateTime(order.editedAt)}.
            </p>
          )}
          {order.status !== 'entregado' && order.status !== 'cancelado' && <PickupCode order={order} />}

          {order.status !== 'cancelado' && <section className="card">
            <h2 className="section-title">Seguimiento</h2>
            <ol className="cl-timeline">
              {ORDER_STEPS.map((s, i) => {
                const when = at(s);
                const state = i < reached ? 'is-done' : i === reached ? 'is-now' : '';
                return (
                  <li key={s} className={state}>
                    <span className="cl-tl-dot">{i <= reached && <IonIcon icon={checkmarkOutline} />}</span>
                    <div>
                      <strong>{STATUS_LABEL[s]}</strong>
                      {i === reached && <p>{STEP_TEXT[s]}</p>}
                      {when && <small className="muted">{dateTime(when)}</small>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>}

          <section className="card cl-summary">
            <h2 className="section-title">Productos</h2>
            <ul>
              {order.items.map((it) => (
                <li key={it.productId} className={hasIssue(order) && order.issue!.missing.includes(it.productId) ? 'is-out' : ''}>
                  <span>
                    <strong>{it.qty} ×</strong> {it.name}
                  </span>
                  <span className="money">{money(it.price * it.qty)}</span>
                </li>
              ))}
            </ul>
            {order.note && <p className="cl-note">Tu nota: {order.note}</p>}
            <div className="cl-summary-total">
              <span>Total</span>
              <strong className="money">{money(order.total)}</strong>
            </div>
          </section>

          {order.status !== 'entregado' && order.status !== 'cancelado' && (
            <div className="cl-pickup">
              <IonIcon icon={cashOutline} />
              <span><strong>Pago al recoger</strong> en la tienda.</span>
            </div>
          )}
          {order.status !== 'entregado' && order.status !== 'cancelado' && !hasIssue(order) && <CancelButton order={order} />}
        </div>
      </IonContent>
    </IonPage>
  );
}

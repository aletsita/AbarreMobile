import { IonButton, IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, useIonAlert, useIonRouter, useIonToast } from '@ionic/react';
import { cashOutline, checkmarkOutline, closeCircleOutline, swapHorizontalOutline, trashOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { ApiError, errorMessage } from '../../api/errors';
import { ORDER_STEPS, STATUS_LABEL, type Order, type OrderStatus } from '../../api/types';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { money } from '../../data/models';
import { PickupCode } from '../components/PickupCode';
import { dateTime, StatusChip } from '../components/ui';
import { useOrders } from '../lib/orders';

const STEP_TEXT: Record<OrderStatus, string> = {
  pendiente: 'La tienda recibió tu pedido.',
  preparando: 'Están juntando tus productos.',
  listo: 'Ya puedes pasar a recogerlo y pagar en la tienda. Muestra tu código en la caja.',
  entregado: 'Recogiste tu pedido. ¡Gracias!',
  cancelado: 'La tienda canceló tu pedido.',
};

// La tienda canceló el pedido. Si fue porque se agotó algo, el cliente decide: elegir otro producto o quitar el pedido.
function CancelNotice({ order }: { order: Order }) {
  const { upsert } = useOrders();
  const router = useIonRouter();
  const [alert] = useIonAlert();
  const [toast] = useIonToast();
  const [busy, setBusy] = useState(false);
  const stock = order.cancel?.reason === 'sin-existencia';
  const missing = order.items.filter((i) => order.cancel?.missing.includes(i.productId));

  const remove = async () => {
    setBusy(true);
    try {
      upsert(await api.resolveOrder(order.id, 'quitar'));
      void toast({ message: `Quitaste el pedido ${order.folio}`, duration: 2500, position: 'top', cssClass: 'toast-app' });
      router.push('/cliente/pedidos', 'back');
    } catch (e) {
      void toast({ message: errorMessage(e), duration: 3500, color: 'danger', position: 'top', cssClass: 'toast-app' });
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = () =>
    alert({
      header: '¿Quitar este pedido?',
      message: 'Pasará a tu historial. No se te cobra nada.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Quitar pedido', role: 'destructive', handler: () => void remove() },
      ],
    });

  return (
    <section className="card cl-cancel" role="alert">
      <div className="cl-cancel-head">
        <IonIcon icon={closeCircleOutline} aria-hidden="true" />
        <div>
          <h2>{stock ? 'Se agotó un producto de tu pedido' : 'La tienda canceló tu pedido'}</h2>
          <p>
            {stock
              ? 'Lo sentimos, la tienda ya no tiene lo siguiente. Puedes elegir otro producto (otra marca u otro tamaño) o quitar el pedido.'
              : order.cancel?.note
                ? `Motivo: ${order.cancel.note}`
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
      {order.resolved ? (
        <p className="cl-cancel-done">
          {order.resolved.action === 'quitar' ? 'Quitaste este pedido.' : 'Elegiste otros productos para un pedido nuevo.'}
        </p>
      ) : (
        <>
          <IonButton expand="block" className="btn-lg" routerLink={`/cliente/pedido/${order.id}/cambiar`}>
            <IonIcon slot="start" icon={swapHorizontalOutline} />
            {stock ? 'Elegir otro producto' : 'Volver a pedir'}
          </IonButton>
          <IonButton expand="block" fill="outline" color="danger" className="btn-lg" disabled={busy} onClick={confirmRemove}>
            <IonIcon slot="start" icon={trashOutline} />
            Quitar pedido
          </IonButton>
        </>
      )}
    </section>
  );
}

export default function PedidoDetalle() {
  const { id } = useParams<{ id: string }>();
  const { orders, upsert } = useOrders();
  const order = orders.find((o) => o.id === id);
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState<string | null>(null);

  // Al abrir desde una notificación puede que la lista aún no lo tenga: se pide al servidor
  const load = async () => {
    try {
      upsert(await api.order(id));
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

          {order.status === 'cancelado' && <CancelNotice order={order} />}
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
                <li key={it.productId}>
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
        </div>
      </IonContent>
    </IonPage>
  );
}

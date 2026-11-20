import { IonButton, IonContent, IonIcon, IonLabel, IonPage, IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonSpinner, useIonRouter } from '@ionic/react';
import { chevronForward } from 'ionicons/icons';
import { useState } from 'react';
import { isActive } from '../../api/types';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { money } from '../../data/models';
import { dateTime, StatusChip } from '../components/ui';
import { useOrders } from '../lib/orders';

type Tab = 'activos' | 'historial';

export default function Pedidos() {
  const { orders, loading, loaded, error, live, refresh } = useOrders();
  const router = useIonRouter();
  const [tab, setTab] = useState<Tab>('activos');
  const list = orders.filter((o) => (tab === 'activos' ? isActive(o) : !isActive(o)));

  let body;
  if (!loaded && loading) {
    body = (
      <div className="cl-center" role="status">
        <IonSpinner name="crescent" />
        Cargando tus pedidos…
      </div>
    );
  } else if (!loaded && error) {
    body = <EmptyState art="error" title="No pudimos cargar tus pedidos" text={error} action={<IonButton onClick={() => void refresh()}>Reintentar</IonButton>} />;
  } else if (!list.length) {
    body =
      tab === 'activos' ? (
        <EmptyState
          art="cart"
          title="No tienes pedidos en curso"
          text="Cuando hagas un pedido, aquí verás cómo va."
          action={<IonButton routerLink="/cliente/tienda" routerDirection="root">Ir a la tienda</IonButton>}
        />
      ) : (
        <EmptyState art="box" title="Aún no hay pedidos entregados" text="Aquí quedan los pedidos que ya recogiste." />
      );
  } else {
    body = (
      <ul className="cl-orders">
        {list.map((o) => (
          <li key={o.id}>
            <button type="button" className="card cl-order" onClick={() => router.push(`/cliente/pedido/${o.id}`)}>
              <span className="cl-order-main">
                <strong>Pedido #{o.folio}</strong>
                <span className="muted">
                  {dateTime(o.createdAt)} · {o.items.reduce((n, i) => n + i.qty, 0)} piezas
                </span>
                <StatusChip status={o.status} />
              </span>
              <span className="money">{money(o.total)}</span>
              <IonIcon icon={chevronForward} className="muted" />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <IonPage>
      <AppHeader title="Mis pedidos" offlineMessage="lo que ves puede no estar al día">
        <div className="cl-tabs">
          <IonSegment value={tab} onIonChange={(e) => setTab(e.detail.value as Tab)}>
            <IonSegmentButton value="activos">
              <IonLabel>Activos</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="historial">
              <IonLabel>Historial</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>
      </AppHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void refresh().finally(() => e.detail.complete())}>
          <IonRefresherContent pullingText="Jala para actualizar" refreshingText="Actualizando…" />
        </IonRefresher>
        <div className="page-pad is-narrow">
          {loaded && error && <p className="cl-stale" role="status">No se pudo actualizar: {error}</p>}
          {loaded && (
            <p className={`cl-live ${live ? 'is-on' : ''}`}>
              <span className="link-dot" />
              {live ? 'Actualizando en vivo' : 'Sin conexión en vivo · jala para actualizar'}
            </p>
          )}
          {body}
        </div>
      </IonContent>
    </IonPage>
  );
}

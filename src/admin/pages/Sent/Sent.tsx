import { IonButton, IonContent, IonIcon, IonLabel, IonPage, IonSegment, IonSegmentButton, useIonToast } from '@ionic/react';
import { archiveOutline, createOutline, cubeOutline, paperPlaneOutline, receiptOutline, scanOutline, trashOutline } from 'ionicons/icons';
import { useState } from 'react';
import { AppHeader } from '../../../components/AppHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ProductThumb } from '../../../components/ProductThumb';
import { SyncBadge } from '../../components/SyncBadge';
import { SyncPendingChip } from '../../components/SyncPendingChip';
import { useApp, type ActivityItem, type PendingItem } from '../../context/AppContext';
import { money, shortDate, time } from '../../../data/models';
import { SentPill, useAccountLabels } from '../Scanner/Scanner';
import './Sent.css';

type Section = 'envios' | 'productos' | 'pedidos';

const PENDING_ICON: Record<PendingItem['kind'], string> = {
  envio: paperPlaneOutline,
  producto: cubeOutline,
  stock: archiveOutline,
};

const ACTIVITY_ICON: Record<ActivityItem['kind'], string> = {
  producto: createOutline,
  stock: archiveOutline,
  pedido: receiptOutline,
};

const when = (at: number) => {
  const iso = new Date(at).toISOString();
  return new Date(at).toDateString() === new Date().toDateString() ? time(iso) : `${shortDate(iso)} · ${time(iso)}`;
};

function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="sent-list">
      {items.map((a) => (
        <li key={a.id} className="sent-row">
          <span className={`sent-icon kind-${a.kind}`}><IonIcon icon={ACTIVITY_ICON[a.kind]} /></span>
          <span className="sent-info">
            <strong>{a.title}</strong>
            <span className="muted">{a.detail}</span>
            <span className="muted">{when(a.at)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// Lo que hizo este celular, por secciones: lo que mandó a la caja, los cambios de productos e inventario,
// y los pedidos que preparó o entregó
export default function Sent() {
  const { sent, removeSent, store, thisDevice, pending, activity } = useApp();
  const [toast] = useIonToast();
  const { sentTo } = useAccountLabels();
  const [section, setSection] = useState<Section>('envios');
  const mine = thisDevice ? sent.filter((s) => s.deviceId === thisDevice.id) : [];
  const inRegister = mine.filter((s) => s.status === 'en-caja');
  const total = inRegister.reduce((n, s) => n + s.qty * s.product.price, 0);
  const pieces = inRegister.reduce((n, s) => n + s.qty, 0);
  const productPending = pending.filter((p) => p.kind !== 'envio');
  const productActivity = activity.filter((a) => a.kind === 'producto' || a.kind === 'stock');
  const orderActivity = activity.filter((a) => a.kind === 'pedido');

  const onRemove = (id: string, name: string) => {
    removeSent(id);
    toast({ message: `${name} se quitó de la cuenta`, duration: 1600, color: 'dark', position: 'top', cssClass: 'toast-app' });
  };

  return (
    <IonPage>
      <AppHeader title="Actividad">
        <div className="sent-tabs">
          <IonSegment value={section} onIonChange={(e) => setSection(e.detail.value as Section)} aria-label="Sección">
            <IonSegmentButton value="envios">
              <IonLabel>A la caja · {mine.length}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="productos">
              <IonLabel>Productos · {productActivity.length}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="pedidos">
              <IonLabel>Pedidos · {orderActivity.length}</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>
      </AppHeader>
      <IonContent>
        <div className="page-pad is-narrow stack">
          <SyncPendingChip />

          {section === 'envios' &&
            (mine.length === 0 ? (
              <EmptyState
                art="cart"
                title="Aún no envías productos"
                text="Lo que escanees en modo Vender aparecerá aquí y en la cuenta de la caja."
                action={
                  <IonButton className="btn-lg" color="secondary" routerLink="/movil/escaner" routerDirection="root">
                    <IonIcon slot="start" icon={scanOutline} />
                    Ir a escanear
                  </IonButton>
                }
              />
            ) : (
              <>
                <section className="card sent-summary">
                  <div>
                    <span className="muted">Esperando cobro en {store.register}</span>
                    <strong className="money">{money(total)}</strong>
                  </div>
                  <span className="sent-count">{pieces} {pieces === 1 ? 'pieza' : 'piezas'}</span>
                </section>

                <section>
                  <h2 className="section-title">Enviados a la caja</h2>
                  <ul className="sent-list">
                    {mine.map((s) => (
                      <li key={s.id} className={`sent-row is-${s.status}`}>
                        <ProductThumb product={s.product} size={38} />
                        <span className="sent-info">
                          <strong>{s.qty} × {s.product.name}</strong>
                          <span className="muted sent-meta">
                            {time(new Date(s.at).toISOString())} <SentPill status={s.status} />
                          </span>
                          {sentTo(s) && (
                            <span className="sent-to">
                              <IonIcon icon={receiptOutline} aria-hidden="true" /> {sentTo(s)}
                            </span>
                          )}
                        </span>
                        <span className="money sent-amount">{money(s.qty * s.product.price)}</span>
                        {(s.status === 'en-caja' || s.status === 'pendiente') && (
                          <button type="button" className="sent-remove" onClick={() => onRemove(s.id, s.product.name)} aria-label={`Quitar ${s.product.name}`}>
                            <IonIcon icon={trashOutline} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ))}

          {section === 'productos' && (
            <>
              {productPending.length > 0 && (
                <section>
                  <h2 className="section-title">Por subir a la caja</h2>
                  <ul className="sent-list">
                    {productPending.map((p) => (
                      <li key={p.id} className="sent-row is-pending">
                        <span className="sent-icon"><IonIcon icon={PENDING_ICON[p.kind]} /></span>
                        <span className="sent-info">
                          <strong>{p.title}</strong>
                          <span className="muted">{p.detail} · {time(new Date(p.at).toISOString())}</span>
                        </span>
                        <SyncBadge state={p.status} compact />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {productActivity.length === 0 ? (
                <EmptyState art="box" title="Sin cambios de productos" text="Cuando edites un producto, des de alta uno nuevo o sumes inventario, aparecerá aquí." />
              ) : (
                <section>
                  <h2 className="section-title">Productos editados e inventario</h2>
                  <ActivityList items={productActivity} />
                </section>
              )}
            </>
          )}

          {section === 'pedidos' &&
            (orderActivity.length === 0 ? (
              <EmptyState art="cart" title="Sin pedidos todavía" text="Los pedidos que prepares o entregues desde este celular aparecerán aquí." />
            ) : (
              <section>
                <h2 className="section-title">Pedidos que atendiste</h2>
                <ActivityList items={orderActivity} />
              </section>
            ))}
        </div>
      </IonContent>
    </IonPage>
  );
}

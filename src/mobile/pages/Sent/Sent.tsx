import { IonButton, IonContent, IonIcon, IonPage, useIonToast } from '@ionic/react';
import { archiveOutline, cubeOutline, paperPlaneOutline, scanOutline, trashOutline } from 'ionicons/icons';
import { AppHeader } from '../../../components/AppHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ProductThumb } from '../../../components/ProductThumb';
import { SyncBadge } from '../../../components/SyncBadge';
import { SyncPendingChip } from '../../../components/SyncPendingChip';
import { useApp, type PendingItem } from '../../../context/AppContext';
import { money, time } from '../../../data/models';
import { SentPill } from '../Scanner/Scanner';
import './Sent.css';

const PENDING_ICON: Record<PendingItem['kind'], string> = {
  envio: paperPlaneOutline,
  producto: cubeOutline,
  stock: archiveOutline,
};

export default function Sent() {
  const { sent, removeSent, store, thisDevice, pending } = useApp();
  const [toast] = useIonToast();
  const mine = thisDevice ? sent.filter((s) => s.deviceId === thisDevice.id) : [];
  const inRegister = mine.filter((s) => s.status === 'en-caja');
  const total = inRegister.reduce((n, s) => n + s.qty * s.product.price, 0);
  const pieces = inRegister.reduce((n, s) => n + s.qty, 0);
  const otherPending = pending.filter((p) => p.kind !== 'envio');

  const onRemove = (id: string, name: string) => {
    removeSent(id);
    toast({ message: `${name} se quitó de la cuenta`, duration: 1600, color: 'dark', position: 'top', cssClass: 'toast-app' });
  };

  return (
    <IonPage>
      <AppHeader title="Actividad" />
      <IonContent>
        <div className="page-pad is-narrow stack">
          <SyncPendingChip />

          {otherPending.length > 0 && (
            <section>
              <h2 className="section-title">Guardado en el celular</h2>
              <ul className="sent-list">
                {otherPending.map((p) => (
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

          {mine.length === 0 ? (
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
                  <span className="muted">En la cuenta de {store.register}</span>
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
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

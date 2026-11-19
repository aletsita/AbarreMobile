import { IonIcon, IonSpinner } from '@ionic/react';
import { cloudDoneOutline, cloudOfflineOutline } from 'ionicons/icons';
import { useApp } from '../context/AppContext';
import './SyncPendingChip.css';

export function SyncPendingChip({ hideWhenDone }: { hideWhenDone?: boolean }) {
  const { pending, uploading, online } = useApp();
  const n = pending.length;

  if (uploading) {
    return (
      <div className="sync-chip is-syncing" role="status">
        <IonSpinner name="crescent" />
        <span>Subiendo {n} {n === 1 ? 'cambio' : 'cambios'}…</span>
      </div>
    );
  }

  if (n === 0) {
    if (hideWhenDone) return null;
    return (
      <div className="sync-chip is-done" role="status">
        <IonIcon icon={cloudDoneOutline} aria-hidden="true" />
        <span>Todo está guardado en la nube</span>
      </div>
    );
  }

  return (
    <div className="sync-chip is-pending" role="status">
      <IonIcon icon={cloudOfflineOutline} aria-hidden="true" />
      <span>
        <strong>{n}</strong> {n === 1 ? 'cambio guardado' : 'cambios guardados'} en este equipo
      </span>
      <span className="sync-chip-action">{online ? 'Subiendo' : 'Se subirán al volver la conexión'}</span>
    </div>
  );
}

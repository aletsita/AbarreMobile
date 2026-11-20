import { IonIcon } from '@ionic/react';
import { cloudOfflineOutline, wifiOutline } from 'ionicons/icons';
import { useOnline } from '../lib/online';
import './ConnectionBadge.css';

export function ConnectionBadge() {
  const online = useOnline();
  return (
    <span className={`conn-badge ${online ? 'is-online' : 'is-offline'}`} role="status" aria-live="polite">
      <IonIcon icon={online ? wifiOutline : cloudOfflineOutline} aria-hidden="true" />
      <span className="conn-text">{online ? 'En línea' : 'Sin conexión'}</span>
    </span>
  );
}

export function OfflineBar({ message = 'lo que registres se guarda en este celular y se sube solo al volver la conexión' }: { message?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-bar" role="alert">
      <IonIcon icon={cloudOfflineOutline} aria-hidden="true" />
      <span>
        <strong>Sin conexión.</strong> {message.charAt(0).toUpperCase() + message.slice(1)}.
      </span>
    </div>
  );
}

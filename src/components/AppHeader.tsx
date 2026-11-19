import { IonBackButton, IonButtons, IonHeader, IonTitle, IonToolbar } from '@ionic/react';
import type { ReactNode } from 'react';
import { ConnectionBadge, OfflineBar } from './ConnectionBadge';

interface Props {
  title: string;
  backHref?: string;
  end?: ReactNode;
  showConnection?: boolean;
  children?: ReactNode;
}

export function AppHeader({ title, backHref, end, showConnection = true, children }: Props) {
  return (
    <IonHeader className="ion-no-border app-header">
      <IonToolbar>
        {backHref && (
          <IonButtons slot="start">
            <IonBackButton defaultHref={backHref} text="" />
          </IonButtons>
        )}
        <IonTitle>{title}</IonTitle>
        <IonButtons slot="end">
          {end}
          {showConnection && <ConnectionBadge />}
        </IonButtons>
      </IonToolbar>
      <OfflineBar />
      {children}
    </IonHeader>
  );
}

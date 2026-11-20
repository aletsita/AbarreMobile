import { IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/react';
import { arrowBack, cloudOfflineOutline } from 'ionicons/icons';
import type { ReactNode } from 'react';
import { BrandLogo, BrandWord } from '../components/Brand';
import { useOnline } from '../lib/online';
import './Inicio.css';

// Marco de las pantallas sin sesión: encabezado de la marca arriba y una tarjeta con el formulario
export function AuthShell({ title, subtitle, back, children }: { title: string; subtitle: string; back?: string; children: ReactNode }) {
  const router = useIonRouter();
  const online = useOnline();

  return (
    <IonPage>
      <IonContent fullscreen className="auth">
        <header className="auth-hero">
          {back && (
            <button type="button" className="auth-back" onClick={() => router.push(back, 'back')} aria-label="Regresar">
              <IonIcon icon={arrowBack} />
            </button>
          )}
          <div className="auth-brand">
            <BrandLogo size={52} />
            <BrandWord className="auth-word" />
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>

        <div className="auth-card">
          {!online && (
            <div className="auth-offline" role="status">
              <IonIcon icon={cloudOfflineOutline} />
              Sin conexión. Conéctate a internet para continuar.
            </div>
          )}
          {children}
        </div>
      </IonContent>
    </IonPage>
  );
}

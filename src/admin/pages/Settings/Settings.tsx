import { IonButton, IonContent, IonIcon, IonLabel, IonPage, IonSegment, IonSegmentButton, useIonAlert, useIonRouter } from '@ionic/react';
import {
  checkmarkCircleOutline,
  contrastOutline,
  linkOutline,
  logOutOutline,
  moonOutline,
  personCircleOutline,
  phonePortraitOutline,
  serverOutline,
  sunnyOutline,
  unlinkOutline,
} from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { AppHeader } from '../../../components/AppHeader';
import { BrandLogo } from '../../../components/Brand';
import { SyncPendingChip } from '../../components/SyncPendingChip';
import { APP_NAME, APP_VERSION } from '../../../config';
import { useApp } from '../../context/AppContext';
import { shortServer } from '../../lib/link';
import { STATUS_LABEL } from '../Link/Link';
import { THEME_LABEL, useThemeMode, type ThemeMode } from '../../../lib/theme';
import { useSession } from '../../../session/SessionContext';
import './Settings.css';

// Dentro de la app nativa ya está instalada; en el navegador solo queda la indicación manual
const installed = Capacitor.isNativePlatform();

export default function Settings() {
  const { store, thisDevice, unlink, isLive, online, server, serverStatus } = useApp();
  const router = useIonRouter();
  const [alert] = useIonAlert();
  const [theme, setTheme] = useThemeMode();
  const { session, logout } = useSession();

  const confirmLogout = () =>
    alert({
      header: '¿Cerrar sesión?',
      message: 'El celular sigue vinculado con la caja. Para volver a usarlo, inicia sesión otra vez.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Cerrar sesión', role: 'destructive', handler: () => void logout() },
      ],
    });

  const confirmUnlink = () =>
    alert({
      header: '¿Desvincular este celular?',
      message: `Dejará de enviar productos a ${store.register}. Para volver a usarlo tendrás que vincularlo de nuevo.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desvincular',
          role: 'destructive',
          handler: () => {
            unlink();
            router.push('/movil/vincular');
          },
        },
      ],
    });

  const registerLive = online && isLive('panel');

  return (
    <IonPage>
      <AppHeader title="Ajustes" />
      <IonContent>
        <div className="page-pad is-narrow">
          <h2 className="section-title">Tu cuenta</h2>
          <section className="card set-device">
            <span className="set-avatar"><IonIcon icon={personCircleOutline} /></span>
            <div className="set-device-info">
              <strong>{session?.name}</strong>
              <span className="muted">{session?.staffRole ?? 'Personal'} de {store.name}</span>
            </div>
          </section>
          <IonButton expand="block" fill="outline" className="btn-lg set-btn" onClick={confirmLogout}>
            <IonIcon slot="start" icon={logOutOutline} />
            Cerrar sesión
          </IonButton>

          <h2 className="section-title">Este celular</h2>
          <section className="card set-device">
            <span className={`set-avatar ${thisDevice ? '' : 'is-off'}`}><IonIcon icon={phonePortraitOutline} /></span>
            <div className="set-device-info">
              <strong>{thisDevice?.name ?? 'Sin vincular'}</strong>
              {thisDevice && <span className="muted">{thisDevice.model}</span>}
              <span className={`set-status ${!thisDevice ? 'is-off' : registerLive ? 'is-on' : 'is-wait'}`}>
                <span className="set-dot" />
                {!thisDevice ? 'No envía a ninguna caja' : registerLive ? `Conectado a ${store.register}` : `${store.register} sin respuesta`}
              </span>
            </div>
          </section>
          {server && thisDevice && (
            <p className="set-server">
              <IonIcon icon={serverOutline} />
              <span>Servidor <strong>{shortServer(server)}</strong></span>
              <span className={`link-status is-${serverStatus}`}><span className="link-dot" />{STATUS_LABEL[serverStatus]}</span>
            </p>
          )}
          {thisDevice ? (
            <IonButton expand="block" fill="outline" color="danger" className="btn-lg set-btn" onClick={confirmUnlink}>
              <IonIcon slot="start" icon={unlinkOutline} />
              Desvincular
            </IonButton>
          ) : (
            <IonButton expand="block" className="btn-lg set-btn" routerLink="/movil/vincular">
              <IonIcon slot="start" icon={linkOutline} />
              Vincular con la caja
            </IonButton>
          )}

          <h2 className="section-title">Sincronización</h2>
          <SyncPendingChip />
          <p className="set-note">
            Si se va el internet puedes seguir escaneando, registrando productos y entradas. Todo se guarda en el
            celular y se sube solo cuando vuelve la conexión.
          </p>

          <h2 className="section-title">Apariencia</h2>
          <IonSegment value={theme} onIonChange={(e) => setTheme(e.detail.value as ThemeMode)} className="set-theme" aria-label="Tema">
            {([['sistema', contrastOutline], ['claro', sunnyOutline], ['oscuro', moonOutline]] as const).map(([m, icon]) => (
              <IonSegmentButton key={m} value={m} layout="icon-start">
                <IonIcon icon={icon} />
                <IonLabel>{THEME_LABEL[m]}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>

          <h2 className="section-title">Aplicación</h2>
          <div className="card set-install">
            <BrandLogo size={46} />
            <div>
              <strong>{APP_NAME} {APP_VERSION}</strong>
              <p className="muted">
                {installed ? 'Instalada en este celular.' : 'Para instalarla, abre el menú del navegador y elige “Agregar a pantalla de inicio”.'}
              </p>
            </div>
            {installed && <IonIcon icon={checkmarkCircleOutline} className="set-installed" />}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

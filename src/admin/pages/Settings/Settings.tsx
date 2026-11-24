import { IonButton, IonContent, IonIcon, IonLabel, IonPage, IonSegment, IonSegmentButton, useIonAlert, useIonRouter } from '@ionic/react';
import {
  checkmarkCircleOutline,
  contrastOutline,
  linkOutline,
  logOutOutline,
  moonOutline,
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
import { initials } from '../../../data/models';
import { useApp } from '../../context/AppContext';
import { shortServer } from '../../../lib/link';
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
          <section className="set-me">
            <span className="set-me-avatar">{initials(session?.name || '?')}</span>
            <div className="set-me-info">
              <strong>{session?.name}</strong>
              <span>{session?.staffRole ?? 'Personal'} · {store.name}</span>
            </div>
          </section>

          <h2 className="section-title">Este celular</h2>
          <section className="card set-phone">
            <div className="set-phone-head">
              <span className={`set-avatar ${thisDevice ? '' : 'is-off'}`}><IonIcon icon={phonePortraitOutline} /></span>
              <div className="set-device-info">
                <strong>{thisDevice?.name ?? 'Sin vincular'}</strong>
                {thisDevice && <span className="muted">{thisDevice.model}</span>}
              </div>
            </div>
            <ul className="set-facts">
              <li>
                <span className="muted">Caja</span>
                <span className={`set-status ${!thisDevice ? 'is-off' : registerLive ? 'is-on' : 'is-wait'}`}>
                  <span className="set-dot" />
                  {!thisDevice ? 'Ninguna' : registerLive ? `Conectado a ${store.register}` : `${store.register} sin respuesta`}
                </span>
              </li>
              {server && thisDevice && (
                <li>
                  <span className="muted">Servidor</span>
                  <span className="set-server">
                    <IonIcon icon={serverOutline} aria-hidden="true" />
                    <strong>{shortServer(server)}</strong>
                    <span className={`link-status is-${serverStatus}`}><span className="link-dot" />{STATUS_LABEL[serverStatus]}</span>
                  </span>
                </li>
              )}
            </ul>
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
          </section>

          <h2 className="section-title">Sincronización</h2>
          <div className="card set-sync">
            <SyncPendingChip />
            <p className="set-note">
              Si se va el internet puedes seguir escaneando, registrando productos y entradas. Todo se guarda en el
              celular y se sube solo cuando vuelve la conexión.
            </p>
          </div>

          <h2 className="section-title">Apariencia</h2>
          <div className="card set-theme-card">
            <IonSegment value={theme} onIonChange={(e) => setTheme(e.detail.value as ThemeMode)} className="set-theme" aria-label="Tema">
              {([['sistema', contrastOutline], ['claro', sunnyOutline], ['oscuro', moonOutline]] as const).map(([m, icon]) => (
                <IonSegmentButton key={m} value={m} layout="icon-start">
                  <IonIcon icon={icon} />
                  <IonLabel>{THEME_LABEL[m]}</IonLabel>
                </IonSegmentButton>
              ))}
            </IonSegment>
          </div>

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

          <IonButton expand="block" fill="outline" color="danger" className="btn-lg set-logout" onClick={confirmLogout}>
            <IonIcon slot="start" icon={logOutOutline} />
            Cerrar sesión
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
}

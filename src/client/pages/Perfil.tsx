import { IonButton, IonContent, IonIcon, IonLabel, IonPage, IonSegment, IonSegmentButton, IonSpinner } from '@ionic/react';
import { useAppAlert } from '../../components/AppAlert';
import { callOutline, contrastOutline, logOutOutline, mailOutline, moonOutline, notificationsOffOutline, notificationsOutline, sunnyOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/errors';
import type { Customer } from '../../api/types';
import { AppHeader } from '../../components/AppHeader';
import { initials } from '../../data/models';
import { THEME_LABEL, useThemeMode, type ThemeMode } from '../../lib/theme';
import { useSession } from '../../session/SessionContext';
import { notifyPermission, requestNotify, type NotifyPermission } from '../lib/notify';

const PERMISSION_TEXT: Record<NotifyPermission, string> = {
  granted: 'Te avisamos cuando cambie el estado de tus pedidos, aunque la app esté en segundo plano.',
  prompt: 'Aún no activas los avisos de tus pedidos.',
  denied: 'Los avisos están bloqueados. Actívalos en Ajustes del teléfono › Apps › Abarré › Notificaciones.',
  'no-disponible': 'Este navegador no muestra notificaciones. Revisa «Mis pedidos».',
};

export default function Perfil() {
  const { session, logout, profile } = useSession();
  const showAlert = useAppAlert();
  const [theme, setTheme] = useThemeMode();
  const [me, setMe] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotifyPermission | null>(null);

  useEffect(() => {
    profile().then(setMe, (e) => setError(errorMessage(e, 'No pudimos cargar tus datos.')));
    void notifyPermission().then(setPermission);
  }, []);

  const confirmLogout = () =>
    void showAlert({
      tone: 'warning',
      title: '¿Cerrar sesión?',
      message: 'Tu carrito se queda guardado en este teléfono para la próxima vez que entres.',
      primary: { text: 'Cerrar sesión', danger: true },
      secondary: 'Cancelar',
    }).then((ok) => ok && void logout('usuario'));

  const name = me?.name ?? session?.name ?? '';

  return (
    <IonPage>
      <AppHeader title="Perfil" />
      <IonContent>
        <div className="page-pad is-narrow">
          <section className="cl-me">
            <span className="cl-me-avatar">{initials(name || '?')}</span>
            <div className="cl-me-info">
              <strong>{name || 'Tu perfil'}</strong>
              <span>Cliente</span>
            </div>
          </section>

          <h2 className="section-title">Tus datos</h2>
          <ul className="card cl-rows">
            {me ? (
              <>
                <li>
                  <span className="cl-row-icon"><IonIcon icon={mailOutline} aria-hidden="true" /></span>
                  <span className="cl-row-text">
                    <small>Correo</small>
                    <strong>{me.email}</strong>
                  </span>
                </li>
                <li>
                  <span className="cl-row-icon"><IonIcon icon={callOutline} aria-hidden="true" /></span>
                  <span className="cl-row-text">
                    <small>Teléfono</small>
                    <strong>{me.phone.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3')}</strong>
                  </span>
                </li>
              </>
            ) : error ? (
              <li className="cl-stale">{error}</li>
            ) : (
              <li className="cl-rows-loading"><IonSpinner name="dots" /></li>
            )}
          </ul>

          <h2 className="section-title">Avisos de pedidos</h2>
          {permission && (
            <div className={`card cl-notif is-${permission}`}>
              <span className="cl-row-icon">
                <IonIcon icon={permission === 'granted' ? notificationsOutline : notificationsOffOutline} aria-hidden="true" />
              </span>
              <div>
                <strong>{permission === 'granted' ? 'Avisos activados' : permission === 'prompt' ? 'Avisos apagados' : 'Avisos no disponibles'}</strong>
                <p>{PERMISSION_TEXT[permission]}</p>
                {permission === 'prompt' && (
                  <IonButton size="small" onClick={() => void requestNotify().then(setPermission)}>
                    Activar avisos
                  </IonButton>
                )}
              </div>
            </div>
          )}

          <h2 className="section-title">Apariencia</h2>
          <div className="card cl-theme-card">
            <IonSegment className="cl-segment" value={theme} onIonChange={(e) => setTheme(e.detail.value as ThemeMode)} aria-label="Tema">
              {([['sistema', contrastOutline], ['claro', sunnyOutline], ['oscuro', moonOutline]] as const).map(([m, icon]) => (
                <IonSegmentButton key={m} value={m} layout="icon-start">
                  <IonIcon icon={icon} />
                  <IonLabel>{THEME_LABEL[m]}</IonLabel>
                </IonSegmentButton>
              ))}
            </IonSegment>
          </div>

          <IonButton expand="block" fill="outline" color="danger" className="btn-lg cl-logout" onClick={confirmLogout}>
            <IonIcon slot="start" icon={logOutOutline} />
            Cerrar sesión
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
}

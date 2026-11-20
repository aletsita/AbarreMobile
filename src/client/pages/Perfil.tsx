import { IonButton, IonContent, IonIcon, IonLabel, IonPage, IonSegment, IonSegmentButton, IonSpinner, useIonAlert } from '@ionic/react';
import { callOutline, contrastOutline, logOutOutline, mailOutline, moonOutline, notificationsOffOutline, notificationsOutline, sunnyOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { api, SIMULATED } from '../../api';
import { errorMessage } from '../../api/errors';
import type { Customer } from '../../api/types';
import { AppHeader } from '../../components/AppHeader';
import { initials } from '../../data/models';
import { THEME_LABEL, useThemeMode, type ThemeMode } from '../../lib/theme';
import { useSession } from '../../session/SessionContext';
import { SimPanel } from '../components/SimPanel';
import { pushMode, pushPermission, requestPush, type PushPermission } from '../lib/push';

const PERMISSION_TEXT: Record<PushPermission, string> = {
  granted: 'Te avisamos cuando cambie el estado de tus pedidos.',
  prompt: 'Aún no activas los avisos de tus pedidos.',
  denied: 'Los avisos están bloqueados. Actívalos en Ajustes del teléfono › Apps › Abarré › Notificaciones.',
  'no-disponible': 'Los avisos no están disponibles en esta versión de la app. Revisa «Mis pedidos».',
};

export default function Perfil() {
  const { session, logout } = useSession();
  const [alert] = useIonAlert();
  const [theme, setTheme] = useThemeMode();
  const [me, setMe] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [simulatedPush, setSimulatedPush] = useState(false);

  useEffect(() => {
    api.me().then(setMe, (e) => setError(errorMessage(e, 'No pudimos cargar tus datos.')));
    void pushPermission().then(setPermission);
    void pushMode().then((m) => setSimulatedPush(m === 'simulado'));
  }, []);

  const confirmLogout = () =>
    alert({
      header: '¿Cerrar sesión?',
      message: 'Tu carrito se queda guardado en este teléfono para la próxima vez que entres.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Cerrar sesión', role: 'destructive', handler: () => void logout('usuario') },
      ],
    });

  const name = me?.name ?? session?.name ?? '';

  return (
    <IonPage>
      <AppHeader title="Perfil" />
      <IonContent>
        <div className="page-pad is-narrow">
          <section className="card cl-profile">
            <span className="cl-avatar">{initials(name || '?')}</span>
            <div>
              <strong>{name}</strong>
              {me ? (
                <>
                  <span className="muted"><IonIcon icon={mailOutline} /> {me.email}</span>
                  <span className="muted"><IonIcon icon={callOutline} /> {me.phone.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3')}</span>
                </>
              ) : error ? (
                <span className="cl-stale">{error}</span>
              ) : (
                <IonSpinner name="dots" />
              )}
            </div>
          </section>

          <h2 className="section-title">Avisos de pedidos</h2>
          {permission && (
            <div className="card cl-notif">
              <IonIcon icon={permission === 'granted' ? notificationsOutline : notificationsOffOutline} />
              <div>
                <p>{PERMISSION_TEXT[permission]}</p>
                {simulatedPush && permission === 'granted' && <small className="muted">Simulados: llegan como aviso dentro de la app.</small>}
                {permission === 'prompt' && (
                  <IonButton size="small" onClick={() => void requestPush().then(setPermission)}>
                    Activar avisos
                  </IonButton>
                )}
              </div>
            </div>
          )}

          <h2 className="section-title">Apariencia</h2>
          <IonSegment value={theme} onIonChange={(e) => setTheme(e.detail.value as ThemeMode)} aria-label="Tema">
            {([['sistema', contrastOutline], ['claro', sunnyOutline], ['oscuro', moonOutline]] as const).map(([m, icon]) => (
              <IonSegmentButton key={m} value={m} layout="icon-start">
                <IonIcon icon={icon} />
                <IonLabel>{THEME_LABEL[m]}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>

          <IonButton expand="block" fill="outline" color="danger" className="btn-lg cl-logout" onClick={confirmLogout}>
            <IonIcon slot="start" icon={logOutOutline} />
            Cerrar sesión
          </IonButton>

          {SIMULATED && <SimPanel />}
        </div>
      </IonContent>
    </IonPage>
  );
}

import { IonButton, IonContent, IonIcon, IonPage, IonSpinner } from '@ionic/react';
import { alertCircleOutline, lockClosedOutline, mailOutline } from 'ionicons/icons';
import { useState } from 'react';
import { errorMessage } from '../api/errors';
import { AppHeader } from '../components/AppHeader';
import { TextField } from '../components/Form';
import { useOnline } from '../lib/online';
import { useSession } from '../session/SessionContext';
import { EMAIL_RE } from './validation';
import './Inicio.css';

export default function Entrar() {
  const { login } = useSession();
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const emailError = tried && !EMAIL_RE.test(email.trim()) && 'Escribe un correo válido.';
  const passwordError = tried && !password && 'Escribe tu contraseña.';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError('');
    if (!EMAIL_RE.test(email.trim()) || !password) return;
    if (!online) {
      setError('Necesitas conexión a internet para iniciar sesión.');
      return;
    }
    setBusy(true);
    try {
      // Al terminar, el guardián de rutas lleva al cliente a la tienda
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <AppHeader title="Iniciar sesión" backHref="/inicio" offlineMessage="necesitas internet para iniciar sesión" />
      <IonContent>
        <form className="page-pad is-narrow stack auth-form" onSubmit={submit} noValidate>
          <p className="auth-lead">Entra con el correo y la contraseña de tu cuenta de cliente.</p>
          <TextField label="Correo" type="email" icon={mailOutline} autoComplete="email" inputMode="email" autoCapitalize="off" value={email} onChange={setEmail} error={emailError} />
          <TextField label="Contraseña" type="password" icon={lockClosedOutline} autoComplete="current-password" value={password} onChange={setPassword} error={passwordError} />

          {error && (
            <div className="form-error" role="alert">
              <IonIcon icon={alertCircleOutline} />
              {error}
            </div>
          )}

          <IonButton type="submit" expand="block" className="btn-xl" disabled={busy}>
            {busy ? <IonSpinner name="crescent" /> : 'Entrar'}
          </IonButton>
          <p className="auth-alt">
            ¿Aún no tienes cuenta?{' '}
            <IonButton fill="clear" size="small" routerLink="/cliente/registro">Crear cuenta</IonButton>
          </p>
        </form>
      </IonContent>
    </IonPage>
  );
}

import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { alertCircleOutline, informationCircleOutline, lockClosedOutline, mailOutline, serverOutline } from 'ionicons/icons';
import { useState } from 'react';
import { errorMessage } from '../api/errors';
import { TextField } from '../components/Form';
import { useOnline } from '../lib/online';
import { useSession } from '../session/SessionContext';
import { AuthShell } from './AuthShell';
import { ServerField } from './ServerField';
import { EMAIL_RE } from './validation';

// Una sola entrada para todos: el servidor dice si la cuenta es de un cliente o del personal de la tienda,
// y el guardián de rutas lleva a cada quien a sus pantallas.
export default function Entrar() {
  const { login } = useSession();
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [serverOk, setServerOk] = useState(true);

  const emailError = tried && !EMAIL_RE.test(email.trim()) && 'Escribe tu correo completo, por ejemplo nombre@correo.com.';
  const passwordError = tried && !password && 'Escribe tu contraseña.';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError('');
    if (!EMAIL_RE.test(email.trim()) || !password || !serverOk) return;
    if (!online) {
      setError('Necesitas conexión a internet para iniciar sesión.');
      return;
    }
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(errorMessage(err, 'No pudimos iniciar sesión. Inténtalo de nuevo.'));
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Inicia sesión" subtitle="Entra con tu correo y contraseña para pedir tu súper o trabajar en la tienda.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <TextField
          label="Correo electrónico"
          type="email"
          icon={mailOutline}
          placeholder="nombre@correo.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="off"
          value={email}
          onChange={setEmail}
          error={emailError}
          hint="El mismo con el que creaste tu cuenta"
        />
        <TextField
          label="Contraseña"
          type="password"
          icon={lockClosedOutline}
          placeholder="Tu contraseña"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={passwordError}
          hint="Toca el ojo para ver lo que escribiste"
        />

        {error && (
          <div className="form-error" role="alert">
            <IonIcon icon={alertCircleOutline} />
            {error}
          </div>
        )}

        <IonButton type="submit" expand="block" className="btn-xl" disabled={busy}>
          {busy ? <IonSpinner name="crescent" /> : 'Iniciar sesión'}
        </IonButton>

        <div className="auth-divider">¿Es tu primera vez?</div>
        <IonButton expand="block" fill="outline" routerLink="/registro">
          Crear una cuenta
        </IonButton>

        <p className="auth-note">
          <IonIcon icon={informationCircleOutline} aria-hidden="true" />
          <span>
            <strong>¿Trabajas en la tienda?</strong> Entra con el correo que tienes registrado en la caja. Después te pediremos
            vincular este celular con la caja.
          </span>
        </p>
      </form>

      <ServerField icon={serverOutline} onValidChange={setServerOk} showErrors={tried} />
    </AuthShell>
  );
}

import { IonButton, IonContent, IonIcon, IonPage, IonSpinner } from '@ionic/react';
import { alertCircleOutline, callOutline, lockClosedOutline, mailOutline, personOutline } from 'ionicons/icons';
import { useState } from 'react';
import { ApiError, errorMessage } from '../api/errors';
import { AppHeader } from '../components/AppHeader';
import { TextField } from '../components/Form';
import { useOnline } from '../lib/online';
import { useSession } from '../session/SessionContext';
import { MIN_PASSWORD, validateRegister, type RegisterInput } from './validation';
import './Inicio.css';

const EMPTY: RegisterInput = { name: '', email: '', phone: '', password: '' };

export default function Registro() {
  const { register } = useSession();
  const online = useOnline();
  const [form, setForm] = useState(EMPTY);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const local = tried ? validateRegister(form) : {};
  const fieldError = (k: keyof RegisterInput) => local[k] ?? serverErrors[k];
  const set = (k: keyof RegisterInput) => (v: string) => {
    setForm((f) => ({ ...f, [k]: k === 'phone' ? v.replace(/\D/g, '').slice(0, 10) : v }));
    setServerErrors((s) => ({ ...s, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError('');
    if (Object.keys(validateRegister(form)).length) return;
    if (!online) {
      setError('Necesitas conexión a internet para crear tu cuenta.');
      return;
    }
    setBusy(true);
    try {
      await register({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() });
    } catch (err) {
      const fields = err instanceof ApiError ? (err.details as { fields?: Record<string, string> } | undefined)?.fields : undefined;
      if (fields) setServerErrors(fields);
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <AppHeader title="Crear cuenta" backHref="/cliente/entrar" offlineMessage="necesitas internet para crear tu cuenta" />
      <IonContent>
        <form className="page-pad is-narrow stack auth-form" onSubmit={submit} noValidate>
          <p className="auth-lead">Con tu cuenta puedes pedir tu súper y ver cuándo está listo para recoger.</p>
          <TextField label="Nombre" icon={personOutline} autoComplete="name" autoCapitalize="words" maxLength={60} value={form.name} onChange={set('name')} error={fieldError('name')} />
          <TextField label="Correo" type="email" icon={mailOutline} autoComplete="email" inputMode="email" autoCapitalize="off" value={form.email} onChange={set('email')} error={fieldError('email')} />
          <TextField label="Teléfono" type="tel" icon={callOutline} autoComplete="tel-national" inputMode="numeric" placeholder="10 dígitos" value={form.phone} onChange={set('phone')} error={fieldError('phone')} hint="La tienda te llamará si hay algún detalle con tu pedido" />
          <TextField
            label="Contraseña"
            type="password"
            icon={lockClosedOutline}
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={fieldError('password')}
            hint={`Mínimo ${MIN_PASSWORD} caracteres`}
          />

          {error && (
            <div className="form-error" role="alert">
              <IonIcon icon={alertCircleOutline} />
              {error}
            </div>
          )}

          <IonButton type="submit" expand="block" className="btn-xl" disabled={busy}>
            {busy ? <IonSpinner name="crescent" /> : 'Crear mi cuenta'}
          </IonButton>
          <p className="auth-alt">
            ¿Ya tienes cuenta?{' '}
            <IonButton fill="clear" size="small" routerLink="/cliente/entrar" routerDirection="back">Iniciar sesión</IonButton>
          </p>
        </form>
      </IonContent>
    </IonPage>
  );
}

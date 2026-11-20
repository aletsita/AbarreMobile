import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { alertCircleOutline, callOutline, lockClosedOutline, mailOutline, personOutline } from 'ionicons/icons';
import { useState } from 'react';
import { ApiError, errorMessage } from '../api/errors';
import { TextField } from '../components/Form';
import { useOnline } from '../lib/online';
import { useSession } from '../session/SessionContext';
import { AuthShell } from './AuthShell';
import { MIN_PASSWORD, validateRegister, type RegisterInput } from './validation';

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
    <AuthShell title="Crea tu cuenta" subtitle="Pide tu súper desde el celular y recógelo listo en la tienda." back="/entrar">
      <form className="auth-form" onSubmit={submit} noValidate>
        <TextField
          label="Nombre completo"
          icon={personOutline}
          placeholder="Ej. María López"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={60}
          value={form.name}
          onChange={set('name')}
          error={fieldError('name')}
          hint="Así te llamaremos cuando recojas tu pedido"
        />
        <TextField
          label="Correo electrónico"
          type="email"
          icon={mailOutline}
          placeholder="nombre@correo.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="off"
          value={form.email}
          onChange={set('email')}
          error={fieldError('email')}
          hint="Lo usarás para iniciar sesión"
        />
        <TextField
          label="Teléfono celular"
          type="tel"
          icon={callOutline}
          placeholder="10 dígitos, sin espacios"
          autoComplete="tel-national"
          inputMode="numeric"
          value={form.phone}
          onChange={set('phone')}
          error={fieldError('phone')}
          hint="La tienda te llamará si hay algún detalle con tu pedido"
        />
        <TextField
          label="Contraseña"
          type="password"
          icon={lockClosedOutline}
          placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={fieldError('password')}
          hint={form.password && form.password.length < MIN_PASSWORD ? `Te faltan ${MIN_PASSWORD - form.password.length} caracteres` : `Mínimo ${MIN_PASSWORD} caracteres. Usa letras y números.`}
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
        <div className="auth-divider">¿Ya tienes cuenta?</div>
        <IonButton expand="block" fill="outline" routerLink="/entrar" routerDirection="back">
          Iniciar sesión
        </IonButton>
      </form>
    </AuthShell>
  );
}

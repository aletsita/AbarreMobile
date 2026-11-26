import { IonIcon } from '@ionic/react';
import { useEffect, useState } from 'react';
import { TextField } from '../components/Form';
import { getServer, normalizeServer, SERVER_FIXED, setServer, shortServer } from '../lib/server';

type Props = { icon: string; onValidChange: (ok: boolean) => void; showErrors: boolean };

// Dirección del servidor de la tienda. Con la API en la nube viene fija en la app y no se muestra;
// en desarrollo se puede cambiar (abierta desde el inicio si el teléfono todavía no tiene ninguna).
export function ServerField(props: Props) {
  return SERVER_FIXED ? null : <EditableServer {...props} />;
}

function EditableServer({ icon, onValidChange, showErrors }: Props) {
  const [current, setCurrent] = useState(getServer);
  const [editing, setEditing] = useState(!current);
  const [text, setText] = useState(shortServer(current));
  const parsed = normalizeServer(text);

  useEffect(() => {
    onValidChange(!editing || !!parsed);
    if (editing && parsed) {
      setServer(parsed);
      setCurrent(parsed);
    }
  }, [editing, parsed]);

  return (
    <div className="auth-server">
      <div className="auth-server-row">
        <IonIcon icon={icon} aria-hidden="true" />
        <span>Servidor de la tienda:</span>
        <strong>{current ? shortServer(current) : 'sin elegir'}</strong>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)}>
            Cambiar
          </button>
        )}
      </div>
      {editing && (
        <TextField
          label="Dirección del servidor"
          placeholder="192.168.1.20:8787"
          inputMode="url"
          autoCapitalize="off"
          autoComplete="off"
          value={text}
          onChange={setText}
          error={showErrors && !parsed && 'Escribe la dirección que aparece en la computadora de la caja.'}
          hint="Aparece en la computadora de la caja al encender el servidor"
        />
      )}
    </div>
  );
}

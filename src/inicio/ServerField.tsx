import { IonIcon } from '@ionic/react';
import { useEffect, useState } from 'react';
import { TextField } from '../components/Form';
import { getServer, normalizeServer, setServer, shortServer } from '../lib/server';

// Dirección del servidor de la tienda. Casi nunca se toca: viene puesta, o la trae el QR de la caja.
// Abierta desde el inicio si el teléfono todavía no tiene ninguna.
export function ServerField({ icon, onValidChange, showErrors }: { icon: string; onValidChange: (ok: boolean) => void; showErrors: boolean }) {
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

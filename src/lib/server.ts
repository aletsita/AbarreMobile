import { normalizeServer, shortServer } from './link';

// Dirección de AbarreAPI con el formato del QR de vinculación (https://api.ejemplo.com/__sync).
// De ahí salen la API (/api) y el canal en vivo del personal (/hubs).
// - API en la nube (VITE_SYNC_URL con https://): la dirección queda fija en la app. Nadie la escribe ni la cambia,
//   y clientes y personal se conectan desde cualquier lugar.
// - Desarrollo (http:// o sin valor): se guarda en el teléfono y se puede cambiar en «Iniciar sesión»
//   (la API corriendo en una computadora de la red local).
const KEY = 'tendero.servidor';
export const DEFAULT_SERVER = normalizeServer(import.meta.env.VITE_SYNC_URL ?? '');
export const SERVER_FIXED = !!DEFAULT_SERVER && DEFAULT_SERVER.startsWith('https://');

export function getServer(): string | null {
  // Una dirección vieja guardada en el teléfono (de cuando se probaba en la red local) no gana sobre la fija
  if (SERVER_FIXED) return DEFAULT_SERVER;
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as unknown) : null;
    return typeof saved === 'string' && saved ? saved : DEFAULT_SERVER;
  } catch {
    return DEFAULT_SERVER;
  }
}

export function setServer(url: string) {
  if (SERVER_FIXED) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(url));
  } catch {
    /* almacenamiento bloqueado */
  }
}

// "http://192.168.1.20:8787/__sync" → "http://192.168.1.20:8787/api"
export const apiBaseOf = (syncUrl: string) => syncUrl.replace(/\/__sync$/, '/api');

export { normalizeServer, shortServer };

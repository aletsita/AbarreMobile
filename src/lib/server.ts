import { normalizeServer, shortServer } from './link';

// Dirección del servidor de la tienda (tendero-web: npm run dev:server). La usan la API (/api) y la
// sincronización con la caja (/__sync). Se guarda en el teléfono: la escribe quien inicia sesión o llega
// en el QR de vinculación. VITE_SYNC_URL es solo el valor inicial.
const KEY = 'tendero.servidor';
export const DEFAULT_SERVER = normalizeServer(import.meta.env.VITE_SYNC_URL ?? '');

export function getServer(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as unknown) : null;
    return typeof saved === 'string' && saved ? saved : DEFAULT_SERVER;
  } catch {
    return DEFAULT_SERVER;
  }
}

export function setServer(url: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(url));
  } catch {
    /* almacenamiento bloqueado */
  }
}

// "http://192.168.1.20:8787/__sync" → "http://192.168.1.20:8787/api"
export const apiBaseOf = (syncUrl: string) => syncUrl.replace(/\/__sync$/, '/api');

export { normalizeServer, shortServer };

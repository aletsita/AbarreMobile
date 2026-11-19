import { uid } from '../data/models';

interface Envelope {
  id: string;
  from: string;
  msg: unknown;
}

export interface SyncLink {
  post: (msg: unknown) => void;
  close: () => void;
}

// Dentro de la app nativa una ruta relativa no llega a ningún servidor: la URL debe ser absoluta
export const URL_SYNC = import.meta.env.VITE_SYNC_URL?.trim() ?? '';
export const SYNC_URL_ERROR = !URL_SYNC
  ? 'Falta VITE_SYNC_URL. Copia .env.example a .env, escribe la dirección del servidor de sincronización (por ejemplo http://192.168.1.20:8787/__sync) y vuelve a compilar la app.'
  : !/^https?:\/\//i.test(URL_SYNC)
    ? `VITE_SYNC_URL debe ser una URL absoluta que empiece con http:// o https:// (ahora vale "${URL_SYNC}").`
    : null;

// Une las pestañas del mismo navegador (BroadcastChannel) y los equipos de la misma red (servidor)
export function openSync(channelName: string, onMessage: (msg: unknown) => void, onConnect: () => void): SyncLink {
  const me = uid();
  const seen = new Set<string>();
  let relay = false;
  let closed = false;

  const remember = (id: string) => {
    seen.add(id);
    if (seen.size > 800) seen.delete(seen.values().next().value as string);
  };

  const receive = (env: Envelope) => {
    if (!env || env.from === me || seen.has(env.id)) return;
    remember(env.id);
    onMessage(env.msg);
  };

  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(channelName) : null;
  if (bc) bc.onmessage = (e: MessageEvent<Envelope>) => receive(e.data);

  let es: EventSource | null = null;
  if (typeof EventSource !== 'undefined') {
    es = new EventSource(URL_SYNC);
    es.onopen = () => {
      relay = true;
      onConnect();
    };
    es.onmessage = (e) => {
      try {
        receive(JSON.parse(e.data) as Envelope);
      } catch {
        /* mensaje inválido */
      }
    };
    es.onerror = () => {
      relay = false;
    };
  }

  return {
    post(msg) {
      if (closed) return;
      const env: Envelope = { id: uid(), from: me, msg };
      remember(env.id);
      try {
        bc?.postMessage(env);
      } catch {
        /* canal cerrado */
      }
      if (!relay) return;
      const body = JSON.stringify(env);
      fetch(URL_SYNC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: body.length < 60000,
      }).catch(() => undefined);
    },
    close() {
      closed = true;
      bc?.close();
      es?.close();
    },
  };
}

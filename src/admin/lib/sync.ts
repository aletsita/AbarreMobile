import { uid } from '../../data/models';
import { normalizeServer } from '../../lib/link';

interface Envelope {
  id: string;
  from: string;
  msg: unknown;
}

export interface SyncLink {
  post: (msg: unknown) => void;
  close: () => void;
}

// Dirección inicial del servidor (opcional). La que se usa de verdad la elige el celular al vincularse
// (QR o dirección escrita a mano) y se guarda en el teléfono; ver AppContext.
export const DEFAULT_SYNC_URL = normalizeServer(import.meta.env.VITE_SYNC_URL ?? '');

// Une las pestañas del mismo navegador (BroadcastChannel) y los equipos de la misma red (servidor)
// Sin `url` solo se comunican las pestañas del mismo navegador
export function openSync(
  url: string | null,
  channelName: string,
  onMessage: (msg: unknown) => void,
  onConnect: () => void,
  onStatus?: (connected: boolean) => void,
): SyncLink {
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
  if (url && typeof EventSource !== 'undefined') {
    es = new EventSource(url);
    es.onopen = () => {
      relay = true;
      onStatus?.(true);
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
      onStatus?.(false);
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
      if (!relay || !url) return;
      const body = JSON.stringify(env);
      fetch(url, {
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

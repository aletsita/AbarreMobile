import { ApiError, networkError } from '../errors';
import type { Method, RequestOptions, Transport } from '../transport';
import { handle, simState, subscribe } from './server';

const latency = () => new Promise((r) => setTimeout(r, 250 + Math.random() * 450));
// Sin internet (o con «servidor caído» en el simulador) se comporta como un fetch que falla
const reachable = () => navigator.onLine && !simState.down;

// Copia los datos como si hubieran viajado en JSON (la pantalla no puede tocar los del servidor)
const wire = <T>(v: unknown): T => (v === undefined || v === null ? (v as T) : (JSON.parse(JSON.stringify(v)) as T));

console.info('[api] Servidor SIMULADO: define VITE_API_URL para usar el servidor real.');

export const simTransport: Transport = {
  async request<T>(method: Method, path: string, { token, body, headers }: RequestOptions = {}) {
    await latency();
    if (!reachable()) throw networkError();
    try {
      const res = await handle(method, path, token, wire<Record<string, unknown>>(body ?? {}), headers ?? {});
      return wire<T>(res.data);
    } catch (e) {
      if (e instanceof ApiError) throw new ApiError(e.status, e.code, e.message, wire(e.details));
      throw new ApiError(500, 'error', 'Error del servidor simulado.');
    }
  },

  events(_path, token, onEvent, onStatus) {
    let off: (() => void) | null = null;
    let closed = false;
    // Igual que EventSource: si no hay conexión reintenta cada 3 s
    const connect = () => {
      if (closed) return;
      if (!reachable()) {
        onStatus(false);
        timer = window.setTimeout(connect, 3000);
        return;
      }
      try {
        off = subscribe(token, (type, data) => {
          if (reachable()) onEvent(type, wire(data));
        });
        onStatus(true);
      } catch {
        onStatus(false);
      }
    };
    let timer = window.setTimeout(connect, 300);
    const lost = () => {
      off?.();
      off = null;
      onStatus(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(connect, 3000);
    };
    window.addEventListener('offline', lost);
    return () => {
      closed = true;
      off?.();
      window.clearTimeout(timer);
      window.removeEventListener('offline', lost);
    };
  },
};

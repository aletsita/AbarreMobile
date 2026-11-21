import { ApiError, networkError } from './errors';
import type { Transport } from './transport';

// Transporte HTTP hacia la API del servidor de la tienda (ver API.md)
export function httpTransport(base: string): Transport {
  return {
    async request(method, path, { token, body, headers } = {}) {
      let res: Response;
      try {
        res = await fetch(base + path, {
          method,
          headers: {
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch {
        throw networkError();
      }
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        /* cuerpo que no es JSON */
      }
      if (!res.ok) {
        const err = (data ?? {}) as { code?: string; message?: string };
        throw new ApiError(res.status, err.code ?? `http-${res.status}`, err.message ?? '', data);
      }
      return data as never;
    },

    // EventSource no deja mandar encabezados: el token va en la URL
    events(path, token, onEvent, onStatus) {
      const es = new EventSource(`${base}${path}?token=${encodeURIComponent(token)}`);
      es.onopen = () => onStatus(true);
      es.onerror = () => onStatus(false);
      for (const type of ['pedido', 'tienda']) {
        es.addEventListener(type, (e) => {
          try {
            onEvent(type, JSON.parse((e as MessageEvent<string>).data));
          } catch {
            /* evento inválido */
          }
        });
      }
      return () => es.close();
    },
  };
}

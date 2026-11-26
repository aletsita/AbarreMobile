export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
}

// Cómo llegan las peticiones al servidor (http.ts)
export interface Transport {
  // Resuelve con el cuerpo de la respuesta o rechaza con ApiError
  request<T>(method: Method, path: string, opts?: RequestOptions): Promise<T>;
  // Eventos en vivo (SSE). Devuelve la función para cerrar la conexión.
  events(path: string, token: string, onEvent: (type: string, data: unknown) => void, onStatus: (open: boolean) => void): () => void;
}

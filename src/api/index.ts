import { ApiError } from './errors';
import type { Method, RequestOptions, Transport } from './transport';
import type { AuthResponse, CatalogProduct, Customer, NewOrder, Order } from './types';

// Sin VITE_API_URL la app habla con el servidor simulado (src/api/sim), que vive dentro de la app.
// Con VITE_API_URL habla por HTTP con el servidor real.
export const API_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
export const SIMULATED = !API_URL;

let transportPromise: Promise<Transport> | null = null;
// El simulador se carga aparte (import dinámico): con servidor real nunca se descarga
const transport = () =>
  (transportPromise ??= SIMULATED
    ? import('./sim/transport').then((m) => m.simTransport)
    : import('./http').then((m) => m.httpTransport(API_URL)));

let token: string | null = null;
let onExpired: (() => void) | null = null;

export const setApiToken = (t: string | null) => {
  token = t;
};
// La sesión se registra aquí para cerrarse cuando el servidor responde 401
export const onSessionExpired = (fn: (() => void) | null) => {
  onExpired = fn;
};

async function call<T>(method: Method, path: string, opts: Omit<RequestOptions, 'token'> = {}): Promise<T> {
  const t = await transport();
  const sent = token;
  try {
    return await t.request<T>(method, path, { ...opts, token: sent });
  } catch (e) {
    // Un 401 sin token (por ejemplo, contraseña equivocada) no es una sesión vencida
    if (e instanceof ApiError && e.status === 401 && sent && sent === token) onExpired?.();
    throw e;
  }
}

export const api = {
  register: (input: { name: string; email: string; phone: string; password: string }) =>
    call<AuthResponse>('POST', '/auth/registro', { body: input }),
  login: (email: string, password: string) => call<AuthResponse>('POST', '/auth/entrar', { body: { email, password } }),
  // El celular de la tienda ya pasó la vinculación con la caja; el servidor le da su token de dispositivo
  linkDevice: (deviceId: string, name: string) => call<{ token: string }>('POST', '/auth/dispositivo', { body: { deviceId, name } }),
  logout: () => call<void>('POST', '/auth/salir'),
  me: () => call<Customer>('GET', '/yo'),

  registerPush: (pushToken: string, platform: string) => call<void>('POST', '/yo/push', { body: { token: pushToken, platform } }),
  unregisterPush: (pushToken: string) => call<void>('DELETE', '/yo/push', { body: { token: pushToken } }),

  catalog: () => call<CatalogProduct[]>('GET', '/catalogo'),
  orders: () => call<Order[]>('GET', '/pedidos'),
  order: (id: string) => call<Order>('GET', `/pedidos/${encodeURIComponent(id)}`),
  // 409 → ApiError con details: OrderConflict
  createOrder: (order: NewOrder, idempotencyKey: string) =>
    call<Order>('POST', '/pedidos', { body: order, headers: { 'Idempotency-Key': idempotencyKey } }),

  // Ruta de la tienda: con token de cliente debe responder 403 (se usa en la prueba de acceso)
  storeOrders: () => call<Order[]>('GET', '/tienda/pedidos'),

  // Cambios de mis pedidos en vivo. Devuelve la función para cerrar.
  watchOrders(onOrder: (o: Order) => void, onStatus: (open: boolean) => void): () => void {
    let close: (() => void) | null = null;
    let cancelled = false;
    const sent = token;
    if (!sent) return () => undefined;
    void transport().then((t) => {
      if (cancelled) return;
      close = t.events('/pedidos/eventos', sent, (type, data) => type === 'pedido' && onOrder(data as Order), onStatus);
    });
    return () => {
      cancelled = true;
      close?.();
    };
  },
};

// Lee el payload de un JWT sin verificar la firma (eso lo hace el servidor)
export function decodeToken<T>(jwt: string): T | null {
  try {
    const part = jwt.split('.')[1];
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json))) as T;
  } catch {
    return null;
  }
}

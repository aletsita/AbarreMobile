import { apiBaseOf, getServer } from '../lib/server';
import { ApiError } from './errors';
import { httpTransport } from './http';
import type { Method, RequestOptions, Transport } from './transport';
import type { AuthResponse, CatalogProduct, Customer, NewOrder, Order } from './types';

// La API vive en el mismo servidor que la sincronización con la caja (ver API.md)
function transport(): Transport {
  const server = getServer();
  if (!server) throw new ApiError(0, 'sin-servidor', 'Falta la dirección del servidor de la tienda.');
  return httpTransport(apiBaseOf(server));
}

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
  const t = transport();
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
  logout: () => call<void>('POST', '/auth/salir'),
  me: () => call<Customer>('GET', '/yo'),

  catalog: () => call<CatalogProduct[]>('GET', '/catalogo'),
  orders: () => call<Order[]>('GET', '/pedidos'),
  order: (id: string) => call<Order>('GET', `/pedidos/${encodeURIComponent(id)}`),
  // Pedido cancelado por la tienda: quitarlo de los activos o pasar a elegir otros productos
  resolveOrder: (id: string, accion: 'quitar' | 'reemplazar') =>
    call<Order>('POST', `/pedidos/${encodeURIComponent(id)}/resolver`, { body: { accion } }),
  // 409 → ApiError con details: OrderConflict
  createOrder: (order: NewOrder, idempotencyKey: string) =>
    call<Order>('POST', '/pedidos', { body: order, headers: { 'Idempotency-Key': idempotencyKey } }),

  // Cambios de mis pedidos en vivo. Devuelve la función para cerrar.
  watchOrders(onOrder: (o: Order) => void, onStatus: (open: boolean) => void): () => void {
    const sent = token;
    if (!sent) return () => undefined;
    try {
      return transport().events('/pedidos/eventos', sent, (type, data) => type === 'pedido' && onOrder(data as Order), onStatus);
    } catch {
      onStatus(false);
      return () => undefined;
    }
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

// SERVIDOR SIMULADO. Vive dentro de la app mientras no exista el backend real (ver API_SIMULADA.md).
// Imita lo que hará el servidor: guarda usuarios y pedidos, firma tokens con rol, rechaza al cliente
// en las rutas de la tienda (403), responde 401 con sesión vencida y 409 si cambió el precio o la existencia.
// Los datos se guardan en localStorage del teléfono ('tendero.sim'); no son reales ni se comparten.
import { PRODUCTS } from '../../data/seed';
import { ApiError } from '../errors';
import type { Method } from '../transport';
import type { CatalogProduct, Customer, NewOrder, Order, OrderChange, OrderConflict, OrderStatus, Role, TokenClaims } from '../types';
import { ORDER_STEPS, STATUS_LABEL } from '../types';
import { SIM_PUSH_EVENT, type SimPush } from './events';

interface SimUser extends Customer {
  salt: string;
  hash: string;
  createdAt: string;
}

interface SimSession {
  jti: string;
  sub: string;
  role: Role;
  exp: number;
}

interface SimOrder extends Order {
  userId: string;
}

interface Db {
  users: SimUser[];
  sessions: SimSession[];
  products: CatalogProduct[];
  orders: SimOrder[];
  idem: Record<string, string>; // `${userId}:${clave}` → id del pedido
  push: { userId: string; token: string; platform: string }[];
  folio: number;
}

const KEY = 'tendero.sim';
const DAY = 86400;
const CLIENT_TTL = 7 * DAY;
const DEVICE_TTL = 365 * DAY;
export const SIM_STORE_DEVICE = 'sim-tienda';

const catalogFromSeed = (): CatalogProduct[] =>
  PRODUCTS.map(({ id, name, category, price, stock, photo }) => ({ id, name, category, price, stock, ...(photo ? { photo } : {}) }));

function fresh(): Db {
  return { users: [], sessions: [], products: catalogFromSeed(), orders: [], idem: {}, push: [], folio: 1000 };
}

let db: Db = load();

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...(JSON.parse(raw) as Db) };
  } catch {
    /* datos dañados: se empieza de cero */
  }
  return fresh();
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* almacenamiento lleno */
  }
}

const now = () => Math.floor(Date.now() / 1000);
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------- tokens con forma de JWT (la firma es de mentira) ----------

const b64url = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function issue(sub: string, role: Role, name: string): string {
  const ttl = role === 'cliente' ? CLIENT_TTL : DEVICE_TTL;
  const s: SimSession = { jti: rid(), sub, role, exp: now() + ttl };
  db.sessions = [...db.sessions.filter((x) => x.exp > now()), s];
  save();
  const claims: TokenClaims & { jti: string } = { sub, role, name, exp: s.exp, jti: s.jti };
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims)}.simulado`;
}

function sessionOf(token: string | null | undefined): SimSession {
  if (!token) throw new ApiError(401, 'sin-sesion', 'Inicia sesión para continuar.');
  let jti = '';
  try {
    jti = (JSON.parse(decodeURIComponent(escape(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))) as { jti: string }).jti;
  } catch {
    /* token inválido */
  }
  const s = db.sessions.find((x) => x.jti === jti);
  if (!s || s.exp <= now()) throw new ApiError(401, 'sesion-vencida', 'Tu sesión venció.');
  return s;
}

// El servidor real hará esto en cada ruta: el rol sale del token, nunca de la app
function requireRole(token: string | null | undefined, role: Role): SimSession {
  const s = sessionOf(token);
  if (s.role !== role) throw new ApiError(403, 'prohibido', 'No tienes permiso para esta acción.');
  return s;
}

// ---------- contraseñas ----------

async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fuera de un contexto seguro (http://IP) no hay crypto.subtle: hash simple, solo para la simulación
  let h = 2166136261;
  for (const b of data) h = Math.imul(h ^ b, 16777619) >>> 0;
  return `fnv${h.toString(16)}`;
}

// ---------- validación (la misma que muestra la app; el servidor no confía en ella) ----------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateRegister(b: Record<string, unknown>) {
  const fields: Record<string, string> = {};
  const name = String(b.name ?? '').trim();
  const email = String(b.email ?? '').trim().toLowerCase();
  const phone = String(b.phone ?? '').replace(/\D/g, '');
  const password = String(b.password ?? '');
  if (name.length < 2) fields.name = 'Escribe tu nombre.';
  if (!EMAIL.test(email)) fields.email = 'Escribe un correo válido.';
  if (phone.length !== 10) fields.phone = 'El teléfono debe tener 10 dígitos.';
  if (password.length < 8) fields.password = 'La contraseña debe tener al menos 8 caracteres.';
  if (Object.keys(fields).length) throw new ApiError(422, 'datos-invalidos', 'Revisa los datos marcados.', { fields });
  return { name, email, phone, password };
}

const publicUser = ({ id, name, email, phone }: SimUser): Customer => ({ id, name, email, phone });
const publicOrder = ({ userId: _u, ...o }: SimOrder): Order => o;

// ---------- eventos en vivo y push ----------

type Listener = (type: string, data: unknown) => void;
const listeners = new Map<string, Set<Listener>>();

export function subscribe(token: string, fn: Listener): () => void {
  const s = requireRole(token, 'cliente');
  const set = listeners.get(s.sub) ?? new Set<Listener>();
  set.add(fn);
  listeners.set(s.sub, set);
  return () => set.delete(fn);
}

// Notificación push simulada: la app la recibe por un evento de la ventana (ver client/lib/push.ts)
export let lastPush: SimPush | null = null;

function notify(o: SimOrder, push = true) {
  listeners.get(o.userId)?.forEach((fn) => fn('pedido', publicOrder(o)));
  if (!push) return;
  const tokens = db.push.filter((p) => p.userId === o.userId);
  if (!tokens.length) return;
  const detail: SimPush = {
    title: `Pedido #${o.folio}: ${STATUS_LABEL[o.status]}`,
    body: o.status === 'listo' ? 'Ya puedes pasar a recogerlo a la tienda.' : `Tu pedido ahora está «${STATUS_LABEL[o.status]}».`,
    data: { orderId: o.id, status: o.status },
  };
  // Solo llegan los tokens simulados; un token FCM real necesitaría Firebase en el servidor
  if (!tokens.some((t) => t.token.startsWith('sim-'))) return;
  lastPush = detail;
  window.dispatchEvent(new CustomEvent(SIM_PUSH_EVENT, { detail }));
}

// ---------- rutas ----------

type Body = Record<string, unknown>;

export async function handle(method: Method, path: string, token: string | null | undefined, body: Body, headers: Record<string, string>): Promise<{ status: number; data: unknown }> {
  const ok = (data: unknown, status = 200) => ({ status, data });
  const m = path.match(/^\/(pedidos|tienda\/pedidos)\/([^/]+)$/);
  const route = m ? `${method} /${m[1]}/:id` : `${method} ${path}`;
  const id = m ? decodeURIComponent(m[2]) : '';

  switch (route) {
    case 'POST /auth/registro': {
      const { name, email, phone, password } = validateRegister(body);
      if (db.users.some((u) => u.email === email)) {
        throw new ApiError(409, 'correo-registrado', 'Ya hay una cuenta con ese correo. Inicia sesión.', { fields: { email: 'Ya hay una cuenta con ese correo.' } });
      }
      const salt = rid();
      const user: SimUser = { id: `c${rid()}`, name, email, phone, salt, hash: await hashPassword(password, salt), createdAt: new Date().toISOString() };
      db.users.push(user);
      save();
      return ok({ token: issue(user.id, 'cliente', user.name), user: publicUser(user) }, 201);
    }

    case 'POST /auth/entrar': {
      const email = String(body.email ?? '').trim().toLowerCase();
      const user = db.users.find((u) => u.email === email);
      if (!user || (await hashPassword(String(body.password ?? ''), user.salt)) !== user.hash) {
        throw new ApiError(401, 'credenciales', 'El correo o la contraseña no coinciden.');
      }
      return ok({ token: issue(user.id, 'cliente', user.name), user: publicUser(user) });
    }

    case 'POST /auth/dispositivo': {
      // El servidor real debe validar aquí el código de vinculación; la simulación confía en la caja
      const deviceId = String(body.deviceId ?? '');
      if (!deviceId) throw new ApiError(422, 'datos-invalidos', 'Falta el dispositivo.');
      return ok({ token: issue(deviceId, 'dispositivo', String(body.name ?? 'Celular')) });
    }

    case 'POST /auth/salir': {
      const s = sessionOf(token);
      db.sessions = db.sessions.filter((x) => x.jti !== s.jti);
      save();
      return ok(null, 204);
    }

    case 'GET /yo': {
      const s = requireRole(token, 'cliente');
      const user = db.users.find((u) => u.id === s.sub);
      if (!user) throw new ApiError(401, 'sesion-vencida', 'Tu sesión venció.');
      return ok(publicUser(user));
    }

    case 'POST /yo/push': {
      const s = requireRole(token, 'cliente');
      const pushToken = String(body.token ?? '');
      if (!pushToken) throw new ApiError(422, 'datos-invalidos', 'Falta el token.');
      db.push = [...db.push.filter((p) => p.token !== pushToken), { userId: s.sub, token: pushToken, platform: String(body.platform ?? '') }];
      save();
      return ok(null, 204);
    }

    case 'DELETE /yo/push': {
      const s = sessionOf(token);
      db.push = db.push.filter((p) => !(p.userId === s.sub && p.token === body.token));
      save();
      return ok(null, 204);
    }

    case 'GET /catalogo': {
      sessionOf(token);
      return ok(db.products);
    }

    case 'GET /pedidos': {
      const s = requireRole(token, 'cliente');
      return ok(db.orders.filter((o) => o.userId === s.sub).map(publicOrder));
    }

    case 'GET /pedidos/:id': {
      const s = requireRole(token, 'cliente');
      // El pedido de otra persona responde igual que uno que no existe
      const o = db.orders.find((x) => x.id === id && x.userId === s.sub);
      if (!o) throw new ApiError(404, 'no-encontrado', 'No encontramos ese pedido.');
      return ok(publicOrder(o));
    }

    case 'POST /pedidos':
      return ok(createOrder(requireRole(token, 'cliente'), body as unknown as NewOrder, headers['Idempotency-Key'] ?? ''), 201);

    case 'GET /tienda/pedidos': {
      requireRole(token, 'dispositivo');
      return ok(db.orders.map(publicOrder));
    }

    case 'PATCH /tienda/pedidos/:id': {
      requireRole(token, 'dispositivo');
      const o = db.orders.find((x) => x.id === id);
      if (!o) throw new ApiError(404, 'no-encontrado', 'No encontramos ese pedido.');
      const status = body.status as OrderStatus;
      if (!ORDER_STEPS.includes(status)) throw new ApiError(422, 'datos-invalidos', 'Estado inválido.');
      // Para entregar, la tienda debe presentar el código que muestra el teléfono del cliente
      if (status === 'entregado' && o.status !== 'entregado' && o.pickupCode && body.pickupCode !== o.pickupCode) {
        throw new ApiError(422, 'codigo-recoger', 'El código para recoger no coincide.', { fields: { pickupCode: 'Código incorrecto.' } });
      }
      if (o.status !== status) {
        o.status = status;
        o.history.push({ status, at: new Date().toISOString() });
        save();
        notify(o);
      }
      return ok(publicOrder(o));
    }
  }
  throw new ApiError(404, 'ruta', `No existe ${method} ${path}`);
}

function createOrder(s: SimSession, body: NewOrder, key: string): Order {
  if (!key) throw new ApiError(400, 'sin-clave', 'Falta la clave de idempotencia.');
  // Misma clave = mismo pedido (el teléfono reintentó tras perder la respuesta)
  const prev = db.idem[`${s.sub}:${key}`];
  const existing = prev && db.orders.find((o) => o.id === prev);
  if (existing) return publicOrder(existing);

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length || items.some((i) => !Number.isInteger(i.qty) || i.qty < 1)) {
    throw new ApiError(422, 'datos-invalidos', 'El pedido no tiene productos válidos.');
  }
  if (!/^\d{6}$/.test(String(body.pickupCode ?? ''))) {
    throw new ApiError(422, 'datos-invalidos', 'Falta el código para recoger.', { fields: { pickupCode: 'Debe tener 6 dígitos.' } });
  }

  const changes: OrderChange[] = [];
  for (const i of items) {
    const p = db.products.find((x) => x.id === i.productId);
    if (!p) changes.push({ kind: 'no-disponible', productId: i.productId, name: 'Producto' });
    else if (p.stock < 1) changes.push({ kind: 'no-disponible', productId: p.id, name: p.name });
    else {
      if (p.price !== i.price) changes.push({ kind: 'precio', productId: p.id, name: p.name, before: i.price, after: p.price });
      if (p.stock < i.qty) changes.push({ kind: 'existencia', productId: p.id, name: p.name, requested: i.qty, available: p.stock });
    }
  }
  const total = round(items.reduce((t, i) => t + (db.products.find((p) => p.id === i.productId)?.price ?? 0) * i.qty, 0));
  if (changes.length || total !== round(body.expectedTotal)) {
    const conflict: OrderConflict = {
      code: 'pedido-cambio',
      message: 'Algunos productos cambiaron desde que los agregaste.',
      changes,
      products: db.products.filter((p) => items.some((i) => i.productId === p.id)),
    };
    throw new ApiError(409, conflict.code, conflict.message, conflict);
  }

  const at = new Date().toISOString();
  const order: SimOrder = {
    id: `o${rid()}`,
    folio: ++db.folio,
    status: 'pendiente',
    items: items.map((i) => {
      const p = db.products.find((x) => x.id === i.productId)!;
      p.stock -= i.qty;
      return { productId: p.id, name: p.name, price: p.price, qty: i.qty };
    }),
    total,
    note: String(body.note ?? '').trim().slice(0, 200),
    createdAt: at,
    history: [{ status: 'pendiente', at }],
    pickupCode: body.pickupCode,
    userId: s.sub,
  };
  db.orders.unshift(order);
  db.idem[`${s.sub}:${key}`] = order.id;
  save();
  notify(order, false);
  return publicOrder(order);
}

const round = (n: number) => Math.round(n * 100) / 100;

// ---------- controles del simulador (hacen de «la tienda» y de fallas del servidor) ----------

export const simState = { down: false };

let storeToken: string | null = null;
// La tienda simulada usa su propio token de dispositivo y pasa por las mismas reglas de rol
function asStore() {
  try {
    if (storeToken) return sessionOf(storeToken) && storeToken;
  } catch {
    /* vencido: se emite otro */
  }
  return (storeToken = issue(SIM_STORE_DEVICE, 'dispositivo', 'Tienda (simulada)'));
}

export const simulator = {
  async advance(orderId: string) {
    const o = db.orders.find((x) => x.id === orderId);
    if (!o || o.status === 'entregado') return;
    const next = ORDER_STEPS[ORDER_STEPS.indexOf(o.status) + 1];
    // La tienda simulada "escanea" el código del cliente al entregar
    await handle('PATCH', `/tienda/pedidos/${orderId}`, asStore(), { status: next, pickupCode: o.pickupCode }, {});
  },
  async advanceOldest() {
    const o = [...db.orders].reverse().find((x) => x.status !== 'entregado');
    if (o) await simulator.advance(o.id);
    return !!o;
  },
  // Sube 10 % el precio de esos productos (para provocar el 409)
  raisePrices(productIds: string[]) {
    db.products.forEach((p) => productIds.includes(p.id) && (p.price = round(Math.ceil(p.price * 1.1))));
    save();
  },
  // Deja 1 pieza (o ninguna) de esos productos
  dropStock(productIds: string[]) {
    db.products.forEach((p) => productIds.includes(p.id) && (p.stock = Math.min(p.stock, 1)));
    save();
  },
  expireSession(token: string | null) {
    const jti = token ? (JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { jti: string }).jti : '';
    db.sessions = db.sessions.map((s) => (s.jti === jti ? { ...s, exp: 0 } : s));
    save();
  },
  reset() {
    // Conserva las cuentas y las sesiones; borra pedidos y regresa el catálogo original
    db = { ...fresh(), users: db.users, sessions: db.sessions, push: db.push };
    save();
  },
};

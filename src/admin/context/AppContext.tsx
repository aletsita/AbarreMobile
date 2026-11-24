import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  money,
  PAYMENT_LABEL,
  uid,
  type CashCut,
  type CashMethod,
  type CashMovement,
  type CreditMovement,
  type Customer,
  type Device,
  type Movement,
  type Product,
  type Sale,
  type SaleItem,
  type Shift,
  type Store,
  type TicketConfig,
  type User,
} from '../../data/models';
import { ACTIVE_STATUSES, isPaidOnline, nextStatus, orderFolio, PICKUP_CODE, reservedStock, type CancelReason, type OrderRequest, type PickupOrder } from '../../data/pickup';
import { CASH_MOVEMENTS, CREDIT_MOVEMENTS, CUSTOMERS, CUTS, DEVICES, MOVEMENTS, PRODUCTS, SALES, SHIFT, STORE, TICKET, USERS } from '../../data/seed';
import { deviceModel } from '../lib/device';
import { loadQueue, nativeQueue, saveQueue } from '../lib/queue';
import { normalizeServer } from '../../lib/link';
import { availableStock, piecesByProduct, type Shortfall } from '../../domain/stock';
import { DEFAULT_SYNC_URL, openSync, type SendResult, type SyncLink } from '../lib/sync';

export interface TicketLine {
  product: Product;
  qty: number;
  source: 'movil' | 'manual';
  flashAt: number;
}

export type SentStatus = 'en-caja' | 'cobrado' | 'cancelado';
export type SyncState = 'pendiente' | 'subiendo';

export interface SentItem {
  id: string;
  product: Product;
  qty: number;
  at: number;
  status: SentStatus;
  deviceId: string;
  accountId?: string;
  // Nombre de la cuenta en la que quedó (para el historial del celular)
  accountName?: string;
}

// Cuentas abiertas a la vez: la activa vive en `ticket` + `account`, las demás esperan en `parked`
export interface OpenAccount {
  id: string;
  name: string;
  customerId: string | null;
  openedAt: number;
  lines: TicketLine[];
}

export type AccountInfo = Omit<OpenAccount, 'lines'>;

export interface AccountView extends AccountInfo {
  active: boolean;
  count: number;
  total: number;
}

export type ProductView = Product & { sync?: SyncState };
export interface AccountOption {
  id: string;
  name: string;
  customerId: string | null;
  active: boolean;
  count: number;
}
export type SentView = Omit<SentItem, 'status'> & { status: SentStatus | SyncState };

export interface LastScan {
  name: string;
  deviceId: string;
  at: number;
}

interface Pairing {
  code: string;
  expiresAt: number;
}

interface Data {
  version: number;
  store: Store;
  ticketConfig: TicketConfig;
  users: User[];
  products: Product[];
  movements: Movement[];
  ticket: TicketLine[];
  account: AccountInfo;
  parked: OpenAccount[];
  customers: Customer[];
  creditMovements: CreditMovement[];
  sales: Sale[];
  sent: SentItem[];
  lastScan: LastScan | null;
  cuts: CashCut[];
  cashMovements: CashMovement[];
  shift: Shift;
  devices: Device[];
  pairing: Pairing | null;
  closedCutId: string | null;
  lastSaleId: string | null;
  // Pide y recoge (viene de la caja)
  orders: PickupOrder[];
}

type StockEntry = { productId: string; qty: number };

type Action =
  | { type: 'SCAN_TO_REGISTER'; product: Product; qty: number; sentId: string; at: number; deviceId: string; accountId?: string }
  | { type: 'REMOVE_SENT'; sentId: string }
  | { type: 'TICKET_ADD'; product: Product; qty: number; at: number }
  | { type: 'TICKET_QTY'; productId: string; delta: number }
  | { type: 'TICKET_REMOVE'; productId: string }
  | { type: 'TICKET_CLEAR' }
  | { type: 'CONFIRM_SALE'; sale: Sale }
  | { type: 'MARK_SALE_SYNCED'; saleId: string }
  | { type: 'UPSERT_PRODUCT'; product: Product; isNew: boolean; at: number }
  | { type: 'ADD_STOCK'; entries: StockEntry[]; at: number; note: string }
  | { type: 'ADD_DEVICE'; device: Device }
  | { type: 'REMOVE_DEVICE'; id: string }
  | { type: 'DEVICE_SEEN'; id: string; at: number }
  | { type: 'SET_PAIRING'; pairing: Pairing | null }
  | { type: 'CLOSE_CUT'; cut: CashCut }
  | { type: 'OPEN_SHIFT'; shift: Shift }
  | { type: 'ADD_CASH_MOVEMENT'; movement: CashMovement }
  | { type: 'UPDATE_STORE'; store: Store }
  | { type: 'UPDATE_TICKET_CONFIG'; config: TicketConfig }
  | { type: 'UPSERT_USER'; user: User; prevEmail?: string }
  | { type: 'ACCOUNT_NEW'; id: string; at: number }
  | { type: 'ACCOUNT_SWITCH'; id: string }
  | { type: 'ACCOUNT_UPDATE'; id: string; name: string; customerId: string | null }
  | { type: 'UPSERT_CUSTOMER'; customer: Customer }
  | { type: 'CREDIT_PAYMENT'; movement: CreditMovement }
  | { type: 'REPLACE_DATA'; data: Data }
  // Pide y recoge: mismas reglas que en la caja, para que este celular pueda prepararlos y entregarlos
  | { type: 'ORDER_RECEIVED'; request: OrderRequest }
  | { type: 'ORDER_ADVANCE'; id: string; from: PickupOrder['status']; at: number }
  | { type: 'ORDER_DELIVER'; id: string; sale: Sale; payment: { method: CashMethod; received: number }; pickupCode: string }
  | { type: 'ORDER_CANCEL'; id: string; reason: CancelReason; missing: string[]; note?: string; at: number }
  | { type: 'ORDER_ISSUE'; id: string; missing: string[]; at: number }
  | { type: 'ORDER_EDIT'; id: string; items: { productId: string; qty: number }[]; at: number }
  // Existencia y apartado según el servidor: llega después de cada venta, pedido o ajuste (ver server/api.js)
  | { type: 'STOCK'; items: { productId: string; stock: number; reserved: number }[]; at: number };

// Resultado de lo que el servidor revisa antes de aplicarlo (preparar, entregar)
export type Outcome<T> =
  | { ok: true; value: T; offline?: boolean }
  | { ok: false; code?: string; message: string; shortages?: Shortfall[] };

const refused = (r: Exclude<SendResult, { ok: true }>, fallback: string): Outcome<never> => ({
  ok: false,
  code: r.body.code,
  message: r.body.message || fallback,
  shortages: r.body.faltantes,
});

type Message = Action | { type: 'PING'; key: string } | { type: 'BYE'; key: string } | { type: 'WHO' } | { type: 'SNAPSHOT'; data: Data };

type Op =
  | { id: string; kind: 'envio'; product: Product; qty: number; at: number; accountId?: string }
  | { id: string; kind: 'producto'; product: Product; isNew: boolean; at: number }
  | { id: string; kind: 'stock'; entries: StockEntry[]; at: number };

// Lo que hizo este celular, para la pantalla de Actividad (solo se guarda en este celular)
export interface ActivityItem {
  id: string;
  kind: 'producto' | 'stock' | 'pedido';
  title: string;
  detail: string;
  at: number;
}

export interface PendingItem {
  id: string;
  kind: Op['kind'];
  title: string;
  detail: string;
  at: number;
  status: SyncState;
}

const VERSION = 5;
const DATA_KEY = 'tendero.datos';
const DEVICE_KEY = 'tendero.dispositivo';
const SERVER_KEY = 'tendero.servidor';
const LINK_TIMEOUT_MS = 10000;
const QUEUE_KEY = 'tendero.pendientes.movil';
const ACTIVITY_KEY = 'tendero.actividad.movil';
const ACTIVITY_MAX = 150;
const CHANNEL = 'tendero';
const PING_MS = 4000;
const STALE_MS = 10000;

function seedData(): Data {
  return {
    version: VERSION,
    store: STORE,
    ticketConfig: TICKET,
    users: USERS,
    products: PRODUCTS,
    movements: MOVEMENTS,
    ticket: [],
    account: { id: 'a1', name: 'Cuenta 1', customerId: null, openedAt: 0 },
    parked: [],
    customers: CUSTOMERS,
    creditMovements: CREDIT_MOVEMENTS,
    sales: SALES,
    sent: [],
    lastScan: null,
    cuts: CUTS,
    cashMovements: CASH_MOVEMENTS,
    shift: SHIFT,
    devices: DEVICES,
    pairing: null,
    closedCutId: null,
    lastSaleId: null,
    orders: [],
  };
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin espacio o almacenamiento bloqueado
  }
}

// Los datos de la caja anteriores a Pide y recoge no traen pedidos
const withOrders = (d: Data): Data => (Array.isArray(d.orders) ? d : { ...d, orders: [] });

function loadData(): Data {
  const saved = read<Data | null>(DATA_KEY, null);
  return saved && saved.version === VERSION ? withOrders(saved) : seedData();
}

function addToTicket(ticket: TicketLine[], product: Product, qty: number, source: TicketLine['source'], at: number) {
  if (ticket.some((l) => l.product.id === product.id)) {
    return ticket.map((l) => (l.product.id === product.id ? { ...l, product, qty: l.qty + qty, source, flashAt: at } : l));
  }
  return [{ product, qty, source, flashAt: at }, ...ticket];
}

const iso = (at: number) => new Date(at).toISOString();

// Siguiente "Cuenta N" libre; se calcula en el reducer para que todos los equipos lleguen al mismo nombre
function nextAccountName(accounts: { name: string }[]) {
  const used = accounts.map((a) => Number(/^Cuenta (\d+)$/.exec(a.name)?.[1] ?? 0));
  return `Cuenta ${Math.max(0, ...used) + 1}`;
}

// La cuenta activa pasa a espera; si está vacía y sin cliente simplemente se descarta
function parkActive(s: Data): OpenAccount[] {
  if (!s.ticket.length && !s.account.customerId) return s.parked;
  return [...s.parked, { ...s.account, lines: s.ticket }];
}

// Al cobrar o cancelar, la cuenta activa se cierra y su lugar lo toma una vacía
function resetAccount(s: Data, at: number): AccountInfo {
  return { id: s.account.id, name: nextAccountName(s.parked), customerId: null, openedAt: at };
}

const inActive = (s: Data, x: SentItem) => !x.accountId || x.accountId === s.account.id;

function reducer(s: Data, a: Action): Data {
  switch (a.type) {
    case 'SCAN_TO_REGISTER': {
      // El celular elige la cuenta; sin accountId, o si esa cuenta ya no está abierta, va a la activa
      const parkedTarget = a.accountId && a.accountId !== s.account.id ? s.parked.find((p) => p.id === a.accountId) : undefined;
      return {
        ...s,
        ticket: parkedTarget ? s.ticket : addToTicket(s.ticket, a.product, a.qty, 'movil', a.at),
        parked: parkedTarget
          ? s.parked.map((p) => (p.id === parkedTarget.id ? { ...p, lines: addToTicket(p.lines, a.product, a.qty, 'movil', a.at) } : p))
          : s.parked,
        sent: [
          {
            id: a.sentId,
            product: a.product,
            qty: a.qty,
            at: a.at,
            status: 'en-caja' as SentStatus,
            deviceId: a.deviceId,
            accountId: parkedTarget?.id ?? s.account.id,
            accountName: parkedTarget?.name ?? s.account.name,
          },
          ...s.sent,
        ].slice(0, 200),
        lastScan: { name: a.product.name, deviceId: a.deviceId, at: a.at },
      };
    }
    case 'REMOVE_SENT': {
      const item = s.sent.find((x) => x.id === a.sentId);
      if (!item) return s;
      const take = (lines: TicketLine[]) =>
        lines.map((l) => (l.product.id === item.product.id ? { ...l, qty: l.qty - item.qty } : l)).filter((l) => l.qty > 0);
      const waiting = item.status === 'en-caja';
      return {
        ...s,
        ticket: waiting && inActive(s, item) ? take(s.ticket) : s.ticket,
        parked: waiting ? s.parked.map((p) => (p.id === item.accountId ? { ...p, lines: take(p.lines) } : p)) : s.parked,
        sent: s.sent.filter((x) => x.id !== a.sentId),
      };
    }
    case 'TICKET_ADD':
      return { ...s, ticket: addToTicket(s.ticket, a.product, a.qty, 'manual', a.at) };
    case 'TICKET_QTY':
      return {
        ...s,
        ticket: s.ticket.map((l) => (l.product.id === a.productId ? { ...l, qty: l.qty + a.delta } : l)).filter((l) => l.qty > 0),
      };
    case 'TICKET_REMOVE':
      return { ...s, ticket: s.ticket.filter((l) => l.product.id !== a.productId) };
    case 'TICKET_CLEAR':
      return {
        ...s,
        ticket: [],
        account: resetAccount(s, s.account.openedAt),
        sent: s.sent.map((x) => (x.status === 'en-caja' && inActive(s, x) ? { ...x, status: 'cancelado' } : x)),
      };
    case 'CONFIRM_SALE': {
      if (a.sale.orderId && s.sales.some((x) => x.id === a.sale.id || x.orderId === a.sale.orderId)) return s;
      const moves: Movement[] = a.sale.items.map((i) => ({
        id: `${a.sale.id}-${i.productId}`,
        productId: i.productId,
        type: 'venta',
        qty: -i.qty,
        date: a.sale.date,
        note: `Venta #${a.sale.folio}`,
      }));
      const charge: CreditMovement | null =
        a.sale.method === 'credito' && a.sale.customerId
          ? {
              id: `cr-${a.sale.id}`,
              customerId: a.sale.customerId,
              type: 'cargo',
              amount: a.sale.total,
              date: a.sale.date,
              employee: a.sale.employee,
              note: `Venta #${a.sale.folio}`,
              saleId: a.sale.id,
            }
          : null;
      return {
        ...s,
        sales: [a.sale, ...s.sales],
        movements: [...moves, ...s.movements],
        customers: charge ? s.customers.map((c) => (c.id === charge.customerId ? { ...c, balance: c.balance + charge.amount } : c)) : s.customers,
        creditMovements: charge ? [charge, ...s.creditMovements] : s.creditMovements,
        products: s.products.map((p) => {
          const it = a.sale.items.find((i) => i.productId === p.id);
          return it ? { ...p, stock: Math.max(0, p.stock - it.qty) } : p;
        }),
        // La venta de un pedido no sale de la cuenta abierta: esa se queda como está
        ...(a.sale.orderId
          ? {}
          : {
              ticket: [],
              account: resetAccount(s, Date.parse(a.sale.date)),
              sent: s.sent.map((x) => (x.status === 'en-caja' && inActive(s, x) ? { ...x, status: 'cobrado' as const } : x)),
              lastSaleId: a.sale.id,
            }),
      };
    }
    case 'MARK_SALE_SYNCED':
      return { ...s, sales: s.sales.map((x) => (x.id === a.saleId ? { ...x, pending: false } : x)) };
    case 'UPSERT_PRODUCT': {
      const prev = s.products.find((p) => p.id === a.product.id);
      const diff = a.product.stock - (prev?.stock ?? 0);
      const move: Movement | null = !prev
        ? { id: uid(), productId: a.product.id, type: 'alta', qty: a.product.stock, date: iso(a.at), note: 'Alta del producto' }
        : diff !== 0
          ? { id: uid(), productId: a.product.id, type: 'ajuste', qty: diff, date: iso(a.at), note: 'Ajuste de existencia' }
          : null;
      return {
        ...s,
        products: prev ? s.products.map((p) => (p.id === a.product.id ? a.product : p)) : [a.product, ...s.products],
        movements: move ? [move, ...s.movements] : s.movements,
        ticket: s.ticket.map((l) => (l.product.id === a.product.id ? { ...l, product: a.product } : l)),
        parked: s.parked.map((p) => ({ ...p, lines: p.lines.map((l) => (l.product.id === a.product.id ? { ...l, product: a.product } : l)) })),
      };
    }
    case 'ADD_STOCK':
      return {
        ...s,
        products: s.products.map((p) => {
          const qty = a.entries.filter((e) => e.productId === p.id).reduce((n, e) => n + e.qty, 0);
          return qty ? { ...p, stock: p.stock + qty } : p;
        }),
        movements: [
          ...a.entries.map((e) => ({ id: uid(), productId: e.productId, type: 'entrada' as const, qty: e.qty, date: iso(a.at), note: a.note })),
          ...s.movements,
        ],
      };
    case 'ADD_DEVICE':
      return { ...s, devices: [...s.devices.filter((d) => d.id !== a.device.id), a.device] };
    case 'REMOVE_DEVICE':
      return { ...s, devices: s.devices.filter((d) => d.id !== a.id) };
    case 'DEVICE_SEEN':
      return { ...s, devices: s.devices.map((d) => (d.id === a.id ? { ...d, lastSeen: iso(a.at) } : d)) };
    case 'REPLACE_DATA':
      return withOrders(a.data);
    case 'ORDER_RECEIVED': {
      const r = a.request;
      if (s.closedCutId || s.orders.some((o) => o.id === r.id) || !PICKUP_CODE.test(String(r.pickupCode ?? ''))) return s;
      if (r.payment && r.payment.status !== 'pagado') return s;
      const qty: Record<string, number> = {};
      for (const it of r.items) qty[it.productId] = (qty[it.productId] ?? 0) + Math.floor(it.qty);
      const reserved = reservedStock(s.orders);
      const items: SaleItem[] = [];
      for (const [id, n] of Object.entries(qty)) {
        const p = s.products.find((x) => x.id === id);
        if (!p || p.showInApp === false || n < 1 || n > p.stock - (reserved[id] ?? 0)) return s;
        items.push({ productId: p.id, name: p.name, qty: n, price: p.price });
      }
      if (!items.length) return s;
      const n = Math.max(0, ...s.orders.map((o) => Number(o.folio.slice(2)) || 0)) + 1;
      const at = iso(r.at);
      const order: PickupOrder = {
        id: r.id,
        folio: orderFolio(n),
        customer: r.customer,
        items,
        note: (r.note ?? '').trim().slice(0, 300),
        total: items.reduce((t, i) => t + i.qty * i.price, 0),
        status: 'pendiente',
        createdAt: at,
        updatedAt: at,
        pickupCode: r.pickupCode,
        ...(r.payment ? { online: r.payment } : {}),
      };
      return { ...s, orders: [order, ...s.orders] };
    }
    case 'ORDER_ADVANCE': {
      const o = s.orders.find((x) => x.id === a.id);
      const next = o && nextStatus(o.status);
      if (!o || o.issue || o.status !== a.from || !next || next === 'entregado') return s;
      if (o.online && !isPaidOnline(o)) return s;
      return { ...s, orders: s.orders.map((x) => (x.id === a.id ? { ...x, status: next, updatedAt: iso(a.at) } : x)) };
    }
    case 'ORDER_DELIVER': {
      const o = s.orders.find((x) => x.id === a.id);
      if (!o || o.issue || o.status !== 'listo' || (o.pickupCode && o.pickupCode !== a.pickupCode)) return s;
      if (isPaidOnline(o) !== (a.sale.method === 'en_linea')) return s;
      const after = reducer(s, { type: 'CONFIRM_SALE', sale: a.sale });
      return {
        ...after,
        orders: after.orders.map((x) =>
          x.id === a.id ? { ...x, status: 'entregado', updatedAt: a.sale.date, deliveredAt: a.sale.date, payment: a.payment, saleId: a.sale.id } : x,
        ),
      };
    }
    case 'ORDER_CANCEL': {
      const o = s.orders.find((x) => x.id === a.id);
      if (!o || !ACTIVE_STATUSES.includes(o.status)) return s;
      const cancel = { reason: a.reason, missing: a.missing.filter((id) => o.items.some((i) => i.productId === id)), ...(a.note ? { note: a.note } : {}), at: iso(a.at) };
      return { ...s, orders: s.orders.map((x) => (x.id === a.id ? { ...x, status: 'cancelado', updatedAt: cancel.at, cancel, issue: undefined } : x)) };
    }
    case 'ORDER_ISSUE': {
      const o = s.orders.find((x) => x.id === a.id);
      const missing = o ? a.missing.filter((id) => o.items.some((i) => i.productId === id)) : [];
      if (!o || !ACTIVE_STATUSES.includes(o.status) || !missing.length) return s;
      return { ...s, orders: s.orders.map((x) => (x.id === a.id ? { ...x, issue: { missing, at: iso(a.at) }, updatedAt: iso(a.at) } : x)) };
    }
    case 'ORDER_EDIT': {
      const o = s.orders.find((x) => x.id === a.id);
      if (!o || !o.issue || !ACTIVE_STATUSES.includes(o.status)) return s;
      const qty: Record<string, number> = {};
      for (const it of a.items) qty[it.productId] = (qty[it.productId] ?? 0) + Math.floor(it.qty);
      const reserved = reservedStock(s.orders, o.id);
      const items: SaleItem[] = [];
      for (const [id, n] of Object.entries(qty)) {
        const p = s.products.find((x) => x.id === id);
        if (!p || p.showInApp === false || n < 1 || n > p.stock - (reserved[id] ?? 0)) return s;
        items.push({ productId: p.id, name: p.name, qty: n, price: p.price });
      }
      if (!items.length) return s;
      const at = iso(a.at);
      const edited: PickupOrder = { ...o, items, total: items.reduce((t, i) => t + i.qty * i.price, 0), issue: undefined, editedAt: at, updatedAt: at };
      return { ...s, orders: s.orders.map((x) => (x.id === a.id ? edited : x)) };
    }
    case 'SET_PAIRING':
      return { ...s, pairing: a.pairing };
    case 'CLOSE_CUT':
      return { ...s, cuts: [a.cut, ...s.cuts], closedCutId: a.cut.id };
    case 'OPEN_SHIFT':
      return { ...s, shift: a.shift, cashMovements: [], closedCutId: null };
    case 'ADD_CASH_MOVEMENT':
      return { ...s, cashMovements: [a.movement, ...s.cashMovements] };
    case 'UPDATE_STORE':
      return { ...s, store: a.store };
    case 'UPDATE_TICKET_CONFIG':
      return { ...s, ticketConfig: a.config };
    case 'UPSERT_USER': {
      const key = a.prevEmail ?? a.user.email;
      const exists = s.users.some((u) => u.email === key);
      return { ...s, users: exists ? s.users.map((u) => (u.email === key ? a.user : u)) : [...s.users, a.user] };
    }
    case 'ACCOUNT_NEW': {
      const parked = parkActive(s);
      return { ...s, parked, ticket: [], account: { id: a.id, name: nextAccountName(parked), customerId: null, openedAt: a.at } };
    }
    case 'ACCOUNT_SWITCH': {
      const target = s.parked.find((p) => p.id === a.id);
      if (!target) return s;
      const { lines, ...account } = target;
      return { ...s, parked: parkActive(s).filter((p) => p.id !== a.id), ticket: lines, account };
    }
    case 'ACCOUNT_UPDATE':
      return s.account.id === a.id
        ? { ...s, account: { ...s.account, name: a.name, customerId: a.customerId } }
        : { ...s, parked: s.parked.map((p) => (p.id === a.id ? { ...p, name: a.name, customerId: a.customerId } : p)) };
    case 'UPSERT_CUSTOMER': {
      // El saldo solo lo mueven las ventas a crédito y los abonos
      const prev = s.customers.find((c) => c.id === a.customer.id);
      const customer = { ...a.customer, balance: prev?.balance ?? 0 };
      return { ...s, customers: prev ? s.customers.map((c) => (c.id === customer.id ? customer : c)) : [customer, ...s.customers] };
    }
    case 'CREDIT_PAYMENT':
      return {
        ...s,
        creditMovements: [a.movement, ...s.creditMovements],
        customers: s.customers.map((c) => (c.id === a.movement.customerId ? { ...c, balance: Math.max(0, c.balance - a.movement.amount) } : c)),
      };
    case 'STOCK':
      // El servidor manda la existencia real: el inventario del celular se pone al día sin recargar
      return {
        ...s,
        products: s.products.map((p) => {
          const it = a.items.find((i) => i.productId === p.id);
          return it ? { ...p, stock: it.stock } : p;
        }),
      };
    default:
      // Mensajes de la caja que este celular no usa (por ejemplo, los de Pide y recoge)
      return s;
  }
}

export type LinkResult = 'ok' | 'invalido' | 'vencido' | 'sin-conexion' | 'sin-respuesta' | 'direccion';

// sin-servidor: aún no se eligió a qué caja conectarse
export type ServerStatus = 'sin-servidor' | 'conectando' | 'conectado' | 'sin-respuesta';

interface AppState extends Omit<Data, 'products' | 'sent' | 'version'> {
  products: ProductView[];
  sent: SentView[];
  online: boolean;
  uploading: boolean;
  pending: PendingItem[];
  lastUpload: { count: number; at: number } | null;

  isLive: (key: string) => boolean;
  thisDevice: Device | null;
  server: string | null;
  serverStatus: ServerStatus;
  linkWithCode: (code: string, name: string, server?: string | null) => Promise<LinkResult>;
  unlink: () => void;

  // Cuentas abiertas en la caja (la activa primero) y a cuál manda este celular lo que escanea
  accounts: AccountOption[];
  sendToRegister: (p: Product, qty: number, accountId?: string) => 'enviado' | 'pendiente';
  // Piezas que todavía se pueden mandar a una cuenta: existencia − apartado por pedidos − lo que ya está en cuentas
  availableFor: (productId: string) => number;
  removeSent: (sentId: string) => void;
  addStock: (entries: StockEntry[]) => 'enviado' | 'pendiente';
  saveProduct: (p: Product, isNew: boolean) => 'enviado' | 'pendiente';
  findByBarcode: (code: string) => ProductView | undefined;
  movementsFor: (productId: string) => Movement[];

  // Pide y recoge desde el celular
  // Empezar a preparar: el servidor revisa que alcance el inventario; si no, dice qué falta
  advanceOrder: (id: string) => Promise<Outcome<null>>;
  // Igual que en la caja: avisar al cliente que se agotó algo (el pedido sigue) o cancelarlo con un motivo
  reportShortage: (id: string, missing: string[]) => void;
  cancelOrder: (id: string, note: string) => void;
  // method en_linea: pedido pagado en la app, no se cobra (el servidor valida el código)
  deliverOrder: (id: string, method: CashMethod, received: number, pickupCode: string) => Promise<Outcome<Sale>>;
  activity: ActivityItem[];
}

const Ctx = createContext<AppState | null>(null);

// Qué cambió de un producto, en pocas palabras ("Precio $20.00 → $22.00 · Existencia 10 → 12")
function productChanges(before: Product | undefined, after: Product) {
  if (!before) return `Lo diste de alta · ${after.stock} pzas · ${money(after.price)}`;
  const parts: string[] = [];
  if (before.name !== after.name) parts.push(`Nombre: ${after.name}`);
  if (before.price !== after.price) parts.push(`Precio ${money(before.price)} → ${money(after.price)}`);
  if (before.cost !== after.cost) parts.push(`Costo ${money(before.cost)} → ${money(after.cost)}`);
  if (before.stock !== after.stock) parts.push(`Existencia ${before.stock} → ${after.stock}`);
  if (before.minStock !== after.minStock) parts.push(`Aviso de poco stock: ${after.minStock}`);
  if (before.barcode !== after.barcode) parts.push('Código de barras');
  if (before.photo !== after.photo) parts.push('Foto');
  if ((before.description ?? '') !== (after.description ?? '')) parts.push('Descripción');
  if (before.showInApp !== after.showInApp) parts.push(after.showInApp === false ? 'Oculto en la app' : 'Visible en la app');
  return parts.join(' · ') || 'Sin cambios';
}

// `employee`: nombre de quien usa el celular (para las ventas de pedidos que entrega)
export function AppProvider({ children, employee = '' }: { children: ReactNode; employee?: string }) {
  const [data, localDispatch] = useReducer(reducer, undefined, loadData);
  const dataRef = useRef(data);
  dataRef.current = data;
  const channel = useRef<SyncLink | null>(null);

  const [queue, setQueue] = useState<Op[]>(() => (nativeQueue ? [] : read(QUEUE_KEY, [])));
  const [queueReady, setQueueReady] = useState(!nativeQueue);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const [uploading, setUploading] = useState(false);
  const flushing = useRef(false);
  const [lastUpload, setLastUpload] = useState<{ count: number; at: number } | null>(null);

  const [activity, setActivity] = useState<ActivityItem[]>(() => read(ACTIVITY_KEY, []));
  const log = useCallback((item: Omit<ActivityItem, 'id' | 'at'>) => {
    setActivity((list) => [{ ...item, id: uid(), at: Date.now() }, ...list].slice(0, ACTIVITY_MAX));
  }, []);

  const [online, setOnline] = useState(navigator.onLine);
  const [presence, setPresence] = useState<Record<string, number>>({});
  const presenceRef = useRef(presence);
  presenceRef.current = presence;

  const [deviceId, setDeviceId] = useState<string | null>(() => read(DEVICE_KEY, null));
  const [server, setServer] = useState<string | null>(() => read<string | null>(SERVER_KEY, null) ?? DEFAULT_SYNC_URL);
  const [link, setLink] = useState<'conectando' | 'conectado' | 'sin-respuesta'>('conectando');
  const connectedRef = useRef(false);
  const snapshotAt = useRef(0);

  const dispatch = useCallback((a: Action) => {
    localDispatch(a);
    channel.current?.post(a);
  }, []);

  // Lo que mueve existencias: el servidor lo aprueba primero. Sin servidor no se hace (el celular no es la caja).
  const send = useCallback(async (a: Action): Promise<SendResult> => {
    if (!channel.current || !connectedRef.current) {
      return { ok: false, status: 0, body: { code: 'sin-conexion', message: 'Sin conexión con la tienda. Revisa la conexión e intenta de nuevo.' } };
    }
    const r = await channel.current.send(a);
    if (r.ok && !r.offline) localDispatch(a);
    return r;
  }, []);

  useEffect(() => write(DATA_KEY, data), [data]);
  useEffect(() => write(ACTIVITY_KEY, activity), [activity]);
  // En la app nativa la cola se lee de Preferences al arrancar (y se migra desde localStorage)
  useEffect(() => {
    if (!nativeQueue) return;
    loadQueue<Op>(QUEUE_KEY).then((saved) => {
      setQueue((q) => [...saved, ...q.filter((o) => !saved.some((s) => s.id === o.id))]);
      setQueueReady(true);
    });
  }, []);

  useEffect(() => {
    if (!queueReady) return;
    if (nativeQueue) void saveQueue(QUEUE_KEY, queue);
    else write(QUEUE_KEY, queue);
  }, [queue, queueReady]);
  useEffect(() => write(DEVICE_KEY, deviceId), [deviceId]);
  useEffect(() => write(SERVER_KEY, server), [server]);

  const thisDevice = data.devices.find((d) => d.id === deviceId) ?? null;
  const presenceKey = thisDevice?.id;
  const presenceKeyRef = useRef(presenceKey);
  presenceKeyRef.current = presenceKey;

  useEffect(() => {
    connectedRef.current = false;
    setLink('conectando');
    // El servidor cambia al vincularse con otra caja: se cierra la conexión anterior y se abre la nueva
    const ch = openSync(
      server,
      CHANNEL,
      (raw) => onMessage(raw as Message),
      () => ch.post({ type: 'WHO' }),
      (ok) => {
        connectedRef.current = ok;
        setLink(ok ? 'conectado' : 'sin-respuesta');
      },
    );
    channel.current = ch;
    const onMessage = (msg: Message) => {
      if (msg.type === 'SNAPSHOT') {
        if (msg.data?.version === VERSION) {
          snapshotAt.current = Date.now();
          localDispatch({ type: 'REPLACE_DATA', data: msg.data });
        }
      } else if (msg.type === 'PING') setPresence((p) => ({ ...p, [msg.key]: Date.now() }));
      else if (msg.type === 'BYE') {
        if (!(msg.key in presenceRef.current)) return;
        setPresence((p) => {
          const next = { ...p };
          delete next[msg.key];
          return next;
        });
      } else if (msg.type === 'WHO') {
        if (presenceKeyRef.current && navigator.onLine) ch.post({ type: 'PING', key: presenceKeyRef.current });
      } else localDispatch(msg);
    };
    ch.post({ type: 'WHO' });
    return () => ch.close();
  }, [server]);

  useEffect(() => {
    const ch = channel.current;
    if (!ch || !presenceKey) return;
    if (!online) {
      ch.post({ type: 'BYE', key: presenceKey });
      return;
    }
    const ping = () => ch.post({ type: 'PING', key: presenceKey });
    ping();
    const t = window.setInterval(ping, PING_MS);
    const bye = () => ch.post({ type: 'BYE', key: presenceKey });
    window.addEventListener('pagehide', bye);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('pagehide', bye);
      bye();
    };
  }, [online, presenceKey]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now();
      const stale = Object.keys(presenceRef.current).filter((k) => now - presenceRef.current[k] > STALE_MS);
      if (!stale.length) return;
      setPresence((p) => {
        const next = { ...p };
        stale.forEach((k) => delete next[k]);
        return next;
      });
    }, 3000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const opToAction = useCallback((op: Op): Action => {
    switch (op.kind) {
      case 'envio': {
        const fresh = dataRef.current.products.find((p) => p.id === op.product.id) ?? op.product;
        return { type: 'SCAN_TO_REGISTER', product: fresh, qty: op.qty, sentId: op.id, at: Date.now(), deviceId: deviceId ?? '', accountId: op.accountId };
      }
      case 'producto':
        return { type: 'UPSERT_PRODUCT', product: op.product, isNew: op.isNew, at: op.at };
      case 'stock':
        return { type: 'ADD_STOCK', entries: op.entries, at: op.at, note: 'Entrada desde el celular' };
    }
  }, [deviceId]);

  const flush = useCallback(() => {
    if (flushing.current || !navigator.onLine || queueRef.current.length === 0) return;
    flushing.current = true;
    setUploading(true);
    window.setTimeout(() => {
      flushing.current = false;
      setUploading(false);
      if (!navigator.onLine) return;
      const ops = queueRef.current;
      ops.forEach((op) => dispatch(opToAction(op)));
      const ids = new Set(ops.map((o) => o.id));
      setQueue((q) => q.filter((o) => !ids.has(o.id)));
      setLastUpload({ count: ops.length, at: Date.now() });
    }, 1500);
  }, [dispatch, opToAction]);

  useEffect(() => {
    if (online && queueReady) flush();
  }, [online, queueReady, flush]);

  const run = useCallback((op: Op) => {
    if (navigator.onLine) {
      dispatch(opToAction(op));
      return 'enviado' as const;
    }
    setQueue((q) => [...q, op]);
    return 'pendiente' as const;
  }, [dispatch, opToAction]);

  const view = useMemo(() => {
    const status: SyncState = uploading ? 'subiendo' : 'pendiente';
    const byId = new Map<string, ProductView>(data.products.map((p) => [p.id, p]));
    const created: string[] = [];
    const extraSent: SentView[] = [];
    const pending: PendingItem[] = [];

    for (const op of queue) {
      if (op.kind === 'producto') {
        if (op.isNew && !byId.has(op.product.id)) created.unshift(op.product.id);
        byId.set(op.product.id, { ...op.product, sync: status });
        pending.push({ id: op.id, kind: op.kind, title: op.product.name, detail: op.isNew ? 'Producto nuevo' : 'Cambios del producto', at: op.at, status });
      } else if (op.kind === 'stock') {
        let pieces = 0;
        op.entries.forEach((e) => {
          const p = byId.get(e.productId);
          pieces += e.qty;
          if (p) byId.set(p.id, { ...p, stock: p.stock + e.qty, sync: status });
        });
        const first = byId.get(op.entries[0]?.productId ?? '');
        const title = op.entries.length === 1 && first ? `+${pieces} ${first.name}` : `${op.entries.length} productos · +${pieces} pzas`;
        pending.push({ id: op.id, kind: op.kind, title, detail: 'Entrada de inventario', at: op.at, status });
      } else {
        extraSent.unshift({ id: op.id, product: op.product, qty: op.qty, at: op.at, status, deviceId: deviceId ?? '' });
        pending.push({ id: op.id, kind: op.kind, title: `${op.qty} × ${op.product.name}`, detail: 'Envío a la caja', at: op.at, status });
      }
    }

    const createdSet = new Set(created);
    const products = [...created.map((id) => byId.get(id)!), ...[...byId.values()].filter((p) => !createdSet.has(p.id))];
    const sent: SentView[] = [...extraSent, ...data.sent];
    return { products, sent, pending: pending.reverse() };
  }, [data.products, data.sent, queue, uploading, deviceId]);

  const viewRef = useRef(view);
  viewRef.current = view;

  const sendToRegister = useCallback(
    (product: Product, qty: number, accountId?: string) => run({ id: uid(), kind: 'envio', product, qty, at: Date.now(), accountId }),
    [run],
  );

  const accounts = useMemo<AccountOption[]>(
    () => [
      { id: data.account.id, name: data.account.name, customerId: data.account.customerId, active: true, count: data.ticket.reduce((n, l) => n + l.qty, 0) },
      ...data.parked.map((p) => ({ id: p.id, name: p.name, customerId: p.customerId, active: false, count: p.lines.reduce((n, l) => n + l.qty, 0) })),
    ],
    [data.account, data.ticket, data.parked],
  );

  // Lo comprometido cuenta también los envíos que esperan conexión en este celular
  const committed = useMemo(() => {
    const reserved = reservedStock(data.orders);
    const inAccounts = piecesByProduct([
      ...[data.ticket, ...data.parked.map((p) => p.lines)].flat().map((l) => ({ productId: l.product.id, qty: l.qty })),
      ...queue.flatMap((op) => (op.kind === 'envio' ? [{ productId: op.product.id, qty: op.qty }] : [])),
    ]);
    return { reserved, inAccounts };
  }, [data.orders, data.ticket, data.parked, queue]);

  const availableFor = useCallback(
    (productId: string) => {
      const p = viewRef.current.products.find((x) => x.id === productId);
      return p ? availableStock(p.stock, committed.reserved[productId], committed.inAccounts[productId]) : 0;
    },
    [committed],
  );
  const addStock = useCallback(
    (entries: StockEntry[]) => {
      const pieces = entries.reduce((n, e) => n + e.qty, 0);
      const first = viewRef.current.products.find((p) => p.id === entries[0]?.productId);
      log({
        kind: 'stock',
        title: entries.length === 1 && first ? first.name : `${entries.length} productos`,
        detail: `Entrada de inventario · +${pieces} ${pieces === 1 ? 'pieza' : 'piezas'}`,
      });
      return run({ id: uid(), kind: 'stock', entries, at: Date.now() });
    },
    [run, log],
  );
  const saveProduct = useCallback(
    (product: Product, isNew: boolean) => {
      const before = viewRef.current.products.find((p) => p.id === product.id);
      log({ kind: 'producto', title: product.name, detail: productChanges(isNew ? undefined : before, product) });
      return run({ id: uid(), kind: 'producto', product, isNew, at: Date.now() });
    },
    [run, log],
  );

  const advanceOrder = useCallback(
    async (id: string): Promise<Outcome<null>> => {
      const o = dataRef.current.orders.find((x) => x.id === id);
      if (!o || o.issue) return { ok: false, message: 'Este pedido está esperando al cliente.' };
      if (o.online && !isPaidOnline(o)) return { ok: false, code: 'pago-pendiente', message: 'El pago de este pedido todavía no se confirma.' };
      const r = await send({ type: 'ORDER_ADVANCE', id, from: o.status, at: Date.now() });
      if (!r.ok) return refused(r, 'No se pudo cambiar el pedido.');
      log({ kind: 'pedido', title: `${o.folio} · ${o.customer.name}`, detail: o.status === 'pendiente' ? 'Empezaste a prepararlo' : 'Lo marcaste como listo para recoger' });
      return { ok: true, value: null };
    },
    [send, log],
  );

  const reportShortage = useCallback(
    (id: string, missing: string[]) => {
      const o = dataRef.current.orders.find((x) => x.id === id);
      if (!o || !missing.length) return;
      dispatch({ type: 'ORDER_ISSUE', id, missing, at: Date.now() });
      const names = o.items.filter((i) => missing.includes(i.productId)).map((i) => i.name);
      log({ kind: 'pedido', title: `${o.folio} · ${o.customer.name}`, detail: `Avisaste que se agotó: ${names.join(', ')}` });
    },
    [dispatch, log],
  );

  const cancelOrder = useCallback(
    (id: string, note: string) => {
      const o = dataRef.current.orders.find((x) => x.id === id);
      if (!o) return;
      dispatch({ type: 'ORDER_CANCEL', id, reason: 'otro', missing: [], note: note.trim(), at: Date.now() });
      log({ kind: 'pedido', title: `${o.folio} · ${o.customer.name}`, detail: `Lo cancelaste: ${note.trim()}` });
    },
    [dispatch, log],
  );

  // Entregar y cobrar desde el celular: la venta es la misma que haría la caja, una sola vez por pedido
  const deliverOrder = useCallback(
    async (id: string, method: CashMethod, received: number, pickupCode: string): Promise<Outcome<Sale>> => {
      const s = dataRef.current;
      const o = s.orders.find((x) => x.id === id);
      const done = s.sales.find((x) => x.orderId === id);
      if (!o || o.issue || o.status !== 'listo') return done ? { ok: true, value: done } : { ok: false, message: 'Este pedido no está listo para entregarse.' };
      if (o.pickupCode && o.pickupCode !== pickupCode) return { ok: false, code: 'codigo-incorrecto', message: 'El código no coincide.' };
      if (isPaidOnline(o) !== (method === 'en_linea')) {
        return { ok: false, code: 'metodo-pago', message: isPaidOnline(o) ? 'Este pedido ya está pagado en línea: no se cobra.' : 'Este pedido se paga al recoger.' };
      }
      const folio = Math.max(...s.sales.map((x) => x.folio), 1000) + 1;
      const sale: Sale = {
        id: `pedido-${o.id}`,
        folio,
        date: new Date().toISOString(),
        items: o.items,
        total: o.total,
        method,
        employee: employee || s.store.owner,
        paid: method === 'efectivo' ? received : undefined,
        customerName: o.customer.name,
        origin: 'pedido',
        orderId: o.id,
        orderFolio: o.folio,
      };
      const r = await send({ type: 'ORDER_DELIVER', id, sale, payment: { method, received: method === 'efectivo' ? received : o.total }, pickupCode });
      if (!r.ok) return refused(r, 'No se pudo entregar el pedido.');
      log({
        kind: 'pedido',
        title: `${o.folio} · ${o.customer.name}`,
        detail: method === 'en_linea' ? `Entregado · ya estaba pagado en línea (${money(o.total)})` : `Entregado y cobrado · ${money(o.total)} (${PAYMENT_LABEL[method].toLowerCase()})`,
      });
      return { ok: true, value: sale };
    },
    [send, employee, log],
  );
  const findByBarcode = useCallback((code: string) => viewRef.current.products.find((p) => p.barcode === code.trim()), []);
  const movementsFor = useCallback(
    (productId: string) => dataRef.current.movements.filter((m) => m.productId === productId).slice(0, 8),
    [],
  );

  // Se conecta al servidor (el del QR o el escrito a mano), pide a la caja sus datos y revisa el código
  const linkWithCode = useCallback(async (code: string, name: string, target?: string | null): Promise<LinkResult> => {
    if (!navigator.onLine) return 'sin-conexion';
    const url = target === undefined ? server : target === null ? server : normalizeServer(target);
    if (!url) return 'direccion';
    const start = Date.now();
    if (url !== server) setServer(url);
    // Espera a que abra la conexión y llegue un SNAPSHOT nuevo de la caja (trae el código vigente)
    const fresh = await new Promise<boolean>((resolve) => {
      let asked = false;
      const t = window.setInterval(() => {
        if (connectedRef.current && !asked && url === server) {
          asked = true;
          channel.current?.post({ type: 'WHO' });
        }
        if (snapshotAt.current > start) {
          window.clearInterval(t);
          resolve(true);
        } else if (Date.now() - start > LINK_TIMEOUT_MS) {
          window.clearInterval(t);
          resolve(false);
        }
      }, 150);
    });
    if (!fresh) return 'sin-respuesta';
    const p = dataRef.current.pairing;
    if (!p || p.code !== code) return 'invalido';
    if (Date.now() > p.expiresAt) return 'vencido';
    const device: Device = {
      id: `d${uid()}`,
      name: name.trim() || 'Celular',
      model: deviceModel(),
      owner: '',
      lastSeen: new Date().toISOString(),
      register: dataRef.current.store.register,
    };
    dispatch({ type: 'ADD_DEVICE', device });
    dispatch({ type: 'SET_PAIRING', pairing: null });
    setDeviceId(device.id);
    return 'ok';
  }, [dispatch, server]);

  const value: AppState = {
    ...data,
    products: view.products,
    sent: view.sent,
    pending: view.pending,
    online,
    uploading,
    lastUpload,

    isLive: (key) => key in presence,
    thisDevice,
    server,
    serverStatus: server ? link : 'sin-servidor',
    linkWithCode,
    unlink: () => {
      if (deviceId) dispatch({ type: 'REMOVE_DEVICE', id: deviceId });
      setDeviceId(null);
    },

    sendToRegister,
    accounts,
    availableFor,
    removeSent: (sentId) => {
      if (queueRef.current.some((o) => o.id === sentId)) setQueue((q) => q.filter((o) => o.id !== sentId));
      else dispatch({ type: 'REMOVE_SENT', sentId });
    },
    addStock,
    saveProduct,
    findByBarcode,
    movementsFor,
    advanceOrder,
    reportShortage,
    cancelOrder,
    deliverOrder,
    activity,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp fuera de AppProvider');
  return ctx;
}

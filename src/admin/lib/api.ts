// Lo que usa el personal en el celular de AbarreAPI (ver AbarreAPI/README.md): tipos que manda la API,
// cómo se convierten a los modelos de la app y el canal en vivo (SignalR).
import * as signalR from '@microsoft/signalr';
import { getApiToken } from '../../api';
import type { CashMethod, Customer, Device, Movement, MovementType, Product, Store } from '../../data/models';
import type { PickupOrder } from '../../data/pickup';
import type { SaleType } from '../../domain/weight';
import { apiBaseOf, getServer } from '../../lib/server';

export interface TiendaDto {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string;
  address: string;
  rfc: string;
  acceptsOrders: boolean;
}

export interface CajaDto {
  id: string;
  name: string;
  serie: string;
  active: boolean;
  openShift?: { id: string };
}

export interface ProductoDto {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  barcode: string;
  photo?: string;
  description?: string;
  showInApp: boolean;
  reserved: number;
  // Por peso: precio por kg; stock y minStock en kg con 3 decimales
  saleType: SaleType;
}

export interface ClienteCreditoDto {
  id: string;
  name: string;
  phone: string;
  creditLimit: number;
  balance: number;
  note: string;
  createdAt: string;
}

export interface CambiosDto {
  cursor: number;
  completo: boolean;
  tienda?: TiendaDto;
  cajas: CajaDto[];
  productos: ProductoDto[];
  clientes: ClienteCreditoDto[];
  eliminados: { productos: string[]; clientes: string[] };
}

export interface EnvioDto {
  id: string;
  product: ProductoDto;
  qty: number;
  at: string;
  status: 'en-caja' | 'cobrado' | 'cancelado';
  deviceId?: string;
  employee: string;
  cajaId?: string;
  accountId?: string;
  accountName?: string;
}

export interface CuentaAbiertaDto {
  id: string;
  name: string;
  customerId?: string;
  active: boolean;
  count: number;
}

export interface CuentasCajaDto {
  cajaId: string;
  accounts: CuentaAbiertaDto[];
  at: string;
}

export interface DispositivoDto {
  id: string;
  name: string;
  model: string;
  owner: string;
  createdAt: string;
  lastSeen?: string;
  online: boolean;
}

export interface MovimientoInventarioDto {
  id: string;
  productId: string;
  type: string;
  qty: number;
  note: string;
  date: string;
}

export interface PedidoGestionDto {
  id: string;
  folio: string;
  customer: { name: string; phone: string };
  items: { productId: string; name: string; price: number; qty: number }[];
  note: string;
  total: number;
  status: PickupOrder['status'];
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  payment?: { method: string; received: number };
  online?: PickupOrder['online'];
  saleId?: string;
  cancel?: PickupOrder['cancel'];
  issue?: PickupOrder['issue'];
  editedAt?: string;
}

export interface VentaDto {
  id: string;
  serie: string;
  folio: number;
  date: string;
  items: { productId: string; name: string; qty: number; price: number; saleType?: SaleType }[];
  total: number;
  method: CashMethod;
  employee: string;
  received: number;
  customerName?: string;
  orderId?: string;
  orderFolio?: string;
}

export interface ResultadoOperacion {
  id: string;
  estado: 'aplicada' | 'con_advertencia' | 'rechazada';
  codigo?: string;
  mensaje?: string;
}

export const toProduct = (p: ProductoDto): Product => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: p.price,
  cost: p.cost,
  stock: p.stock,
  minStock: p.minStock,
  barcode: p.barcode,
  // Sin valor = por pieza (como en los modelos de la app)
  ...(p.saleType === 'peso' ? { saleType: 'peso' as const } : {}),
  photo: p.photo || undefined,
  description: p.description || undefined,
  showInApp: p.showInApp,
});

export const toCustomer = (c: ClienteCreditoDto): Customer => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  creditLimit: c.creditLimit,
  balance: c.balance,
  note: c.note,
  createdAt: c.createdAt,
});

export const toStore = (t: TiendaDto | undefined, prev: Store, register: string): Store =>
  t ? { name: t.name, owner: t.owner, email: t.email, phone: t.phone, address: t.address, rfc: t.rfc, register } : { ...prev, register };

export const toDevice = (d: DispositivoDto, register: string): Device => ({
  id: d.id,
  name: d.name,
  model: d.model,
  owner: d.owner,
  lastSeen: d.lastSeen ?? d.createdAt,
  register,
});

const MOVEMENT_TYPES: MovementType[] = ['venta', 'entrada', 'ajuste', 'alta'];
export const toMovement = (m: MovimientoInventarioDto): Movement => ({
  id: m.id,
  productId: m.productId,
  type: MOVEMENT_TYPES.includes(m.type as MovementType) ? (m.type as MovementType) : 'ajuste',
  qty: m.qty,
  date: m.date,
  note: m.note,
});

export const toOrder = (o: PedidoGestionDto): PickupOrder => ({
  id: o.id,
  folio: o.folio,
  customer: o.customer,
  items: o.items.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, price: i.price })),
  note: o.note,
  total: o.total,
  status: o.status,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
  deliveredAt: o.deliveredAt,
  payment: o.payment ? { method: o.payment.method as CashMethod, received: o.payment.received } : undefined,
  online: o.online,
  saleId: o.saleId,
  cancel: o.cancel,
  issue: o.issue,
  editedAt: o.editedAt,
});

type HubHandlers = Record<string, (...args: never[]) => void>;

// Canal en vivo del personal: /hubs/tienda en el mismo servidor que /api. Se reconecta solo.
export function openHub(params: { dispositivoId?: string }, handlers: HubHandlers, onStatus: (connected: boolean) => void) {
  const server = getServer();
  if (!server) {
    onStatus(false);
    return { stop: () => undefined };
  }
  const base = apiBaseOf(server).replace(/\/api$/, '');
  const qs = new URLSearchParams();
  if (params.dispositivoId) qs.set('dispositivoId', params.dispositivoId);
  const conn = new signalR.HubConnectionBuilder()
    .withUrl(`${base}/hubs/tienda?${qs}`, { accessTokenFactory: () => getApiToken() ?? '' })
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (c) => Math.min(30000, 1000 * 2 ** Math.min(c.previousRetryCount, 5)) })
    .configureLogging(signalR.LogLevel.None)
    .build();
  // Sin valor de regreso: SignalR tomaría cualquier valor como respuesta del cliente
  for (const [name, fn] of Object.entries(handlers)) {
    conn.on(name, (...args: unknown[]) => {
      try {
        (fn as (...a: unknown[]) => void)(...args);
      } catch {
        /* un evento con datos inesperados no tumba la conexión */
      }
    });
  }
  conn.onreconnecting(() => onStatus(false));
  conn.onreconnected(() => onStatus(true));

  let stopped = false;
  let retry: number | undefined;
  const start = async () => {
    try {
      await conn.start();
      if (stopped) return void conn.stop();
      onStatus(true);
    } catch {
      onStatus(false);
      if (!stopped) retry = window.setTimeout(start, 5000);
    }
  };
  conn.onclose(() => {
    onStatus(false);
    if (!stopped) retry = window.setTimeout(start, 5000);
  });
  void start();

  return {
    stop: () => {
      stopped = true;
      window.clearTimeout(retry);
      void conn.stop();
    },
  };
}

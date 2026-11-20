// Tipos que viajan entre la app y el servidor (tendero-web/server/api.js). Ver API.md.

// cliente: Pide y recoge · personal: usuario activo de la caja (Dueño, Cajero o Inventario)
export type Role = 'cliente' | 'personal';
export type StaffRole = 'Dueño' | 'Cajero' | 'Inventario';

// Lo que trae el token (JWT: header.payload.firma, payload en base64url)
export interface TokenClaims {
  sub: string; // id del usuario o del dispositivo
  role: Role;
  name: string;
  staffRole?: StaffRole; // solo personal
  exp: number; // segundos desde 1970
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface AuthResponse {
  token: string;
  user: Customer;
}

// Producto tal como lo ve el cliente: sin costo, mínimo ni código de barras
export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number; // disponible para pedir (existencia menos lo apartado). No se muestra tal cual al cliente.
  description?: string;
  photo?: string;
}

export type OrderStatus = 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'cancelado';

// La caja canceló el pedido. `missing`: ids de los productos que se agotaron.
export interface OrderCancel {
  reason: 'sin-existencia' | 'otro';
  missing: string[];
  note?: string;
  at: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  folio: string; // el de la caja, "P-0006"
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  note: string;
  createdAt: string;
  history: { status: OrderStatus; at: string }[];
  // Código para recoger (6 dígitos). Solo lo ve el dueño del pedido; la caja lo pide al entregar.
  pickupCode?: string;
  cancel?: OrderCancel;
  // Lo que hizo el cliente con un pedido cancelado
  resolved?: { action: 'quitar' | 'reemplazar'; at: string };
}

export interface NewOrder {
  items: { productId: string; qty: number; price: number }[];
  note: string;
  expectedTotal: number;
  pickupCode: string; // lo genera el teléfono (client/lib/pickup.ts)
}

// Cuerpo del 409 al crear un pedido: qué cambió desde que el cliente vio el catálogo
export type OrderChange =
  | { kind: 'precio'; productId: string; name: string; before: number; after: number }
  | { kind: 'existencia'; productId: string; name: string; requested: number; available: number }
  | { kind: 'no-disponible'; productId: string; name: string };

export interface OrderConflict {
  code: 'pedido-cambio';
  message: string;
  changes: OrderChange[];
  products: CatalogProduct[]; // datos actuales de los productos del pedido
}

export const ORDER_STEPS: OrderStatus[] = ['pendiente', 'preparando', 'listo', 'entregado'];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  preparando: 'Preparando',
  listo: 'Listo para recoger',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

// Cancelado y el cliente todavía no decide qué hacer: se queda en «Activos» para que lo vea
export const needsAction = (o: Order) => o.status === 'cancelado' && !o.resolved;
export const isActive = (o: Order) => (o.status !== 'entregado' && o.status !== 'cancelado') || needsAction(o);

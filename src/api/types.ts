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

// Pedido cancelado. `missing`: ids de los productos que se agotaron. cliente: lo canceló el cliente.
export interface OrderCancel {
  reason: 'sin-existencia' | 'otro' | 'cliente';
  missing: string[];
  note?: string;
  at: string;
}

// Pago en línea (Stripe). El servidor lo confirma con el webhook firmado; la app solo lo consulta.
export type PaymentStatus = 'pendiente_de_pago' | 'pagado' | 'fallido' | 'por_reembolsar' | 'reembolsado';

export interface OrderPayment {
  method: 'en_linea';
  status: PaymentStatus;
  amount?: number; // lo que cobró el proveedor
  paidAt?: string;
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pendiente_de_pago: 'Pago pendiente',
  pagado: 'Pagado',
  fallido: 'Pago no completado',
  por_reembolsar: 'Reembolso en proceso',
  reembolsado: 'Reembolsado',
};

// Productos que cambiaron en el catálogo (evento `catalogo` del SSE): `productos` nuevos o con otro nombre,
// precio, foto o categoría; `quitados` los que se ocultaron o se borraron
export interface CatalogUpdate {
  productos: CatalogProduct[];
  quitados: string[];
}

// Existencia que cambió (evento `inventario` del SSE): disponible para pedir
export interface StockUpdate {
  id: string;
  stock: number;
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
  // Código para recoger: 6 caracteres sin O/0 ni I/1 (los pedidos anteriores traen 6 dígitos). Lo genera el
  // servidor al confirmarse el pago y solo lo ve el dueño del pedido; la caja lo pide al entregar.
  pickupCode?: string;
  // Sin `payment`: pedido de antes del pago en línea, se paga al recoger
  payment?: OrderPayment;
  // Secreto de la sesión de pago embebida, mientras falta pagar (solo lo recibe el dueño del pedido)
  paymentClientSecret?: string;
  cancel?: OrderCancel;
  // La tienda avisó que se agotaron estos productos: el pedido sigue en pie y espera a que el cliente
  // los cambie por otros, los quite o cancele el pedido
  issue?: { missing: string[]; at: string };
  editedAt?: string;
  // Lo que hizo el cliente con un pedido cancelado
  resolved?: { action: 'quitar' | 'reemplazar'; at: string };
}

// Si la tienda recibe pedidos: abre mientras la caja está conectada y con su turno abierto
export interface StoreStatus {
  abierta: boolean;
  motivo?: 'sin-conexion' | 'turno-cerrado';
  mensaje?: string;
  nombre?: string;
}

export interface NewOrder {
  items: { productId: string; qty: number; price: number }[];
  note: string;
  expectedTotal: number;
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

// El cliente tiene que decidir algo: se agotó un producto de su pedido, o la tienda lo canceló y aún no lo ve
export const hasIssue = (o: Order) => !!o.issue && o.status !== 'entregado' && o.status !== 'cancelado';
export const needsAction = (o: Order) => hasIssue(o) || (o.status === 'cancelado' && !o.resolved && o.cancel?.reason !== 'cliente');
export const isActive = (o: Order) => (o.status !== 'entregado' && o.status !== 'cancelado') || needsAction(o);
export const isPaid = (o: Order) => o.payment?.status === 'pagado';
// Todavía no hay pago confirmado: la tienda no lo ve hasta que el servidor reciba la confirmación
export const awaitingPayment = (o: Order) => o.status !== 'cancelado' && (o.payment?.status === 'pendiente_de_pago' || o.payment?.status === 'fallido');

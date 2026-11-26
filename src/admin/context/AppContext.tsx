import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
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
import { ApiError } from '../../api/errors';
import { setApiDevice, staffApi } from '../../api';
import { money, PAYMENT_LABEL, uid, type CashMethod, type Customer, type Device, type Movement, type Product, type Sale, type Store } from '../../data/models';
import { reservedStock, type PickupOrder } from '../../data/pickup';
import { productInUse } from '../../data/productUse';
import { isWeighed, qtyLabel, qtyText, roundQty } from '../../domain/weight';
import { availableStock, type Shortfall } from '../../domain/stock';
import { getServer } from '../../lib/server';
import { deviceModel } from '../lib/device';
import { loadQueue, nativeQueue, saveQueue } from '../lib/queue';
import {
  openHub,
  toCustomer,
  toDevice,
  toMovement,
  toOrder,
  toProduct,
  toStore,
  type CambiosDto,
  type CuentasCajaDto,
  type DispositivoDto,
  type EnvioDto,
  type MovimientoInventarioDto,
  type PedidoGestionDto,
  type ResultadoOperacion,
  type VentaDto,
} from '../lib/api';

// El celular del personal trabaja contra AbarreAPI (ver AbarreAPI/README.md):
// - Catálogo, clientes y la tienda con GET /sync/cambios; los cambios llegan en vivo por SignalR.
// - Lo que hace (envíos a la caja, entradas, productos) va a una cola que sube con POST /sync/subir,
//   así funciona igual sin conexión.
// - Las cuentas abiertas de la caja llegan de GET /envios/cuentas y del evento `cuentas`.
// - Los pedidos (preparar, avisar, cancelar, entregar) van directo al servidor: requieren conexión.

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

export type ProductView = Product & { sync?: SyncState };
export interface AccountOption {
  id: string;
  name: string;
  customerId: string | null;
  active: boolean;
  count: number;
}
export type SentView = Omit<SentItem, 'status'> & { status: SentStatus | SyncState };

type StockEntry = { productId: string; qty: number };

interface Data {
  version: number;
  tiendaId: string | null;
  cursor: number;
  // Caja a la que manda este celular (la primera activa de la tienda)
  cajaId: string | null;
  store: Store;
  products: Product[];
  // Piezas apartadas por pedidos pagados, según el servidor
  reserved: Record<string, number>;
  customers: Customer[];
  movements: Movement[];
  sent: SentItem[];
  orders: PickupOrder[];
  sales: Sale[];
}

type Action =
  | { type: 'SERVER_CHANGES'; changes: CambiosDto }
  | { type: 'STOCK'; items: { productId: string; stock: number; reserved: number }[] }
  | { type: 'UPSERT_PRODUCT'; product: Product }
  // La API ya lo borró (borrado lógico); aquí solo se quita de la lista
  | { type: 'DELETE_PRODUCT'; id: string }
  | { type: 'SENT'; items: SentItem[]; replace: boolean }
  | { type: 'ORDERS'; orders: PickupOrder[] }
  | { type: 'ORDER_UPSERT'; order: PickupOrder }
  | { type: 'SALE'; sale: Sale }
  | { type: 'MOVEMENTS_FOR'; productId: string; movements: Movement[] }
  | { type: 'RESET'; tiendaId: string | null };

// Resultado de lo que el servidor revisa antes de aplicarlo (preparar, entregar)
export type Outcome<T> =
  | { ok: true; value: T; offline?: boolean }
  | { ok: false; code?: string; message: string; shortages?: Shortfall[] };

const refused = (e: unknown, fallback: string): Outcome<never> => {
  if (!(e instanceof ApiError)) return { ok: false, message: fallback };
  if (e.offline) return { ok: false, code: 'sin-conexion', message: 'Sin conexión con la tienda. Revisa la conexión e intenta de nuevo.' };
  const d = (e.details ?? {}) as { faltantes?: Shortfall[] };
  return { ok: false, code: e.code, message: e.message || fallback, shortages: d.faltantes };
};

type OpTipo = 'envio' | 'producto' | 'entrada_inventario' | 'ajuste_inventario';

interface Op {
  id: string;
  tipo: OpTipo;
  ocurridaEn: string;
  datos: Record<string, unknown>;
  title: string;
  detail: string;
  at: number;
  // Lo que se ve en el celular mientras no sube
  product?: Product;
  qty?: number;
  entries?: StockEntry[];
}

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
  kind: 'envio' | 'producto' | 'stock';
  title: string;
  detail: string;
  at: number;
  status: SyncState;
}

export interface UploadReport {
  count: number;
  at: number;
  rejected: { title: string; message: string }[];
  warnings: { title: string; message: string }[];
}

export type LinkResult = 'ok' | 'invalido' | 'vencido' | 'sin-conexion' | 'sin-respuesta' | 'direccion';

// sin-servidor: aún no se eligió a qué servidor conectarse
export type ServerStatus = 'sin-servidor' | 'conectando' | 'conectado' | 'sin-respuesta';

interface SavedDevice {
  tiendaId: string;
  device: Device;
}

const VERSION = 6;
const DATA_KEY = 'abarre.movil.datos';
const DEVICE_KEY = 'abarre.movil.dispositivo';
const QUEUE_KEY = 'abarre.movil.cola';
const ACTIVITY_KEY = 'tendero.actividad.movil';
const ACTIVITY_MAX = 150;
const RETRY_MS = 30000;

const emptyStore: Store = { name: '', owner: '', email: '', phone: '', address: '', rfc: '', register: 'la caja' };

function emptyData(tiendaId: string | null = null): Data {
  return { version: VERSION, tiendaId, cursor: 0, cajaId: null, store: emptyStore, products: [], reserved: {}, customers: [], movements: [], sent: [], orders: [], sales: [] };
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

function loadData(): Data {
  const saved = read<Data | null>(DATA_KEY, null);
  return saved && saved.version === VERSION ? saved : emptyData();
}

const iso = (at: number) => new Date(at).toISOString();
const enc = encodeURIComponent;

const toSent = (e: EnvioDto): SentItem => ({
  id: e.id,
  product: toProduct(e.product),
  qty: e.qty,
  at: Date.parse(e.at) || Date.now(),
  status: e.status,
  deviceId: e.deviceId ?? '',
  accountId: e.accountId,
  accountName: e.accountName,
});

function reducer(s: Data, a: Action): Data {
  switch (a.type) {
    case 'SERVER_CHANGES': {
      const c = a.changes;
      const dead = new Set([...c.eliminados.productos, ...c.eliminados.clientes]);
      const merge = <T extends { id: string }>(list: T[], fresh: T[]) => {
        const ids = new Set(fresh.map((x) => x.id));
        return [...fresh, ...(c.completo ? [] : list.filter((x) => !ids.has(x.id) && !dead.has(x.id)))];
      };
      const cajas = c.cajas.filter((x) => x.active);
      const caja = cajas.find((x) => x.id === s.cajaId) ?? cajas[0];
      const reserved = c.completo ? {} : { ...s.reserved };
      for (const p of c.productos) reserved[p.id] = p.reserved;
      return {
        ...s,
        cursor: c.cursor,
        cajaId: caja?.id ?? s.cajaId,
        store: toStore(c.tienda, s.store, caja?.name ?? s.store.register),
        products: merge(s.products, c.productos.map(toProduct)).sort((x, y) => x.name.localeCompare(y.name, 'es')),
        reserved,
        customers: merge(s.customers, c.clientes.map(toCustomer)),
      };
    }
    case 'STOCK': {
      if (!a.items.length) return s;
      const byId = new Map(a.items.map((i) => [i.productId, i]));
      const reserved = { ...s.reserved };
      a.items.forEach((i) => (reserved[i.productId] = i.reserved));
      return { ...s, reserved, products: s.products.map((p) => (byId.has(p.id) ? { ...p, stock: roundQty(byId.get(p.id)!.stock) } : p)) };
    }
    case 'UPSERT_PRODUCT': {
      const exists = s.products.some((p) => p.id === a.product.id);
      return { ...s, products: exists ? s.products.map((p) => (p.id === a.product.id ? a.product : p)) : [a.product, ...s.products] };
    }
    case 'DELETE_PRODUCT':
      return { ...s, products: s.products.filter((p) => p.id !== a.id) };
    case 'SENT': {
      if (a.replace) return { ...s, sent: a.items.slice(0, 200) };
      const ids = new Set(a.items.map((x) => x.id));
      return { ...s, sent: [...a.items, ...s.sent.filter((x) => !ids.has(x.id))].sort((x, y) => y.at - x.at).slice(0, 200) };
    }
    case 'ORDERS':
      return { ...s, orders: a.orders };
    case 'ORDER_UPSERT': {
      const exists = s.orders.some((o) => o.id === a.order.id);
      return { ...s, orders: exists ? s.orders.map((o) => (o.id === a.order.id ? a.order : o)) : [a.order, ...s.orders] };
    }
    case 'SALE':
      return { ...s, sales: [a.sale, ...s.sales.filter((x) => x.id !== a.sale.id)].slice(0, 100) };
    case 'MOVEMENTS_FOR':
      return { ...s, movements: [...a.movements, ...s.movements.filter((m) => m.productId !== a.productId)].slice(0, 500) };
    case 'RESET':
      return emptyData(a.tiendaId);
  }
  return s;
}

interface AppState {
  store: Store;
  products: ProductView[];
  customers: Customer[];
  orders: PickupOrder[];
  sales: Sale[];
  sent: SentView[];
  online: boolean;
  uploading: boolean;
  pending: PendingItem[];
  lastUpload: UploadReport | null;

  // 'panel': la caja está conectada (publicó sus cuentas). Cualquier otro: id de un celular conectado.
  isLive: (key: string) => boolean;
  thisDevice: Device | null;
  server: string | null;
  serverStatus: ServerStatus;
  linkWithCode: (code: string, name: string, server?: string | null) => Promise<LinkResult>;
  unlink: () => void;

  // Cuentas abiertas en la caja (la activa primero) y a cuál manda este celular lo que escanea
  accounts: AccountOption[];
  sendToRegister: (p: Product, qty: number, accountId?: string) => 'enviado' | 'pendiente';
  // Piezas que todavía se pueden mandar a una cuenta: existencia − apartado por pedidos − lo enviado que sigue en la caja
  availableFor: (productId: string) => number;
  removeSent: (sentId: string) => void;
  addStock: (entries: StockEntry[]) => 'enviado' | 'pendiente';
  saveProduct: (p: Product, isNew: boolean) => 'enviado' | 'pendiente';
  // Borrado lógico; requiere conexión. La API responde 409 si está apartado en un pedido sin entregar.
  deleteProduct: (id: string) => Promise<Outcome<null>>;
  findByBarcode: (code: string) => ProductView | undefined;
  movementsFor: (productId: string) => Movement[];

  // Pide y recoge desde el celular
  advanceOrder: (id: string) => Promise<Outcome<null>>;
  reportShortage: (id: string, missing: string[]) => Promise<Outcome<null>>;
  cancelOrder: (id: string, note: string) => Promise<Outcome<null>>;
  // El servidor busca el pedido listo con ese código (escrito o QR). No muestra el código: solo lo compara.
  verifyPickupCode: (raw: string) => Promise<Outcome<PickupOrder>>;
  // method en_linea: pedido pagado en la app, no se cobra (el servidor valida el código)
  deliverOrder: (id: string, method: CashMethod, received: number, pickupCode: string) => Promise<Outcome<Sale>>;
  activity: ActivityItem[];
}

const Ctx = createContext<AppState | null>(null);

// Qué cambió de un producto, en pocas palabras ("Precio $20.00 → $22.00 · Existencia 10 → 12")
function productChanges(before: Product | undefined, after: Product) {
  if (!before) return `Lo diste de alta · ${qtyLabel(after.stock, after.saleType)} · ${money(after.price)}${isWeighed(after) ? '/kg' : ''}`;
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

// `tiendaId`: la tienda de la sesión (lo guardado de otra tienda se descarta)
export function AppProvider({ children, tiendaId = null }: { children: ReactNode; employee?: string; tiendaId?: string | null }) {
  const [data, dispatch] = useReducer(reducer, undefined, () => {
    const d = loadData();
    return tiendaId && d.tiendaId !== tiendaId ? emptyData(tiendaId) : d;
  });
  const dataRef = useRef(data);
  dataRef.current = data;

  const [queue, setQueueState] = useState<Op[]>(() => (nativeQueue ? [] : read(QUEUE_KEY, [])));
  const [queueReady, setQueueReady] = useState(!nativeQueue);
  const queueRef = useRef(queue);
  const setQueue = useCallback((fn: (q: Op[]) => Op[]) => {
    queueRef.current = fn(queueRef.current);
    setQueueState(queueRef.current);
  }, []);
  const [uploading, setUploading] = useState(false);
  const flushing = useRef<Promise<void> | null>(null);
  const [lastUpload, setLastUpload] = useState<UploadReport | null>(null);

  const [activity, setActivity] = useState<ActivityItem[]>(() => read(ACTIVITY_KEY, []));
  const log = useCallback((item: Omit<ActivityItem, 'id' | 'at'>) => {
    setActivity((list) => [{ ...item, id: uid(), at: Date.now() }, ...list].slice(0, ACTIVITY_MAX));
  }, []);

  const [online, setOnline] = useState(navigator.onLine);
  const [hubUp, setHubUp] = useState<boolean | null>(null);
  const [presence, setPresence] = useState<Set<string>>(new Set());
  const [registers, setRegisters] = useState<CuentasCajaDto[]>([]);

  const [device, setDevice] = useState<Device | null>(() => {
    const saved = read<SavedDevice | null>(DEVICE_KEY, null);
    return saved && (!tiendaId || saved.tiendaId === tiendaId) ? saved.device : null;
  });
  const deviceRef = useRef(device);
  deviceRef.current = device;
  setApiDevice(device?.id ?? null);
  const server = getServer();

  useEffect(() => write(DATA_KEY, { ...data, tiendaId: tiendaId ?? data.tiendaId }), [data, tiendaId]);
  useEffect(() => write(ACTIVITY_KEY, activity), [activity]);
  useEffect(() => {
    if (tiendaId) write(DEVICE_KEY, device ? { tiendaId, device } : null);
  }, [device, tiendaId]);

  // En la app nativa la cola se lee de Preferences al arrancar
  useEffect(() => {
    if (!nativeQueue) return;
    void loadQueue<Op>(QUEUE_KEY).then((saved) => {
      setQueue((q) => [...saved.filter((o) => o.tipo), ...q.filter((o) => !saved.some((x) => x.id === o.id))]);
      setQueueReady(true);
    });
  }, [setQueue]);
  useEffect(() => {
    if (!queueReady) return;
    if (nativeQueue) void saveQueue(QUEUE_KEY, queue);
    else write(QUEUE_KEY, queue);
  }, [queue, queueReady]);

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

  // ---------- Descargar del servidor ----------

  const pull = useCallback(async (full = false) => {
    try {
      const c = await staffApi<CambiosDto>('GET', `/sync/cambios?desde=${full ? 0 : dataRef.current.cursor}`);
      dispatch({ type: 'SERVER_CHANGES', changes: c });
    } catch {
      /* sin conexión: se reintenta con el siguiente aviso */
    }
  }, []);
  const pullTimer = useRef<number>();
  const schedulePull = useCallback(() => {
    window.clearTimeout(pullTimer.current);
    pullTimer.current = window.setTimeout(() => void pull(), 300);
  }, [pull]);

  const loadSent = useCallback(async () => {
    try {
      const since = enc(new Date(Date.now() - 3 * 864e5).toISOString());
      const list = await staffApi<EnvioDto[]>('GET', `/envios?mios=true&desde=${since}`);
      dispatch({ type: 'SENT', items: list.map(toSent), replace: true });
    } catch {
      /* se queda lo guardado */
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const since = enc(new Date(Date.now() - 7 * 864e5).toISOString());
      const [activos, recientes] = await Promise.all([
        staffApi<PedidoGestionDto[]>('GET', '/gestion/pedidos?estado=activos'),
        staffApi<PedidoGestionDto[]>('GET', `/gestion/pedidos?estado=todos&desde=${since}`),
      ]);
      const map = new Map<string, PickupOrder>();
      for (const o of [...recientes, ...activos]) map.set(o.id, toOrder(o));
      dispatch({ type: 'ORDERS', orders: [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
    } catch {
      /* se queda lo guardado */
    }
  }, []);

  const loadRegisters = useCallback(async () => {
    try {
      const [cuentas, dispositivos] = await Promise.all([
        staffApi<CuentasCajaDto[]>('GET', '/envios/cuentas'),
        staffApi<DispositivoDto[]>('GET', '/dispositivos'),
      ]);
      setRegisters(cuentas);
      setPresence(new Set(dispositivos.filter((d) => d.online).map((d) => d.id)));
      // El dueño quitó este celular desde la caja: deja de estar vinculado
      const mine = deviceRef.current;
      if (mine && !dispositivos.some((d) => d.id === mine.id)) setDevice(null);
      else if (mine) {
        const d = dispositivos.find((x) => x.id === mine.id);
        if (d) setDevice(toDevice(d, dataRef.current.store.register));
      }
    } catch {
      /* sin conexión */
    }
  }, []);

  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  const loadAll = useCallback(async () => {
    await flushRef.current();
    await pull(true);
    await Promise.all([loadSent(), loadOrders(), loadRegisters()]);
  }, [pull, loadSent, loadOrders, loadRegisters]);

  // ---------- Subir la cola ----------

  const flush = useCallback(async (): Promise<void> => {
    if (flushing.current) return flushing.current;
    if (!navigator.onLine || queueRef.current.length === 0) return;
    const ops = queueRef.current;
    const run = (async () => {
      setUploading(true);
      try {
        const r = await staffApi<{ resultados: ResultadoOperacion[] }>('POST', '/sync/subir', {
          cajaId: dataRef.current.cajaId,
          operaciones: ops.map((o) => ({ id: o.id, tipo: o.tipo, ocurridaEn: o.ocurridaEn, datos: o.datos })),
        });
        const results = new Map(r.resultados.map((x) => [x.id, x]));
        const handled = ops.filter((o) => results.has(o.id));
        setQueue((q) => q.filter((o) => !results.has(o.id)));
        const report = (estado: ResultadoOperacion['estado']) =>
          handled.filter((o) => results.get(o.id)!.estado === estado).map((o) => ({ title: o.title, message: results.get(o.id)!.mensaje ?? '' }));
        if (handled.length) setLastUpload({ count: handled.length, at: Date.now(), rejected: report('rechazada'), warnings: report('con_advertencia') });
        if (handled.some((o) => o.tipo === 'envio')) void loadSent();
        // Lo rechazado se había aplicado aquí: se vuelve a leer todo del servidor
        if (handled.some((o) => results.get(o.id)!.estado === 'rechazada')) void pull(true);
        else schedulePull();
      } catch (e) {
        if (e instanceof ApiError && !e.offline && e.status !== 401) {
          setLastUpload({ count: 0, at: Date.now(), rejected: [{ title: 'No se pudieron subir los pendientes', message: e.message }], warnings: [] });
        }
      } finally {
        setUploading(false);
      }
    })();
    flushing.current = run;
    try {
      await run;
    } finally {
      flushing.current = null;
    }
  }, [loadSent, pull, schedulePull, setQueue]);
  flushRef.current = flush;

  const enqueue = useCallback(
    (op: Omit<Op, 'ocurridaEn' | 'at' | 'id'> & { id?: string }) => {
      const at = Date.now();
      setQueue((q) => [...q, { ...op, id: op.id ?? uid(), ocurridaEn: iso(at), at }]);
      if (navigator.onLine) window.setTimeout(() => void flush(), 0);
      return navigator.onLine ? ('enviado' as const) : ('pendiente' as const);
    },
    [flush, setQueue],
  );

  useEffect(() => {
    if (!online || !queueReady) return;
    void flush();
    const t = window.setInterval(() => queueRef.current.length && void flush(), RETRY_MS);
    return () => window.clearInterval(t);
  }, [online, queueReady, flush]);

  // ---------- En vivo ----------

  const deviceId = device?.id;
  useEffect(() => {
    setHubUp(null);
    const hub = openHub(
      { dispositivoId: deviceId },
      {
        pedido: ((dto: PedidoGestionDto) => dispatch({ type: 'ORDER_UPSERT', order: toOrder(dto) })) as never,
        envio: ((e: EnvioDto) => {
          if (deviceRef.current && e.deviceId === deviceRef.current.id) dispatch({ type: 'SENT', items: [toSent(e)], replace: false });
        }) as never,
        catalogo: (() => schedulePull()) as never,
        inventario: ((list: { productId: string; stock: number; reserved: number }[]) => dispatch({ type: 'STOCK', items: list })) as never,
        cuentas: ((c: CuentasCajaDto) => setRegisters((list) => [...list.filter((x) => x.cajaId !== c.cajaId), c])) as never,
        dispositivo: ((d: { id: string; online: boolean }) =>
          setPresence((p) => {
            const next = new Set(p);
            if (d.online) next.add(d.id);
            else next.delete(d.id);
            return next;
          })) as never,
      },
      (up) => {
        setHubUp(up);
        if (up) void loadAll();
      },
    );
    return () => hub.stop();
  }, [deviceId, server, loadAll, schedulePull]);

  // De vuelta al primer plano: lo que cambió mientras la app estaba en segundo plano (productos nuevos, borrados,
  // precios, pedidos). Mientras tanto el sistema pudo haber cortado la conexión en vivo sin avisar.
  const loadAllRef = useRef(loadAll);
  loadAllRef.current = loadAll;
  useEffect(() => {
    const resume = () => void loadAllRef.current();
    if (Capacitor.isNativePlatform()) {
      const h = App.addListener('appStateChange', ({ isActive }) => isActive && resume());
      return () => void h.then((x) => x.remove());
    }
    const onVisible = () => document.visibilityState === 'visible' && resume();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // ---------- Vista: lo que espera subir se ve ya aplicado ----------

  const view = useMemo(() => {
    const status: SyncState = uploading ? 'subiendo' : 'pendiente';
    const byId = new Map<string, ProductView>(data.products.map((p) => [p.id, p]));
    const created: string[] = [];
    const extraSent: SentView[] = [];
    const pending: PendingItem[] = [];
    for (const op of queue) {
      if (op.tipo === 'producto' && op.product) {
        if (!byId.has(op.product.id)) created.unshift(op.product.id);
        byId.set(op.product.id, { ...op.product, sync: status });
        pending.push({ id: op.id, kind: 'producto', title: op.title, detail: op.detail, at: op.at, status });
      } else if (op.tipo === 'entrada_inventario' && op.entries) {
        op.entries.forEach((e) => {
          const p = byId.get(e.productId);
          if (p) byId.set(p.id, { ...p, stock: roundQty(p.stock + e.qty), sync: status });
        });
        pending.push({ id: op.id, kind: 'stock', title: op.title, detail: op.detail, at: op.at, status });
      } else if (op.tipo === 'ajuste_inventario') {
        pending.push({ id: op.id, kind: 'stock', title: op.title, detail: op.detail, at: op.at, status });
      } else if (op.tipo === 'envio' && op.product) {
        extraSent.unshift({ id: String(op.datos.id), product: op.product, qty: op.qty ?? 1, at: op.at, status, deviceId: device?.id ?? '' });
        pending.push({ id: op.id, kind: 'envio', title: op.title, detail: op.detail, at: op.at, status });
      }
    }
    const createdSet = new Set(created);
    const products = [...created.map((id) => byId.get(id)!), ...[...byId.values()].filter((p) => !createdSet.has(p.id))];
    const queuedIds = new Set(extraSent.map((x) => x.id));
    const sent: SentView[] = [...extraSent, ...data.sent.filter((x) => !queuedIds.has(x.id))];
    return { products, sent, pending: pending.reverse() };
  }, [data.products, data.sent, queue, uploading, device?.id]);

  const viewRef = useRef(view);
  viewRef.current = view;

  // ---------- Acciones ----------

  const myRegister = registers.find((r) => r.cajaId === data.cajaId);
  const accounts = useMemo<AccountOption[]>(
    () =>
      (myRegister?.accounts ?? [])
        .map((a) => ({ id: a.id, name: a.name, customerId: a.customerId ?? null, active: a.active, count: a.count }))
        .sort((a, b) => Number(b.active) - Number(a.active)),
    [myRegister],
  );
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  const sendToRegister = useCallback(
    (product: Product, qty: number, accountId?: string) => {
      const s = dataRef.current;
      const account = accountsRef.current.find((a) => a.id === accountId);
      // La API usa el id de la operación como id del envío: los dos son el mismo
      const id = uid();
      return enqueue({
        id,
        tipo: 'envio',
        title: `${qty} × ${product.name}`,
        detail: 'Envío a la caja',
        product,
        qty,
        datos: { id, productId: product.id, qty, cajaId: s.cajaId, at: new Date().toISOString(), accountId: account?.id, accountName: account?.name },
      });
    },
    [enqueue],
  );

  // Lo comprometido: apartado por pedidos (según el servidor) y lo que este celular mandó y sigue en la caja
  const availableFor = useCallback(
    (productId: string) => {
      const p = viewRef.current.products.find((x) => x.id === productId);
      if (!p) return 0;
      const reserved = dataRef.current.reserved[productId] ?? reservedStock(dataRef.current.orders)[productId] ?? 0;
      const inRegister = viewRef.current.sent
        .filter((x) => x.product.id === productId && (x.status === 'en-caja' || x.status === 'pendiente' || x.status === 'subiendo'))
        .reduce((n, x) => n + x.qty, 0);
      return availableStock(p.stock, reserved, inRegister);
    },
    [],
  );

  const addStock = useCallback(
    (entries: StockEntry[]) => {
      const pieces = entries.reduce((n, e) => roundQty(n + e.qty), 0);
      const first = viewRef.current.products.find((p) => p.id === entries[0]?.productId);
      const one = entries.length === 1 && first;
      const title = one ? first.name : `${entries.length} productos`;
      log({ kind: 'stock', title, detail: `Entrada de inventario · +${one ? qtyLabel(pieces, first.saleType) : qtyLabel(pieces)}` });
      return enqueue({
        tipo: 'entrada_inventario',
        title: one ? `+${qtyText(pieces, first.saleType)} ${first.name}` : `${entries.length} productos · +${pieces} pzas`,
        detail: 'Entrada de inventario',
        entries,
        datos: { id: uid(), entries, note: 'Entrada desde el celular', at: new Date().toISOString() },
      });
    },
    [enqueue, log],
  );

  const saveProduct = useCallback(
    (product: Product, isNew: boolean) => {
      const at = Date.now();
      const before = viewRef.current.products.find((p) => p.id === product.id);
      log({ kind: 'producto', title: product.name, detail: productChanges(isNew ? undefined : before, product) });
      dispatch({ type: 'UPSERT_PRODUCT', product });
      const photo = product.photo?.startsWith('data:') ? product.photo : product.photo ? undefined : before?.photo ? '' : undefined;
      const r = enqueue({
        tipo: 'producto',
        title: product.name,
        detail: isNew ? 'Producto nuevo' : 'Cambios del producto',
        product,
        datos: {
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          cost: product.cost,
          ...(isNew ? { stock: product.stock } : {}),
          minStock: product.minStock,
          barcode: product.barcode,
          saleType: product.saleType ?? 'pieza',
          ...(photo !== undefined ? { photo } : {}),
          description: product.description ?? '',
          showInApp: product.showInApp !== false,
          updatedAt: iso(at),
        },
      });
      // En una edición la existencia se manda como lo que se contó (ajuste), no como parte del producto
      if (!isNew && before && before.stock !== product.stock) {
        enqueue({
          tipo: 'ajuste_inventario',
          title: product.name,
          detail: `Existencia ${before.stock} → ${product.stock}`,
          datos: { id: uid(), productId: product.id, countedStock: product.stock, note: 'Ajuste desde el celular', at: iso(at) },
        });
      }
      return r;
    },
    [enqueue, log],
  );

  // Va directo a la API (no a la cola): si está apartado en un pedido, el servidor lo rechaza y hay que decirlo ya.
  // La API avisa a la caja y a los demás celulares con el evento `catalogo`.
  const deleteProduct = useCallback(async (id: string): Promise<Outcome<null>> => {
    if (!viewRef.current.products.some((p) => p.id === id)) return { ok: false, code: 'no-existe', message: 'Ese producto ya no existe.' };
    if (queueRef.current.some((op) => op.product?.id === id || op.entries?.some((e) => e.productId === id)))
      return { ok: false, code: 'pendiente', message: 'Este producto tiene cambios sin subir. Espera a que se suban e intenta de nuevo.' };
    const busy = productInUse(id, { ticket: [], parked: [], orders: dataRef.current.orders });
    if (busy) return { ok: false, code: 'producto-en-uso', message: busy };
    try {
      await staffApi<void>('DELETE', `/productos/${enc(id)}`);
      dispatch({ type: 'DELETE_PRODUCT', id });
      return { ok: true, value: null };
    } catch (e) {
      return refused(e, 'No se pudo borrar el producto.');
    }
  }, []);

  const findByBarcode = useCallback((code: string) => viewRef.current.products.find((p) => p.barcode === code.trim()), []);

  const movementsAsked = useRef(new Map<string, number>());
  const movementsFor = useCallback((productId: string) => {
    const last = movementsAsked.current.get(productId) ?? 0;
    if (Date.now() - last > 30000 && navigator.onLine) {
      movementsAsked.current.set(productId, Date.now());
      void staffApi<MovimientoInventarioDto[]>('GET', `/inventario/movimientos?productoId=${enc(productId)}&limite=20`)
        .then((list) => dispatch({ type: 'MOVEMENTS_FOR', productId, movements: list.map(toMovement) }))
        .catch(() => undefined);
    }
    return dataRef.current.movements.filter((m) => m.productId === productId).slice(0, 8);
  }, []);

  const orderCall = useCallback(async (id: string, action: string, body: unknown, fallback: string): Promise<Outcome<null>> => {
    try {
      const o = await staffApi<PedidoGestionDto>('POST', `/gestion/pedidos/${enc(id)}/${action}`, body);
      dispatch({ type: 'ORDER_UPSERT', order: toOrder(o) });
      return { ok: true, value: null };
    } catch (e) {
      // Alguien más lo cambió: se vuelve a leer
      if (e instanceof ApiError && e.status === 409) {
        void staffApi<PedidoGestionDto>('GET', `/gestion/pedidos/${enc(id)}`)
          .then((o) => dispatch({ type: 'ORDER_UPSERT', order: toOrder(o) }))
          .catch(() => undefined);
      }
      return refused(e, fallback);
    }
  }, []);

  const advanceOrder = useCallback(
    async (id: string): Promise<Outcome<null>> => {
      const o = dataRef.current.orders.find((x) => x.id === id);
      if (!o) return { ok: false, message: 'No encontramos ese pedido.' };
      if (o.issue) return { ok: false, message: 'Este pedido está esperando al cliente.' };
      const r = await orderCall(id, 'avanzar', { from: o.status }, 'No se pudo cambiar el pedido.');
      if (r.ok) log({ kind: 'pedido', title: `${o.folio} · ${o.customer.name}`, detail: o.status === 'pendiente' ? 'Empezaste a prepararlo' : 'Lo marcaste como listo para recoger' });
      return r;
    },
    [orderCall, log],
  );

  const reportShortage = useCallback(
    async (id: string, missing: string[]): Promise<Outcome<null>> => {
      const o = dataRef.current.orders.find((x) => x.id === id);
      if (!o || !missing.length) return { ok: false, message: 'Elige qué se agotó.' };
      const r = await orderCall(id, 'agotado', { missing }, 'No se pudo avisar al cliente.');
      if (r.ok) {
        const names = o.items.filter((i) => missing.includes(i.productId)).map((i) => i.name);
        log({ kind: 'pedido', title: `${o.folio} · ${o.customer.name}`, detail: `Avisaste que se agotó: ${names.join(', ')}` });
      }
      return r;
    },
    [orderCall, log],
  );

  const cancelOrder = useCallback(
    async (id: string, note: string): Promise<Outcome<null>> => {
      const o = dataRef.current.orders.find((x) => x.id === id);
      if (!o) return { ok: false, message: 'No encontramos ese pedido.' };
      const r = await orderCall(id, 'cancelar', { reason: 'otro', missing: [], note: note.trim() }, 'No se pudo cancelar el pedido.');
      if (r.ok) log({ kind: 'pedido', title: `${o.folio} · ${o.customer.name}`, detail: `Lo cancelaste: ${note.trim()}` });
      return r;
    },
    [orderCall, log],
  );

  const verifyPickupCode = useCallback(async (raw: string): Promise<Outcome<PickupOrder>> => {
    try {
      const o = toOrder(await staffApi<PedidoGestionDto>('POST', '/gestion/pedidos/buscar-codigo', { code: raw }));
      dispatch({ type: 'ORDER_UPSERT', order: o });
      return { ok: true, value: o };
    } catch (e) {
      return refused(e, 'No se pudo revisar el código.');
    }
  }, []);

  // Entregar desde el celular: el servidor valida el código, crea la venta (serie P) y descuenta la existencia
  const deliverOrder = useCallback(
    async (id: string, method: CashMethod, received: number, pickupCode: string): Promise<Outcome<Sale>> => {
      const o = dataRef.current.orders.find((x) => x.id === id);
      try {
        const r = await staffApi<{ order: PedidoGestionDto; sale: VentaDto }>('POST', `/gestion/pedidos/${enc(id)}/entregar`, {
          code: pickupCode,
          method,
          received: method === 'efectivo' ? received : undefined,
          cajaId: dataRef.current.cajaId,
        });
        const v = r.sale;
        const sale: Sale = {
          id: v.id,
          folio: v.folio,
          date: v.date,
          items: v.items,
          total: v.total,
          method: v.method,
          employee: v.employee,
          paid: v.method === 'efectivo' ? v.received : undefined,
          customerName: v.customerName,
          origin: 'pedido',
          orderId: v.orderId,
          orderFolio: v.orderFolio,
        };
        dispatch({ type: 'ORDER_UPSERT', order: toOrder(r.order) });
        dispatch({ type: 'SALE', sale });
        if (o) {
          log({
            kind: 'pedido',
            title: `${o.folio} · ${o.customer.name}`,
            detail: method === 'en_linea' ? `Entregado · ya estaba pagado en línea (${money(o.total)})` : `Entregado y cobrado · ${money(o.total)} (${PAYMENT_LABEL[method].toLowerCase()})`,
          });
        }
        return { ok: true, value: sale };
      } catch (e) {
        return refused(e, 'No se pudo entregar el pedido.');
      }
    },
    [log],
  );

  // Vincular: el código de 6 dígitos que generó el dueño en la caja (Dispositivos). La dirección del QR no se
  // usa para cambiar de servidor: la sesión ya está en uno (el de «Iniciar sesión»).
  const linkWithCode = useCallback(async (code: string, name: string): Promise<LinkResult> => {
    if (!navigator.onLine) return 'sin-conexion';
    if (!getServer()) return 'direccion';
    try {
      const d = await staffApi<DispositivoDto>('POST', '/dispositivos/vincular', { code, name: name.trim() || 'Celular', model: deviceModel() });
      setApiDevice(d.id);
      setDevice(toDevice(d, dataRef.current.store.register));
      return 'ok';
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.offline) return 'sin-respuesta';
        if (e.status === 422 || e.status === 429) return 'invalido';
      }
      return 'sin-respuesta';
    }
  }, []);

  const unlink = useCallback(() => {
    const d = deviceRef.current;
    if (d) void staffApi('DELETE', `/dispositivos/${enc(d.id)}`).catch(() => undefined);
    setApiDevice(null);
    setDevice(null);
  }, []);

  const serverStatus: ServerStatus = !server ? 'sin-servidor' : hubUp === null ? 'conectando' : hubUp ? 'conectado' : 'sin-respuesta';
  const registerLive = !!myRegister && myRegister.accounts.length > 0;
  const thisDevice = device ? { ...device, register: data.store.register } : null;

  const value: AppState = {
    store: data.store,
    products: view.products,
    customers: data.customers,
    orders: data.orders,
    sales: data.sales,
    sent: view.sent,
    online,
    uploading,
    pending: view.pending,
    lastUpload,

    isLive: (key) => (key === 'panel' ? registerLive : presence.has(key)),
    thisDevice,
    server,
    serverStatus,
    linkWithCode,
    unlink,

    accounts,
    sendToRegister,
    availableFor,
    removeSent: (sentId) => {
      const queued = queueRef.current.find((o) => o.tipo === 'envio' && o.datos.id === sentId);
      if (queued) {
        setQueue((q) => q.filter((o) => o.id !== queued.id));
        return;
      }
      void staffApi<EnvioDto>('POST', `/envios/${enc(sentId)}/cancelar`)
        .then((e) => dispatch({ type: 'SENT', items: [toSent(e)], replace: false }))
        .catch(() => undefined);
    },
    addStock,
    saveProduct,
    findByBarcode,
    movementsFor,
    advanceOrder,
    deleteProduct,
    reportShortage,
    cancelOrder,
    verifyPickupCode,
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

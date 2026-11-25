import { isWeighed } from '../../../domain/weight';
import {
  IonButton,
  IonContent,
  IonFooter,
  IonIcon,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonToggle,
  IonToolbar,
  useIonRouter,
  useIonToast,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import {
  add,
  addCircleOutline,
  archiveOutline,
  cartOutline,
  checkmarkDone,
  chevronForward,
  linkOutline,
  personOutline,
  receiptOutline,
  remove,
  searchOutline,
  trashOutline,
} from 'ionicons/icons';
import { useRef, useState } from 'react';
import { AppHeader } from '../../../components/AppHeader';
import { useAppAlert } from '../../../components/AppAlert';
import { BarcodeSearch } from '../../components/BarcodeSearch';
import { EmptyState } from '../../../components/EmptyState';
import { ProductThumb } from '../../../components/ProductThumb';
import { ScannerView } from '../../scanner/ScannerView';
import { StockBadge } from '../../components/StockBadge';
import { SyncBadge } from '../../components/SyncBadge';
import { useApp, type ProductView, type SentView } from '../../context/AppContext';
import { money } from '../../../data/models';
import { ScanResultSheet, type ScanMode } from '../../components/ScanResultSheet';
import './Scanner.css';

interface BatchLine {
  product: ProductView;
  qty: number;
}

const MODE_HINT: Record<ScanMode, string> = {
  vender: 'Apunta al código para venderlo',
  inventario: 'Escanea lo que va entrando',
  consultar: 'Escanea para ver precio y stock',
};

export const STATUS_LABEL: Record<SentView['status'], string> = {
  'en-caja': 'En la caja',
  cobrado: 'Cobrado',
  cancelado: 'Cancelado',
  pendiente: 'Sin subir',
  subiendo: 'Subiendo',
};

export function SentPill({ status }: { status: SentView['status'] }) {
  if (status === 'pendiente' || status === 'subiendo') return <SyncBadge state={status} compact />;
  return <span className={`status-pill st-${status}`}>{STATUS_LABEL[status]}</span>;
}

// Nombre de las cuentas de la caja (con su cliente) y a cuál fue cada envío, para la pantalla y el historial
export function useAccountLabels() {
  const { accounts, customers } = useApp();
  const accountLabel = (a: { name: string; customerId: string | null }) => {
    const c = a.customerId ? customers.find((x) => x.id === a.customerId) : undefined;
    return c && c.name !== a.name ? `${a.name} · ${c.name}` : a.name;
  };
  // Si la cuenta sigue abierta se muestra con su cliente; si ya se cobró, el nombre que tenía
  const sentTo = (s: SentView) => {
    const open = s.accountId ? accounts.find((a) => a.id === s.accountId) : undefined;
    if (open) return accountLabel(open);
    if (s.accountName) return s.accountName;
    return s.status === 'pendiente' || s.status === 'subiendo' ? 'la cuenta en pantalla' : undefined;
  };
  return { accountLabel, sentTo };
}

export default function Scanner() {
  const { products, sent, thisDevice, store, accounts, customers, addStock, findByBarcode, isLive, online } = useApp();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const showAlert = useAppAlert();
  const [mode, setMode] = useState<ScanMode>('vender');
  const [batchMode, setBatchMode] = useState(false);
  const [batch, setBatch] = useState<BatchLine[]>([]);
  const [current, setCurrent] = useState<ProductView>();
  const [currentQty, setCurrentQty] = useState(1);
  const [lastScanned, setLastScanned] = useState<string>();
  const [visible, setVisible] = useState(true);
  const [typing, setTyping] = useState(false);
  const [asking, setAsking] = useState(false);

  useIonViewDidEnter(() => setVisible(true));
  useIonViewWillLeave(() => setVisible(false));

  const newProduct = (code?: string) => router.push(code ? `/movil/producto-nuevo?codigo=${encodeURIComponent(code)}` : '/movil/producto-nuevo');

  // Lo que se manda cae en la cuenta que la caja tiene en pantalla; aquí solo se muestra cuál es
  const { accountLabel, sentTo } = useAccountLabels();
  const onScreen = accounts.find((a) => a.active);
  const onScreenCustomer = onScreen?.customerId ? customers.find((c) => c.id === onScreen.customerId) : undefined;

  const handleProduct = (p: ProductView, qty = 1) => {
    setLastScanned(p.name);
    if (mode === 'inventario' && batchMode && !isWeighed(p)) {
      setBatch((b) =>
        b.some((l) => l.product.id === p.id)
          ? b.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + qty } : l))
          : [{ product: p, qty }, ...b],
      );
    } else {
      setCurrentQty(qty);
      setCurrent(p);
    }
  };

  // Una sola alerta a la vez: mientras está abierta la cámara queda en pausa y no se atienden más lecturas
  const askingRef = useRef(false);
  const handleCode = async (code: string) => {
    if (askingRef.current) return;
    const p = findByBarcode(code);
    if (p) return handleProduct(p);
    askingRef.current = true;
    setAsking(true);
    const create = await showAlert({
      tone: 'warning',
      title: 'Código no registrado',
      code,
      message: 'Este producto aún no está en tu inventario.',
      primary: 'Dar de alta',
      secondary: 'Cancelar',
    });
    // Al dar de alta la cámara se apaga antes de quitar la pausa: así no vuelve a leer el mismo código
    // mientras la pantalla se va (antes se reanudaba y reabría la alerta y la cámara encima del formulario)
    if (create) {
      setVisible(false);
      newProduct(code);
    }
    askingRef.current = false;
    setAsking(false);
  };

  const changeBatch = (id: string, delta: number) =>
    setBatch((b) => b.map((l) => (l.product.id === id ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0));

  const saveBatch = () => {
    const pieces = batch.reduce((n, l) => n + l.qty, 0);
    const r = addStock(batch.map((l) => ({ productId: l.product.id, qty: l.qty })));
    setBatch([]);
    toast({
      message: r === 'pendiente' ? `${pieces} piezas guardadas en el celular. Se subirán al volver la conexión.` : `${pieces} piezas sumadas al inventario`,
      duration: 2400,
      color: r === 'pendiente' ? 'warning' : 'success',
      position: 'top',
      cssClass: 'toast-app',
    });
  };

  const mine = thisDevice ? sent.filter((s) => s.deviceId === thisDevice.id) : [];
  const recent = mine.slice(0, 4);
  const batchPieces = batch.reduce((n, l) => n + l.qty, 0);
  const registerLive = isLive('panel');

  return (
    <IonPage>
      <AppHeader title="Escáner">
        <IonToolbar className="scan-tools">
          {!thisDevice ? (
            <button type="button" className="scan-status is-off" onClick={() => router.push('/movil/vincular')}>
              <span className="scan-status-icon"><IonIcon icon={linkOutline} aria-hidden="true" /></span>
              <span className="scan-status-text">
                <strong>Sin vincular</strong>
                <small>Toca para vincular con la caja</small>
              </span>
              <IonIcon icon={chevronForward} className="scan-status-go" aria-hidden="true" />
            </button>
          ) : (
            <div className={`scan-status ${!online || !registerLive ? 'is-wait' : 'is-on'}`}>
              <span className="scan-status-icon">
                <IonIcon icon={onScreenCustomer ? personOutline : receiptOutline} aria-hidden="true" />
              </span>
              <span className="scan-status-text">
                <small>
                  <span className="scan-link-dot" aria-hidden="true" />
                  {!online ? `Sin conexión con ${store.register}` : registerLive ? `Conectado a ${store.register}` : `${store.register} cerrada`}
                </small>
                {mode === 'vender' ? (
                  <strong>
                    {onScreen ? (
                      <>Enviando a {onScreenCustomer ? onScreenCustomer.name : onScreen.name}</>
                    ) : (
                      'Enviando a la cuenta en pantalla'
                    )}
                  </strong>
                ) : (
                  <strong>{mode === 'inventario' ? 'Entradas de inventario' : 'Consulta de precios'}</strong>
                )}
              </span>
              {mode === 'vender' && onScreen && onScreen.count > 0 && <span className="scan-status-count">{onScreen.count} art.</span>}
            </div>
          )}
          <IonSegment value={mode} onIonChange={(e) => setMode(e.detail.value as ScanMode)} className="scan-modes" aria-label="Modo del escáner">
            <IonSegmentButton value="vender" layout="icon-start">
              <IonIcon icon={cartOutline} />
              <IonLabel>Vender</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="inventario" layout="icon-start">
              <IonIcon icon={archiveOutline} />
              <IonLabel>Inventario</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="consultar" layout="icon-start">
              <IonIcon icon={searchOutline} />
              <IonLabel>Consultar</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </AppHeader>

      <IonContent scrollY={false}>
        <div className={`scan-layout ${typing ? 'is-typing' : ''}`}>
          <div className="scan-camera">
            <ScannerView
              enabled={visible && !typing}
              paused={!!current || asking}
              onCode={(code) => void handleCode(code)}
              lastScanned={lastScanned}
              hint={mode === 'vender' && onScreen ? `Se agrega a ${accountLabel(onScreen)}` : MODE_HINT[mode]}
            />
          </div>

          <div className="scan-panel">
            <div className="scan-search" onFocus={() => setTyping(true)} onBlur={() => setTyping(false)}>
              <BarcodeSearch
                products={products}
                onPick={handleProduct}
                onMissing={newProduct}
                placeholder="Escribe el código de barras"
                keyboardToggle
                blurOnPick
              />
            </div>

            {mode === 'vender' && (
              <>
                <div className="scan-panel-head">
                  <h2>Últimos envíos</h2>
                  {mine.length > 0 && (
                    <button type="button" className="scan-more" onClick={() => router.push('/movil/enviados')}>
                      Ver todo <IonIcon icon={chevronForward} />
                    </button>
                  )}
                </div>
                {recent.length === 0 ? (
                  <EmptyState art="cart" title="Nada enviado todavía" text="Escanea o escribe un código y aparecerá en la cuenta de la caja." />
                ) : (
                  <ul className="scan-list">
                    {recent.map((s) => (
                      <li key={s.id}>
                        <ProductThumb product={s.product} size={38} />
                        <span className="scan-list-name">
                          <strong>{s.qty} × {s.product.name}</strong>
                          <span className="scan-list-meta">
                            <SentPill status={s.status} />
                            {sentTo(s) && <span className="scan-list-to">→ {sentTo(s)}</span>}
                          </span>
                        </span>
                        <span className="money">{money(s.qty * s.product.price)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {mode === 'inventario' && (
              <>
                <div className="scan-panel-head">
                  <h2>{batchMode ? `Lote · ${batchPieces} ${batchPieces === 1 ? 'pieza' : 'piezas'}` : 'Agregar inventario'}</h2>
                  <IonToggle checked={batchMode} onIonChange={(e) => setBatchMode(e.detail.checked)} labelPlacement="start">
                    Por lote
                  </IonToggle>
                </div>
                {!batchMode ? (
                  <div className="scan-help">
                    <p>
                      Escanea un producto para sumar piezas o cambiar sus datos. Con <strong>Por lote</strong> escaneas
                      todo lo que llegó y lo guardas de una vez.
                    </p>
                    <IonButton fill="outline" className="btn-lg" expand="block" onClick={() => newProduct()}>
                      <IonIcon slot="start" icon={addCircleOutline} />
                      Registrar producto nuevo
                    </IonButton>
                  </div>
                ) : batch.length === 0 ? (
                  <EmptyState art="box" title="Lote vacío" text="Cada código que escanees suma una pieza a la lista." />
                ) : (
                  <ul className="scan-list">
                    {batch.map((l) => (
                      <li key={l.product.id}>
                        <ProductThumb product={l.product} size={38} />
                        <span className="scan-list-name">
                          <strong>{l.product.name}</strong>
                          <span className="scan-list-stock">
                            <StockBadge product={l.product} compact />
                            <span className="muted">→ {l.product.stock + l.qty} pzas</span>
                          </span>
                        </span>
                        <span className="scan-batch-qty">
                          <button type="button" onClick={() => changeBatch(l.product.id, -1)} aria-label="Uno menos">
                            <IonIcon icon={l.qty === 1 ? trashOutline : remove} />
                          </button>
                          <span>+{l.qty}</span>
                          <button type="button" onClick={() => changeBatch(l.product.id, 1)} aria-label="Uno más">
                            <IonIcon icon={add} />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {mode === 'consultar' && (
              <div className="scan-help">
                <p>Muestra precio de venta, precio de compra, existencia y los últimos movimientos. No cambia nada en la caja ni en el inventario.</p>
              </div>
            )}
          </div>
        </div>
      </IonContent>

      {mode === 'inventario' && batchMode && batch.length > 0 && (
        <IonFooter className="action-footer ion-no-border">
          <IonToolbar>
            <IonButton expand="block" className="btn-xl" onClick={saveBatch}>
              <IonIcon slot="start" icon={checkmarkDone} />
              Guardar entradas ({batchPieces})
            </IonButton>
          </IonToolbar>
        </IonFooter>
      )}

      <ScanResultSheet
        product={current}
        mode={mode}
        initialQty={currentQty}
        destination={onScreen && accountLabel(onScreen)}
        onClose={() => setCurrent(undefined)}
      />
    </IonPage>
  );
}

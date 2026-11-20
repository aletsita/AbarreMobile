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
  useIonAlert,
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
  remove,
  scanOutline,
  searchOutline,
  trashOutline,
} from 'ionicons/icons';
import { useRef, useState } from 'react';
import { AppHeader } from '../../../components/AppHeader';
import { BarcodeSearch } from '../../components/BarcodeSearch';
import { EmptyState } from '../../../components/EmptyState';
import { ProductThumb } from '../../../components/ProductThumb';
import { ScannerView } from '../../components/ScannerView';
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

export default function Scanner() {
  const { products, sent, thisDevice, store, addStock, findByBarcode, isLive, online } = useApp();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const [alert] = useIonAlert();
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

  const handleProduct = (p: ProductView, qty = 1) => {
    setLastScanned(p.name);
    if (mode === 'inventario' && batchMode) {
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

  const lastSim = useRef<string>();
  const simulateScan = () => {
    const pool = products.filter((p) => p.barcode && p.barcode !== lastSim.current);
    if (!pool.length) return;
    const p = pool[Math.floor(Math.random() * pool.length)];
    lastSim.current = p.barcode;
    setLastScanned(p.barcode);
    handleCode(p.barcode);
  };

  const handleCode = (code: string) => {
    const p = findByBarcode(code);
    if (p) return handleProduct(p);
    setAsking(true);
    alert({
      header: 'Código no registrado',
      message: `El código ${code} no está en tu inventario.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Dar de alta', handler: () => newProduct(code) },
      ],
      onDidDismiss: () => setAsking(false),
    });
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
            <button type="button" className="scan-link is-off" onClick={() => router.push('/movil/vincular')}>
              <IonIcon icon={linkOutline} />
              Sin vincular · <strong>Vincular con la caja</strong>
            </button>
          ) : (
            <div className={`scan-link ${!online ? 'is-wait' : registerLive ? 'is-on' : 'is-wait'}`}>
              <span className="scan-link-dot" aria-hidden="true" />
              {!online ? (
                <span>Sin conexión con <strong>{store.register}</strong></span>
              ) : registerLive ? (
                <span>Conectado a <strong>{store.register}</strong></span>
              ) : (
                <span><strong>{store.register}</strong> cerrada · los envíos aparecerán al abrirla</span>
              )}
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
              onCode={handleCode}
              lastScanned={lastScanned}
              hint={MODE_HINT[mode]}
            />
            <button type="button" className="scanner-simulate" onClick={simulateScan} disabled={!!current || asking}>
              <IonIcon icon={scanOutline} />
              Simular escaneo
            </button>
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
                  <h2>Enviado a {store.register}</h2>
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
                          <SentPill status={s.status} />
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
                          <span className="muted">Stock {l.product.stock} → {l.product.stock + l.qty}</span>
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

      <ScanResultSheet product={current} mode={mode} initialQty={currentQty} onClose={() => setCurrent(undefined)} />
    </IonPage>
  );
}

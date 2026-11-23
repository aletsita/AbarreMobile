import { IonButton, IonContent, IonIcon, IonModal, useIonRouter, useIonToast } from '@ionic/react';
import {
  add,
  addCircleOutline,
  alertCircleOutline,
  arrowDown,
  arrowUp,
  constructOutline,
  createOutline,
  linkOutline,
  paperPlaneOutline,
  remove,
  sparklesOutline,
} from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { ProductThumb } from '../../components/ProductThumb';
import { StockBadge } from './StockBadge';
import { SyncBadge } from './SyncBadge';
import { useApp, type ProductView } from '../context/AppContext';
import { money, shortDate, type MovementType } from '../../data/models';
import { availableLabel, clampToAvailable, piecesLabel } from '../../domain/stock';
import './ScanResultSheet.css';

export type ScanMode = 'vender' | 'inventario' | 'consultar';

interface Props {
  product?: ProductView;
  mode: ScanMode;
  initialQty?: number;
  // Cuenta de la caja a la que se manda en modo vender
  target?: { id: string; name: string };
  onClose: () => void;
}

const MOVE_ICON: Record<MovementType, string> = { venta: arrowDown, entrada: arrowUp, ajuste: constructOutline, alta: sparklesOutline };
const MOVE_LABEL: Record<MovementType, string> = { venta: 'Venta', entrada: 'Entrada', ajuste: 'Ajuste', alta: 'Alta' };
const HEIGHTS: Record<ScanMode, number> = { vender: 0.52, inventario: 0.62, consultar: 0.92 };

export function ScanResultSheet({ product, mode, initialQty = 1, target, onClose }: Props) {
  const { sendToRegister, addStock, store, thisDevice, movementsFor, availableFor } = useApp();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const [qty, setQty] = useState(initialQty);

  // Al vender no se puede mandar más de lo disponible (existencia − apartado − lo que ya está en cuentas)
  const selling = mode === 'vender';
  const available = product && selling ? availableFor(product.id) : Infinity;
  const soldOut = selling && available <= 0;
  const [limited, setLimited] = useState(false);

  useEffect(() => {
    if (!selling) {
      setQty(initialQty);
      setLimited(false);
      return;
    }
    const r = clampToAvailable(initialQty, available);
    setQty(Math.max(1, r.qty));
    setLimited(r.limited && r.qty > 0);
    // Solo al abrir otro producto; el disponible que cambie después se revisa al enviar
  }, [product?.id, mode, initialQty]);

  const notify = (message: string, saved: boolean) =>
    toast({
      message: saved ? `${message}. Sin conexión: quedó guardado en el celular y se subirá solo.` : message,
      duration: saved ? 3200 : 1800,
      color: saved ? 'warning' : 'success',
      position: 'top',
      cssClass: 'toast-app',
    });

  const send = () => {
    if (!product || soldOut) return;
    const n = Math.min(qty, available);
    if (n < 1) return;
    const r = sendToRegister(product, n, target?.id);
    notify(`${n} × ${product.name} agregado a ${target?.name ?? store.register}`, r === 'pendiente');
    onClose();
  };

  const more = () => {
    if (qty >= available) {
      setLimited(true);
      return;
    }
    setQty((q) => q + 1);
  };

  const sumStock = () => {
    if (!product) return;
    const r = addStock([{ productId: product.id, qty }]);
    notify(`+${qty} ${product.name} al inventario`, r === 'pendiente');
    onClose();
  };

  const go = (path: string) => {
    onClose();
    router.push(path);
  };

  const moves = product ? movementsFor(product.id) : [];

  return (
    <IonModal
      isOpen={!!product}
      onDidDismiss={onClose}
      initialBreakpoint={HEIGHTS[mode]}
      breakpoints={[0, HEIGHTS[mode], 1]}
      className="scan-sheet"
    >
      {product && (
        <IonContent className="ion-padding">
          <div className="ss-head">
            <ProductThumb product={product} size={72} />
            <div className="ss-info">
              <span className="ss-code">{product.barcode}</span>
              <h2>{product.name}</h2>
              <div className="ss-meta">
                <strong className="money">{money(product.price)}</strong>
                <StockBadge product={product} />
                {product.sync && <SyncBadge state={product.sync} compact />}
              </div>
            </div>
          </div>

          {soldOut && (
            <p className="ss-warn is-danger" role="alert">
              <IonIcon icon={alertCircleOutline} />
              <span>
                <strong>Sin stock para vender.</strong> Las {piecesLabel(product.stock)} que marca el inventario ya están apartadas por pedidos o en otras cuentas.
              </span>
            </p>
          )}
          {selling && !soldOut && limited && (
            <p className="ss-warn" role="status">
              <IonIcon icon={alertCircleOutline} />
              <span>Solo hay <strong>{availableLabel(available)}</strong> para vender.</span>
            </p>
          )}

          {mode !== 'consultar' && !soldOut && (
            <section className="ss-qty">
              <span>{mode === 'vender' ? 'Cantidad' : 'Piezas que entran'}</span>
              <div className="ss-stepper">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Uno menos">
                  <IonIcon icon={remove} />
                </button>
                <span className="money" aria-live="polite">{qty}</span>
                <button type="button" onClick={mode === 'vender' ? more : () => setQty((q) => q + 1)} aria-label="Uno más" disabled={soldOut}>
                  <IonIcon icon={add} />
                </button>
              </div>
            </section>
          )}

          {mode === 'inventario' && (
            <div className="ss-quick">
              {[6, 12, 24].map((n) => (
                <button key={n} type="button" onClick={() => setQty(n)} className={qty === n ? 'is-active' : ''}>
                  {n} pzas
                </button>
              ))}
              <span className="ss-after">
                Quedarán <strong>{product.stock + qty}</strong>
              </span>
            </div>
          )}

          {mode === 'vender' && (
            <div className="ss-actions">
              {thisDevice ? (
                <>
                  <IonButton expand="block" color="secondary" className="btn-xl" onClick={send} disabled={soldOut || !target}>
                    <IonIcon slot="start" icon={paperPlaneOutline} />
                    {soldOut ? 'Sin stock' : `Agregar a ${target?.name ?? 'la cuenta'} · ${money(product.price * qty)}`}
                  </IonButton>
                  {!soldOut && target && <p className="ss-dest">Se agrega a la cuenta <strong>{target.name}</strong> en {store.register}.</p>}
                </>
              ) : (
                <>
                  <p className="ss-note">Este celular no está vinculado con ninguna caja.</p>
                  <IonButton expand="block" className="btn-xl" onClick={() => go('/movil/vincular')}>
                    <IonIcon slot="start" icon={linkOutline} />
                    Vincular con la caja
                  </IonButton>
                </>
              )}
            </div>
          )}

          {mode === 'inventario' && (
            <div className="ss-actions">
              <IonButton expand="block" className="btn-xl" onClick={sumStock}>
                <IonIcon slot="start" icon={addCircleOutline} />
                Sumar al stock
              </IonButton>
              <IonButton expand="block" fill="outline" className="btn-lg" onClick={() => go(`/movil/producto/${product.id}`)}>
                <IonIcon slot="start" icon={createOutline} />
                Editar datos
              </IonButton>
            </div>
          )}

          {mode === 'consultar' && (
            <>
              <dl className="ss-facts">
                <div><dt>Precio de venta</dt><dd className="money">{money(product.price)}</dd></div>
                <div><dt>Precio de compra</dt><dd className="money">{money(product.cost)}</dd></div>
                <div><dt>Existencia</dt><dd className="money">{product.stock} pzas</dd></div>
                <div><dt>Ganancia por pieza</dt><dd className="money ss-margin">{money(product.price - product.cost)}</dd></div>
              </dl>
              <h3 className="section-title">Movimientos</h3>
              {moves.length === 0 ? (
                <p className="muted ss-none">Todavía no hay movimientos de este producto.</p>
              ) : (
                <ul className="ss-moves">
                  {moves.map((m) => (
                    <li key={m.id}>
                      <span className={`ss-move-icon type-${m.type}`}><IonIcon icon={MOVE_ICON[m.type]} /></span>
                      <span className="ss-move-text">
                        <strong>{MOVE_LABEL[m.type]}</strong>
                        <span className="muted">{m.note} · {shortDate(m.date)}</span>
                      </span>
                      <span className={`ss-move-qty ${m.qty > 0 ? 'is-in' : 'is-out'}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</span>
                    </li>
                  ))}
                </ul>
              )}
              <IonButton expand="block" fill="outline" className="btn-lg" onClick={() => go(`/movil/producto/${product.id}`)}>
                <IonIcon slot="start" icon={createOutline} />
                Editar datos
              </IonButton>
            </>
          )}
        </IonContent>
      )}
    </IonModal>
  );
}

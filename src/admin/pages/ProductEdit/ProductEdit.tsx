import { isWeighed, qtyLabel, qtyText, roundQty, type SaleType } from '../../../domain/weight';
import { SaleTypeField } from '../../components/SaleTypeField';
import { IonButton, IonContent, IonFooter, IonIcon, IonPage, IonToolbar, useIonRouter, useIonToast } from '@ionic/react';
import { add, arrowDown, arrowUp, barcodeOutline, constructOutline, cubeOutline, phonePortraitOutline, pricetagOutline, pricetagsOutline, remove, saveOutline, sparklesOutline, swapVerticalOutline, trashOutline } from 'ionicons/icons';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppAlert } from '../../../components/AppAlert';
import { AppHeader } from '../../../components/AppHeader';
import { EmptyState } from '../../../components/EmptyState';
import { AreaField, FormCard, MoneyField, SwitchField, TextField } from '../../../components/Form';
import { PhotoPicker } from '../../components/PhotoPicker';
import { StockBadge } from '../../components/StockBadge';
import { SyncBadge } from '../../components/SyncBadge';
import { useApp } from '../../context/AppContext';
import { money, shortDate, type MovementType, type Product } from '../../../data/models';
import './ProductEdit.css';

const MOVE_ICON: Record<MovementType, string> = { venta: arrowDown, entrada: arrowUp, ajuste: constructOutline, alta: sparklesOutline };
const MOVE_LABEL: Record<MovementType, string> = { venta: 'Venta', entrada: 'Entrada', ajuste: 'Ajuste', alta: 'Alta' };

export default function ProductEdit() {
  const { id } = useParams<{ id: string }>();
  const { products, saveProduct, deleteProduct, movementsFor } = useApp();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const showAlert = useAppAlert();
  const [deleting, setDeleting] = useState(false);
  const view = products.find((p) => p.id === id);
  const [draft, setDraft] = useState<Product>();
  // Texto de los campos numéricos, para poder escribir "12." sin que se borre el punto
  const [nums, setNums] = useState({ price: '', cost: '', minStock: '', stock: '' });
  // Cuando ya se empezó a editar, lo que llegue de la caja (cada vez que manda sus datos) no borra el formulario
  const touched = useRef(false);

  useEffect(() => {
    if (!view) return setDraft(undefined);
    if (touched.current && draft?.id === view.id) return;
    touched.current = false;
    const { sync: _sync, ...product } = view;
    setDraft(product);
    setNums({ price: String(product.price), cost: String(product.cost), minStock: String(product.minStock), stock: String(product.stock) });
  }, [view]);

  if (!view || !draft) {
    return (
      <IonPage>
        <AppHeader title="Producto" backHref="/movil/escaner" />
        <IonContent>
          <EmptyState
            art="error"
            title="No encontramos este producto"
            text="Puede que se haya borrado. Vuelve a escanearlo."
            action={<IonButton className="btn-lg" routerLink="/movil/escaner" routerDirection="back">Volver al escáner</IonButton>}
          />
        </IonContent>
      </IonPage>
    );
  }

  const set = <K extends keyof Product>(k: K, v: Product[K]) => {
    touched.current = true;
    setDraft({ ...draft, [k]: v });
  };
  const setNum = (k: keyof typeof nums, v: string) => {
    setNums({ ...nums, [k]: v });
    set(k, Number(v) || 0);
  };
  const setStock = (n: number) => {
    setNums({ ...nums, stock: String(n) });
    set('stock', n);
  };
  const weighed = isWeighed(draft);
  // Existencia: piezas enteras o kilos con hasta 3 decimales
  const setQtyNum = (k: 'stock' | 'minStock', v: string) => {
    if (weighed ? !/^\d*[.,]?\d{0,3}$/.test(v) : false) return;
    const clean = weighed ? v.replace(',', '.') : v.replace(/\D/g, '');
    setNums({ ...nums, [k]: clean });
    set(k, roundQty(Number(clean) || 0));
  };
  // Al pasar a pieza la existencia queda en piezas enteras
  const setSaleType = (v: SaleType) => {
    touched.current = true;
    const next: Product = { ...draft, saleType: v === 'peso' ? 'peso' : undefined };
    if (v !== 'peso') {
      next.stock = Math.floor(draft.stock);
      next.minStock = Math.floor(draft.minStock);
    }
    if (v === 'peso') next.showInApp = false;
    setDraft(next);
    setNums({ ...nums, stock: String(next.stock), minStock: String(next.minStock) });
  };
  const { sync: _s, ...original } = view;
  const changed = JSON.stringify(draft) !== JSON.stringify(original);

  const save = () => {
    const r = saveProduct({ ...draft, name: draft.name.trim(), description: draft.description?.trim() || undefined }, false);
    touched.current = false;
    toast({
      message: r === 'pendiente' ? 'Cambios guardados en el celular. Se subirán al volver la conexión.' : 'Cambios guardados',
      duration: r === 'pendiente' ? 3000 : 1500,
      color: r === 'pendiente' ? 'warning' : 'success',
      position: 'top',
      cssClass: 'toast-app',
    });
    router.goBack();
  };

  // Borrado lógico: las ventas y cortes que ya lo incluyen no cambian
  const askDelete = async () => {
    const yes = await showAlert({
      tone: 'warning',
      title: `¿Borrar ${view.name}?`,
      message: 'Deja de aparecer en el inventario, en la caja y en la app de clientes. Las ventas y cortes que ya lo incluyen no cambian.',
      primary: { text: 'Borrar producto', danger: true },
      secondary: 'Cancelar',
    });
    if (!yes) return;
    setDeleting(true);
    const r = await deleteProduct(view.id);
    setDeleting(false);
    if (!r.ok) {
      await showAlert({ tone: 'error', title: 'No se pudo borrar', message: r.message, primary: 'Entendido' });
      return;
    }
    void toast({ message: `${view.name} se borró del inventario`, duration: 2000, color: 'success', position: 'top', cssClass: 'toast-app' });
    router.push('/movil/inventario', 'back', 'replace');
  };

  return (
    <IonPage>
      <AppHeader title="Editar producto" backHref="/movil/escaner" />
      <IonContent>
        <div className="page-pad is-narrow stack">
          <section className="pd-hero">
            <PhotoPicker value={draft.photo} onChange={(photo) => set('photo', photo)} />
            <div>
              <h1>{draft.name || 'Sin nombre'}</h1>
              <span className="pd-price">
                <strong className="money">{money(draft.price || 0)}</strong>
                <small>{weighed ? 'por kg' : 'por pieza'}</small>
              </span>
              <div className="row">
                <StockBadge product={draft} />
                {view.sync && <SyncBadge state={view.sync} compact />}
              </div>
            </div>
          </section>

          <FormCard title="Datos del producto" icon={pricetagsOutline}>
            <TextField label="Nombre" value={draft.name} error={!draft.name.trim() && 'Escribe el nombre del producto'} onChange={(v) => set('name', v)} />
            <TextField label="Código de barras" icon={barcodeOutline} inputMode="numeric" value={draft.barcode} onChange={(v) => set('barcode', v.replace(/\s/g, ''))} />
            <div>
              <span className="pd-label">Se vende por</span>
              <SaleTypeField value={draft.saleType} onChange={setSaleType} />
            </div>
          </FormCard>

          <FormCard title="Precio" icon={pricetagOutline}>
            <div className="form-grid">
              <MoneyField label={weighed ? 'Precio por kg' : 'Precio de venta'} value={nums.price} error={!(draft.price > 0) && 'Pon un precio mayor a $0'} onChange={(v) => setNum('price', v)} />
              <MoneyField label="Precio de compra" value={nums.cost} onChange={(v) => setNum('cost', v)} />
            </div>
            {draft.price > 0 && draft.cost > 0 && (
              <p className={`pd-margin ${draft.price > draft.cost ? 'is-ok' : 'is-bad'}`}>
                {draft.price > draft.cost ? (
                  <>
                    Ganas <strong>{money(draft.price - draft.cost)}</strong> por {weighed ? 'kilo' : 'pieza'} ({Math.round(((draft.price - draft.cost) / draft.price) * 100)} %)
                  </>
                ) : (
                  'El precio de venta es menor o igual al de compra'
                )}
              </p>
            )}
          </FormCard>

          <FormCard title="Existencia" icon={cubeOutline}>
            <div className="pd-stock">
              <TextField
                label={weighed ? 'Kilos en tienda' : 'Piezas en tienda'}
                suffix={weighed ? 'kg' : 'pzas'}
                inputMode={weighed ? 'decimal' : 'numeric'}
                value={nums.stock}
                hint={draft.stock !== original.stock ? `Antes: ${qtyLabel(original.stock, original.saleType)}` : undefined}
                onChange={(v) => setQtyNum('stock', v)}
              />
              {!weighed && (
                <div className="pd-stepper">
                  <button type="button" onClick={() => setStock(Math.max(0, draft.stock - 1))} aria-label="Uno menos">
                    <IonIcon icon={remove} />
                  </button>
                  <button type="button" onClick={() => setStock(draft.stock + 1)} aria-label="Uno más">
                    <IonIcon icon={add} />
                  </button>
                </div>
              )}
            </div>
            <TextField
              label="Avisar cuando queden"
              hint="Se marca como poco stock"
              suffix={weighed ? 'kg' : 'pzas'}
              inputMode={weighed ? 'decimal' : 'numeric'}
              value={nums.minStock}
              onChange={(v) => setQtyNum('minStock', v)}
            />
          </FormCard>

          <FormCard title="App de clientes" icon={phonePortraitOutline} text="Lo que ven en Pide y recoge">
            <AreaField
              label="Descripción"
              optional
              placeholder="Ej. Paquete de 12 huevos blancos."
              maxLength={300}
              value={draft.description ?? ''}
              onChange={(v) => set('description', v)}
            />
            <SwitchField
              label="Mostrar en la app"
              hint={weighed ? 'Los productos por peso no se piden desde la app: se venden en caja.' : 'Si lo apagas, los clientes no lo ven en Pide y recoge.'}
              disabled={weighed}
              checked={!weighed && draft.showInApp !== false}
              onChange={(v) => set('showInApp', v)}
            />
          </FormCard>

          <FormCard title="Movimientos" icon={swapVerticalOutline}>
            <ul className="pd-moves">
              {movementsFor(draft.id).map((m) => (
                <li key={m.id}>
                  <span className={`pd-move-icon type-${m.type}`}>
                    <IonIcon icon={MOVE_ICON[m.type]} />
                  </span>
                  <span className="pd-move-text">
                    <strong>{MOVE_LABEL[m.type]}</strong>
                    <span className="muted">
                      {m.note} · {shortDate(m.date)}
                    </span>
                  </span>
                  <span className={`pd-move-qty ${m.qty > 0 ? 'is-in' : 'is-out'}`}>
                    {m.qty > 0 ? '+' : ''}
                    {qtyText(m.qty, draft.saleType)}
                  </span>
                </li>
              ))}
              {movementsFor(draft.id).length === 0 && <li className="muted">Sin movimientos todavía.</li>}
            </ul>
          </FormCard>

          <button type="button" className="pd-delete" disabled={deleting} onClick={() => void askDelete()}>
            <IonIcon icon={trashOutline} aria-hidden="true" />
            Borrar producto
          </button>
        </div>
      </IonContent>

      <IonFooter className="action-footer ion-no-border">
        <IonToolbar>
          <IonButton expand="block" className="btn-xl" disabled={!changed || !draft.name.trim() || !(draft.price > 0)} onClick={save}>
            <IonIcon slot="start" icon={saveOutline} />
            Guardar cambios
          </IonButton>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
}

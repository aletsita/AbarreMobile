import { IonButton, IonContent, IonFooter, IonIcon, IonPage, IonToolbar, useIonRouter, useIonToast } from '@ionic/react';
import { add, arrowDown, arrowUp, barcodeOutline, constructOutline, remove, saveOutline, sparklesOutline, trashOutline } from 'ionicons/icons';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppAlert } from '../../../components/AppAlert';
import { AppHeader } from '../../../components/AppHeader';
import { EmptyState } from '../../../components/EmptyState';
import { AreaField, MoneyField, SwitchField, TextField } from '../../../components/Form';
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
          <section className="pd-hero card">
            <PhotoPicker value={draft.photo} onChange={(photo) => set('photo', photo)} />
            <div>
              <h1>{draft.name || 'Sin nombre'}</h1>
              <strong className="pd-price money">{money(draft.price || 0)}</strong>
              <div className="row">
                <StockBadge product={draft} />
                {view.sync && <SyncBadge state={view.sync} compact />}
              </div>
            </div>
          </section>

          <TextField label="Nombre" value={draft.name} error={!draft.name.trim() && 'Escribe el nombre del producto'} onChange={(v) => set('name', v)} />
          <div className="form-grid">
            <MoneyField label="Precio de venta" value={nums.price} error={!(draft.price > 0) && 'Pon un precio mayor a $0'} onChange={(v) => setNum('price', v)} />
            <MoneyField label="Precio de compra" value={nums.cost} onChange={(v) => setNum('cost', v)} />
          </div>
          <div className="form-grid">
            <TextField label="Avisar cuando queden" suffix="pzas" inputMode="numeric" value={nums.minStock} onChange={(v) => setNum('minStock', v.replace(/\D/g, ''))} />
            <TextField label="Código de barras" icon={barcodeOutline} inputMode="numeric" value={draft.barcode} onChange={(v) => set('barcode', v.replace(/\s/g, ''))} />
          </div>

          <section className="card pd-stock">
            <TextField
              label="Existencia"
              suffix="pzas"
              inputMode="numeric"
              value={nums.stock}
              hint={draft.stock !== original.stock ? `Antes: ${original.stock} pzas` : undefined}
              onChange={(v) => setNum('stock', v.replace(/\D/g, ''))}
            />
            <div className="pd-stepper">
              <button type="button" onClick={() => setStock(Math.max(0, draft.stock - 1))} aria-label="Uno menos">
                <IonIcon icon={remove} />
              </button>
              <button type="button" onClick={() => setStock(draft.stock + 1)} aria-label="Uno más">
                <IonIcon icon={add} />
              </button>
            </div>
          </section>

          <AreaField
            label="Descripción para los clientes"
            optional
            placeholder="Ej. Paquete de 12 huevos blancos."
            maxLength={300}
            value={draft.description ?? ''}
            onChange={(v) => set('description', v)}
          />
          <SwitchField
            label="Mostrar en la app de clientes"
            hint="Si lo apagas, los clientes no lo ven en Pide y recoge."
            checked={draft.showInApp !== false}
            onChange={(v) => set('showInApp', v)}
          />

          <h2 className="section-title">Movimientos</h2>
          <ul className="card pd-moves">
            {movementsFor(draft.id).map((m) => (
              <li key={m.id}>
                <span className={`pd-move-icon type-${m.type}`}><IonIcon icon={MOVE_ICON[m.type]} /></span>
                <span className="pd-move-text">
                  <strong>{MOVE_LABEL[m.type]}</strong>
                  <span className="muted">{m.note} · {shortDate(m.date)}</span>
                </span>
                <span className={`pd-move-qty ${m.qty > 0 ? 'is-in' : 'is-out'}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</span>
              </li>
            ))}
            {movementsFor(draft.id).length === 0 && <li className="muted">Sin movimientos todavía.</li>}
          </ul>
        </div>
      </IonContent>

      <IonFooter className="action-footer ion-no-border">
        <IonToolbar>
          <IonButton expand="block" className="btn-xl" disabled={!changed || !draft.name.trim() || !(draft.price > 0)} onClick={save}>
            <IonIcon slot="start" icon={saveOutline} />
            Guardar cambios
          </IonButton>
          <IonButton expand="block" fill="clear" color="danger" className="btn-lg" disabled={deleting} onClick={() => void askDelete()}>
            <IonIcon slot="start" icon={trashOutline} />
            Borrar producto
          </IonButton>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
}

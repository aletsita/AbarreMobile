import { IonButton, IonContent, IonFooter, IonIcon, IonInput, IonPage, IonToolbar, useIonRouter, useIonToast } from '@ionic/react';
import { add, arrowDown, arrowUp, barcodeOutline, constructOutline, remove, saveOutline, sparklesOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppHeader } from '../../../components/AppHeader';
import { EmptyState } from '../../../components/EmptyState';
import { PhotoPicker } from '../../../components/PhotoPicker';
import { StockBadge } from '../../../components/StockBadge';
import { SyncBadge } from '../../../components/SyncBadge';
import { useApp } from '../../../context/AppContext';
import { money, shortDate, type MovementType, type Product } from '../../../data/models';
import './ProductEdit.css';

const MOVE_ICON: Record<MovementType, string> = { venta: arrowDown, entrada: arrowUp, ajuste: constructOutline, alta: sparklesOutline };
const MOVE_LABEL: Record<MovementType, string> = { venta: 'Venta', entrada: 'Entrada', ajuste: 'Ajuste', alta: 'Alta' };

export default function ProductEdit() {
  const { id } = useParams<{ id: string }>();
  const { products, saveProduct, movementsFor } = useApp();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const view = products.find((p) => p.id === id);
  const [draft, setDraft] = useState<Product>();

  useEffect(() => {
    if (!view) return setDraft(undefined);
    const { sync: _sync, ...product } = view;
    setDraft(product);
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

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setDraft({ ...draft, [k]: v });
  const { sync: _s, ...original } = view;
  const changed = JSON.stringify(draft) !== JSON.stringify(original);

  const save = () => {
    const r = saveProduct({ ...draft, name: draft.name.trim() }, false);
    toast({
      message: r === 'pendiente' ? 'Cambios guardados en el celular. Se subirán al volver la conexión.' : 'Cambios guardados',
      duration: r === 'pendiente' ? 3000 : 1500,
      color: r === 'pendiente' ? 'warning' : 'success',
      position: 'top',
      cssClass: 'toast-app',
    });
    router.goBack();
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

          <IonInput className="field" fill="outline" label="Nombre" labelPlacement="stacked" value={draft.name} onIonInput={(e) => set('name', e.detail.value ?? '')} />
          <div className="pd-grid">
            <IonInput className="field" fill="outline" label="Precio de venta" labelPlacement="stacked" inputmode="decimal"
              value={String(draft.price)} onIonInput={(e) => set('price', Number(e.detail.value) || 0)}>
              <span slot="start" className="muted">$</span>
            </IonInput>
            <IonInput className="field" fill="outline" label="Precio de compra" labelPlacement="stacked" inputmode="decimal"
              value={String(draft.cost)} onIonInput={(e) => set('cost', Number(e.detail.value) || 0)}>
              <span slot="start" className="muted">$</span>
            </IonInput>
          </div>
          <IonInput className="field" fill="outline" label="Avisar cuando queden" labelPlacement="stacked" inputmode="numeric"
            value={String(draft.minStock)} onIonInput={(e) => set('minStock', Number(e.detail.value) || 0)} />
          <IonInput className="field" fill="outline" label="Código de barras" labelPlacement="stacked" inputmode="numeric"
            value={draft.barcode} onIonInput={(e) => set('barcode', e.detail.value ?? '')}>
            <IonIcon slot="start" icon={barcodeOutline} className="muted" style={{ marginRight: 8 }} />
          </IonInput>

          <section className="card pd-stock">
            <div>
              <span className="pd-stock-label">Existencia</span>
              <strong className="money">{draft.stock} pzas</strong>
            </div>
            <div className="pd-stepper">
              <button type="button" onClick={() => set('stock', Math.max(0, draft.stock - 1))} aria-label="Uno menos">
                <IonIcon icon={remove} />
              </button>
              <button type="button" onClick={() => set('stock', draft.stock + 1)} aria-label="Uno más">
                <IonIcon icon={add} />
              </button>
            </div>
          </section>

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
          <IonButton expand="block" className="btn-xl" disabled={!changed || !draft.name.trim()} onClick={save}>
            <IonIcon slot="start" icon={saveOutline} />
            Guardar cambios
          </IonButton>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
}

import { IonButton, IonContent, IonFooter, IonIcon, IonPage, IonSpinner, IonToolbar, useIonRouter, useIonToast } from '@ionic/react';
import { cartOutline, storefrontOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { money } from '../../data/models';
import { Availability, Price, ProductImage, QtyStepper, StoreClosed } from '../components/ui';
import { useCart } from '../lib/cart';
import { useCatalog } from '../lib/catalog';

export default function Producto() {
  const { id } = useParams<{ id: string }>();
  const { byId, loading, error, refresh, closed } = useCatalog();
  const cart = useCart();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const p = byId(id);
  const inCart = cart.qtyOf(id);
  const left = p ? Math.max(0, p.stock - inCart) : 0;
  const [qty, setQty] = useState(1);

  useEffect(() => setQty((q) => Math.max(1, Math.min(q, left || 1))), [left]);

  const add = () => {
    if (!p) return;
    const added = cart.add(p, qty);
    void toast({ message: `Agregaste ${added} × ${p.name}`, duration: 1600, color: 'success', position: 'top', cssClass: 'toast-app' });
    router.goBack();
  };

  let body;
  if (!p && loading) {
    body = (
      <div className="cl-center" role="status">
        <IonSpinner name="crescent" />
        Cargando…
      </div>
    );
  } else if (!p && error) {
    body = <EmptyState art="error" title="No pudimos cargar el producto" text={error} action={<IonButton onClick={() => void refresh()}>Reintentar</IonButton>} />;
  } else if (!p) {
    body = <EmptyState art="search" title="Este producto ya no está en la tienda" action={<IonButton routerLink="/cliente/tienda" routerDirection="back">Volver a la tienda</IonButton>} />;
  } else {
    body = (
      <div className="cl-detail">
        <StoreClosed compact />
        <ProductImage product={p} />
        <span className="cl-detail-cat">{p.category}</span>
        <h1>{p.name}</h1>
        <Price value={p.price} className="cl-detail-price" />
        <div className="cl-detail-stock">
          <Availability stock={p.stock} />
          {inCart > 0 && <span className="muted">{inCart} en tu carrito</span>}
        </div>
        {p.stock > 0 && left < 1 && <p className="muted">Ya tienes en tu carrito todas las piezas que puedes pedir.</p>}

        {p.description && (
          <section className="cl-detail-desc">
            <h2>Descripción</h2>
            <p>{p.description}</p>
          </section>
        )}
        <p className="cl-detail-pickup">
          <IonIcon icon={storefrontOutline} aria-hidden="true" />
          <span><strong>Recoge en tienda</strong> y paga al recoger.</span>
        </p>
      </div>
    );
  }

  const canAdd = !!p && p.stock > 0 && left > 0 && !closed;

  return (
    <IonPage>
      <AppHeader title="Producto" backHref="/cliente/tienda" />
      <IonContent>
        <div className="page-pad is-narrow">{body}</div>
      </IonContent>
      {canAdd && (
        <IonFooter className="action-footer">
          <IonToolbar>
            <div className="cl-foot-row">
              <QtyStepper label="Cantidad" value={qty} max={left} onChange={setQty} />
              <IonButton className="btn-xl cl-grow" onClick={add}>
                <IonIcon slot="start" icon={cartOutline} />
                Agregar · {money(p!.price * qty)}
              </IonButton>
            </div>
          </IonToolbar>
        </IonFooter>
      )}
    </IonPage>
  );
}

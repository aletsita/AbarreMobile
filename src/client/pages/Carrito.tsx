import { IonButton, IonContent, IonFooter, IonIcon, IonPage, IonSpinner, IonToolbar } from '@ionic/react';
import { arrowForward, chatbubbleEllipsesOutline, receiptOutline, trashOutline } from 'ionicons/icons';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { AreaField, FormCard } from '../../components/Form';
import { money } from '../../data/models';
import { ProductImage, QtyStepper, StoreClosed } from '../components/ui';
import { useCart } from '../lib/cart';
import { useCatalog } from '../lib/catalog';

export const NOTE_MAX = 200;

export default function Carrito() {
  const cart = useCart();
  const { closed } = useCatalog();

  let body;
  if (!cart.ready) {
    body = (
      <div className="cl-center" role="status">
        <IonSpinner name="crescent" />
      </div>
    );
  } else if (!cart.lines.length) {
    body = (
      <EmptyState
        art="cart"
        title="Tu carrito está vacío"
        text="Agrega productos desde la tienda y aquí arma tu pedido."
        action={<IonButton routerLink="/cliente/tienda" routerDirection="root">Ir a la tienda</IonButton>}
      />
    );
  } else {
    body = (
      <div className="stack">
        <div className="cl-cart-head">
          <h1>Tu carrito</h1>
          <span className="cl-cart-count">
            {cart.count} {cart.count === 1 ? 'pieza' : 'piezas'}
          </span>
        </div>

        <ul className="cl-cart-lines">
          {cart.lines.map((l) => (
            <li key={l.productId} className="cl-cart-line">
              <ProductImage product={l} size={56} />
              <div className="cl-cart-info">
                <strong>{l.name}</strong>
                <span className="cl-cart-meta">
                  {money(l.price)} c/u
                  {l.qty >= l.stock && <span className="cl-cart-max">Máximo disponible</span>}
                </span>
                <QtyStepper label={`Cantidad de ${l.name}`} value={l.qty} max={l.stock} onChange={(n) => cart.setQty(l.productId, n)} />
              </div>
              <div className="cl-cart-side">
                <span className="money cl-cart-sub">{money(l.price * l.qty)}</span>
                <button type="button" className="cl-cart-remove" onClick={() => cart.remove(l.productId)} aria-label={`Quitar ${l.name}`}>
                  <IonIcon icon={trashOutline} />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <FormCard title="Nota para la tienda" icon={chatbubbleEllipsesOutline} text="Opcional: algo que deban saber al prepararlo">
          <AreaField
            label="Nota"
            optional
            rows={2}
            maxLength={NOTE_MAX}
            placeholder="Ej. Las tortillas bien calientitas"
            value={cart.note}
            onChange={cart.setNote}
            hint={`${cart.note.length}/${NOTE_MAX}`}
          />
        </FormCard>

        <FormCard title="Resumen" icon={receiptOutline} className="cl-cart-total">
          <div>
            <span>Productos distintos</span>
            <span>{cart.lines.length}</span>
          </div>
          <div>
            <span>Piezas</span>
            <span>{cart.count}</span>
          </div>
          <div className="is-total">
            <span>Total</span>
            <strong className="money">{money(cart.total)}</strong>
          </div>
        </FormCard>
      </div>
    );
  }

  return (
    <IonPage>
      <AppHeader title="Carrito" offlineMessage="tu carrito se queda guardado. Para hacer el pedido necesitas conexión" />
      <IonContent>
        <div className="page-pad is-narrow">
          {cart.lines.length > 0 && <StoreClosed compact />}
          {body}
        </div>
      </IonContent>
      {cart.lines.length > 0 && (
        <IonFooter className="action-footer">
          <IonToolbar>
            <IonButton expand="block" className="btn-xl" routerLink={closed ? undefined : '/cliente/confirmar'} disabled={closed}>
              {closed ? 'La tienda está cerrada' : `Hacer pedido · ${money(cart.total)}`}
              {!closed && <IonIcon slot="end" icon={arrowForward} />}
            </IonButton>
          </IonToolbar>
        </IonFooter>
      )}
    </IonPage>
  );
}

import { IonButton, IonContent, IonFooter, IonIcon, IonPage, IonSpinner, IonToolbar } from '@ionic/react';
import { arrowForward, trashOutline } from 'ionicons/icons';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { AreaField } from '../../components/Form';
import { money } from '../../data/models';
import { ProductImage, QtyStepper } from '../components/ui';
import { useCart } from '../lib/cart';

export const NOTE_MAX = 200;

export default function Carrito() {
  const cart = useCart();

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
        <ul className="cl-lines card">
          {cart.lines.map((l) => (
            <li key={l.productId}>
              <ProductImage product={l} size={64} />
              <div className="cl-line-info">
                <strong>{l.name}</strong>
                <span className="muted">{money(l.price)} c/u{l.qty >= l.stock && ' · máximo disponible'}</span>
                <QtyStepper label={`Cantidad de ${l.name}`} value={l.qty} max={l.stock} onChange={(n) => cart.setQty(l.productId, n)} />
              </div>
              <div className="cl-line-end">
                <span className="money">{money(l.price * l.qty)}</span>
                <IonButton fill="clear" color="danger" size="small" onClick={() => cart.remove(l.productId)} aria-label={`Quitar ${l.name}`}>
                  <IonIcon slot="icon-only" icon={trashOutline} />
                </IonButton>
              </div>
            </li>
          ))}
        </ul>

        <AreaField
          label="Nota para la tienda"
          optional
          rows={2}
          maxLength={NOTE_MAX}
          placeholder="Ej. Las tortillas bien calientitas"
          value={cart.note}
          onChange={cart.setNote}
          hint={`${cart.note.length}/${NOTE_MAX}`}
        />

        <div className="cl-total card">
          <span>Total ({cart.count} {cart.count === 1 ? 'pieza' : 'piezas'})</span>
          <strong className="money">{money(cart.total)}</strong>
        </div>
        <p className="cl-pay-note">Pagas al recoger en la tienda.</p>
      </div>
    );
  }

  return (
    <IonPage>
      <AppHeader title="Carrito" offlineMessage="tu carrito se queda guardado. Para hacer el pedido necesitas conexión" />
      <IonContent>
        <div className="page-pad is-narrow">{body}</div>
      </IonContent>
      {cart.lines.length > 0 && (
        <IonFooter className="action-footer">
          <IonToolbar>
            <IonButton expand="block" className="btn-xl" routerLink="/cliente/confirmar">
              Hacer pedido · {money(cart.total)}
              <IonIcon slot="end" icon={arrowForward} />
            </IonButton>
          </IonToolbar>
        </IonFooter>
      )}
    </IonPage>
  );
}

import { IonButton, IonContent, IonFooter, IonIcon, IonPage, IonSpinner, IonToolbar, useIonRouter } from '@ionic/react';
import { alertCircleOutline, cardOutline, cloudOfflineOutline, lockClosedOutline, storefrontOutline } from 'ionicons/icons';
import { useState } from 'react';
import { ApiError, errorMessage } from '../../api/errors';
import type { OrderChange, OrderConflict } from '../../api/types';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { money } from '../../data/models';
import { useOnline } from '../../lib/online';
import { useCart } from '../lib/cart';
import { useCatalog } from '../lib/catalog';
import { useOrders } from '../lib/orders';
import { StoreClosed } from '../components/ui';

function changeText(c: OrderChange) {
  switch (c.kind) {
    case 'precio':
      return `${c.name}: el precio cambió de ${money(c.before)} a ${money(c.after)}.`;
    case 'existencia':
      return c.available > 0
        ? `${c.name}: solo quedan ${c.available}. Ajustamos tu carrito (pedías ${c.requested}).`
        : `${c.name}: se agotó. Lo quitamos de tu carrito.`;
    case 'no-disponible':
      return `${c.name}: ya no está disponible. Lo quitamos de tu carrito.`;
  }
}

export default function Confirmar() {
  const cart = useCart();
  const orders = useOrders();
  const catalog = useCatalog();
  const online = useOnline();
  const router = useIonRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; offline?: boolean } | null>(null);
  const [changes, setChanges] = useState<OrderChange[]>([]);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!online) {
      setError({ text: 'Sin internet no podemos enviar tu pedido. Tu carrito se queda guardado; inténtalo cuando vuelva la conexión.', offline: true });
      return;
    }
    setBusy(true);
    try {
      const order = await orders.create(
        {
          items: cart.lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price })),
          note: cart.note.trim(),
          expectedTotal: cart.total,
        },
        // Si el envío se reintenta con la misma clave, el servidor regresa el mismo pedido y la misma página de pago
        cart.orderKey,
      );
      cart.clear();
      void catalog.refresh();
      // El monto lo calculó el servidor. La tarjeta se escribe en el recuadro de Stripe de la pantalla de pago.
      router.push(`/cliente/pagar/${order.id}`, 'root', 'replace');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && (e.details as OrderConflict | undefined)?.code === 'pedido-cambio') {
        const conflict = e.details as OrderConflict;
        cart.applyConflict(conflict);
        setChanges(conflict.changes);
        void catalog.refresh();
      } else if (e instanceof ApiError && e.offline) {
        // La misma clave de idempotencia se reusa al reintentar: si el pedido sí llegó, no se duplica
        setError({ text: 'No pudimos comunicarnos con la tienda. Tu carrito se queda guardado; vuelve a intentarlo.', offline: true });
      } else {
        setError({ text: errorMessage(e, 'No pudimos enviar tu pedido.') });
      }
    } finally {
      setBusy(false);
    }
  };

  if (cart.ready && !cart.lines.length && !busy) {
    return (
      <IonPage>
        <AppHeader title="Confirmar pedido" backHref="/cliente/carrito" />
        <IonContent>
          <EmptyState
            art="cart"
            title={changes.length ? 'Ya no queda nada de tu carrito' : 'Tu carrito está vacío'}
            text={changes.length ? changes.map(changeText).join(' ') : 'Agrega productos para hacer un pedido.'}
            action={<IonButton routerLink="/cliente/tienda" routerDirection="root">Ir a la tienda</IonButton>}
          />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <AppHeader title="Confirmar pedido" backHref="/cliente/carrito" offlineMessage="para hacer el pedido necesitas conexión. Tu carrito se queda guardado" />
      <IonContent>
        <div className="page-pad is-narrow stack">
          <StoreClosed compact />
          {changes.length > 0 && (
            <section className="cl-changes" role="alert">
              <strong>Algunos productos cambiaron</strong>
              <ul>
                {changes.map((c) => (
                  <li key={`${c.kind}-${c.productId}`}>{changeText(c)}</li>
                ))}
              </ul>
              <span>Revisa el nuevo total y confirma de nuevo.</span>
            </section>
          )}

          <section className="card cl-summary">
            <h2 className="section-title">Tu pedido</h2>
            <ul>
              {cart.lines.map((l) => (
                <li key={l.productId}>
                  <span>
                    <strong>{l.qty} ×</strong> {l.name}
                  </span>
                  <span className="money">{money(l.price * l.qty)}</span>
                </li>
              ))}
            </ul>
            {cart.note.trim() && <p className="cl-note">Nota: {cart.note.trim()}</p>}
            <div className="cl-summary-total">
              <span>Total</span>
              <strong className="money">{money(cart.total)}</strong>
            </div>
          </section>

          <div className="cl-pickup">
            <IonIcon icon={storefrontOutline} />
            <span>Pasa a <strong>recoger tu pedido a la tienda</strong> cuando te avisemos que está listo.</span>
          </div>
          <div className="cl-pickup">
            <IonIcon icon={cardOutline} />
            <span><strong>Pagas en línea</strong> con tarjeta al confirmar. La tienda empieza tu pedido en cuanto se confirma el pago.</span>
          </div>
          <div className="cl-pickup">
            <IonIcon icon={lockClosedOutline} />
            <span>El pago se hace en la página segura de Stripe: la app nunca ve los datos de tu tarjeta.</span>
          </div>

          {error && (
            <div className="form-error" role="alert">
              <IonIcon icon={error.offline ? cloudOfflineOutline : alertCircleOutline} />
              {error.text}
            </div>
          )}
        </div>
      </IonContent>
      <IonFooter className="action-footer">
        <IonToolbar>
          <IonButton expand="block" className="btn-xl" color="secondary" onClick={() => void submit()} disabled={busy || !cart.lines.length || catalog.closed}>
            {busy ? <IonSpinner name="crescent" /> : changes.length ? `Confirmar y pagar con los cambios · ${money(cart.total)}` : `Confirmar y pagar · ${money(cart.total)}`}
          </IonButton>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
}

import { IonButton, IonContent, IonFooter, IonIcon, IonPage, IonSpinner, IonToolbar, useIonRouter, useIonToast } from '@ionic/react';
import { addOutline, cartOutline, checkmarkOutline, closeCircleOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import type { CatalogProduct, OrderItem } from '../../api/types';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { money, normalize } from '../../data/models';
import { Availability, ProductImage, QtyStepper } from '../components/ui';
import { useCart } from '../lib/cart';
import { useCatalog } from '../lib/catalog';
import { useOrders } from '../lib/orders';

const MAX_SUGGESTIONS = 6;

// Palabras que identifican un producto ("huevo", "blanco", "bimbo"), sin cantidades ni medidas
const words = (s: string) => new Set(normalize(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !/\d/.test(w)));

// Parecidos a lo que se agotó: primero los que comparten palabras del nombre (otra marca u otro tamaño
// del mismo producto), después los de la misma categoría. Solo lo que sí hay.
function suggestionsFor(item: OrderItem, gone: CatalogProduct | undefined, products: CatalogProduct[], exclude: string[]) {
  const target = words(item.name);
  return products
    .filter((p) => p.stock > 0 && !exclude.includes(p.id))
    .map((p) => {
      const shared = [...words(p.name)].filter((w) => target.has(w)).length;
      return { p, score: shared * 3 + (gone && p.category === gone.category ? 2 : 0) };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name, 'es'))
    .slice(0, MAX_SUGGESTIONS)
    .map((x) => x.p);
}

function ProductRow({ product: p, qty }: { product: CatalogProduct; qty: number }) {
  const cart = useCart();
  const inCart = cart.qtyOf(p.id);
  return (
    <li className="cl-swap-row">
      <ProductImage product={p} />
      <div className="cl-swap-info">
        <strong>{p.name}</strong>
        <span className="money">{money(p.price)}</span>
        <Availability stock={p.stock} />
      </div>
      {inCart > 0 ? (
        <QtyStepper label={`Cantidad de ${p.name}`} value={inCart} max={p.stock} onChange={(n) => cart.setQty(p.id, n)} />
      ) : (
        <IonButton size="small" onClick={() => cart.add(p, Math.min(qty, p.stock))}>
          <IonIcon slot="start" icon={addOutline} />
          Agregar
        </IonButton>
      )}
    </li>
  );
}

// Pedido cancelado por falta de existencia: el cliente elige otros productos en lugar de los agotados
// (otra marca, otro tamaño) y vuelve a agregar los que sí hay. Al final arma un pedido nuevo desde el carrito.
export default function CambiarPedido() {
  const { id } = useParams<{ id: string }>();
  const { orders, upsert } = useOrders();
  const { products, byId, loading, refresh } = useCatalog();
  const cart = useCart();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const [busy, setBusy] = useState(false);
  const order = orders.find((o) => o.id === id);

  // Existencias al momento: lo que se agotó en el pedido puede seguir agotado (o ya haber llegado)
  useEffect(() => {
    void refresh();
  }, []);

  if (!order || order.status !== 'cancelado') {
    return (
      <IonPage>
        <AppHeader title="Elegir otro producto" backHref="/cliente/pedidos" />
        <IonContent>
          <EmptyState art="search" title="Este pedido no está cancelado" action={<IonButton routerLink="/cliente/pedidos" routerDirection="root">Ver mis pedidos</IonButton>} />
        </IonContent>
      </IonPage>
    );
  }

  const missingIds = order.cancel?.missing ?? [];
  const missing = order.items.filter((i) => missingIds.includes(i.productId));
  const kept = order.items.filter((i) => !missingIds.includes(i.productId));
  const keptAvailable = kept.map((i) => ({ item: i, p: byId(i.productId) })).filter((x): x is { item: OrderItem; p: CatalogProduct } => !!x.p && x.p.stock > 0);
  const keptAdded = keptAvailable.length > 0 && keptAvailable.every((x) => cart.qtyOf(x.p.id) > 0);

  const addKept = () => {
    const n = keptAvailable.reduce((sum, { item, p }) => sum + (cart.qtyOf(p.id) ? 0 : cart.add(p, Math.min(item.qty, p.stock))), 0);
    void toast({ message: n ? 'Agregamos los demás productos a tu carrito' : 'Ya estaban en tu carrito', duration: 1800, color: 'success', position: 'top', cssClass: 'toast-app' });
  };

  const goCart = async () => {
    setBusy(true);
    try {
      upsert(await api.resolveOrder(order.id, 'reemplazar'));
    } catch {
      /* no impide seguir: el pedido cancelado solo se queda en «Activos» */
    }
    setBusy(false);
    router.push('/cliente/carrito', 'root');
  };

  return (
    <IonPage>
      <AppHeader title="Elegir otro producto" backHref={`/cliente/pedido/${order.id}`} />
      <IonContent>
        <div className="page-pad is-narrow stack">
          {loading && !products.length ? (
            <div className="cl-center" role="status">
              <IonSpinner name="crescent" />
              Cargando productos…
            </div>
          ) : (
            <>
              {missing.map((item) => {
                const now = byId(item.productId);
                // Si ya volvió a haber, el mismo producto va primero
                const options = [...(now && now.stock > 0 ? [now] : []), ...suggestionsFor(item, now, products, missingIds)];
                return (
                  <section key={item.productId} className="cl-swap">
                    <div className="cl-swap-gone">
                      <IonIcon icon={closeCircleOutline} aria-hidden="true" />
                      <span>
                        <strong>{item.qty} × {item.name}</strong>
                        <small>{now && now.stock > 0 ? 'Ya volvió a haber. Puedes pedirlo otra vez.' : 'Se agotó. Elige otro en su lugar:'}</small>
                      </span>
                    </div>
                    {options.length ? (
                      <>
                        <h2 className="cl-swap-sub">Parecidos</h2>
                        <ul className="cl-swap-keep">
                          {options.map((p) => <ProductRow key={p.id} product={p} qty={item.qty} />)}
                        </ul>
                      </>
                    ) : (
                      <p className="cl-swap-none">
                        No encontramos productos parecidos disponibles.{' '}
                        <IonButton fill="clear" size="small" routerLink="/cliente/tienda" routerDirection="root">Ver toda la tienda</IonButton>
                      </p>
                    )}
                  </section>
                );
              })}

              {kept.length > 0 && (
                <section className="cl-swap">
                  <h2 className="cl-swap-sub">{missing.length ? 'Los demás productos de tu pedido' : 'Tu pedido'}</h2>
                  <ul className="cl-swap-keep">
                    {kept.map((item) => {
                      const p = byId(item.productId);
                      return p && p.stock > 0 ? (
                        <ProductRow key={item.productId} product={p} qty={item.qty} />
                      ) : (
                        <li key={item.productId} className="cl-swap-row">
                          <div className="cl-swap-info">
                            <strong>{item.qty} × {item.name}</strong>
                            <Availability stock={0} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {keptAvailable.length > 0 && (
                    <IonButton expand="block" fill="outline" onClick={addKept} disabled={keptAdded}>
                      <IonIcon slot="start" icon={keptAdded ? checkmarkOutline : cartOutline} />
                      {keptAdded ? 'Ya están en tu carrito' : 'Agregar todos al carrito'}
                    </IonButton>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </IonContent>
      <IonFooter className="action-footer">
        <IonToolbar>
          <IonButton expand="block" className="btn-xl" disabled={busy || cart.count === 0} onClick={() => void goCart()}>
            {busy ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={cartOutline} />Ir al carrito{cart.count ? ` · ${money(cart.total)}` : ''}</>}
          </IonButton>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
}

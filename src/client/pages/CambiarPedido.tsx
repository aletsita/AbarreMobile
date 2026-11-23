import { IonButton, IonContent, IonFooter, IonIcon, IonPage, IonSpinner, IonToolbar, useIonRouter, useIonToast } from '@ionic/react';
import { addOutline, alertCircleOutline, checkmarkOutline, closeCircleOutline, removeOutline, trashOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, errorMessage } from '../../api/errors';
import { hasIssue, type CatalogProduct, type OrderConflict, type OrderItem } from '../../api/types';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { money, normalize } from '../../data/models';
import { Availability, ProductImage, StoreClosed } from '../components/ui';
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

interface RowProps {
  product: { id: string; name: string; category: string; photo?: string; price: number };
  qty: number;
  max: number;
  suggested?: number;
  disabled?: boolean;
  onChange: (qty: number) => void;
}

// Un producto del pedido nuevo: "Agregar" o, ya elegido, cuántas piezas (0 lo quita)
function Row({ product: p, qty, max, suggested = 1, disabled, onChange }: RowProps) {
  return (
    <li className={`cl-swap-row ${qty > 0 ? 'is-picked' : ''}`}>
      <ProductImage product={p} />
      <div className="cl-swap-info">
        <strong>{p.name}</strong>
        <span className="money">{money(p.price)}</span>
        <Availability stock={max} />
      </div>
      {qty > 0 ? (
        <div className="cl-qty" role="group" aria-label={`Cantidad de ${p.name}`}>
          <button type="button" onClick={() => onChange(qty - 1)} disabled={disabled} aria-label={qty === 1 ? 'Quitar' : 'Quitar uno'}>
            <IonIcon icon={qty === 1 ? trashOutline : removeOutline} />
          </button>
          <output aria-live="polite">{qty}</output>
          <button type="button" onClick={() => onChange(qty + 1)} disabled={disabled || qty >= max} aria-label="Agregar uno">
            <IonIcon icon={addOutline} />
          </button>
        </div>
      ) : (
        <IonButton size="small" disabled={disabled || max < 1} onClick={() => onChange(Math.max(1, Math.min(suggested, max)))}>
          <IonIcon slot="start" icon={addOutline} />
          Agregar
        </IonButton>
      )}
    </li>
  );
}

// Se agotó un producto: el cliente arma de nuevo SU MISMO pedido. Puede elegir otros productos en lugar de
// los agotados (otra marca, otro tamaño) y ajustar o quitar los demás. El pedido conserva su folio y su código.
export default function CambiarPedido() {
  const { id } = useParams<{ id: string }>();
  const { orders, change } = useOrders();
  const { products, byId, loading, refresh, closed } = useCatalog();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const order = orders.find((o) => o.id === id);
  const missingIds = order?.issue?.missing ?? [];
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lo que el cliente sigue queriendo del pedido arranca ya elegido
  useEffect(() => {
    if (!order) return;
    setPicked(Object.fromEntries(order.items.filter((i) => !missingIds.includes(i.productId)).map((i) => [i.productId, i.qty])));
  }, [order?.id, order?.issue?.at]);

  // Existencias al momento: lo agotado puede seguir agotado (o ya haber llegado)
  useEffect(() => {
    void refresh();
  }, []);

  // El catálogo ya descuenta lo que este pedido tiene apartado: para sus propios productos se devuelve
  const own = (pid: string) => order?.items.find((i) => i.productId === pid)?.qty ?? 0;
  const maxFor = (pid: string) => (byId(pid)?.stock ?? 0) + (missingIds.includes(pid) ? 0 : own(pid));
  const set = (pid: string, qty: number) =>
    setPicked((m) => {
      const next = { ...m };
      if (qty < 1) delete next[pid];
      else next[pid] = Math.min(qty, maxFor(pid));
      return next;
    });

  const lines = useMemo(
    () =>
      Object.entries(picked).map(([pid, qty]) => {
        const p = byId(pid);
        const item = order?.items.find((i) => i.productId === pid);
        return { productId: pid, qty, price: p?.price ?? item?.price ?? 0 };
      }),
    [picked, byId, order],
  );
  const total = lines.reduce((t, l) => t + l.qty * l.price, 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);

  if (!order || !hasIssue(order)) {
    return (
      <IonPage>
        <AppHeader title="Elegir otro producto" backHref={order ? `/cliente/pedido/${order.id}` : '/cliente/pedidos'} />
        <IonContent>
          <EmptyState
            art="search"
            title="Este pedido ya no necesita cambios"
            action={<IonButton routerLink={order ? `/cliente/pedido/${order.id}` : '/cliente/pedidos'} routerDirection="back">Ver mi pedido</IonButton>}
          />
        </IonContent>
      </IonPage>
    );
  }

  const missing = order.items.filter((i) => missingIds.includes(i.productId));
  const kept = order.items.filter((i) => !missingIds.includes(i.productId));
  const chosenIds = [...missingIds, ...kept.map((i) => i.productId)];
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await change(order.id, lines.map(({ productId, qty }) => ({ productId, qty })));
      void toast({ message: 'Listo. Le avisamos a la tienda de tu cambio.', duration: 2500, color: 'success', position: 'top', cssClass: 'toast-app' });
      router.push(`/cliente/pedido/${order.id}`, 'back');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && (e.details as OrderConflict | undefined)?.code === 'pedido-cambio') {
        const c = e.details as OrderConflict;
        setError(`${c.message} ${c.changes.map((x) => x.name).join(', ')}. Revisa las cantidades.`.trim());
        void refresh();
      } else setError(errorMessage(e, 'No pudimos avisar a la tienda.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <AppHeader title="Elegir otro producto" backHref={`/cliente/pedido/${order.id}`} />
      <IonContent>
        <div className="page-pad is-narrow stack">
          <StoreClosed compact />
          {loading && !products.length ? (
            <div className="cl-center" role="status">
              <IonSpinner name="crescent" />
              Cargando productos…
            </div>
          ) : (
            <>
              {missing.map((item) => {
                const now = byId(item.productId);
                const back = !!now && now.stock > 0;
                // Si ya volvió a haber, el mismo producto va primero
                const options = [...(back ? [now!] : []), ...suggestionsFor(item, now, products, chosenIds)];
                return (
                  <section key={item.productId} className="cl-swap">
                    <div className="cl-swap-gone">
                      <IonIcon icon={closeCircleOutline} aria-hidden="true" />
                      <span>
                        <strong>{item.qty} × {item.name}</strong>
                        <small>{back ? 'Ya volvió a haber. Puedes pedirlo otra vez.' : 'Se agotó. Elige otro en su lugar:'}</small>
                      </span>
                    </div>
                    {options.length ? (
                      <ul className="cl-swap-keep">
                        {options.map((p) => (
                          <Row key={p.id} product={p} qty={picked[p.id] ?? 0} max={maxFor(p.id)} suggested={item.qty} disabled={busy} onChange={(n) => set(p.id, n)} />
                        ))}
                      </ul>
                    ) : (
                      <p className="cl-swap-none">No encontramos productos parecidos disponibles. Puedes seguir con lo demás de tu pedido.</p>
                    )}
                  </section>
                );
              })}

              {kept.length > 0 && (
                <section className="cl-swap">
                  <h2 className="cl-swap-sub">Lo demás de tu pedido</h2>
                  <ul className="cl-swap-keep">
                    {kept.map((item) => {
                      const p = byId(item.productId);
                      return (
                        <Row
                          key={item.productId}
                          product={p ?? { id: item.productId, name: item.name, category: '', price: item.price }}
                          qty={picked[item.productId] ?? 0}
                          max={maxFor(item.productId)}
                          suggested={item.qty}
                          disabled={busy}
                          onChange={(n) => set(item.productId, n)}
                        />
                      );
                    })}
                  </ul>
                </section>
              )}

              {error && (
                <div className="form-error" role="alert">
                  <IonIcon icon={alertCircleOutline} />
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </IonContent>
      <IonFooter className="action-footer">
        <IonToolbar>
          <IonButton expand="block" className="btn-xl" disabled={busy || closed || count === 0} onClick={() => void save()}>
            {busy ? (
              <IonSpinner name="crescent" />
            ) : count === 0 ? (
              'Elige al menos un producto'
            ) : (
              <>
                <IonIcon slot="start" icon={checkmarkOutline} />
                Guardar cambios · {money(total)}
              </>
            )}
          </IonButton>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
}

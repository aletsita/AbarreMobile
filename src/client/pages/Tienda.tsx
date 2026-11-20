import { IonButton, IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSearchbar, IonSpinner, useIonRouter, useIonToast } from '@ionic/react';
import { addOutline, checkmarkOutline } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { money, normalize } from '../../data/models';
import type { CatalogProduct } from '../../api/types';
import { ProductImage } from '../components/ui';
import { useCart } from '../lib/cart';
import { useCatalog } from '../lib/catalog';

const ALL = 'Todo';

export default function Tienda() {
  const { products, loading, error, refresh } = useCatalog();
  const cart = useCart();
  const [toast] = useIonToast();
  const router = useIonRouter();
  const [text, setText] = useState('');
  const [category, setCategory] = useState(ALL);

  const categories = useMemo(() => [ALL, ...new Set(products.map((p) => p.category))], [products]);
  const shown = useMemo(() => {
    const q = normalize(text.trim());
    return products
      .filter((p) => (category === ALL || p.category === category) && (!q || normalize(p.name).includes(q)))
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.name.localeCompare(b.name, 'es'));
  }, [products, text, category]);

  const add = (p: CatalogProduct) => {
    const added = cart.add(p);
    void toast({
      message: added ? `${p.name} en tu carrito` : `Ya tienes todas las piezas disponibles de ${p.name}`,
      duration: 1600,
      color: added ? 'success' : 'warning',
      position: 'top',
      cssClass: 'toast-app',
    });
  };

  let body;
  if (loading && !products.length) {
    body = (
      <div className="cl-center" role="status">
        <IonSpinner name="crescent" />
        Cargando productos…
      </div>
    );
  } else if (error && !products.length) {
    body = <EmptyState art="error" title="No pudimos cargar la tienda" text={error} action={<IonButton onClick={() => void refresh()}>Reintentar</IonButton>} />;
  } else if (!products.length) {
    body = <EmptyState art="box" title="La tienda aún no tiene productos" text="Vuelve más tarde." />;
  } else if (!shown.length) {
    body = (
      <EmptyState
        art="search"
        title="Sin resultados"
        text={text ? `No encontramos «${text}»${category !== ALL ? ` en ${category}` : ''}.` : `No hay productos en ${category}.`}
        action={<IonButton fill="outline" onClick={() => { setText(''); setCategory(ALL); }}>Ver todo</IonButton>}
      />
    );
  } else {
    body = (
      <ul className="cl-grid">
        {shown.map((p) => {
          const soldOut = p.stock < 1;
          const inCart = cart.qtyOf(p.id);
          return (
            <li key={p.id} className={`cl-card ${soldOut ? 'is-out' : ''}`}>
              <button type="button" className="cl-card-link" onClick={() => router.push(`/cliente/producto/${p.id}`)}>
                <ProductImage product={p} />
                <span className="cl-card-name">{p.name}</span>
              </button>
              <div className="cl-card-foot">
                <span className="money">{money(p.price)}</span>
                {soldOut ? (
                  <span className="cl-out">Agotado</span>
                ) : (
                  <IonButton size="small" className="cl-add" onClick={() => add(p)} disabled={inCart >= p.stock} aria-label={`Agregar ${p.name}`}>
                    <IonIcon slot="icon-only" icon={inCart ? checkmarkOutline : addOutline} />
                    {inCart > 0 && <span className="cl-add-n">{inCart}</span>}
                  </IonButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <IonPage>
      <AppHeader title="Tienda" offlineMessage="los precios pueden no estar al día. Para pedir necesitas conexión">
        <div className="cl-search">
          <IonSearchbar value={text} onIonInput={(e) => setText(e.detail.value ?? '')} placeholder="Buscar productos" debounce={150} />
          <div className="cl-cats" role="tablist" aria-label="Categorías">
            {categories.map((c) => (
              <button key={c} type="button" role="tab" aria-selected={c === category} className={c === category ? 'is-on' : ''} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </AppHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void refresh().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="page-pad">{body}</div>
      </IonContent>
    </IonPage>
  );
}

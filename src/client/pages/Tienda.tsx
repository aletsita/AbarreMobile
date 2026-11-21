import { IonButton, IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, useIonActionSheet, useIonRouter } from '@ionic/react';
import {
  arrowBack,
  arrowForward,
  bagHandleOutline,
  cartOutline,
  chevronUp,
  closeCircle,
  ellipsisHorizontal,
  personOutline,
  receiptOutline,
  refreshOutline,
  searchOutline,
  storefrontOutline,
} from 'ionicons/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrandLogo, BrandWord } from '../../components/Brand';
import { OfflineBar } from '../../components/ConnectionBadge';
import { EmptyState } from '../../components/EmptyState';
import { money, normalize } from '../../data/models';
import { STORE } from '../../data/seed';
import type { CatalogProduct } from '../../api/types';
import { categoryIcon, categoryTint, ProductCard, StoreClosed } from '../components/ui';
import { useCart } from '../lib/cart';
import { useCatalog } from '../lib/catalog';

const ALL = 'Todo';

const byAvailability = (a: CatalogProduct, b: CatalogProduct) => Number(b.stock > 0) - Number(a.stock > 0) || a.name.localeCompare(b.name, 'es');

function SearchBox({ value, onChange, placeholder, compact }: { value: string; onChange: (v: string) => void; placeholder: string; compact?: boolean }) {
  return (
    <label className={`tn-search ${compact ? 'is-compact' : ''}`}>
      <IonIcon icon={searchOutline} aria-hidden="true" />
      <input type="search" enterKeyHint="search" autoComplete="off" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Borrar búsqueda">
          <IonIcon icon={closeCircle} />
        </button>
      )}
    </label>
  );
}

export default function Tienda() {
  const { products, loading, error, refresh, store } = useCatalog();
  const cart = useCart();
  const router = useIonRouter();
  const [menu] = useIonActionSheet();
  const [text, setText] = useState('');
  const [category, setCategory] = useState(ALL);
  const [collapsed, setCollapsed] = useState(false);
  const content = useRef<HTMLIonContentElement>(null);
  const hero = useRef<HTMLElement>(null);
  const catalogStart = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
  const sections = useMemo(
    () => categories.map((c) => ({ category: c, items: products.filter((p) => p.category === c).sort(byAvailability) })),
    [products, categories],
  );
  const shown = useMemo(() => {
    const q = normalize(text.trim());
    return products.filter((p) => (category === ALL || p.category === category) && (!q || normalize(p.name).includes(q))).sort(byAvailability);
  }, [products, text, category]);

  // Banners con datos reales: el servicio de la tienda y las categorías con más productos
  const banners = useMemo(
    () =>
      sections
        .filter((s) => s.items.some((p) => p.stock > 0))
        .sort((a, b) => b.items.length - a.items.length)
        .slice(0, 3)
        .map((s) => {
          const available = s.items.filter((p) => p.stock > 0);
          return { ...s, photo: available.find((p) => p.photo)?.photo, from: Math.min(...available.map((p) => p.price)) };
        }),
    [sections],
  );

  const browsing = category !== ALL || text.trim() !== '';

  const openCategory = (c: string) => {
    setCategory(c);
    void content.current?.scrollToTop(250);
  };
  const reset = () => {
    setCategory(ALL);
    setText('');
  };

  // El botón de regresar de Android cierra la categoría o la búsqueda antes de salir
  useEffect(() => {
    if (!browsing) return;
    const onBack = (ev: Event) => (ev as CustomEvent).detail.register(10, reset);
    document.addEventListener('ionBackButton', onBack);
    return () => document.removeEventListener('ionBackButton', onBack);
  }, [browsing]);

  const openMenu = () =>
    void menu({
      header: STORE.name,
      cssClass: 'tn-menu',
      buttons: [
        { text: 'Ver carrito', icon: cartOutline, handler: () => router.push('/cliente/carrito') },
        { text: 'Mis pedidos', icon: receiptOutline, handler: () => router.push('/cliente/pedidos') },
        { text: 'Perfil', icon: personOutline, handler: () => router.push('/cliente/perfil') },
        { text: 'Actualizar productos', icon: refreshOutline, handler: () => void refresh() },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });

  const placeholder = `Buscar en ${category !== ALL ? category : STORE.name}`;

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
  } else if (browsing) {
    body = (
      <div className="tn-browse">
        <div className="tn-browse-head">
          <button type="button" className="tn-round" onClick={reset} aria-label="Volver a la tienda">
            <IonIcon icon={arrowBack} />
          </button>
          <div>
            <h2>{category !== ALL ? category : 'Resultados'}</h2>
            <span className="muted">
              {text.trim() ? `«${text.trim()}» · ` : ''}
              {shown.length} {shown.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>
        </div>
        {shown.length ? (
          <div className="tn-grid">
            {shown.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            art="search"
            title="Sin resultados"
            text={text ? `No encontramos «${text}»${category !== ALL ? ` en ${category}` : ''}.` : `No hay productos en ${category}.`}
            action={<IonButton fill="outline" onClick={reset}>Ver todo</IonButton>}
          />
        )}
      </div>
    );
  } else {
    body = (
      <>
        <div className="tn-banners" aria-label="Promociones">
          <article className="tn-banner is-pickup">
            <div className="tn-banner-text">
              <strong>Pide y recoge</strong>
              <span>Arma tu pedido en la app y pásalo a recoger a la tienda. Pagas al recoger.</span>
              <button type="button" onClick={() => catalogStart.current?.scrollIntoView({ behavior: 'smooth' })}>
                Pídelo ya <IonIcon icon={arrowForward} />
              </button>
            </div>
            <span className="tn-banner-art" aria-hidden="true">
              <IonIcon icon={bagHandleOutline} />
            </span>
          </article>
          {banners.map((b) => (
            <article key={b.category} className="tn-banner" style={{ background: categoryTint(b.category, 18).background }}>
              <div className="tn-banner-text">
                <strong>{b.category}</strong>
                <span>
                  {b.items.length} {b.items.length === 1 ? 'producto' : 'productos'} · desde {money(b.from)}
                </span>
                <button type="button" onClick={() => openCategory(b.category)}>
                  Ver todo <IonIcon icon={arrowForward} />
                </button>
              </div>
              <span className="tn-banner-art" style={{ color: categoryTint(b.category).color }} aria-hidden="true">
                {b.photo ? <img src={b.photo} alt="" /> : <IonIcon icon={categoryIcon(b.category)} />}
              </span>
            </article>
          ))}
        </div>

        <nav className="tn-cats" aria-label="Categorías" ref={catalogStart}>
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => openCategory(c)}>
              <span className="tn-cat-circle" style={categoryTint(c)}>
                <IonIcon icon={categoryIcon(c)} />
              </span>
              <span className="tn-cat-name">{c}</span>
            </button>
          ))}
        </nav>

        {sections.map((s) => (
          <section key={s.category} className="tn-sec" aria-labelledby={`sec-${s.category}`}>
            <div className="tn-sec-head">
              <h2 id={`sec-${s.category}`}>{s.category}</h2>
              <button type="button" className="tn-round" onClick={() => openCategory(s.category)} aria-label={`Ver todo ${s.category}`}>
                <IonIcon icon={arrowForward} />
              </button>
            </div>
            <div className="tn-rail">
              {s.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ))}
      </>
    );
  }

  return (
    <IonPage className="tn">
      {/* Barra compacta y fija que aparece al colapsar el encabezado */}
      <div className={`tn-bar ${collapsed ? 'is-on' : ''}`}>
        <button type="button" className="tn-round is-hero" onClick={() => void content.current?.scrollToTop(300)} aria-label="Ir arriba">
          <IonIcon icon={chevronUp} />
        </button>
        <SearchBox value={text} onChange={setText} placeholder={placeholder} compact />
        <button type="button" className="tn-round is-hero" onClick={openMenu} aria-label="Más opciones">
          <IonIcon icon={ellipsisHorizontal} />
        </button>
      </div>

      <IonContent
        ref={content}
        scrollEvents
        onIonScroll={(e) => setCollapsed(e.detail.scrollTop > (hero.current ? hero.current.offsetHeight - 64 : 120))}
      >
        <IonRefresher slot="fixed" onIonRefresh={(e) => void refresh().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <header className="tn-hero" ref={hero}>
          <div className="tn-hero-top">
            <span className="tn-brand">
              <BrandLogo size={28} />
              <BrandWord />
            </span>
            <span className="tn-hero-actions">
              <button type="button" className="tn-round is-hero" onClick={() => router.push('/cliente/pedidos')} aria-label="Mis pedidos">
                <IonIcon icon={receiptOutline} />
              </button>
              <button type="button" className="tn-round is-hero" onClick={() => router.push('/cliente/perfil')} aria-label="Perfil">
                <IonIcon icon={personOutline} />
              </button>
            </span>
          </div>
          <h1 className="tn-store">
            {store?.nombre ?? STORE.name}
            {store && <span className={`tn-open ${store.abierta ? 'is-open' : 'is-closed'}`}>{store.abierta ? 'Abierta' : 'Cerrada'}</span>}
          </h1>
          <p className="tn-pickup">
            <IonIcon icon={storefrontOutline} aria-hidden="true" />
            <span>
              <strong>Recoge en tienda</strong> · {STORE.address}
            </span>
          </p>
          <SearchBox value={text} onChange={setText} placeholder={placeholder} />
        </header>
        <OfflineBar message="los precios pueden no estar al día. Para pedir necesitas conexión" />
        <div className="tn-closed">
          <StoreClosed />
        </div>

        <div className={`tn-body ${cart.count > 0 ? 'has-cart' : ''}`}>{body}</div>
      </IonContent>

      {cart.count > 0 && (
        <button type="button" className="tn-cartbar" onClick={() => router.push('/cliente/carrito')}>
          <span className="tn-cartbar-n">{cart.count}</span>
          <span>Ver carrito</span>
          <strong className="money">{money(cart.total)}</strong>
        </button>
      )}
    </IonPage>
  );
}

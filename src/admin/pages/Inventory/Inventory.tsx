import { IonButton, IonContent, IonIcon, IonModal, IonPage, IonSearchbar, useIonRouter } from '@ionic/react';
import { addOutline, alertCircleOutline, chevronForward, closeOutline, cubeOutline, scanOutline, trendingDownOutline } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { AppHeader } from '../../../components/AppHeader';
import { useAppAlert } from '../../../components/AppAlert';
import { EmptyState } from '../../../components/EmptyState';
import { ProductThumb } from '../../../components/ProductThumb';
import { money, normalize, stockLevel, type StockLevel } from '../../../data/models';
import { ScannerView } from '../../scanner/ScannerView';
import { StockBadge } from '../../components/StockBadge';
import { SyncBadge } from '../../components/SyncBadge';
import { useApp, type ProductView } from '../../context/AppContext';
import './Inventory.css';

type Filter = 'todos' | StockLevel;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'poco', label: 'Poco stock' },
  { id: 'sin', label: 'Sin stock' },
  { id: 'ok', label: 'En stock' },
];

// Inventario de la tienda: lo mismo que en la caja (existencias y precios), con el escáner para encontrar un
// producto y editarlo, o darlo de alta si su código no está registrado
export default function Inventory() {
  const { products, findByBarcode } = useApp();
  const router = useIonRouter();
  const showAlert = useAppAlert();
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [scanning, setScanning] = useState(false);
  const [asking, setAsking] = useState(false);

  const count = (f: StockLevel) => products.filter((p) => stockLevel(p) === f).length;
  const pieces = products.reduce((n, p) => n + p.stock, 0);

  const list = useMemo(() => {
    const q = normalize(text);
    return products
      .filter((p) => filter === 'todos' || stockLevel(p) === filter)
      .filter((p) => !q || normalize(p.name).includes(q) || p.barcode.includes(q) || normalize(p.category).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [products, text, filter]);

  const open = (p: ProductView) => router.push(`/movil/producto/${p.id}`);
  const create = (code?: string) => router.push(code ? `/movil/producto-nuevo?codigo=${encodeURIComponent(code)}` : '/movil/producto-nuevo');

  const onCode = (code: string) => {
    const p = findByBarcode(code);
    if (p) {
      setScanning(false);
      open(p);
      return;
    }
    if (asking) return;
    setAsking(true);
    void showAlert({
      tone: 'warning',
      title: 'Código no registrado',
      code,
      message: 'Este producto aún no está en tu inventario.',
      primary: 'Dar de alta',
      secondary: 'Seguir escaneando',
    }).then((ok) => {
      // La cámara se cierra antes de quitar la pausa para que no vuelva a leer el código al irse
      if (ok) {
        setScanning(false);
        create(code);
      }
      setAsking(false);
    });
  };

  return (
    <IonPage>
      <AppHeader
        title="Inventario"
        end={
          <IonButton onClick={() => create()} aria-label="Producto nuevo">
            <IonIcon slot="icon-only" icon={addOutline} />
          </IonButton>
        }
      >
        <div className="inv-tools">
          <IonSearchbar value={text} onIonInput={(e) => setText(e.detail.value ?? '')} placeholder="Nombre, código o categoría" className="inv-search" />
          <IonButton className="inv-scan" onClick={() => setScanning(true)}>
            <IonIcon slot="start" icon={scanOutline} />
            Escanear
          </IonButton>
        </div>
      </AppHeader>
      <IonContent>
        <div className="page-pad is-narrow stack">
          <div className="inv-kpis">
            <button type="button" className={`inv-kpi ${filter === 'todos' ? 'is-active' : ''}`} onClick={() => setFilter('todos')}>
              <IonIcon icon={cubeOutline} />
              <strong>{products.length}</strong>
              <span>Productos · {pieces} pzas</span>
            </button>
            <button type="button" className={`inv-kpi is-warn ${filter === 'poco' ? 'is-active' : ''}`} onClick={() => setFilter('poco')}>
              <IonIcon icon={trendingDownOutline} />
              <strong>{count('poco')}</strong>
              <span>Poco stock</span>
            </button>
            <button type="button" className={`inv-kpi is-danger ${filter === 'sin' ? 'is-active' : ''}`} onClick={() => setFilter('sin')}>
              <IonIcon icon={alertCircleOutline} />
              <strong>{count('sin')}</strong>
              <span>Sin stock</span>
            </button>
          </div>

          <div className="inv-chips" role="group" aria-label="Filtrar">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={filter === f.id ? 'is-active' : ''} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <EmptyState
              art="search"
              title={text ? 'No encontramos ese producto' : 'Nada en esta lista'}
              text={text ? 'Revisa el nombre o escanea su código.' : undefined}
              action={
                <IonButton fill="outline" onClick={() => create()}>
                  <IonIcon slot="start" icon={addOutline} />
                  Registrar producto nuevo
                </IonButton>
              }
            />
          ) : (
            <ul className="inv-list">
              {list.map((p) => (
                <li key={p.id}>
                  <button type="button" className={`inv-row lvl-${stockLevel(p)}`} onClick={() => open(p)}>
                    <ProductThumb product={p} size={46} />
                    <span className="inv-info">
                      <strong>{p.name}</strong>
                      <span className="muted">{p.category} · {p.barcode || 'sin código'}</span>
                      <span className="inv-meta">
                        <StockBadge product={p} />
                        {p.sync && <SyncBadge state={p.sync} compact />}
                        {p.showInApp === false && <span className="inv-hidden">Oculto en la app</span>}
                      </span>
                    </span>
                    <span className="inv-price money">{money(p.price)}</span>
                    <IonIcon icon={chevronForward} className="muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </IonContent>

      <IonModal isOpen={scanning} onDidDismiss={() => setScanning(false)} className="inv-scan-modal">
        <IonContent>
          <div className="inv-scan-body">
            <div className="inv-scan-head">
              <h2>Escanea un producto</h2>
              <IonButton fill="clear" onClick={() => setScanning(false)} aria-label="Cerrar">
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </div>
            <p className="muted">Si ya está en tu inventario lo abrimos para editarlo; si no, puedes darlo de alta.</p>
            <div className="inv-scan-camera">
              <ScannerView enabled={scanning} paused={asking} onCode={onCode} hint="Apunta al código de barras" />
            </div>
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
}

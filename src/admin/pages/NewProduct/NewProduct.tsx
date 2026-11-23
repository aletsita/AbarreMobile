import {
  IonButton,
  IonContent,
  IonFooter,
  IonIcon,
  IonPage,
  IonSpinner,
  IonToolbar,
  useIonAlert,
  useIonRouter,
  useIonToast,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import {
  add,
  alertCircleOutline,
  barcodeOutline,
  cameraOutline,
  checkmarkCircleOutline,
  closeOutline,
  informationCircleOutline,
  paperPlaneOutline,
  remove,
  sparklesOutline,
} from 'ionicons/icons';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { autofillProduct } from '../../../application/lookupProduct';
import { AppHeader } from '../../../components/AppHeader';
import { MoneyField, TextField } from '../../../components/Form';
import { generateInternalEan13 } from '../../../domain/ean13';
import { PhotoPicker } from '../../components/PhotoPicker';
import { useApp } from '../../context/AppContext';
import { readPhoto } from '../../lib/photo';
import { ScannerView } from '../../scanner/ScannerView';
import { CATEGORIES, money, uid, type Product } from '../../../data/models';
import './NewProduct.css';

type Notice = { tone: 'ok' | 'info'; text: string };

export default function NewProduct() {
  const { search } = useLocation();
  const { saveProduct, sendToRegister, findByBarcode, store, thisDevice } = useApp();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const [alert] = useIonAlert();
  const fromScan = new URLSearchParams(search).get('codigo') ?? '';

  const [barcode, setBarcode] = useState(fromScan);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Abarrotes');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState(1);
  const [photo, setPhoto] = useState<string>();
  const [tried, setTried] = useState(false);

  // Alta con la cámara: lee el código y trata de llenar el resto desde una base pública
  const [scanning, setScanning] = useState(false);
  const [visible, setVisible] = useState(true);
  const [looking, setLooking] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const lookupId = useRef(0);
  useIonViewDidEnter(() => setVisible(true));
  useIonViewWillLeave(() => setVisible(false));

  const lookup = async (code: string) => {
    const id = ++lookupId.current;
    setLooking(true);
    setNotice(undefined);
    const r = await autofillProduct(code);
    if (id !== lookupId.current) return;
    setLooking(false);
    if (r.status === 'listo') {
      // Lo que la persona ya escribió no se pisa; lo sugerido siempre se puede editar
      setName((n) => n.trim() ? n : r.draft.name);
      if (r.draft.image) {
        const image = r.draft.image;
        readPhoto(new File([image], 'foto', { type: image.type }))
          .then((p) => setPhoto((current) => current ?? p))
          .catch(() => undefined);
      }
      setNotice({ tone: 'ok', text: `Llenamos los datos con ${r.draft.source}. Revisa el nombre y captura el precio y la existencia.` });
    } else if (r.status === 'no-encontrado') {
      setNotice({ tone: 'info', text: 'Este código no está en la base pública de productos. Llena los datos a mano.' });
    } else if (r.status === 'sin-conexion') {
      setNotice({ tone: 'info', text: 'Sin internet no pudimos buscar los datos. Ya pusimos el código; captura lo demás a mano.' });
    } else {
      setNotice({ tone: 'info', text: 'No pudimos consultar la base de productos. Ya pusimos el código; captura lo demás a mano.' });
    }
  };

  const takeCode = (raw: string) => {
    const code = raw.replace(/\s/g, '');
    setScanning(false);
    setBarcode(code);
    const existing = findByBarcode(code);
    if (existing) {
      lookupId.current++;
      setLooking(false);
      setNotice(undefined);
      alert({
        header: 'Ya está en tu inventario',
        message: `El código ${code} es de ${existing.name}. ¿Quieres editarlo en lugar de darlo de alta otra vez?`,
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Editar producto', handler: () => router.push(`/movil/producto/${existing.id}`, 'forward', 'replace') },
        ],
      });
      return;
    }
    void lookup(code);
  };

  // Llegó desde el escáner con un código que no existe: se buscan sus datos una vez
  useEffect(() => {
    if (fromScan && !findByBarcode(fromScan)) void lookup(fromScan);
  }, []);

  const generateCode = () => {
    lookupId.current++;
    setLooking(false);
    setScanning(false);
    setBarcode(generateInternalEan13((c) => !!findByBarcode(c)));
    setNotice({ tone: 'info', text: 'Código interno de la tienda (empieza con 2). Imprímelo en una etiqueta para escanearlo después.' });
  };

  const duplicate = barcode.trim() ? findByBarcode(barcode) : undefined;
  const errors = {
    barcode: !barcode.trim() ? 'Escribe o escanea el código' : duplicate ? `Ya existe: ${duplicate.name}` : '',
    name: !name.trim() ? 'Escribe el nombre del producto' : '',
    price: !(Number(price) > 0) ? 'Pon un precio mayor a $0' : '',
    cost: Number(cost) > 0 && Number(cost) >= Number(price) ? 'Es mayor o igual al precio de venta' : '',
  };
  const invalid = Boolean(errors.barcode || errors.name || errors.price);
  const margin = Number(price) - Number(cost);

  const save = (toRegister: boolean) => {
    setTried(true);
    if (invalid) return;
    const product: Product = {
      id: `p${uid()}`,
      name: name.trim(),
      category,
      price: Number(price),
      cost: Number(cost) || 0,
      stock,
      minStock: 3,
      barcode: barcode.trim(),
      photo,
    };
    const r = saveProduct(product, true);
    if (toRegister) sendToRegister(product, 1);
    const offline = r === 'pendiente';
    toast({
      message: offline
        ? `${product.name} quedó guardado en el celular. Se subirá en cuanto vuelva la conexión.`
        : toRegister
          ? `${product.name} registrado y enviado a ${store.register}`
          : `${product.name} registrado en el inventario`,
      duration: offline ? 3200 : 1800,
      color: offline ? 'warning' : 'success',
      position: 'top',
      cssClass: 'toast-app',
    });
    if (router.canGoBack()) router.goBack();
    else router.push('/movil/escaner', 'back');
  };

  return (
    <IonPage>
      <AppHeader title="Producto nuevo" backHref="/movil/escaner" />
      <IonContent>
        <div className="page-pad is-narrow stack">
          {fromScan && (
            <section className="np-alert">
              <IonIcon icon={alertCircleOutline} />
              <div>
                <strong>Código no registrado</strong>
                <p>Llena los datos para agregarlo a tu inventario.</p>
              </div>
            </section>
          )}

          <section className="card np-group">
            <h2 className="np-group-title">Datos del producto</h2>
            <div className="np-top">
              <PhotoPicker value={photo} onChange={setPhoto} />
              <TextField
                className="np-code"
                label="Código de barras"
                icon={barcodeOutline}
                inputMode="numeric"
                value={barcode}
                error={(tried && errors.barcode) || (duplicate ? errors.barcode : '')}
                onChange={(v) => setBarcode(v.replace(/\s/g, ''))}
              />
            </div>
            <div className="np-code-actions">
              <IonButton fill="outline" className="btn-lg" onClick={() => setScanning((s) => !s)} aria-expanded={scanning}>
                <IonIcon slot="start" icon={scanning ? closeOutline : cameraOutline} />
                {scanning ? 'Cerrar cámara' : 'Escanear con la cámara'}
              </IonButton>
              <IonButton fill="outline" className="btn-lg" onClick={generateCode}>
                <IonIcon slot="start" icon={sparklesOutline} />
                Generar código
              </IonButton>
            </div>
            {scanning && (
              <div className="np-camera">
                <ScannerView enabled={visible && scanning} onCode={takeCode} hint="Apunta al código del producto" />
              </div>
            )}
            {looking && (
              <p className="np-notice" role="status">
                <IonSpinner name="crescent" />
                Buscando los datos del producto…
              </p>
            )}
            {notice && !looking && (
              <p className={`np-notice is-${notice.tone}`} role="status">
                <IonIcon icon={notice.tone === 'ok' ? checkmarkCircleOutline : informationCircleOutline} />
                {notice.text}
              </p>
            )}

            <TextField
              label="Nombre del producto"
              placeholder="Ej. Galletas Emperador 109 g"
              value={name}
              error={tried && errors.name}
              autoCapitalize="sentences"
              onChange={setName}
            />
          </section>

          <section className="card np-group">
            <h2 className="np-group-title">Categoría</h2>
            <div className="np-chips">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" className={c === category ? 'is-active' : ''} aria-pressed={c === category} onClick={() => setCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
          </section>

          <section className="card np-group">
            <h2 className="np-group-title">Precio</h2>
            <div className="form-grid np-grid">
              <MoneyField label="Precio de compra" value={cost} error={errors.cost} onChange={setCost} />
              <MoneyField label="Precio de venta" className="np-price" value={price} error={tried && errors.price} onChange={setPrice} />
            </div>
            {Number(price) > 0 && Number(cost) > 0 && margin > 0 && (
              <p className="np-margin">Ganas <strong>{money(margin)}</strong> por pieza ({Math.round((margin / Number(price)) * 100)} %)</p>
            )}
          </section>

          <section className="card np-group np-stock">
            <h2 className="np-group-title">Existencia inicial</h2>
            <div className="np-stepper">
              <button type="button" onClick={() => setStock((s) => Math.max(0, s - 1))} aria-label="Menos">
                <IonIcon icon={remove} />
              </button>
              <input
                className="money"
                inputMode="numeric"
                aria-label="Existencia inicial"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value.replace(/\D/g, '')) || 0)}
              />
              <button type="button" onClick={() => setStock((s) => s + 1)} aria-label="Más">
                <IonIcon icon={add} />
              </button>
            </div>
          </section>
        </div>
      </IonContent>

      <IonFooter className="action-footer ion-no-border">
        <IonToolbar>
          <IonButton expand="block" className="btn-xl" onClick={() => save(false)}>
            Guardar producto
          </IonButton>
          {thisDevice && (
            <IonButton expand="block" fill="clear" color="secondary" className="btn-lg np-only" onClick={() => save(true)}>
              <IonIcon slot="start" icon={paperPlaneOutline} />
              Guardar y enviar a la caja
            </IonButton>
          )}
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
}

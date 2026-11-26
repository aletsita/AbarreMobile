import { roundQty, type SaleType } from '../../../domain/weight';
import { SaleTypeField } from '../../components/SaleTypeField';
import {
  IonButton,
  IonContent,
  IonFooter,
  IonIcon,
  IonPage,
  IonSpinner,
  IonToolbar,
  useIonRouter,
  useIonToast,
  useIonViewDidEnter,
  useIonViewWillEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import {
  add,
  barcodeOutline,
  cameraOutline,
  closeOutline,
  cubeOutline,
  gridOutline,
  paperPlaneOutline,
  pricetagOutline,
  pricetagsOutline,
  remove,
  scaleOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { autofillProduct } from '../../../application/lookupProduct';
import { AppHeader } from '../../../components/AppHeader';
import { Notice } from '../../../components/Notice';
import { useAppAlert } from '../../../components/AppAlert';
import { FormCard, MoneyField, TextField } from '../../../components/Form';
import { generateInternalEan13 } from '../../../domain/ean13';
import { PhotoPicker } from '../../components/PhotoPicker';
import { useApp } from '../../context/AppContext';
import { readPhoto } from '../../lib/photo';
import { ScannerView } from '../../scanner/ScannerView';
import { CATEGORIES, money, uid, type Product } from '../../../data/models';
import './NewProduct.css';

type LookupNotice = { tone: 'ok' | 'info'; text: string };

export default function NewProduct() {
  const { search } = useLocation();
  const { saveProduct, sendToRegister, findByBarcode, store, thisDevice } = useApp();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const showAlert = useAppAlert();
  const codeInUrl = () => (new URLSearchParams(search).get('codigo') ?? '').replace(/\s/g, '');

  // Código con el que llegó desde el escáner (no registrado); se vuelve a leer cada vez que se entra
  const [fromScan, setFromScan] = useState(codeInUrl);
  const [barcode, setBarcode] = useState(fromScan);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Abarrotes');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState(1);
  const [saleType, setSaleType] = useState<SaleType>('pieza');
  // Por peso la existencia se escribe en kilos (texto tal cual, "1." no debe volverse 1)
  const [kgStock, setKgStock] = useState('');
  const weighed = saleType === 'peso';
  const [photo, setPhoto] = useState<string>();
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Alta con la cámara: lee el código y trata de llenar el resto desde una base pública
  const [scanning, setScanning] = useState(false);
  const [visible, setVisible] = useState(true);
  const [looking, setLooking] = useState(false);
  const [notice, setNotice] = useState<LookupNotice>();
  const lookupId = useRef(0);
  useIonViewDidEnter(() => setVisible(true));

  // Ionic deja la pantalla montada entre visitas: el formulario se reinicia al entrar y al salir para no
  // arrastrar el código, los datos autocompletados ni los errores de la vez anterior
  const reset = (code: string) => {
    lookupId.current++;
    setFromScan(code);
    setBarcode(code);
    setName('');
    setCategory('Abarrotes');
    setCost('');
    setPrice('');
    setStock(1);
    setSaleType('pieza');
    setKgStock('');
    setPhoto(undefined);
    setTried(false);
    setScanning(false);
    setLooking(false);
    setNotice(undefined);
    setSaving(false);
    savingRef.current = false;
  };
  useIonViewWillEnter(() => {
    const code = codeInUrl();
    reset(code);
    // Llegó desde el escáner con un código que no existe: se buscan sus datos
    if (code && !findByBarcode(code)) void lookup(code);
  }, [search]);
  useIonViewWillLeave(() => {
    setVisible(false);
    reset('');
  });

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
      void showAlert({
        tone: 'info',
        title: 'Ya está en tu inventario',
        code,
        message: `Este código es de ${existing.name}. Puedes editarlo en lugar de darlo de alta otra vez.`,
        primary: 'Editar producto',
        secondary: 'Cancelar',
      }).then((edit) => edit && router.push(`/movil/producto/${existing.id}`, 'forward', 'replace'));
      return;
    }
    void lookup(code);
  };

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

  const save = async (toRegister: boolean) => {
    // Un solo guardado aunque se toque dos veces el botón
    if (savingRef.current) return;
    setTried(true);
    if (invalid) return;
    savingRef.current = true;
    setSaving(true);
    const product: Product = {
      id: uid(),
      name: name.trim(),
      category,
      price: Number(price),
      cost: Number(cost) || 0,
      stock: weighed ? roundQty(Number(kgStock) || 0) : stock,
      minStock: weighed ? 1 : 3,
      ...(weighed ? { saleType: 'peso' as const } : {}),
      barcode: barcode.trim(),
      photo,
    };
    let r: ReturnType<typeof saveProduct>;
    try {
      r = saveProduct(product, true);
      // Lo pesado no se manda sin peso: se agrega en la caja o desde el escáner
      if (toRegister && !weighed) sendToRegister(product, 1);
    } catch {
      // No se guardó: el formulario se queda como está para corregir o reintentar
      savingRef.current = false;
      setSaving(false);
      await showAlert({
        tone: 'error',
        title: 'No se guardó el producto',
        message: 'Algo falló al guardarlo en el celular. Revisa los datos e inténtalo de nuevo.',
        primary: 'Entendido',
      });
      return;
    }
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
    // Formulario limpio y al inventario, donde ya aparece el producto nuevo
    reset('');
    router.push('/movil/inventario', 'root', 'replace');
  };

  return (
    <IonPage>
      <AppHeader title="Producto nuevo" backHref="/movil/escaner" />
      <IonContent>
        <div className="page-pad is-narrow stack">
          {tried && invalid && (
            <Notice tone="error" title="Faltan datos">
              Revisa los campos marcados en rojo.
            </Notice>
          )}
          {fromScan && (
            <Notice tone="warning" title="Código no registrado">
              Llena los datos para agregarlo a tu inventario.
            </Notice>
          )}

          <FormCard title="Datos del producto" icon={pricetagsOutline}>
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
              <p className="np-looking" role="status">
                <IonSpinner name="crescent" />
                Buscando los datos del producto…
              </p>
            )}
            {notice && !looking && (
              <Notice tone={notice.tone === 'ok' ? 'success' : 'info'}>{notice.text}</Notice>
            )}

            <TextField
              label="Nombre del producto"
              placeholder="Ej. Galletas Emperador 109 g"
              value={name}
              error={tried && errors.name}
              autoCapitalize="sentences"
              onChange={setName}
            />
          </FormCard>

          <FormCard title="Categoría" icon={gridOutline}>
            <div className="np-chips">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" className={c === category ? 'is-active' : ''} aria-pressed={c === category} onClick={() => setCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
          </FormCard>

          <FormCard title="Se vende por" icon={scaleOutline}>
            <SaleTypeField value={saleType} onChange={setSaleType} />
          </FormCard>

          <FormCard title="Precio" icon={pricetagOutline}>
            <div className="form-grid np-grid">
              <MoneyField label="Precio de compra" value={cost} error={errors.cost} onChange={setCost} />
              <MoneyField label={weighed ? 'Precio por kg' : 'Precio de venta'} className="np-price" value={price} error={tried && errors.price} onChange={setPrice} />
            </div>
            {Number(price) > 0 && Number(cost) > 0 && margin > 0 && (
              <p className="np-margin">Ganas <strong>{money(margin)}</strong> por {weighed ? 'kilo' : 'pieza'} ({Math.round((margin / Number(price)) * 100)} %)</p>
            )}
          </FormCard>

          <FormCard title="Existencia inicial" icon={cubeOutline} className="np-stock">
            {weighed ? (
              <TextField
                label="Kilos en tienda"
                suffix="kg"
                inputMode="decimal"
                placeholder="0.000"
                value={kgStock}
                onChange={(v) => /^\d*[.,]?\d{0,3}$/.test(v) && setKgStock(v.replace(',', '.'))}
              />
            ) : (
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
            )}
          </FormCard>
        </div>
      </IonContent>

      <IonFooter className="action-footer ion-no-border">
        <IonToolbar>
          <IonButton expand="block" className="btn-xl" onClick={() => void save(false)} disabled={saving}>
            {saving ? <IonSpinner name="crescent" /> : 'Guardar producto'}
          </IonButton>
          {thisDevice && !weighed && (
            <IonButton expand="block" fill="clear" color="secondary" className="btn-lg np-only" onClick={() => void save(true)} disabled={saving}>
              <IonIcon slot="start" icon={paperPlaneOutline} />
              Guardar y enviar a la caja
            </IonButton>
          )}
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
}

import { IonButton, IonContent, IonFooter, IonIcon, IonPage, IonToolbar, useIonRouter, useIonToast } from '@ionic/react';
import { add, alertCircleOutline, barcodeOutline, paperPlaneOutline, remove } from 'ionicons/icons';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppHeader } from '../../../components/AppHeader';
import { MoneyField, TextField } from '../../../components/Form';
import { PhotoPicker } from '../../components/PhotoPicker';
import { useApp } from '../../context/AppContext';
import { CATEGORIES, money, uid, type Product } from '../../../data/models';
import './NewProduct.css';

export default function NewProduct() {
  const { search } = useLocation();
  const { saveProduct, sendToRegister, findByBarcode, store, thisDevice } = useApp();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const fromScan = new URLSearchParams(search).get('codigo') ?? '';

  const [barcode, setBarcode] = useState(fromScan);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Abarrotes');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState(1);
  const [photo, setPhoto] = useState<string>();
  const [tried, setTried] = useState(false);

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

          <TextField
            label="Nombre del producto"
            placeholder="Ej. Galletas Emperador 109 g"
            value={name}
            error={tried && errors.name}
            autoCapitalize="sentences"
            onChange={setName}
          />

          <div>
            <span className="fld-label np-label">Categoría</span>
            <div className="np-chips">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" className={c === category ? 'is-active' : ''} aria-pressed={c === category} onClick={() => setCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid np-grid">
            <MoneyField label="Precio de compra" value={cost} error={errors.cost} onChange={setCost} />
            <MoneyField label="Precio de venta" className="np-price" value={price} error={tried && errors.price} onChange={setPrice} />
          </div>
          {Number(price) > 0 && Number(cost) > 0 && margin > 0 && (
            <p className="np-margin">Ganas <strong>{money(margin)}</strong> por pieza ({Math.round((margin / Number(price)) * 100)} %)</p>
          )}

          <div className="np-stock">
            <span className="fld-label np-label">Existencia inicial</span>
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
          </div>
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

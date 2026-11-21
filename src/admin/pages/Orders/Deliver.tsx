import { IonButton, IonContent, IonFooter, IonIcon, IonPage, IonToolbar, useIonRouter, useIonToast, useIonViewDidEnter, useIonViewWillLeave } from '@ionic/react';
import { alertCircleOutline, cardOutline, cashOutline, checkmarkDone, swapHorizontalOutline } from 'ionicons/icons';
import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppHeader } from '../../../components/AppHeader';
import { MoneyField } from '../../../components/Form';
import { money, PAYMENT_LABEL, type CashMethod } from '../../../data/models';
import { ORDER_STATUS_LABEL, parsePickupInput, PICKUP_METHODS, type PickupOrder } from '../../../data/pickup';
import { ScannerView } from '../../scanner/ScannerView';
import { useApp } from '../../context/AppContext';
import './Orders.css';

const MAX_FAILS = 5;
const LOCK_MS = 60000;
const METHOD_ICON: Record<CashMethod, string> = { efectivo: cashOutline, tarjeta: cardOutline, transferencia: swapHorizontalOutline };

// Entregar un pedido desde el celular: el código del cliente (QR o 6 dígitos) y después el cobro.
// Igual que en la caja: el código nunca se muestra, solo se compara.
export default function Deliver() {
  const { orders, deliverOrder } = useApp();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const presetId = new URLSearchParams(useLocation().search).get('pedido') ?? undefined;
  const preset = orders.find((o) => o.id === presetId);

  const [verified, setVerified] = useState<{ order: PickupOrder; code: string }>();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(true);
  const fails = useRef(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const locked = lockedUntil > Date.now();

  const [method, setMethod] = useState<CashMethod>('efectivo');
  const [received, setReceived] = useState('');

  useIonViewDidEnter(() => setVisible(true));
  useIonViewWillLeave(() => setVisible(false));

  const fail = (msg: string) => {
    fails.current += 1;
    if (fails.current >= MAX_FAILS) {
      fails.current = 0;
      setLockedUntil(Date.now() + LOCK_MS);
      window.setTimeout(() => setLockedUntil(0), LOCK_MS);
      setError('Demasiados intentos. Espera un minuto y vuelve a intentarlo.');
    } else setError(msg);
    // Los números se quedan a la vista (seleccionados) para revisarlos o escribir encima
    window.setTimeout(() => (document.getElementById('dl-code') as HTMLInputElement | null)?.select());
  };

  const check = (raw: string) => {
    if (locked || verified) return;
    const parsed = parsePickupInput(raw);
    if (!parsed) return setError('Escribe los 6 dígitos o escanea el QR del cliente.');
    let found: PickupOrder | undefined;
    if (preset) {
      if (parsed.orderId && parsed.orderId !== preset.id) return fail(`Ese código es de otro pedido, no del ${preset.folio}.`);
      if (preset.pickupCode !== parsed.code) {
        const other = orders.find((o) => o.id !== preset.id && o.pickupCode === parsed.code);
        return fail(
          other
            ? `Ese código es del pedido ${other.folio} (${other.customer.name}), no del ${preset.folio}.`
            : `El código no coincide con el del ${preset.folio}. Pídele al cliente que lo revise en su app.`,
        );
      }
      found = preset;
    } else {
      found = orders.find((o) => o.pickupCode === parsed.code && (!parsed.orderId || o.id === parsed.orderId));
      if (!found) return fail('No hay ningún pedido con ese código.');
    }
    if (found.status === 'entregado') return fail(`El pedido ${found.folio} ya se entregó.`);
    if (found.status === 'cancelado') return fail(`El pedido ${found.folio} está cancelado.`);
    if (found.issue) return setError(`El pedido ${found.folio} está esperando a que el cliente cambie un producto agotado.`);
    if (found.status !== 'listo') return setError(`El pedido ${found.folio} está en "${ORDER_STATUS_LABEL[found.status]}". Márcalo como listo antes de entregarlo.`);
    fails.current = 0;
    setError('');
    setText('');
    setReceived(String(found.total));
    setVerified({ order: found, code: parsed.code });
  };

  const total = verified?.order.total ?? 0;
  const paid = Number(received) || 0;
  const short = method === 'efectivo' && paid < total;

  const confirm = () => {
    if (!verified || short) return;
    const sale = deliverOrder(verified.order.id, method, method === 'efectivo' ? paid : total, verified.code);
    if (!sale) {
      void toast({ message: 'No se pudo entregar. Revisa el pedido en la caja.', duration: 3000, color: 'danger', position: 'top', cssClass: 'toast-app' });
      return;
    }
    void toast({
      message: `${verified.order.folio} entregado · venta #${sale.folio}${method === 'efectivo' && paid > total ? ` · cambio ${money(paid - total)}` : ''}`,
      duration: 4000,
      color: 'success',
      position: 'top',
      cssClass: 'toast-app',
    });
    router.push('/movil/pedidos', 'back');
  };

  return (
    <IonPage>
      <AppHeader title={verified ? `Cobrar ${verified.order.folio}` : preset ? `Entregar ${preset.folio}` : 'Entregar pedido'} backHref="/movil/pedidos" />
      <IonContent>
        <div className="page-pad is-narrow">
          {!verified ? (
            <div className="dl-step">
              <p className="muted" style={{ margin: 0 }}>
                {preset ? <>Pídele a <strong>{preset.customer.name}</strong> el código de su app.</> : 'Pídele al cliente que te muestre el código de su app.'}
              </p>
              <div className="dl-camera">
                <ScannerView
                  enabled={visible && !locked}
                  paused={locked}
                  formats={['qr_code']}
                  square
                  hint="Apunta al QR del celular del cliente"
                  onCode={check}
                />
              </div>
              <label className="section-title" htmlFor="dl-code" style={{ margin: 0 }}>O escribe los 6 números</label>
              <input
                id="dl-code"
                className="dl-code"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000000"
                maxLength={6}
                value={text}
                disabled={locked}
                aria-invalid={!!error}
                aria-describedby="dl-help"
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setText(v);
                  setError('');
                  if (v.length === 6) check(v);
                }}
              />
              <p id="dl-help" className={`dl-help ${error ? 'is-error' : ''}`} role={error ? 'alert' : undefined}>
                {error ? <><IonIcon icon={alertCircleOutline} />{error}</> : 'Se revisa solo al completar los 6 números.'}
              </p>
            </div>
          ) : (
            <div className="dl-step">
              <section className="card dl-order">
                <strong>{verified.order.folio} · {verified.order.customer.name}</strong>
                <ul>
                  {verified.order.items.map((i) => (
                    <li key={i.productId}>
                      <span><b>{i.qty}×</b> {i.name}</span>
                      <span className="money">{money(i.qty * i.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="dl-total">
                  <span>Total a cobrar</span>
                  <strong className="money">{money(total)}</strong>
                </div>
              </section>

              <h2 className="section-title" style={{ margin: 0 }}>¿Cómo paga?</h2>
              <div className="dl-methods" role="radiogroup" aria-label="Forma de pago">
                {PICKUP_METHODS.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? 'is-active' : ''} onClick={() => setMethod(m)}>
                    <IonIcon icon={METHOD_ICON[m]} />
                    {PAYMENT_LABEL[m]}
                  </button>
                ))}
              </div>

              {method === 'efectivo' && (
                <>
                  <MoneyField label="Recibí" value={received} onChange={setReceived} />
                  <div className="dl-quick">
                    {[total, 50, 100, 200, 500].filter((v, i, all) => v >= total && all.indexOf(v) === i).map((v) => (
                      <button key={v} type="button" onClick={() => setReceived(String(v))}>
                        {v === total ? 'Exacto' : money(v)}
                      </button>
                    ))}
                  </div>
                  <div className={`dl-change ${short ? 'is-short' : ''}`}>
                    <span>{short ? 'Falta' : 'Cambio'}</span>
                    <strong className="money">{money(Math.abs(paid - total))}</strong>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </IonContent>
      {verified && (
        <IonFooter className="action-footer ion-no-border">
          <IonToolbar>
            <IonButton expand="block" color="success" className="btn-xl" disabled={short} onClick={confirm}>
              <IonIcon slot="start" icon={checkmarkDone} />
              Cobrar y entregar · {money(total)}
            </IonButton>
          </IonToolbar>
        </IonFooter>
      )}
    </IonPage>
  );
}

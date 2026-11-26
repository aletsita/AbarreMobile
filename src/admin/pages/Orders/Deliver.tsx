import { IonButton, IonContent, IonFooter, IonIcon, IonPage, IonToolbar, useIonRouter, useIonToast, useIonViewDidEnter, useIonViewWillLeave } from '@ionic/react';
import { cardOutline, cashOutline, checkmarkCircle, checkmarkDone, globeOutline, keypadOutline, qrCodeOutline, refreshOutline, swapHorizontalOutline, walletOutline } from 'ionicons/icons';
import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppAlert } from '../../../components/AppAlert';
import { AppHeader } from '../../../components/AppHeader';
import { FormCard, MoneyField } from '../../../components/Form';
import { Notice } from '../../../components/Notice';
import { money, PAYMENT_LABEL, type CashMethod } from '../../../data/models';
import { cleanPickupCode, isPaidOnline, ORDER_STATUS_LABEL, parsePickupInput, PICKUP_CODE, PICKUP_METHODS, type PickupOrder } from '../../../data/pickup';
import { shortfallText } from '../../../domain/stock';
import { ScannerView } from '../../scanner/ScannerView';
import { useApp } from '../../context/AppContext';
import './Orders.css';

const MAX_FAILS = 5;
const LOCK_MS = 60000;
// Billetes con los que suele pagar el cliente; los menores al total se ven pero no se pueden elegir
const BILLS = [20, 50, 100, 200, 500, 1000];
const METHOD_ICON: Record<CashMethod, string> = { efectivo: cashOutline, tarjeta: cardOutline, transferencia: swapHorizontalOutline, en_linea: globeOutline };

// Entregar un pedido desde el celular: el código del cliente (QR o 6 caracteres) y después el cobro.
// Si ya se pagó en la app no se cobra: solo se valida el código (el servidor lo revisa y limita los intentos).
// Igual que en la caja: el código nunca se muestra, solo se compara.
export default function Deliver() {
  const { orders, deliverOrder, verifyPickupCode } = useApp();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const showAlert = useAppAlert();
  // Cómo se captura el código: con la cámara (lo normal) o escrito a mano
  const [mode, setMode] = useState<'camara' | 'escribir'>('camara');
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
  const [busy, setBusy] = useState(false);

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

  // El servidor busca el pedido listo con ese código (no lo manda al celular: solo lo compara)
  const check = async (raw: string) => {
    if (locked || verified || busy) return;
    const parsed = parsePickupInput(raw);
    if (!parsed) return setError('Escribe los 6 caracteres del código o escanea el QR del cliente.');
    if (preset && parsed.orderId && parsed.orderId !== preset.id) return fail(`Ese código es de otro pedido, no del ${preset.folio}.`);
    setBusy(true);
    const r = await verifyPickupCode(raw.trim());
    setBusy(false);
    if (!r.ok) {
      if (r.code === 'sin-conexion') return setError('Entregar un pedido requiere conexión con la tienda. Revisa la conexión.');
      return fail(r.message);
    }
    const found = r.value;
    if (preset && found.id !== preset.id) return fail(`Ese código es del pedido ${found.folio} (${found.customer.name}), no del ${preset.folio}.`);
    if (found.issue) return setError(`El pedido ${found.folio} está esperando a que el cliente cambie un producto agotado.`);
    if (found.status !== 'listo') return setError(`El pedido ${found.folio} está en "${ORDER_STATUS_LABEL[found.status]}". Márcalo como listo antes de entregarlo.`);
    fails.current = 0;
    setError('');
    setText('');
    setReceived(String(found.total));
    setVerified({ order: found, code: parsed.code });
  };

  const total = verified?.order.total ?? 0;
  const prepaid = verified ? isPaidOnline(verified.order) : false;
  const paid = Number(received) || 0;
  const short = !prepaid && method === 'efectivo' && paid < total;

  const confirm = async () => {
    if (!verified || short || busy) return;
    setBusy(true);
    const how = prepaid ? 'en_linea' : method;
    const r = await deliverOrder(verified.order.id, how, how === 'efectivo' ? paid : total, verified.code);
    setBusy(false);
    if (!r.ok) {
      // Código rechazado por el servidor (o bloqueado): se vuelve a pedir
      if (r.code?.startsWith('codigo')) {
        setVerified(undefined);
        setError(r.message);
        return;
      }
      void showAlert({ tone: 'error', title: 'No se entregó', message: r.shortages?.length ? shortfallText(r.shortages) : r.message, primary: 'Entendido' });
      return;
    }
    const sale = r.value;
    void toast({
      message: prepaid
        ? `${verified.order.folio} entregado · venta #${sale.folio} pagada en línea`
        : `${verified.order.folio} entregado · venta #${sale.folio}${method === 'efectivo' && paid > total ? ` · cambio ${money(paid - total)}` : ''}`,
      duration: 4000,
      color: 'success',
      position: 'top',
      cssClass: 'toast-app',
    });
    router.push('/movil/pedidos', 'back');
  };

  // Resumen del pedido: arriba en el paso del código (si ya se sabe cuál es) y en el cobro
  const summary = (o: PickupOrder, done = false) => (
    <section className={`dl-summary ${done ? 'is-done' : ''}`}>
      <span className="dl-summary-icon">
        <IonIcon icon={done ? checkmarkCircle : qrCodeOutline} aria-hidden="true" />
      </span>
      <span className="dl-summary-text">
        <strong>{o.customer.name}</strong>
        <small>
          {done ? 'Código correcto · ' : ''}Pedido {o.folio} · {o.items.length} {o.items.length === 1 ? 'producto' : 'productos'}
        </small>
      </span>
      <span className="dl-summary-total">
        <strong className="money">{money(o.total)}</strong>
        <span className={`dl-chip ${isPaidOnline(o) ? 'is-paid' : 'is-cash'}`}>{isPaidOnline(o) ? 'Pagado' : 'Por cobrar'}</span>
      </span>
    </section>
  );

  return (
    <IonPage>
      <AppHeader title={verified ? `${prepaid ? 'Entregar' : 'Cobrar'} ${verified.order.folio}` : preset ? `Entregar ${preset.folio}` : 'Entregar pedido'} backHref="/movil/pedidos" />
      <IonContent>
        <div className="page-pad is-narrow">
          <ol className="dl-steps" aria-label="Pasos">
            <li className={verified ? 'is-done' : 'is-current'}>
              <span>{verified ? <IonIcon icon={checkmarkCircle} /> : 1}</span>
              Código
            </li>
            <li className={verified ? 'is-current' : ''}>
              <span>2</span>
              {prepaid ? 'Entregar' : 'Cobrar y entregar'}
            </li>
          </ol>

          {!verified ? (
            <div className="dl-step">
              {preset && summary(preset)}

              <div className="dl-mode" role="tablist" aria-label="Cómo capturar el código">
                <button type="button" role="tab" aria-selected={mode === 'camara'} className={mode === 'camara' ? 'is-active' : ''} onClick={() => setMode('camara')}>
                  <IonIcon icon={qrCodeOutline} aria-hidden="true" />
                  Escanear QR
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'escribir'}
                  className={mode === 'escribir' ? 'is-active' : ''}
                  onClick={() => {
                    setMode('escribir');
                    window.setTimeout(() => document.getElementById('dl-code')?.focus(), 50);
                  }}
                >
                  <IonIcon icon={keypadOutline} aria-hidden="true" />
                  Escribir código
                </button>
              </div>

              {mode === 'camara' ? (
                <>
                  <div className="dl-camera">
                    <ScannerView
                      enabled={visible && !locked && mode === 'camara'}
                      paused={locked}
                      formats={['qr_code']}
                      square
                      hint="Apunta al QR del celular del cliente"
                      onCode={check}
                    />
                  </div>
                  <p className="dl-help">
                    {preset ? <>Pídele a <strong>{preset.customer.name}</strong> que abra su pedido en la app y te muestre el QR.</> : 'Pídele al cliente que abra su pedido en la app y te muestre el QR.'}
                  </p>
                </>
              ) : (
                <div className="dl-type">
                  <label htmlFor="dl-code">Código de 6 caracteres</label>
                  <input
                    id="dl-code"
                    className="dl-code"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="ABC234"
                    maxLength={6}
                    value={text}
                    disabled={locked}
                    aria-invalid={!!error}
                    aria-describedby="dl-error"
                    onChange={(e) => {
                      const v = cleanPickupCode(e.target.value);
                      setText(v);
                      setError('');
                      if (PICKUP_CODE.test(v)) void check(v);
                    }}
                  />
                  <p className="dl-help">Está debajo del QR en la app del cliente. Se revisa solo al completar los 6.</p>
                  <IonButton expand="block" className="btn-lg" disabled={locked || text.length < 6} onClick={() => void check(text)}>
                    <IonIcon slot="start" icon={checkmarkDone} />
                    Verificar código
                  </IonButton>
                </div>
              )}

              {error && (
                <div id="dl-error" role="alert">
                  <Notice tone="error" title={locked ? 'Bloqueado un minuto' : 'Código no válido'}>
                    {error}
                  </Notice>
                </div>
              )}
            </div>
          ) : (
            <div className="dl-step">
              {summary(verified.order, true)}

              <FormCard title="Productos" icon={walletOutline} className="dl-order">
                <ul>
                  {verified.order.items.map((i) => (
                    <li key={i.productId}>
                      <span className="dl-qty">{i.qty}</span>
                      <span className="dl-name">{i.name}</span>
                      <span className="money">{money(i.qty * i.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="dl-total">
                  <span>{prepaid ? 'Pagado en línea' : 'Total a cobrar'}</span>
                  <strong className="money">{money(total)}</strong>
                </div>
              </FormCard>

              {prepaid ? (
                <Notice tone="success" title="Ya está pagado">
                  No cobres nada: solo entrega el pedido.
                </Notice>
              ) : (
                <FormCard title="¿Cómo paga?" icon={cashOutline}>
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
                      <span className="dl-label">¿Con cuánto paga?</span>
                      <div className="dl-quick" role="group" aria-label="Con cuánto paga">
                        <button type="button" className={paid === total ? 'is-active' : ''} aria-pressed={paid === total} onClick={() => setReceived(String(total))}>
                          <strong>Exacto</strong>
                          <span className="money">{money(total)}</span>
                        </button>
                        {BILLS.map((v) => (
                          <button
                            key={v}
                            type="button"
                            className={paid === v ? 'is-active' : ''}
                            aria-pressed={paid === v}
                            disabled={v < total}
                            onClick={() => setReceived(String(v))}
                          >
                            <strong className="money">{money(v).replace('.00', '')}</strong>
                            <span>{v < total ? 'No alcanza' : `Cambio ${money(v - total)}`}</span>
                          </button>
                        ))}
                      </div>
                      <MoneyField label="Otro monto" value={received} onChange={setReceived} />
                      <div className={`dl-change ${short ? 'is-short' : ''}`} aria-live="polite">
                        <span>{short ? 'Le falta' : 'Entrega de cambio'}</span>
                        <strong className="money">{money(Math.abs(paid - total))}</strong>
                      </div>
                    </>
                  )}
                  {method !== 'efectivo' && (
                    <Notice tone="info">
                      {method === 'tarjeta' ? <>Cobra <strong>{money(total)}</strong> en la terminal y entrega cuando se apruebe.</> : <>Entrega cuando veas la transferencia de <strong>{money(total)}</strong>.</>}
                    </Notice>
                  )}
                </FormCard>
              )}

              <button
                type="button"
                className="dl-restart"
                onClick={() => {
                  setVerified(undefined);
                  setMode('camara');
                }}
              >
                <IonIcon icon={refreshOutline} aria-hidden="true" />
                No es este pedido · escanear otro
              </button>
            </div>
          )}
        </div>
      </IonContent>
      {verified && (
        <IonFooter className="action-footer ion-no-border">
          <IonToolbar>
            <IonButton expand="block" color="success" className="btn-xl" disabled={short || busy} onClick={() => void confirm()}>
              <IonIcon slot="start" icon={checkmarkDone} />
              {busy ? 'Entregando…' : prepaid ? `Entregar pedido ${verified.order.folio}` : `Cobrar ${money(total)} y entregar`}
            </IonButton>
          </IonToolbar>
        </IonFooter>
      )}
    </IonPage>
  );
}

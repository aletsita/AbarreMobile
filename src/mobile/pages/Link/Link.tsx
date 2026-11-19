import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  useIonAlert,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { alertCircleOutline, checkmarkCircle, desktopOutline, keypadOutline, phonePortraitOutline, qrCodeOutline, scanOutline } from 'ionicons/icons';
import { useRef, useState } from 'react';
import { AppHeader } from '../../../components/AppHeader';
import { ScannerView } from '../../../components/ScannerView';
import { useApp, type LinkResult } from '../../../context/AppContext';
import { defaultDeviceName } from '../../../lib/device';
import './Link.css';

type Method = 'qr' | 'codigo';

const ERRORS: Record<Exclude<LinkResult, 'ok'>, string> = {
  invalido: 'El código no coincide. Revísalo en Dispositivos del panel.',
  vencido: 'El código ya venció. Genera otro desde el panel.',
  'sin-conexion': 'Necesitas conexión a internet para vincular el celular.',
};

export default function Link() {
  const { thisDevice, store, linkWithCode, unlink } = useApp();
  const [alert] = useIonAlert();
  const [method, setMethod] = useState<Method>('qr');
  const [code, setCode] = useState('');
  const [name, setName] = useState(defaultDeviceName);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useIonViewDidEnter(() => setVisible(true));
  useIonViewWillLeave(() => setVisible(false));

  const tryLink = (value: string) => {
    const r = linkWithCode(value, name);
    if (r === 'ok') {
      setCode('');
      setError('');
    } else setError(ERRORS[r]);
  };

  const onQr = (raw: string) => {
    const m = raw.match(/^(?:ABARRE|TENDERO)-LINK:(\d{6})$/);
    if (m) tryLink(m[1]);
    else setError('Ese código QR no es de Abarré.');
  };

  const confirmUnlink = () =>
    alert({
      header: '¿Desvincular este celular?',
      message: `Dejará de enviar productos a ${store.register}.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Desvincular', role: 'destructive', handler: unlink },
      ],
    });

  return (
    <IonPage>
      <AppHeader title="Vincular con la caja" backHref="/movil/escaner" />
      <IonContent>
        <div className="page-pad is-narrow stack">
          {thisDevice ? (
            <section className="card link-ok">
              <span className="link-ok-icon"><IonIcon icon={checkmarkCircle} /></span>
              <h1>Celular vinculado</h1>
              <p>
                Lo que escanees llega a <strong>{store.register}</strong> de {store.name}.
              </p>
              <div className="link-pair" aria-hidden="true">
                <IonIcon icon={phonePortraitOutline} />
                <span className="link-pair-line" />
                <IonIcon icon={desktopOutline} />
              </div>
              <dl className="link-facts">
                <div><dt>Este celular</dt><dd>{thisDevice.name}</dd></div>
                <div><dt>Modelo</dt><dd>{thisDevice.model}</dd></div>
                <div><dt>Caja</dt><dd>{store.register}</dd></div>
              </dl>
              <IonButton expand="block" color="secondary" className="btn-xl" routerLink="/movil/escaner" routerDirection="root">
                <IonIcon slot="start" icon={scanOutline} />
                Ir al escáner
              </IonButton>
              <IonButton expand="block" fill="clear" color="danger" className="btn-lg" onClick={confirmUnlink}>
                Desvincular este celular
              </IonButton>
            </section>
          ) : (
            <>
              <ol className="link-steps">
                <li>En la computadora de la caja abre <strong>Dispositivos</strong> y toca <strong>Vincular nuevo celular</strong>.</li>
                <li>Escanea el código QR que aparece o escribe los 6 dígitos.</li>
              </ol>

              <IonInput
                className="field"
                fill="outline"
                label="Nombre de este celular"
                labelPlacement="stacked"
                value={name}
                maxlength={30}
                onIonInput={(e) => setName(e.detail.value ?? '')}
              />

              <IonSegment value={method} onIonChange={(e) => { setMethod(e.detail.value as Method); setError(''); }} className="link-seg">
                <IonSegmentButton value="qr" layout="icon-start">
                  <IonIcon icon={qrCodeOutline} />
                  <IonLabel>Código QR</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="codigo" layout="icon-start">
                  <IonIcon icon={keypadOutline} />
                  <IonLabel>6 dígitos</IonLabel>
                </IonSegmentButton>
              </IonSegment>

              {method === 'qr' ? (
                <div className="link-camera">
                  <ScannerView enabled={visible} square formats={['qr_code']} onCode={onQr} hint="Apunta al QR de la pantalla de la caja" />
                </div>
              ) : (
                <section className="card link-code">
                  <label htmlFor="link-code">Código de vinculación</label>
                  <div className="code-boxes" onClick={() => inputRef.current?.focus()}>
                    {Array.from({ length: 6 }, (_, i) => (
                      <span key={i} className={`code-box ${i === code.length ? 'is-current' : ''} ${i === 2 ? 'gap-after' : ''}`}>
                        {code[i] ?? ''}
                      </span>
                    ))}
                    <input
                      id="link-code"
                      ref={inputRef}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                        setError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && tryLink(code)}
                    />
                  </div>
                  <IonButton expand="block" className="btn-xl" disabled={code.length < 6} onClick={() => tryLink(code)}>
                    Vincular
                  </IonButton>
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
    </IonPage>
  );
}

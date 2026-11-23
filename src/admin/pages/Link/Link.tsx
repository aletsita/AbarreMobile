import {
  IonButton,
  IonContent,
  IonIcon,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  useIonAlert,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import {
  alertCircleOutline,
  checkmarkCircle,
  desktopOutline,
  keypadOutline,
  phonePortraitOutline,
  qrCodeOutline,
  scanOutline,
  serverOutline,
  wifiOutline,
} from 'ionicons/icons';
import { useRef, useState } from 'react';
import { useSession } from '../../../session/SessionContext';
import { AppHeader } from '../../../components/AppHeader';
import { TextField } from '../../../components/Form';
import { ScannerView } from '../../scanner/ScannerView';
import { useApp, type LinkResult, type ServerStatus } from '../../context/AppContext';
import { defaultDeviceName } from '../../lib/device';
import { normalizeServer, parseLinkQr, shortServer } from '../../../lib/link';
import './Link.css';

type Method = 'qr' | 'codigo';

export const STATUS_LABEL: Record<ServerStatus, string> = {
  'sin-servidor': 'Sin caja elegida',
  conectando: 'Conectando…',
  conectado: 'Conectado',
  'sin-respuesta': 'Sin respuesta',
};

function errorText(r: Exclude<LinkResult, 'ok'>, server: string) {
  switch (r) {
    case 'invalido':
      return 'El código no coincide. Revísalo en Dispositivos, en la computadora de la caja.';
    case 'vencido':
      return 'El código ya venció. Toca «Generar otro» en la caja.';
    case 'sin-conexion':
      return 'Este celular no tiene conexión. Conéctalo a la misma red Wi‑Fi que la caja.';
    case 'direccion':
      return 'Escribe la dirección que aparece en la caja, por ejemplo 192.168.1.20:8787.';
    case 'sin-respuesta':
      return `La caja no respondió en ${shortServer(server)}. Revisa que el celular esté en la misma Wi‑Fi, que el servidor esté encendido (npm run dev:server) y que el firewall de Windows permita Node.js.`;
  }
}

export default function Link() {
  const { thisDevice, store, linkWithCode, unlink, server, serverStatus } = useApp();
  const [alert] = useIonAlert();
  const { session, logout } = useSession();
  const [method, setMethod] = useState<Method>('qr');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState(() => shortServer(server));
  const [name, setName] = useState(defaultDeviceName);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useIonViewDidEnter(() => setVisible(true));
  useIonViewWillLeave(() => setVisible(false));

  const tryLink = async (value: string, target: string | null) => {
    if (busy) return;
    setBusy(true);
    setError('');
    const r = await linkWithCode(value, name, target);
    setBusy(false);
    if (r === 'ok') {
      setCode('');
      return;
    }
    setError(errorText(r, target ?? server ?? ''));
    if (target) setAddress(shortServer(target));
  };

  const onQr = (raw: string) => {
    if (busy) return;
    const link = parseLinkQr(raw);
    if (!link) {
      setError('Ese código QR no es de Abarré. Usa el que aparece en Dispositivos de la caja.');
      return;
    }
    // Los QR anteriores no traen la dirección: se usa la que ya tenga el celular
    void tryLink(link.code, link.server);
  };

  const submitCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    const target = normalizeServer(address);
    if (!target) {
      setError(errorText('direccion', ''));
      return;
    }
    if (code.length === 6) void tryLink(code, target);
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

  const statusChip = server && (
    <span className={`link-status is-${serverStatus}`}>
      <span className="link-dot" />
      {STATUS_LABEL[serverStatus]}
    </span>
  );

  return (
    <IonPage>
      <AppHeader title="Vincular con la caja" backHref="/movil/escaner" />
      <IonContent>
        <div className="page-pad is-narrow stack link-page">
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
                <div><dt>Servidor</dt><dd>{shortServer(server)} {statusChip}</dd></div>
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
              <section className="link-hello">
                <div>
                  <strong>Hola, {session?.name.split(' ')[0]}</strong>
                  <span>Entraste como <b>{session?.staffRole ?? 'personal'}</b>. Vincula este celular con la caja para empezar a escanear.</span>
                </div>
                <IonButton fill="clear" size="small" onClick={() => void logout()}>
                  No soy yo
                </IonButton>
              </section>

              <ol className="link-steps">
                <li>Conecta este celular a la <strong>misma red Wi‑Fi</strong> que la computadora de la caja.</li>
                <li>En la caja abre <strong>Dispositivos</strong> y toca <strong>Vincular nuevo celular</strong>.</li>
                <li>Escanea el código QR, o escribe la dirección y los 6 dígitos.</li>
              </ol>

              <TextField label="Nombre de este celular" hint="Así aparecerá en la caja" icon={phonePortraitOutline} value={name} maxLength={30} onChange={setName} />

              <IonSegment value={method} onIonChange={(e) => { setMethod(e.detail.value as Method); setError(''); }} className="link-seg">
                <IonSegmentButton value="qr" layout="icon-start">
                  <IonIcon icon={qrCodeOutline} />
                  <IonLabel>Código QR</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="codigo" layout="icon-start">
                  <IonIcon icon={keypadOutline} />
                  <IonLabel>Escribir código</IonLabel>
                </IonSegmentButton>
              </IonSegment>

              {method === 'qr' ? (
                <div className="link-camera">
                  <ScannerView enabled={visible && !busy} square formats={['qr_code']} onCode={onQr} hint="Apunta al QR de la pantalla de la caja" />
                </div>
              ) : (
                <form className="card link-code" onSubmit={submitCode}>
                  <TextField
                    label="Dirección de la caja"
                    hint="Aparece debajo del QR, por ejemplo 192.168.1.20:8787"
                    icon={serverOutline}
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="192.168.1.20:8787"
                    value={address}
                    onChange={(v) => {
                      setAddress(v);
                      setError('');
                    }}
                  />
                  <div className="fld">
                    <label className="fld-label" htmlFor="link-code">Código de 6 dígitos</label>
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
                      />
                    </div>
                  </div>
                  <IonButton type="submit" expand="block" className="btn-xl" disabled={code.length < 6 || !address.trim() || busy}>
                    Vincular
                  </IonButton>
                </form>
              )}

              {busy && (
                <div className="link-busy" role="status">
                  <IonSpinner name="crescent" />
                  Conectando con la caja…
                </div>
              )}

              {error && (
                <div className="form-error" role="alert">
                  <IonIcon icon={alertCircleOutline} />
                  {error}
                </div>
              )}

              {server && !busy && (
                <p className="link-server">
                  <IonIcon icon={wifiOutline} />
                  <span>Última caja: <strong>{shortServer(server)}</strong></span>
                  {statusChip}
                </p>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

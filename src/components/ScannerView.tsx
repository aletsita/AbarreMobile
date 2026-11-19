import { IonIcon, IonSpinner } from '@ionic/react';
import { cameraOutline, checkmarkCircle, closeOutline, flashlight, flashlightOutline, refreshOutline, scanOutline, videocamOffOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useScanner } from '../lib/scanner';
import './ScannerView.css';

interface Props {
  enabled: boolean;
  paused?: boolean;
  onCode: (code: string) => void;
  hint?: string;
  lastScanned?: string;
  square?: boolean;
  formats?: string[];
}

export function ScannerView({ enabled, paused, onCode, hint = 'Apunta al código de barras', lastScanned, square, formats }: Props) {
  const [hits, setHits] = useState(0);
  const cam = useScanner({
    enabled,
    paused,
    formats,
    onCode: (code) => {
      setHits((n) => n + 1);
      onCode(code);
    },
  });

  const [showOk, setShowOk] = useState(false);
  useEffect(() => {
    if (!lastScanned) return;
    setShowOk(true);
    const t = window.setTimeout(() => setShowOk(false), 2500);
    return () => window.clearTimeout(t);
  }, [lastScanned, hits]);

  const active = cam.status === 'activa';

  const aim = (
    <div className="scanner-aim" aria-hidden="true">
      <span className={`scanner-frame ${square ? 'is-square' : ''}`}>
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
        {cam.canRead && !paused && <span className="scan-line" />}
      </span>
      {hits > 0 && <span key={hits} className="scan-flash" />}
    </div>
  );

  const hintText = (
    <span className={`scanner-hint ${showOk ? 'is-ok' : ''}`}>
      {showOk && lastScanned ? (
        <>
          <IonIcon icon={checkmarkCircle} /> {lastScanned}
        </>
      ) : cam.canRead ? (
        hint
      ) : (
        'Este navegador no lee códigos con la cámara'
      )}
    </span>
  );

  const torchButton = cam.torchAvailable && (
    <button
      type="button"
      className={`scanner-icon-btn ${cam.torch ? 'is-on' : ''}`}
      onClick={cam.toggleTorch}
      aria-label="Linterna"
      aria-pressed={cam.torch}
    >
      <IonIcon icon={cam.torch ? flashlight : flashlightOutline} />
    </button>
  );

  // App nativa: ML Kit dibuja la cámara detrás del WebView y aquí solo va el visor encima
  if (cam.fullscreen) {
    return createPortal(
      <div className="scanner-native-overlay">
        <div className="scanner is-live is-native">
          {aim}
          <div className="scanner-top">
            {hintText}
            <span className="scanner-native-actions">
              {torchButton}
              <button type="button" className="scanner-icon-btn" onClick={cam.close} aria-label="Cerrar">
                <IonIcon icon={closeOutline} />
              </button>
            </span>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className={`scanner ${active ? 'is-live' : 'is-idle'}`}>
      <video ref={cam.videoRef} className="scanner-video" playsInline muted />

      {active && aim}

      {!active && (
        <div className="scanner-state" role="status">
          {cam.status === 'cerrada' ? (
            <>
              <IonIcon icon={cameraOutline} />
              <strong>{hint}</strong>
              <button type="button" onClick={cam.retry}>
                <IonIcon icon={scanOutline} /> Abrir cámara
              </button>
            </>
          ) : cam.status === 'iniciando' || cam.status === 'apagada' ? (
            <>
              <IonSpinner name="crescent" />
              <span>Abriendo cámara…</span>
            </>
          ) : cam.status === 'sin-permiso' ? (
            <>
              <IonIcon icon={videocamOffOutline} />
              <strong>Sin permiso para la cámara</strong>
              <span>Permite el acceso en el navegador o escribe el código abajo.</span>
              <button type="button" onClick={cam.retry}>
                <IonIcon icon={refreshOutline} /> Reintentar
              </button>
            </>
          ) : (
            <>
              <IonIcon icon={cameraOutline} />
              <strong>Cámara no disponible</strong>
              <span>Escribe el código de barras abajo.</span>
              <button type="button" onClick={cam.retry}>
                <IonIcon icon={refreshOutline} /> Reintentar
              </button>
            </>
          )}
        </div>
      )}

      {active && (
        <div className="scanner-top">
          {hintText}
          {torchButton}
        </div>
      )}
    </div>
  );
}

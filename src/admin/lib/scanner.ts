import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { PRODUCT_FORMATS, useBarcodeCamera, type CameraStatus } from '../hooks/useBarcodeCamera';

// Lector de códigos con una sola interfaz:
// en la app nativa usa ML Kit (cámara a pantalla completa detrás del WebView),
// en el navegador usa la cámara web con BarcodeDetector (useBarcodeCamera).
export const nativeScanner = Capacitor.isNativePlatform();

export type ScannerStatus = CameraStatus | 'cerrada';

export interface ScannerOptions {
  enabled: boolean;
  paused?: boolean;
  formats?: string[];
  onCode: (code: string) => void;
}

export interface Scanner {
  videoRef: RefObject<HTMLVideoElement>;
  status: ScannerStatus;
  canRead: boolean;
  torch: boolean;
  torchAvailable: boolean;
  toggleTorch: () => void;
  retry: () => void;
  /** Solo nativo: la cámara ocupa toda la pantalla mientras es true */
  fullscreen: boolean;
  /** Solo nativo: cierra la cámara a pantalla completa */
  close: () => void;
}

const NATIVE_FORMAT: Record<string, BarcodeFormat> = {
  ean_13: BarcodeFormat.Ean13,
  ean_8: BarcodeFormat.Ean8,
  upc_a: BarcodeFormat.UpcA,
  upc_e: BarcodeFormat.UpcE,
  code_128: BarcodeFormat.Code128,
  code_39: BarcodeFormat.Code39,
  itf: BarcodeFormat.Itf,
  qr_code: BarcodeFormat.QrCode,
};

// Mientras ML Kit muestra la cámara, el WebView se vuelve transparente y solo se ve el visor
const ACTIVE_CLASS = 'scanner-native';

function useWebScanner(options: ScannerOptions): Scanner {
  const cam = useBarcodeCamera(options);
  return { ...cam, fullscreen: false, close: () => undefined };
}

function useNativeScanner({ enabled, paused = false, formats = PRODUCT_FORMATS, onCode }: ScannerOptions): Scanner {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<ScannerStatus>('cerrada');
  const [open, setOpen] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const formatsKey = formats.join(',');
  const running = enabled && open && !paused;

  useEffect(() => {
    if (!running) {
      if (!enabled || !open) setStatus((s) => (s === 'sin-permiso' || s === 'no-disponible' ? s : 'cerrada'));
      return;
    }
    let stopped = false;
    let listener: PluginListenerHandle | null = null;

    (async () => {
      setStatus('iniciando');
      try {
        const { supported } = await BarcodeScanner.isSupported();
        if (!supported) {
          if (!stopped) setStatus('no-disponible');
          setOpen(false);
          return;
        }
        let { camera } = await BarcodeScanner.checkPermissions();
        if (camera !== 'granted' && camera !== 'limited') ({ camera } = await BarcodeScanner.requestPermissions());
        if (camera !== 'granted' && camera !== 'limited') {
          if (!stopped) setStatus('sin-permiso');
          setOpen(false);
          return;
        }
        if (stopped) return;

        let last = '';
        let lastAt = 0;
        listener = await BarcodeScanner.addListener('barcodesScanned', ({ barcodes }) => {
          const value = barcodes[0]?.rawValue?.trim();
          if (!value || (value === last && Date.now() - lastAt <= 2500)) return;
          last = value;
          lastAt = Date.now();
          navigator.vibrate?.(40);
          onCodeRef.current(value);
        });
        if (stopped) {
          await listener.remove();
          return;
        }
        document.documentElement.classList.add(ACTIVE_CLASS);
        await BarcodeScanner.startScan({ formats: formatsKey.split(',').map((f) => NATIVE_FORMAT[f]).filter(Boolean) });
        if (stopped) return;
        setStatus('activa');
        setTorchAvailable((await BarcodeScanner.isTorchAvailable()).available);
      } catch {
        document.documentElement.classList.remove(ACTIVE_CLASS);
        if (!stopped) setStatus('no-disponible');
        setOpen(false);
      }
    })();

    return () => {
      stopped = true;
      document.documentElement.classList.remove(ACTIVE_CLASS);
      void BarcodeScanner.stopScan().catch(() => undefined);
      void listener?.remove();
      setTorch(false);
    };
  }, [running, enabled, open, formatsKey]);

  // El botón atrás de Android cierra la cámara en lugar de salir de la pantalla
  const fullscreen = running && status === 'activa';
  useEffect(() => {
    if (!fullscreen) return;
    const onBack = (e: Event) =>
      (e as CustomEvent<{ register: (priority: number, handler: () => void) => void }>).detail.register(110, () => setOpen(false));
    document.addEventListener('ionBackButton', onBack);
    return () => document.removeEventListener('ionBackButton', onBack);
  }, [fullscreen]);

  const toggleTorch = useCallback(async () => {
    try {
      await BarcodeScanner.toggleTorch();
      setTorch((await BarcodeScanner.isTorchEnabled()).enabled);
    } catch {
      setTorchAvailable(false);
    }
  }, []);

  const retry = useCallback(() => {
    // Si el permiso quedó negado, Android ya no vuelve a preguntar: se abren los ajustes de la app
    if (status === 'sin-permiso') {
      BarcodeScanner.checkPermissions()
        .then(({ camera }) => (camera === 'granted' ? setOpen(true) : BarcodeScanner.openSettings()))
        .catch(() => undefined);
      return;
    }
    setOpen(true);
  }, [status]);

  const close = useCallback(() => setOpen(false), []);

  return {
    videoRef,
    status,
    canRead: status === 'activa',
    torch,
    torchAvailable,
    toggleTorch,
    retry,
    fullscreen,
    close,
  };
}

export const useScanner: (options: ScannerOptions) => Scanner = nativeScanner ? useNativeScanner : useWebScanner;

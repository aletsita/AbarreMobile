import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'apagada' | 'iniciando' | 'activa' | 'sin-permiso' | 'no-disponible';

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorCtor {
  new (options: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

export const PRODUCT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];

interface Options {
  enabled: boolean;
  paused?: boolean;
  formats?: string[];
  onCode: (code: string) => void;
}

export function useBarcodeCamera({ enabled, paused = false, formats = PRODUCT_FORMATS, onCode }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [status, setStatus] = useState<CameraStatus>('apagada');
  const [canRead, setCanRead] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const formatsKey = formats.join(',');

  useEffect(() => {
    if (!enabled) {
      setStatus('apagada');
      return;
    }
    let stopped = false;
    let timer = 0;
    let stream: MediaStream | null = null;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('no-disponible');
        return;
      }
      setStatus('iniciando');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
      } catch (err) {
        if (!stopped) setStatus((err as DOMException)?.name === 'NotAllowedError' ? 'sin-permiso' : 'no-disponible');
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorchAvailable(!!caps.torch);

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setStatus('activa');

      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!Detector) return;
      const supported = (await Detector.getSupportedFormats?.()) ?? [];
      const usable = formatsKey.split(',').filter((f) => supported.includes(f));
      if (!usable.length || stopped) return;
      const detector = new Detector({ formats: usable });
      setCanRead(true);

      let last = '';
      let lastAt = 0;
      const tick = async () => {
        if (stopped) return;
        if (!pausedRef.current && video && video.readyState >= 2) {
          try {
            const [hit] = await detector.detect(video);
            const value = hit?.rawValue?.trim();
            if (value && (value !== last || Date.now() - lastAt > 2500)) {
              last = value;
              lastAt = Date.now();
              navigator.vibrate?.(40);
              onCodeRef.current(value);
            }
          } catch {
            // cuadro sin datos todavía
          }
        }
        timer = window.setTimeout(tick, 220);
      };
      tick();
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
      setTorch(false);
      setCanRead(false);
    };
  }, [enabled, attempt, formatsKey]);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      setTorchAvailable(false);
    }
  }, [torch]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { videoRef, status, canRead, torch, torchAvailable, toggleTorch, retry };
}

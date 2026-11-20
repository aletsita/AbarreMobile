import { IonIcon } from '@ionic/react';
import { qrCodeOutline } from 'ionicons/icons';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import type { Order } from '../../api/types';
import { pickupQr, spacedCode } from '../lib/pickup';

// Lo que el cliente muestra en la caja para recoger su pedido
export function PickupCode({ order }: { order: Order }) {
  const [src, setSrc] = useState('');
  const code = order.pickupCode ?? '';

  useEffect(() => {
    let alive = true;
    if (!code) return;
    QRCode.toDataURL(pickupQr(order.id, code), { margin: 1, width: 440, errorCorrectionLevel: 'M', color: { dark: '#0f1b33', light: '#ffffff' } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(''));
    return () => {
      alive = false;
    };
  }, [order.id, code]);

  if (!code) return null;

  if (order.status !== 'listo') {
    return (
      <div className="cl-code-wait">
        <IonIcon icon={qrCodeOutline} />
        <span>Cuando tu pedido esté listo, aquí aparecerá el código para recogerlo.</span>
      </div>
    );
  }

  return (
    <section className="card cl-code" aria-label="Código para recoger">
      <h2 className="section-title">Muestra este código en la caja</h2>
      <div className="cl-code-qr">{src ? <img src={src} width={220} height={220} alt="Código QR para recoger tu pedido" /> : <span />}</div>
      <strong className="cl-code-digits" aria-label={`Código ${code.split('').join(' ')}`}>
        {spacedCode(code)}
      </strong>
      <p className="muted">Si no pueden escanearlo, dicta los 6 dígitos. No lo compartas: con él se entrega tu pedido.</p>
    </section>
  );
}

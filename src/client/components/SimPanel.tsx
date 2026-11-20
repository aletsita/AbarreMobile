import { IonButton, IonIcon, IonToggle, useIonToast } from '@ionic/react';
import { flaskOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { ApiError } from '../../api/errors';
import { SIM_TAP_EVENT } from '../../api/sim/events';
import { useSession } from '../../session/SessionContext';
import { useCart } from '../lib/cart';
import { useOrders } from '../lib/orders';

type Sim = typeof import('../../api/sim/server');

// El avance automático sigue aunque cambies de pantalla; se detiene al cerrar sesión
let autoTimer: number | null = null;
export function stopSimAuto() {
  if (autoTimer !== null) window.clearInterval(autoTimer);
  autoTimer = null;
}

// Controles para probar la app sin backend: hacen de «la tienda» y provocan fallas del servidor.
// Solo aparece con el servidor simulado (sin VITE_API_URL).
export function SimPanel() {
  const [sim, setSim] = useState<Sim | null>(null);
  const [down, setDown] = useState(false);
  const [auto, setAuto] = useState(autoTimer !== null);
  const [result, setResult] = useState('');
  const { session } = useSession();
  const cart = useCart();
  const { orders } = useOrders();
  const [toast] = useIonToast();

  useEffect(() => {
    void import('../../api/sim/server').then((m) => {
      setSim(m);
      setDown(m.simState.down);
    });
  }, []);

  if (!sim) return null;

  const say = (message: string) => void toast({ message, duration: 2200, position: 'top', cssClass: 'toast-app' });
  const active = orders.filter((o) => o.status !== 'entregado');
  const cartIds = cart.lines.map((l) => l.productId);

  const toggleAuto = (on: boolean) => {
    if (autoTimer !== null) window.clearInterval(autoTimer);
    autoTimer = on ? window.setInterval(() => void sim.simulator.advanceOldest(), 10000) : null;
    setAuto(on);
  };

  const tryStoreRoute = async () => {
    try {
      await api.storeOrders();
      setResult('⚠️ La ruta de la tienda respondió 200 con token de cliente.');
    } catch (e) {
      setResult(e instanceof ApiError ? `Ruta de la tienda: ${e.status} ${e.code} (esperado: 403)` : 'Error inesperado');
    }
  };

  const expire = async () => {
    sim.simulator.expireSession(session?.token ?? null);
    // La siguiente petición recibe 401 y la app cierra la sesión sola
    await api.me().catch(() => undefined);
  };

  return (
    <section className="cl-sim">
      <h2 className="section-title">
        <IonIcon icon={flaskOutline} /> Simulación (sin servidor real)
      </h2>
      <p className="muted">Estos botones hacen de la tienda y del servidor mientras no existe el backend.</p>

      <div className="cl-sim-grid">
        <IonButton size="small" fill="outline" disabled={!active.length} onClick={() => void sim.simulator.advanceOldest()}>
          Tienda: avanzar pedido
        </IonButton>
        <IonButton size="small" fill="outline" disabled={!cartIds.length} onClick={() => { sim.simulator.raisePrices(cartIds); say('Subieron los precios de tu carrito'); }}>
          Subir precios del carrito
        </IonButton>
        <IonButton size="small" fill="outline" disabled={!cartIds.length} onClick={() => { sim.simulator.dropStock(cartIds); say('Bajó la existencia de tu carrito'); }}>
          Bajar existencia del carrito
        </IonButton>
        <IonButton size="small" fill="outline" disabled={!sim.lastPush} onClick={() => window.dispatchEvent(new CustomEvent(SIM_TAP_EVENT, { detail: sim.lastPush }))}>
          Tocar última notificación
        </IonButton>
        <IonButton size="small" fill="outline" onClick={() => void tryStoreRoute()}>
          Probar ruta de tienda
        </IonButton>
        <IonButton size="small" fill="outline" color="warning" onClick={() => void expire()}>
          Vencer mi sesión (401)
        </IonButton>
      </div>
      {result && <p className="cl-sim-result" role="status">{result}</p>}

      <div className="cl-sim-row">
        <span>Avance automático cada 10 s</span>
        <IonToggle checked={auto} onIonChange={(e) => toggleAuto(e.detail.checked)} aria-label="Avance automático" />
      </div>
      <div className="cl-sim-row">
        <span>Servidor caído</span>
        <IonToggle
          checked={down}
          onIonChange={(e) => {
            sim.simState.down = e.detail.checked;
            setDown(e.detail.checked);
          }}
          aria-label="Servidor caído"
        />
      </div>
      <IonButton size="small" fill="clear" color="danger" onClick={() => { sim.simulator.reset(); say('Simulación restablecida: catálogo original y sin pedidos'); }}>
        Restablecer catálogo y pedidos
      </IonButton>
    </section>
  );
}

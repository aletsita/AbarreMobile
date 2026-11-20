import { useEffect, useState } from 'react';
import { BrandLogo } from '../components/Brand';
import { APP_TAGLINE } from '../config';
import './Splash.css';

const MIN_MS = 2200; // lo que dura la animación completa
const LEAVE_MS = 450;
const NAME = 'Abarré';

// Animación al abrir la app: logo, nombre letra por letra y lema. Se va cuando termina la animación
// y ya se sabe si hay sesión (`ready`); mientras tanto la pantalla de abajo se prepara.
export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [minDone, setMinDone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMinDone(true), MIN_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!minDone || !ready) return;
    setLeaving(true);
    const t = window.setTimeout(onDone, LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [minDone, ready]);

  return (
    <div className={`spl ${leaving ? 'is-leaving' : ''}`} role="status" aria-label={`${NAME}, cargando`}>
      <div className="spl-glow" aria-hidden="true" />
      <div className="spl-center">
        <div className="spl-logo">
          <span className="spl-ring" aria-hidden="true" />
          <BrandLogo size={104} />
        </div>
        <h1 className="spl-name" aria-hidden="true">
          {[...NAME].map((ch, i) => (
            <span key={i} className={i === NAME.length - 1 ? 'is-accent' : ''} style={{ animationDelay: `${650 + i * 70}ms` }}>
              {ch}
            </span>
          ))}
        </h1>
        <p className="spl-tagline">{APP_TAGLINE}</p>
      </div>
      <div className="spl-bar" aria-hidden="true"><span /></div>
    </div>
  );
}

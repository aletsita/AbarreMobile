import { createBrowserHistory, type History, type LocationDescriptor } from 'history';
import type { Role } from '../api/types';
import { canEnter, homeFor } from './guard';

// Historial del router con el guardián de rutas integrado. Una ruta ajena al rol (escrita a mano,
// con push/replace o con el botón atrás) se cambia por el inicio del rol ANTES de que la vean
// React Router e Ionic: así nunca se monta una pantalla de otro rol ni se rompe una transición.
let role: Role | null = null;
let ready = false;

// RoleGate la actualiza en cuanto se conoce la sesión
export function setGuardRole(r: Role | null, isReady: boolean) {
  role = r;
  ready = isReady;
}

const allowed = (path: string) => !ready || canEnter(role, path);

export const guardedHistory: History = (() => {
  const h = createBrowserHistory();
  const push = h.push.bind(h);
  const replace = h.replace.bind(h);
  const listen = h.listen.bind(h);
  const pathOf = (to: LocationDescriptor) => (typeof to === 'string' ? new URL(to, window.location.origin).pathname : (to.pathname ?? h.location.pathname));

  h.push = ((to: LocationDescriptor, state?: unknown) => (allowed(pathOf(to)) ? push(to as string, state) : replace(homeFor(role)))) as History['push'];
  h.replace = ((to: LocationDescriptor, state?: unknown) => replace((allowed(pathOf(to)) ? to : homeFor(role)) as string, state)) as History['replace'];
  // Atrás/adelante o popstate forzado hacia una ruta ajena: se reemplaza por el inicio del rol
  listen((loc) => {
    if (!allowed(loc.pathname)) replace(homeFor(role));
  });
  // Los demás (React Router, Ionic) solo reciben rutas permitidas
  h.listen = ((fn: Parameters<History['listen']>[0]) => listen((loc, action) => allowed(loc.pathname) && fn(loc, action))) as History['listen'];
  return h;
})();

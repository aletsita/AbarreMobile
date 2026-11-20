import type { Role } from '../api/types';

// Guardián de rutas por rol. La app tiene tres árboles de pantallas y cada sesión solo entra al suyo:
//   sin sesión  → /inicio, /cliente/entrar, /cliente/registro y /movil/vincular (vincular el celular de la tienda)
//   cliente     → /cliente/*
//   dispositivo → /movil/*  (escáner, inventario, ajustes: lo de siempre)
// Cualquier otra ruta redirige al inicio de su rol. El servidor vuelve a revisar el rol en cada petición.

export const PUBLIC_PATHS = ['/inicio', '/cliente/entrar', '/cliente/registro'];
export const STAFF_LINK_PATH = '/movil/vincular';

export function homeFor(role: Role | null) {
  if (role === 'cliente') return '/cliente/tienda';
  if (role === 'dispositivo') return '/movil/bienvenida';
  return '/inicio';
}

export function canEnter(role: Role | null, path: string) {
  const p = path.replace(/\/+$/, '') || '/';
  if (role === 'cliente') return p.startsWith('/cliente/') && !PUBLIC_PATHS.includes(p);
  if (role === 'dispositivo') return p.startsWith('/movil/');
  return PUBLIC_PATHS.includes(p) || p === STAFF_LINK_PATH;
}

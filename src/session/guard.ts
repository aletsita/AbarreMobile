import type { Role } from '../api/types';

// Guardián de rutas por rol. La app tiene tres árboles de pantallas y cada sesión solo entra al suyo:
//   sin sesión → /entrar y /registro
//   cliente    → /cliente/*  (Pide y recoge)
//   personal   → /movil/*    (vincular con la caja, escáner, inventario, ajustes)
// Cualquier otra ruta redirige al inicio de su rol. El servidor vuelve a revisar el rol en cada petición.

export const PUBLIC_PATHS = ['/entrar', '/registro'];

export function homeFor(role: Role | null) {
  if (role === 'cliente') return '/cliente/tienda';
  // AdminApp decide si va a vincular el celular o directo al escáner
  if (role === 'personal') return '/movil/inicio';
  return '/entrar';
}

export function canEnter(role: Role | null, path: string) {
  const p = path.replace(/\/+$/, '') || '/';
  if (role === 'cliente') return p.startsWith('/cliente/');
  if (role === 'personal') return p.startsWith('/movil/');
  return PUBLIC_PATHS.includes(p);
}

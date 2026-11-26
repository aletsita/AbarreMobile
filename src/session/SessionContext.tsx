import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, decodeToken, onSessionExpired, setApiToken } from '../api';
import type { Customer, Role, StaffRole, TokenClaims } from '../api/types';
import { clearToken, readToken, saveToken } from './tokenStore';

export interface Session {
  role: Role;
  userId: string;
  name: string;
  staffRole?: StaffRole;
  tiendaId?: string;
  token: string;
}

export type LogoutReason = 'usuario' | 'vencida';

interface SessionState {
  status: 'cargando' | 'lista';
  session: Session | null;
  notice: string | null;
  clearNotice: () => void;
  register: (input: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  // Datos de la cuenta con sesión abierta (nombre, correo, teléfono)
  profile: () => Promise<Customer>;
  login: (email: string, password: string) => Promise<void>;
  logout: (reason?: LogoutReason) => Promise<void>;
  // Tareas que deben correr antes de borrar el token (por ejemplo, quitar las notificaciones)
  onBeforeLogout: (fn: (reason: LogoutReason) => Promise<void> | void) => () => void;
}

const Ctx = createContext<SessionState | null>(null);

const fromToken = (token: string): Session | null => {
  const c = decodeToken<TokenClaims>(token);
  if (!c || (c.role !== 'cliente' && c.role !== 'personal') || !c.sub) return null;
  if (c.exp * 1000 <= Date.now()) return null;
  return { role: c.role, userId: c.sub, name: c.name ?? '', staffRole: c.staffRole, tiendaId: c.tiendaId, token };
};

const EXPIRED = 'Tu sesión venció. Vuelve a iniciar sesión.';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionState['status']>('cargando');
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hooks = useRef(new Set<(reason: LogoutReason) => Promise<void> | void>());
  const leaving = useRef(false);

  const begin = useCallback(async (token: string) => {
    const s = fromToken(token);
    if (!s) throw new Error('Token inválido');
    await saveToken(token);
    setApiToken(token);
    setSession(s);
  }, []);

  // Al abrir la app el rol del token decide a qué pantallas entra
  useEffect(() => {
    void (async () => {
      const token = await readToken();
      const s = token ? fromToken(token) : null;
      if (s) {
        setApiToken(token);
        setSession(s);
      } else if (token) {
        await clearToken();
        setNotice(EXPIRED);
      }
      setStatus('lista');
    })();
  }, []);

  const logout = useCallback(async (reason: LogoutReason = 'usuario') => {
    if (leaving.current) return;
    leaving.current = true;
    try {
      for (const fn of hooks.current) await Promise.resolve(fn(reason)).catch(() => undefined);
      // Avisa al servidor para que invalide el token; si no responde pronto, se sigue igual
      if (reason !== 'vencida') await Promise.race([api.logout().catch(() => undefined), new Promise((r) => setTimeout(r, 1500))]);
      setApiToken(null);
      await clearToken();
      setSession(null);
      if (reason === 'vencida') setNotice(EXPIRED);
    } finally {
      leaving.current = false;
    }
  }, []);

  useEffect(() => {
    onSessionExpired(() => void logout('vencida'));
    return () => onSessionExpired(null);
  }, [logout]);

  const value: SessionState = {
    status,
    session,
    notice,
    clearNotice: () => setNotice(null),
    register: async (input) => begin((await api.register(input)).token),
    login: async (email, password) => begin((await api.login(email, password)).token),
    logout,
    profile: () => api.me(),
    onBeforeLogout: (fn) => {
      hooks.current.add(fn);
      return () => hooks.current.delete(fn);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession fuera de SessionProvider');
  return ctx;
}

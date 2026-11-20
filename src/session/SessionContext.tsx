import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, decodeToken, onSessionExpired, setApiToken } from '../api';
import type { Role, TokenClaims } from '../api/types';
import { clearToken, readToken, saveToken } from './tokenStore';

export interface Session {
  role: Role;
  userId: string;
  name: string;
  // El celular de la tienda puede trabajar sin token mientras lo obtiene (funciona sin internet, como antes)
  token: string | null;
}

export type LogoutReason = 'usuario' | 'vencida' | 'desvinculado';

interface SessionState {
  status: 'cargando' | 'lista';
  session: Session | null;
  notice: string | null;
  clearNotice: () => void;
  register: (input: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  startDevice: (deviceId: string, name: string) => void;
  logout: (reason?: LogoutReason) => Promise<void>;
  // Tareas que deben correr antes de borrar el token (por ejemplo, dar de baja el token push)
  onBeforeLogout: (fn: (reason: LogoutReason) => Promise<void> | void) => () => void;
}

const Ctx = createContext<SessionState | null>(null);

// Id del celular vinculado que guarda la parte de la tienda (admin/context/AppContext.tsx).
// Un celular que ya estaba vinculado antes de esta versión entra como dispositivo aunque aún no tenga token.
function storedDeviceId(): string | null {
  try {
    const raw = localStorage.getItem('tendero.dispositivo');
    const id = raw ? (JSON.parse(raw) as string | null) : null;
    return typeof id === 'string' && id ? id : null;
  } catch {
    return null;
  }
}

const fromToken = (token: string): Session | null => {
  const c = decodeToken<TokenClaims>(token);
  if (!c || (c.role !== 'cliente' && c.role !== 'dispositivo') || !c.sub) return null;
  if (c.exp * 1000 <= Date.now()) return null;
  return { role: c.role, userId: c.sub, name: c.name ?? '', token };
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
      } else {
        if (token) {
          await clearToken();
          if (decodeToken<TokenClaims>(token)?.role === 'cliente') setNotice(EXPIRED);
        }
        const deviceId = storedDeviceId();
        if (deviceId) setSession({ role: 'dispositivo', userId: deviceId, name: '', token: null });
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

  // El celular de la tienda pide su token de dispositivo en cuanto hay conexión
  const deviceWithoutToken = session?.role === 'dispositivo' && !session.token ? session : null;
  useEffect(() => {
    if (!deviceWithoutToken) return;
    let stop = false;
    const fetchToken = async () => {
      try {
        const { token } = await api.linkDevice(deviceWithoutToken.userId, deviceWithoutToken.name);
        if (stop) return;
        await saveToken(token);
        setApiToken(token);
        setSession((s) => (s && s.userId === deviceWithoutToken.userId ? { ...s, token } : s));
      } catch {
        /* sin conexión: se reintenta al volver */
      }
    };
    void fetchToken();
    window.addEventListener('online', fetchToken);
    return () => {
      stop = true;
      window.removeEventListener('online', fetchToken);
    };
  }, [deviceWithoutToken?.userId]);

  const value: SessionState = {
    status,
    session,
    notice,
    clearNotice: () => setNotice(null),
    register: async (input) => begin((await api.register(input)).token),
    login: async (email, password) => begin((await api.login(email, password)).token),
    startDevice: (deviceId, name) => setSession({ role: 'dispositivo', userId: deviceId, name, token: null }),
    logout,
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

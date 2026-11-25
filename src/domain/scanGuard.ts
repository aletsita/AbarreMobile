// Protección contra lecturas repetidas del escáner: la cámara ve el mismo código muchas veces por segundo
// y, al reanudarse, lo vuelve a leer. El mismo código se ignora durante `windowMs` después de aceptarlo;
// un código distinto pasa siempre.
export const REPEAT_WINDOW_MS = 2000;

export function createRepeatGuard(windowMs = REPEAT_WINDOW_MS) {
  let last = '';
  let lastAt = -Infinity;
  return {
    // true = lectura nueva que se debe atender
    accept(code: string, now = Date.now()) {
      const value = code.trim();
      if (!value) return false;
      if (value === last && now - lastAt < windowMs) return false;
      last = value;
      lastAt = now;
      return true;
    },
    // Olvida la última lectura: el siguiente código pasa aunque sea el mismo
    reset() {
      last = '';
      lastAt = -Infinity;
    },
  };
}

import { describe, expect, it } from 'vitest';
import { createRepeatGuard } from './scanGuard';

describe('lecturas repetidas del escáner', () => {
  it('ignora el mismo código dentro de la ventana', () => {
    const g = createRepeatGuard(2000);
    expect(g.accept('7501055363278', 0)).toBe(true);
    expect(g.accept('7501055363278', 300)).toBe(false);
    expect(g.accept('7501055363278', 1999)).toBe(false);
  });

  it('vuelve a aceptar el mismo código pasada la ventana', () => {
    const g = createRepeatGuard(2000);
    g.accept('123', 0);
    expect(g.accept('123', 2000)).toBe(true);
  });

  it('un código distinto pasa siempre', () => {
    const g = createRepeatGuard(2000);
    g.accept('123', 0);
    expect(g.accept('456', 10)).toBe(true);
    expect(g.accept('123', 20)).toBe(true);
  });

  it('ignora lecturas vacías y espacios', () => {
    const g = createRepeatGuard();
    expect(g.accept('   ', 0)).toBe(false);
    expect(g.accept(' 123 ', 0)).toBe(true);
    expect(g.accept('123', 5)).toBe(false);
  });

  it('reset deja pasar el código de inmediato', () => {
    const g = createRepeatGuard(2000);
    g.accept('123', 0);
    g.reset();
    expect(g.accept('123', 10)).toBe(true);
  });
});

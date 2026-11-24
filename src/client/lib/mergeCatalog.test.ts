import { describe, expect, it } from 'vitest';
import { mergeCatalog } from './mergeCatalog';

const p = (id: string, price = 10) => ({ id, name: id, category: 'Abarrotes', price, stock: 5 });

describe('catálogo en vivo', () => {
  it('cambia el precio en su lugar', () => {
    expect(mergeCatalog([p('a'), p('b')], { productos: [p('b', 12)], quitados: [] })).toEqual([p('a'), p('b', 12)]);
  });

  it('quita los ocultos o borrados', () => {
    expect(mergeCatalog([p('a'), p('b')], { productos: [], quitados: ['a'] })).toEqual([p('b')]);
  });

  it('agrega al inicio lo que apareció', () => {
    expect(mergeCatalog([p('a')], { productos: [p('c')], quitados: [] })).toEqual([p('c'), p('a')]);
  });

  it('un aviso vacío no cambia nada', () => {
    const all = [p('a')];
    expect(mergeCatalog(all, { productos: [], quitados: [] })).toEqual(all);
  });
});

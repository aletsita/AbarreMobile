import { describe, expect, it } from 'vitest';
import { availableStock, clampToAvailable, piecesByProduct } from './stock';

describe('inventario disponible', () => {
  it('resta lo apartado y lo que ya está en cuentas', () => {
    expect(availableStock(10, 3, 2)).toBe(5);
    expect(availableStock(10)).toBe(10);
  });

  it('nunca es negativo', () => {
    expect(availableStock(2, 3, 1)).toBe(0);
  });

  it('suma piezas por producto', () => {
    expect(piecesByProduct([{ productId: 'a', qty: 2 }, { productId: 'b', qty: 1 }, { productId: 'a', qty: 3 }])).toEqual({ a: 5, b: 1 });
  });
});

describe('límite de cantidad', () => {
  it('deja pasar lo que alcanza', () => {
    expect(clampToAvailable(3, 5)).toEqual({ qty: 3, limited: false });
  });

  it('limita al máximo disponible y avisa', () => {
    expect(clampToAvailable(8, 5)).toEqual({ qty: 5, limited: true });
  });

  it('sin disponible no agrega nada', () => {
    expect(clampToAvailable(1, 0)).toEqual({ qty: 0, limited: true });
    expect(clampToAvailable(1, -2)).toEqual({ qty: 0, limited: true });
  });
});

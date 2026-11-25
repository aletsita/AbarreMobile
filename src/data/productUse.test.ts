import { describe, expect, it } from 'vitest';
import { productInUse } from './productUse';

const line = (id: string) => ({ product: { id } });
const empty = { ticket: [], parked: [], orders: [] };

describe('borrar un producto', () => {
  it('se puede si nadie lo usa', () => {
    expect(productInUse('a', empty)).toBeNull();
  });

  it('no se puede si está en la cuenta en pantalla', () => {
    expect(productInUse('a', { ...empty, ticket: [line('a')] })).toMatch(/cuenta que tienes en pantalla/);
  });

  it('no se puede si está en una cuenta abierta', () => {
    expect(productInUse('a', { ...empty, parked: [{ name: 'Don Pepe', lines: [line('a')] }] })).toMatch(/Don Pepe/);
  });

  it('no se puede si está apartado en un pedido activo', () => {
    const orders = [{ folio: 'P-0003', status: 'preparando' as const, items: [{ productId: 'a', name: 'A', qty: 1, price: 10 }] }];
    expect(productInUse('a', { ...empty, orders })).toMatch(/P-0003/);
  });

  it('un pedido entregado o cancelado no lo detiene', () => {
    const items = [{ productId: 'a', name: 'A', qty: 1, price: 10 }];
    const orders = [
      { folio: 'P-0001', status: 'entregado' as const, items },
      { folio: 'P-0002', status: 'cancelado' as const, items },
    ];
    expect(productInUse('a', { ...empty, orders })).toBeNull();
  });
});

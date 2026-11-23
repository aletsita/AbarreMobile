import { describe, expect, it } from 'vitest';
import type { LookupResult, ProductLookup } from '../domain/productLookup';
import { autofillProduct } from './lookupProduct';

const fake = (result: LookupResult): ProductLookup => ({ source: 'Prueba', find: async () => result });

describe('autocompletar el alta', () => {
  it('arma el nombre con marca y presentación', async () => {
    const r = await autofillProduct('7501000000001', fake({ status: 'encontrado', source: 'Prueba', info: { name: 'Galletas', brand: 'Emperador', quantity: '109 g' } }));
    expect(r).toEqual({ status: 'listo', draft: { name: 'Galletas Emperador 109 g', image: undefined, source: 'Prueba' } });
  });

  it('no repite la marca si ya viene en el nombre', async () => {
    const r = await autofillProduct('7501000000001', fake({ status: 'encontrado', source: 'Prueba', info: { name: 'Coca-Cola 600 ml', brand: 'Coca-Cola', quantity: '600 ml' } }));
    expect(r.status === 'listo' && r.draft.name).toBe('Coca-Cola 600 ml');
  });

  it('pasa tal cual cuando la fuente no tiene el producto o no hay internet', async () => {
    expect(await autofillProduct('1', fake({ status: 'no-encontrado' }))).toEqual({ status: 'no-encontrado' });
    expect(await autofillProduct('1', fake({ status: 'sin-conexion' }))).toEqual({ status: 'sin-conexion' });
  });
});

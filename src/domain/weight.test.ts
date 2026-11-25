import { describe, expect, it } from 'vitest';
import { isWeighed, itemCount, lineCents, lineTotal, parseKg, qtyLabel, qtyText, roundQty, sumCents } from './weight';

describe('venta por peso', () => {
  it('0.350 kg a $80.00/kg son $28.00', () => {
    expect(lineCents(0.35, 80, 'peso')).toBe(2800);
    expect(lineTotal(0.35, 80, 'peso')).toBe(28);
  });

  it('redondea al centavo más cercano', () => {
    // 0.333 kg × $25.50 = 8.4915 → $8.49
    expect(lineCents(0.333, 25.5, 'peso')).toBe(849);
    // 0.125 kg × $99.99 = 12.49875 → $12.50
    expect(lineCents(0.125, 99.99, 'peso')).toBe(1250);
  });

  it('por pieza multiplica piezas enteras', () => {
    expect(lineCents(3, 12.5)).toBe(3750);
    expect(lineCents(3, 12.5, 'pieza')).toBe(3750);
  });

  it('suma en centavos sin errores de punto flotante', () => {
    const lines = [
      { qty: 1, price: 0.1 },
      { qty: 1, price: 0.2 },
    ];
    expect(sumCents(lines)).toBe(30);
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumCents([{ qty: 0.35, price: 80, saleType: 'peso' as const }, { qty: 2, price: 10.5 }])).toBe(4900);
  });

  it('normaliza los kilos a 3 decimales', () => {
    expect(roundQty(1.2 - 0.35)).toBe(0.85);
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
  });

  it('lee lo que escribe el cajero', () => {
    expect(parseKg('0.350')).toBe(0.35);
    expect(parseKg('0,35')).toBe(0.35);
    expect(parseKg('.5')).toBe(0.5);
    expect(parseKg(' 2 ')).toBe(2);
    expect(parseKg('0.001')).toBe(0.001);
  });

  it('rechaza pesos inválidos', () => {
    for (const bad of ['', '.', '0', '0.000', '-1', 'abc', '1.2345', '1000', '1e3', '1..2']) expect(parseKg(bad)).toBeNull();
  });

  it('muestra la cantidad según el tipo', () => {
    expect(qtyText(0.35, 'peso')).toBe('0.350 kg');
    expect(qtyText(3)).toBe('3');
    expect(qtyLabel(1)).toBe('1 pieza');
    expect(qtyLabel(2, 'pieza')).toBe('2 piezas');
    expect(qtyLabel(1.5, 'peso')).toBe('1.500 kg');
  });

  it('sin tipo es pieza', () => {
    expect(isWeighed({})).toBe(false);
    expect(isWeighed({ saleType: 'pieza' })).toBe(false);
    expect(isWeighed({ saleType: 'peso' })).toBe(true);
  });
});

describe('artículos de una venta', () => {
  it('cada producto pesado cuenta como uno', () => {
    expect(itemCount([{ qty: 3 }, { qty: 0.35, saleType: 'peso' }, { qty: 1.2, saleType: 'peso' }])).toBe(5);
  });
});

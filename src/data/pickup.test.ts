import { describe, expect, it } from 'vitest';
import { cleanPickupCode, isPaidOnline, parsePickupInput, PICKUP_CODE } from './pickup';
import { shortfallText } from '../domain/stock';

describe('código para recoger', () => {
  it('acepta 6 caracteres sin O/0 ni I/1, y los 6 dígitos de pedidos anteriores', () => {
    expect(PICKUP_CODE.test('K7MW3P')).toBe(true);
    expect(PICKUP_CODE.test('482913')).toBe(true);
    expect(PICKUP_CODE.test('K7MW0P')).toBe(false);
    expect(PICKUP_CODE.test('K7MWIP')).toBe(false);
    expect(PICKUP_CODE.test('K7MW3')).toBe(false);
  });

  it('lee el código escrito (con espacios o minúsculas) y el QR', () => {
    expect(parsePickupInput(' k7m w3p ')).toEqual({ code: 'K7MW3P' });
    expect(parsePickupInput('abarre:recoger:o123:k7mw3p')).toEqual({ orderId: 'o123', code: 'K7MW3P' });
    expect(parsePickupInput('abarre:recoger:o123:482913')).toEqual({ orderId: 'o123', code: '482913' });
    expect(parsePickupInput('hola')).toBeNull();
  });

  it('limpia lo que se teclea en el campo', () => {
    expect(cleanPickupCode('k7-mw 3p9')).toBe('K7MW3P');
  });

  it('solo un pago confirmado cuenta como pagado en línea', () => {
    expect(isPaidOnline({ online: { method: 'en_linea', status: 'pagado' } })).toBe(true);
    expect(isPaidOnline({ online: { method: 'en_linea', status: 'pendiente_de_pago' } })).toBe(false);
    expect(isPaidOnline({})).toBe(false);
  });
});

describe('faltantes del servidor', () => {
  it('dice cuánto hay y cuánto falta de cada producto', () => {
    expect(
      shortfallText([
        { productId: 'a', name: 'Leche', requested: 3, available: 1, missing: 2 },
        { productId: 'b', name: 'Pan', requested: 1, available: 0, missing: 1 },
      ]),
    ).toBe('Leche: solo hay 1 pieza disponible (faltan 2) · Pan: no hay disponible (faltan 1)');
  });
});

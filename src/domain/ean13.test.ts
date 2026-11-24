import { describe, expect, it } from 'vitest';
import { ean13CheckDigit, generateInternalEan13, isInternalEan13, isValidEan13 } from './ean13';

describe('EAN-13', () => {
  it('calcula el dígito verificador de códigos reales', () => {
    expect(ean13CheckDigit('750105530007')).toBe(5); // 7501055300075
    expect(ean13CheckDigit('400638133393')).toBe(1); // 4006381333931
  });

  it('valida longitud, dígitos y verificador', () => {
    expect(isValidEan13('7501055300075')).toBe(true);
    expect(isValidEan13('7501055300076')).toBe(false);
    expect(isValidEan13('750105530007')).toBe(false);
    expect(isValidEan13('75010553000a5')).toBe(false);
  });

  it('genera códigos internos válidos con prefijo 2', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInternalEan13(() => false);
      expect(isValidEan13(code)).toBe(true);
      expect(isInternalEan13(code)).toBe(true);
    }
  });

  it('no repite un código que ya existe', () => {
    const digits = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    let i = 0;
    const random = () => digits[i++ % digits.length] / 10;
    const taken = new Set(['2000000000008']);
    const code = generateInternalEan13((c) => taken.has(c), random);
    expect(taken.has(code)).toBe(false);
    expect(isValidEan13(code)).toBe(true);
  });

  it('se rinde si todos los códigos están ocupados', () => {
    expect(() => generateInternalEan13(() => true)).toThrow();
  });
});

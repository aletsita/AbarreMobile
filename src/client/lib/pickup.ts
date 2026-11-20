// Código para recoger un pedido. Lo genera el teléfono al confirmar el pedido y viaja con él;
// la app lo muestra (QR y 6 dígitos) cuando el pedido está listo, y la caja lo pide para entregarlo.

// 6 dígitos al azar con el generador seguro del sistema (no Math.random)
export function newPickupCode() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, '0');
}

// Contenido del QR. La caja también acepta solo los 6 dígitos escritos a mano.
export const pickupQr = (orderId: string, code: string) => `abarre:recoger:${orderId}:${code}`;

// "482913" → "482 913", más fácil de dictar
export const spacedCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

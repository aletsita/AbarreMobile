// Código para recoger un pedido. Lo genera el servidor cuando se confirma el pago (6 caracteres sin O/0 ni I/1);
// la app lo muestra (QR y código) y la caja lo pide para entregarlo.

// Contenido del QR. La caja también acepta solo el código escrito a mano.
export const pickupQr = (orderId: string, code: string) => `abarre:recoger:${orderId}:${code}`;

// "K7MW3P" → "K7M W3P", más fácil de dictar
export const spacedCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

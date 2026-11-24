import { loadStripe, type Stripe, type StripeEmbeddedCheckout } from '@stripe/stripe-js';

// Pago embebido de Stripe: el recuadro de la tarjeta lo sirve Stripe dentro de la pantalla «Pagar pedido».
// Los datos de la tarjeta nunca pasan por la app ni por el servidor de la tienda; aquí solo va la clave
// publicable (pk_test_…), que es pública por diseño. La confirmación del pago la da el servidor (webhook).
const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';

let stripe: Promise<Stripe | null> | null = null;
// Stripe solo admite un pago embebido a la vez: cada montaje espera a que el anterior se destruya
let current: Promise<StripeEmbeddedCheckout | null> = Promise.resolve(null);
const destroyed = new WeakSet<StripeEmbeddedCheckout>();
function destroy(c: StripeEmbeddedCheckout | null | undefined) {
  if (!c || destroyed.has(c)) return;
  destroyed.add(c);
  try {
    c.destroy();
  } catch {
    /* ya no estaba montado */
  }
}

export const paymentsConfigured = () => /^pk_test_/.test(PUBLISHABLE_KEY);

// Monta el pago de la sesión `clientSecret` en `el`. Regresa la función para quitarlo de la pantalla.
// `cancelled` se revisa antes de montar: si la pantalla ya se fue, no se crea nada.
export function mountPayment(el: HTMLElement, clientSecret: string, onComplete: () => void, cancelled: () => boolean): Promise<() => void> {
  const previous = current;
  const next = (async () => {
    destroy(await previous.catch(() => null));
    if (cancelled()) return null;
    if (!paymentsConfigured()) throw new Error('El pago en línea no está configurado en esta app.');
    stripe ??= loadStripe(PUBLISHABLE_KEY);
    const s = await stripe.catch(() => null);
    if (!s) {
      stripe = null; // se vuelve a intentar la próxima vez (sin internet al cargar)
      throw new Error('No se pudo cargar el pago. Revisa tu conexión.');
    }
    if (cancelled()) return null;
    const checkout = await s.createEmbeddedCheckoutPage({ clientSecret, onComplete });
    if (cancelled()) {
      destroy(checkout);
      return null;
    }
    checkout.mount(el);
    return checkout;
  })();
  current = next.catch(() => null);
  return next.then((checkout) => () => destroy(checkout));
}

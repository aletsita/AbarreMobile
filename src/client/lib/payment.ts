import { loadStripe, type Stripe } from '@stripe/stripe-js';

// Pago embebido de Stripe: el recuadro de la tarjeta lo sirve Stripe dentro de la pantalla «Pagar pedido».
// Los datos de la tarjeta nunca pasan por la app ni por el servidor de la tienda; aquí solo va la clave
// publicable (pk_test_…), que es pública por diseño. La confirmación del pago la da el servidor (webhook).
const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';

let stripe: Promise<Stripe | null> | null = null;

export const paymentsConfigured = () => /^pk_test_/.test(PUBLISHABLE_KEY);

// Monta el pago de la sesión `clientSecret` en `el`. Regresa la función para quitarlo de la pantalla.
export async function mountPayment(el: HTMLElement, clientSecret: string, onComplete: () => void): Promise<() => void> {
  if (!paymentsConfigured()) throw new Error('Falta VITE_STRIPE_PUBLISHABLE_KEY (pk_test_…) en el .env de la app.');
  stripe ??= loadStripe(PUBLISHABLE_KEY);
  const s = await stripe.catch(() => null);
  if (!s) {
    stripe = null; // se vuelve a intentar la próxima vez (sin internet al cargar)
    throw new Error('No se pudo cargar el pago. Revisa tu conexión.');
  }
  const checkout = await s.createEmbeddedCheckoutPage({ clientSecret, onComplete });
  checkout.mount(el);
  return () => checkout.destroy();
}

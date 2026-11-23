// La tarjeta se captura en la página de Stripe, fuera de la app: aquí nunca pasan datos de la tarjeta.
// En el celular se abre en el navegador del sistema; al terminar, el cliente regresa a la app y el estado
// del pedido llega solo (el servidor lo confirma con el webhook de Stripe).
export function openPayment(url: string) {
  window.open(url, '_blank', 'noopener');
}

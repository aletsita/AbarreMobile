interface ImportMetaEnv {
  // Dirección inicial del servidor de la tienda (opcional). La API usa el mismo servidor en /api.
  // Se cambia en «Iniciar sesión» o al vincular el celular con el QR de la caja.
  readonly VITE_SYNC_URL?: string;
  // Clave publicable de Stripe en modo de pruebas (pk_test_…) para la pantalla «Pagar pedido». Es pública por diseño.
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
}

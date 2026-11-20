interface ImportMetaEnv {
  // Servidor de sincronización inicial (opcional): el celular lo cambia al vincularse con el QR o la dirección
  readonly VITE_SYNC_URL?: string;
  // API del servidor (registro, catálogo, pedidos). Vacía = servidor simulado dentro de la app
  readonly VITE_API_URL?: string;
}

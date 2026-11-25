// Error de cualquier llamada al servidor. status 0 = no hubo respuesta (sin internet o servidor caído).
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get offline() {
    return this.status === 0;
  }
}

export const networkError = () => new ApiError(0, 'sin-conexion', 'No pudimos conectar. Revisa tu internet e inténtalo de nuevo.');

// Mensaje para mostrar en pantalla, sin detalles técnicos
export function errorMessage(e: unknown, fallback = 'Algo salió mal. Inténtalo de nuevo.') {
  if (e instanceof ApiError) {
    if (e.offline) return 'No pudimos conectar. Revisa tu internet e inténtalo de nuevo.';
    // 503 trae un aviso pensado para el cliente (tienda desconectada, pago no disponible); los demás 5xx no
    if (e.status === 503 && e.message) return e.message;
    if (e.status >= 500) return 'El servidor tuvo un problema. Inténtalo en un momento.';
    return e.message || fallback;
  }
  return fallback;
}

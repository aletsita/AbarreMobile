// Eventos de la ventana con los que el servidor simulado imita las notificaciones push
export const SIM_PUSH_EVENT = 'tendero:sim-push'; // llega una notificación (app en primer plano)
export const SIM_TAP_EVENT = 'tendero:sim-push-tap'; // el usuario toca la notificación

export interface SimPush {
  title: string;
  body: string;
  data: { orderId: string; status: string };
}

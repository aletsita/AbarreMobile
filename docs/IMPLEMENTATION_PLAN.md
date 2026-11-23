# IMPLEMENTATION_PLAN.md — Incremento 1: "Pide y recoge" en la app móvil

Este plan describe, en orden, los pasos que seguiremos para construir el incremento. Cada paso termina con una comprobación para saber que quedó bien. El alcance y los criterios (CA1 a CA12) están en `CURRENT_TASK.md`, y las reglas generales en `PROJECT_CONTEXT.md`.

Última actualización: 22 de noviembre de 2026

## Orden general

Primero preparamos la base y el contrato, después las capas internas, luego el flujo del cliente, el del personal y, al final, las pruebas y el cierre. El servidor no se construye aquí: usamos la API real si ya existe o una API simulada con el mismo contrato.

---

## Fase 1. Base del proyecto y contrato

**1.1 Estructura de carpetas.** Dejamos la app organizada en `src/domain`, `src/application`, `src/infrastructure` y `src/presentation`, junto con los módulos `src/admin` y `src/client`.

*Comprobación:* la app compila y abre en el emulador o en un Android.

**1.2 Reglas de arquitectura automáticas.** Configuramos el lint para prohibir tres cosas: que `client` importe de `admin`, que Presentación importe de Infraestructura y que el Dominio importe Ionic o Capacitor.

*Comprobación (CA11):* al escribir una importación prohibida, el lint falla.

**1.3 Configuración por entorno.** La URL de la API se guarda en un archivo de entorno que no se sube al repositorio.

*Comprobación:* podemos cambiar de la API real a la simulada sin modificar el código.

**1.4 API simulada.** Creamos un mock con las ocho rutas del contrato, incluido un flujo SSE, y con la posibilidad de forzar respuestas 401, 403 y 409.

*Comprobación:* probamos cada ruta desde el navegador o con `curl` antes de usarla en la app.

---

## Fase 2. Dominio, Aplicación e Infraestructura

**2.1 Dominio.** Definimos las entidades `Producto`, `Pedido`, `ItemPedido` y `Usuario`, el tipo `EstadoPedido` y la función `siguienteEstado()`, que solo devuelve el siguiente estado válido y rechaza cualquier otro.

*Comprobación (parte de CA7):* pruebas unitarias de las transiciones.

**2.2 Contratos de repositorio.** Declaramos las interfaces para sesión, productos, pedidos y flujo de eventos.

**2.3 Casos de uso.** Implementamos registrarse, iniciar sesión, listar el catálogo, confirmar pedido (genera la llave de idempotencia), listar mis pedidos, listar pedidos del personal y avanzar estado.

*Comprobación (CA1 y CA4):* pruebas con repositorios simulados, incluido el reintento con la misma llave.

**2.4 Infraestructura.** Construimos el cliente HTTP que agrega el token y convierte los códigos 401, 403 y 409 en errores propios. También los repositorios, el almacenamiento local de la sesión y el carrito, y el observador de SSE con reintento y recarga.

*Comprobación (CA9):* un 401 simulado cierra la sesión.

---

## Fase 3. Módulo del cliente (`src/client`)

**3.1 Sesión y guardián de rutas.** Guardamos el token, enviamos a login cuando no hay sesión y bloqueamos las rutas de `src/admin` para el rol cliente.

*Comprobación (parte de CA8).*

**3.2 Registro e inicio de sesión (HU1).**

*Comprobación:* CA1 en el dispositivo.

**3.3 Catálogo y carrito (HU2).** El catálogo se carga de forma diferida y el carrito se guarda en el almacenamiento local, con cantidades enteras de 1 en adelante y un total estimado.

*Comprobación:* CA2.

**3.4 Confirmar pedido (HU3).** El botón se deshabilita con el carrito vacío, el carrito se vacía solo con una respuesta exitosa y la llave se conserva en los reintentos.

*Comprobación:* CA3 y CA4 en el dispositivo, incluida la prueba en modo avión.

**3.5 "Mis pedidos" en vivo (HU3).** La lista se actualiza por SSE y, si se pierde la conexión, se reintenta y se recarga completa.

*Comprobación:* CA6 del lado del cliente.

---

## Fase 4. Módulo del personal (`src/admin`)

**4.1 Lista de pedidos en vivo (HU4).**

*Comprobación:* CA5.

**4.2 Cambio de estado (HU5).** El botón muestra solo el siguiente estado válido. Si hay un 409, mostramos un mensaje y recargamos el pedido. Si hay un 403, mostramos el mensaje sin cerrar la app.

*Comprobación:* CA6 completo, CA7 y la parte del 403 de CA8.

**4.3 Reconexión.** Reutilizamos el mecanismo de reintento y recarga de la fase 3.

*Comprobación:* CA10.

---

## Fase 5. Pruebas y cierre

**5.1 Pruebas automatizadas.** Ejecutamos las pruebas del dominio, los casos de uso y el guardián de rutas.

**5.2 Prueba manual de punta a punta.** Seguimos este guion: el cliente se registra, arma su carrito y confirma; el personal ve el pedido y lo pasa a preparando, listo y entregado; el cliente ve cada cambio; por último probamos el modo avión y la recuperación. Si no hay dos dispositivos, usamos un celular y un emulador o navegador.

*Comprobación:* CA2, CA3, CA5, CA6 y CA10.

**5.3 Revisión de reglas y compilación.** Ejecutamos `npm run lint`, `npm run build`, las pruebas, `npx cap sync android` y generamos el APK de depuración.

*Comprobación:* CA11 y CA12.

**5.4 Registro de evidencia.** Llenamos la tabla de verificación con capturas o resultados.

---

## Registro de verificación

| CA | Estado | Evidencia (captura, prueba y fecha) |
|---|---|---|
| CA1 | Pendiente | |
| CA2 | Pendiente | |
| CA3 | Pendiente | |
| CA4 | Pendiente | |
| CA5 | Pendiente | |
| CA6 | Pendiente | |
| CA7 | Pendiente | |
| CA8 | Pendiente | |
| CA9 | Pendiente | |
| CA10 | Pendiente | |
| CA11 | Pendiente | |
| CA12 | Pendiente | |

## Dependencias externas

| Dependencia | Responsable | Si no está lista |
|---|---|---|
| API real con el contrato de `CURRENT_TASK.md` | Proyecto del servidor | Usamos la API simulada y lo anotamos en la demostración |
| Integración de pedidos entregados con ventas y corte | Proyecto web | No afecta a este incremento |

## Siguientes incrementos

1. Notificaciones push con FCM (requiere resolver P1 y P4).
2. Trabajo sin conexión del personal (requiere resolver P2).
3. Alojamiento del servidor (P3).

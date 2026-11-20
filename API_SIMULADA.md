# API simulada (propuesta)

**Esto no es el contrato del servidor.** Es lo que hoy responde el servidor simulado de la app (`src/api/sim/server.ts`) mientras no exista el backend de clientes. Cuando llegue `API_CONTRACT.md` desde tendero-web, este archivo se borra y se ajustan `src/api/index.ts` y `src/api/types.ts`. Las pantallas no llaman al servidor directamente, así que no deberían cambiar.

- Con `VITE_API_URL` vacía, la app usa el simulador. Con `VITE_API_URL`, usa `src/api/http.ts` (fetch + EventSource), que sigue esta propuesta y **todavía no se ha probado contra un servidor real**.
- Los tipos (`CatalogProduct`, `Order`, `OrderConflict`, etc.) están en `src/api/types.ts`.

## Autenticación

- Token JWT en `Authorization: Bearer <token>`. El payload trae `{ sub, role: 'cliente' | 'dispositivo', name, exp }`.
- 401: token vencido o inválido. La app cierra la sesión y vuelve al inicio con un aviso.
- 403: el rol no tiene permiso. Las rutas `/tienda/*` rechazan al cliente y las rutas `/pedidos` y `/yo` rechazan al dispositivo.

| Método y ruta | Rol | Cuerpo | Respuesta |
|---|---|---|---|
| `POST /auth/registro` | — | `{ name, email, phone, password }` | `201 { token, user }` · `422 { fields }` · `409 correo-registrado` |
| `POST /auth/entrar` | — | `{ email, password }` | `200 { token, user }` · `401 credenciales` |
| `POST /auth/dispositivo` | — | `{ deviceId, name }` | `200 { token }` (rol dispositivo) |
| `POST /auth/salir` | cualquiera | — | `204` (invalida el token) |
| `GET /yo` | cliente | — | `{ id, name, email, phone }` |

Validación del registro: nombre de 2 caracteres o más, correo válido, teléfono de 10 dígitos y contraseña de 8 caracteres o más.

> **Pendiente en el servidor real:** `POST /auth/dispositivo` debe recibir y validar el **código de 6 dígitos** de la caja. Hoy la vinculación se valida en el celular con el relay (`SYNC_PROTOCOL.md`) y el simulador confía en ella.

## Catálogo

| Método y ruta | Rol | Respuesta |
|---|---|---|
| `GET /catalogo` | cliente o dispositivo | `CatalogProduct[]`: `{ id, name, category, price, stock, photo? }`, **sin costo, mínimo ni código de barras** |

## Pedidos

| Método y ruta | Rol | Notas |
|---|---|---|
| `GET /pedidos` | cliente | Solo los del cliente del token |
| `GET /pedidos/:id` | cliente | El pedido de otra persona responde `404` |
| `POST /pedidos` | cliente | Encabezado `Idempotency-Key`. Cuerpo `{ items: [{ productId, qty, price }], note, expectedTotal, pickupCode }` |
| `GET /pedidos/eventos?token=…` | cliente | SSE. Evento `pedido` con el `Order` cada vez que cambia uno de sus pedidos |

`POST /pedidos`:

- `201 Order` con `{ id, folio, status: 'pendiente', items, total, note, createdAt, history: [{ status, at }] }`.
- La misma `Idempotency-Key` del mismo cliente devuelve el mismo pedido, sin duplicarlo.
- `409 { code: 'pedido-cambio', message, changes, products }` si el precio no coincide con el que mandó el cliente, si falta existencia o si un producto ya no existe. `changes` usa los tipos `precio` (before, after), `existencia` (requested, available) y `no-disponible`. `products` trae los datos actuales de los productos del pedido.
- Al crear el pedido se descuenta la existencia.
- `pickupCode` son 6 dígitos que genera el teléfono al confirmar el pedido (`client/lib/pickup.ts`, con `crypto.getRandomValues`). Si falta o no son 6 dígitos, responde `422`. El servidor lo guarda y solo lo regresa al dueño del pedido.

### Código para recoger

- El detalle del pedido muestra el código cuando el estado es `listo`: un QR con el texto `abarre:recoger:<id del pedido>:<código>` y los 6 dígitos. Antes de eso solo dice que aparecerá ahí. Al entregarse, se oculta.
- La caja lo pide para entregar: escribe los 6 dígitos o escanea el QR con la cámara o con un lector USB.
- `PATCH /tienda/pedidos/:id` con `status: 'entregado'` exige `pickupCode` igual al del pedido; si no coincide responde `422 codigo-recoger`. En la simulación, «Tienda: avanzar pedido» manda el código correcto.

Estados: `pendiente → preparando → listo → entregado`. No hay cancelación.

## Avisos (push)

| Método y ruta | Rol | Cuerpo |
|---|---|---|
| `POST /yo/push` | cliente | `{ token, platform }` (registra o actualiza el token FCM) |
| `DELETE /yo/push` | cualquiera | `{ token }` (al cerrar sesión) |

Cuando la tienda cambia el estado, el servidor manda por FCM una notificación al canal `pedidos` con `data: { orderId, status }`.

## Tienda (solo rol dispositivo)

| Método y ruta | Respuesta |
|---|---|
| `GET /tienda/pedidos` | Todos los pedidos. Con token de cliente: **403** |
| `PATCH /tienda/pedidos/:id` | `{ status, pickupCode? }`. Para `entregado`, `pickupCode` es obligatorio y debe coincidir. Avisa al cliente por SSE y push |

La app móvil todavía no tiene pantallas de tienda para pedidos (no se pidieron). En la simulación, «la tienda» son los botones del panel de Perfil.

## Simulación

El panel **Simulación** de la pantalla Perfil solo aparece sin `VITE_API_URL`. Sirve para:

- avanzar el estado del pedido más antiguo, a mano o cada 10 s;
- subir precios o bajar la existencia de lo que hay en el carrito (provoca el 409);
- tocar la última notificación (abre el detalle);
- probar una ruta de la tienda con el token de cliente (debe dar 403);
- vencer la sesión (401);
- simular el servidor caído;
- restablecer el catálogo y los pedidos.

Los datos simulados se guardan en `localStorage` (`tendero.sim`), solo en ese teléfono. El catálogo sale de `src/data/seed.ts`. Como ese archivo trae costos ficticios, en modo simulado el teléfono del cliente descarga ese paquete aunque nunca los muestra. Con `VITE_API_URL` el simulador no se descarga.

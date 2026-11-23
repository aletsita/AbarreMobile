# API de la app del celular

La atiende el servidor de **tendero-web** (`server/api.js`), en el mismo puerto que la sincronización con la caja:

```
http://IP-de-la-caja:8787/api      ← API (este documento)
http://IP-de-la-caja:8787/__sync   ← canal de sincronización (SYNC_PROTOCOL.md)
```

La app guarda una sola dirección (`tendero.servidor`) y de ella saca las dos. Se cambia en **Iniciar sesión → Servidor de la tienda → Cambiar** o llega en el QR de vinculación.

Los datos (cuentas, sesiones cerradas y pedidos) se guardan en `tendero-web/server/data/api.json`. Para empezar de cero, apaga el servidor y borra esa carpeta.

## Cómo se relaciona con la caja

La caja sigue siendo la dueña del inventario y de los pedidos. El servidor **escucha** el canal de sincronización:

- Del `SNAPSHOT` de la caja toma los productos, los usuarios y los pedidos. Cuando necesita datos al momento publica un `WHO` y espera el siguiente `SNAPSHOT` (hasta 3 s).
- Un pedido nuevo se le manda a la caja con `ORDER_RECEIVED`. La caja lo acepta o lo rechaza, y el siguiente `SNAPSHOT` lo confirma y trae su folio (`P-0006`).
- `ORDER_ADVANCE`, `ORDER_DELIVER`, `ORDER_CANCEL` y `ORDER_ISSUE` (de la caja o del celular de la tienda) actualizan el pedido y se avisan en vivo al cliente. Al entregar, el servidor también descuenta la existencia de su copia del catálogo.
- Si el cliente cambia productos o cancela, el servidor publica `ORDER_EDIT` u `ORDER_CANCEL` (`reason: 'cliente'`).

**Tienda cerrada.** La tienda está cerrada si la caja no manda `PING` en 12 s (sin internet o con la página cerrada) o si cerró su turno. El catálogo responde con la última copia conocida y los pedidos nuevos responden `503` (`tienda-desconectada` o `tienda-cerrada`).

| Método y ruta | Respuesta |
|---|---|
| `GET /tienda` | `{ abierta, motivo?: 'sin-conexion' \| 'turno-cerrado', mensaje?, nombre? }` |

El mismo objeto llega en vivo como evento `tienda` en `GET /pedidos/eventos`. La app lo muestra como **Tienda cerrada** y no deja agregar al carrito ni confirmar.

## Roles

El rol viaja en el token y se decide **al iniciar sesión o crear la cuenta**:

| Rol | Quién | Pantallas |
|---|---|---|
| `personal` | Su correo es el de un usuario **activo** de la caja (Dueño, Cajero o Inventario). El token trae `staffRole`. | `/movil/*`: vincular el celular, escáner, inventario, ajustes |
| `cliente` | Cualquier otra cuenta | `/cliente/*`: Pide y recoge |

Las rutas de pedidos responden `403` a quien no es cliente.

## Autenticación

Token JWT (HS256, 30 días) en `Authorization: Bearer <token>`. La clave se genera al crear `api.json`.

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /auth/registro` | `{ name, email, phone, password }` | `201 { token, user }` · `422 { fields }` · `409` correo ya registrado |
| `POST /auth/entrar` | `{ email, password }` | `200 { token, user }` · `401` |
| `POST /auth/salir` | — | `204` (el token queda revocado) |
| `GET /yo` | — | `{ id, name, email, phone }` |

Reglas: nombre de 2 letras o más, correo válido, teléfono de 10 dígitos y contraseña de 8 caracteres o más. Las contraseñas se guardan con `scrypt` y sal.

## Catálogo

`GET /catalogo` (cualquier sesión) → productos de la caja con `showInApp` distinto de `false`:

```ts
{ id, name, category, price, stock, description?, photo? }
```

`stock` es lo que se puede pedir: existencia menos lo apartado por pedidos sin entregar (los que esperan pago no apartan). La app **no** lo muestra al cliente tal cual: solo «Disponible», «¡Quedan pocas piezas!» (5 o menos) o «Agotado».

Cuando cambia la existencia o lo apartado (venta en caja, pedido, ajuste), el SSE de `/pedidos/eventos` manda el evento `inventario` con `{ id, stock }[]` de los productos que cambiaron. Si la conexión en vivo se corta, la app recarga el catálogo y los pedidos completos al reconectarse.

## Pedidos (rol cliente)

| Método y ruta | Respuesta |
|---|---|
| `GET /pedidos` | Mis pedidos |
| `GET /pedidos/:id` | Uno de mis pedidos (`404` si es de otra persona) |
| `POST /pedidos` | `201` el pedido **sin pagar** con su página de pago (`paymentUrl`). Llega a la caja hasta que se confirma el pago |
| `POST /pedidos/:id/pagar` | Reintentar el pago. Si la sesión anterior sigue abierta regresa la misma (no se cobra dos veces); si venció o falló, abre otra. `409 sin-stock` si ya no alcanza |
| `POST /pagos/webhook` | Solo para Stripe. Firma `Stripe-Signature` (HMAC-SHA256 con `STRIPE_WEBHOOK_SECRET`, tolerancia 5 min); sin firma válida, `400`. Un evento repetido responde `200 { repetido: true }` y no cambia nada |
| `GET /pagos/regreso?estado=pagado\|cancelado` | Página a la que regresa Stripe; solo dice «regresa a la app» (la confirmación es el webhook) |
| `POST /pedidos/:id/cambiar` | `{ items: { productId, qty }[] }` para un pedido con aviso (`issue`). Regresa el mismo pedido con los productos nuevos. `409 sin-aviso` si no tiene aviso, `409 pedido-cambio` si no alcanza la existencia |
| `POST /pedidos/:id/cancelar` | El cliente cancela un pedido con aviso. Queda `cancelado` con `reason: 'cliente'` |
| `POST /pedidos/:id/resolver` | `{ accion: 'quitar' \| 'reemplazar' }` para pasar al historial un pedido cancelado por la tienda. `409` si no está cancelado |
| `GET /pedidos/eventos?token=…` | Server-Sent Events: evento `pedido` con el pedido completo cada vez que cambia, `tienda` (abierta o cerrada) e `inventario` |

`POST /pedidos` lleva el encabezado `Idempotency-Key` (la misma clave regresa el mismo pedido) y el cuerpo:

```ts
{ items: { productId, qty, price }[], note, expectedTotal }  // el código para recoger ya no lo manda el teléfono
```

- El monto lo calcula el servidor con los precios actuales de la caja (`price` solo sirve para avisar cambios). La sesión de Stripe Checkout se crea con llave de idempotencia por intento (`checkout-<id>-<n>`).
- `409 pedido-cambio` si cambió un precio o no alcanza la existencia. Trae `changes` y `products` (los datos actuales) para que la app ajuste el carrito.
- `503 tienda-desconectada` si la caja no responde; `503 pagos-no-configurados` si el servidor no tiene claves de prueba de Stripe.

**Pago en línea (obligatorio).** La tarjeta se escribe en la página de Stripe: no pasa por la app ni por el servidor. El pedido nace con `payment.status: 'pendiente_de_pago'` y no aparta nada. Cuando llega el webhook firmado `checkout.session.completed` (pagado):
- si alcanza la existencia, se aparta en el mismo paso, queda `pagado` con `paidAt`, `amount` y la referencia de Stripe, el servidor genera el `pickupCode` y lo manda a la caja (`ORDER_RECEIVED`);
- si ya no alcanza, el pedido queda `cancelado` (`reason: 'sin-existencia'`) y el pago `por_reembolsar` (el reembolso se hace a mano en Stripe).
`checkout.session.expired` deja el pago `fallido`: el cliente puede reintentar. Un pedido pagado que se cancela (por el cliente o la tienda) queda `por_reembolsar`. Un pedido pagado no se puede cambiar (`409 pedido-pagado`).

Pedido:

```ts
{ id, folio: 'P-0006', status: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'cancelado', items, total, note, createdAt,
  history: { status, at }[],
  pickupCode?,                                                                     // solo con el pago confirmado
  payment?: { method: 'en_linea', status: 'pendiente_de_pago' | 'pagado' | 'fallido' | 'por_reembolsar' | 'reembolsado', amount?, paidAt? },
  paymentUrl?,                                                                     // página de pago, mientras falta pagar
  issue?: { missing: string[], at },                                               // se agotó algo: espera al cliente
  editedAt?,                                                                       // el cliente cambió productos
  cancel?: { reason: 'sin-existencia' | 'otro' | 'cliente', missing: string[], note?, at },  // missing: ids de los productos agotados
  resolved?: { action: 'quitar' | 'reemplazar', at } }                            // lo que decidió el cliente
```

### Se agotó un producto

En la caja, **Pedidos → ⚠ → Se agotó un producto** marca qué productos ya no hay. El pedido **no se cancela**: queda esperando al cliente (`issue`), con su folio, su código y las demás piezas apartadas. No se puede preparar ni entregar hasta que el cliente decida:

- **Elegir otro producto**: abre `/cliente/pedido/:id/cambiar`, que sugiere productos parecidos que sí hay (otra marca u otro tamaño) y deja ajustar las cantidades. **Guardar cambios** manda `cambiar` con la lista completa: se edita el mismo pedido.
- **Quitar lo agotado y seguir**: `cambiar` con los productos que sí hay.
- **Cancelar pedido**: `cancelar`.

### Pedido cancelado

La caja también puede cancelar el pedido por **otro motivo** (con un texto para el cliente). Sus piezas dejan de estar apartadas. En la app el pedido sigue en **Activos** hasta que el cliente toca **Entendido** (`resolver` con `quitar`).

### Celular de la tienda

El personal (Dueño, Cajero, Inventario) vinculado a la caja tiene en el celular la pestaña **Pedidos**: empezar a preparar, marcar listo y **Entregar**, que escanea el QR del cliente (o se escribe su código) y cobra; si el pedido ya está pagado en línea, solo entrega. Cada pedido dice si está «Pagado en línea» o «Se paga al recoger». Publica los mismos `ORDER_ADVANCE` y `ORDER_DELIVER` que la caja y el servidor los revisa antes (ver SYNC_PROTOCOL.md): sin existencia no se puede empezar a preparar.

## Notificaciones

Son **locales** (`@capacitor/local-notifications`): la app recibe el cambio por `GET /pedidos/eventos` y, si no está a la vista, muestra una notificación del sistema en el canal `pedidos`. Llegan con la app abierta o en segundo plano, pero no si se cerró por completo. No hace falta Firebase.

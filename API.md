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
- `ORDER_ADVANCE` y `ORDER_DELIVER` de la caja actualizan el pedido y se avisan en vivo al cliente.

Si la caja no está abierta, el catálogo responde con la última copia conocida y los pedidos nuevos responden `503`.

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

`stock` es lo que se puede pedir: existencia menos lo apartado por pedidos sin entregar. La app **no** lo muestra al cliente tal cual: solo «Disponible», «¡Quedan pocas piezas!» (5 o menos) o «Agotado».

## Pedidos (rol cliente)

| Método y ruta | Respuesta |
|---|---|
| `GET /pedidos` | Mis pedidos |
| `GET /pedidos/:id` | Uno de mis pedidos (`404` si es de otra persona) |
| `POST /pedidos` | `201` el pedido ya aceptado por la caja |
| `GET /pedidos/eventos?token=…` | Server-Sent Events: evento `pedido` con el pedido completo cada vez que cambia |

`POST /pedidos` lleva el encabezado `Idempotency-Key` (la misma clave regresa el mismo pedido) y el cuerpo:

```ts
{ items: { productId, qty, price }[], note, expectedTotal, pickupCode }  // pickupCode: 6 dígitos que genera el teléfono
```

- `409 pedido-cambio` si cambió un precio, no alcanza la existencia o la caja no lo aceptó. Trae `changes` y `products` (los datos actuales) para que la app ajuste el carrito.
- `503 tienda-desconectada` si la caja no responde.

Pedido:

```ts
{ id, folio: 'P-0006', status: 'pendiente' | 'preparando' | 'listo' | 'entregado', items, total, note, createdAt,
  history: { status, at }[], pickupCode }
```

## Notificaciones

Son **locales** (`@capacitor/local-notifications`): la app recibe el cambio por `GET /pedidos/eventos` y, si no está a la vista, muestra una notificación del sistema en el canal `pedidos`. Llegan con la app abierta o en segundo plano, pero no si se cerró por completo. No hace falta Firebase.

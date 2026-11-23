# CURRENT_TASK.md — Incremento 1: "Pide y recoge" en la app móvil

Este documento define el incremento que estamos desarrollando ahora: qué se va a hacer, qué no, con qué reglas y cómo comprobaremos que quedó bien. El contexto general está en `PROJECT_CONTEXT.md` y los pasos de construcción en `IMPLEMENTATION_PLAN.md`.

Última actualización: 22 de noviembre de 2026

## 1. Objetivo

Lograr que, desde la aplicación móvil, un cliente pueda registrarse, armar un carrito y hacer un pedido para recogerlo, y que el personal de la tienda lo vea en vivo y lo avance hasta el estado "entregado". Al terminar, este flujo completo debe funcionar en un celular Android real, ya sea con la API real o con una API simulada que respete el mismo contrato.

## 2. Historias de usuario

Describimos lo que necesita cada persona para saber qué funciones son indispensables:

- **HU1.** Como cliente, quiero registrarme e iniciar sesión para poder hacer pedidos.
- **HU2.** Como cliente, quiero ver el catálogo y agregar productos a un carrito para armar mi pedido.
- **HU3.** Como cliente, quiero confirmar mi pedido y consultar su estado para saber cuándo pasar por él.
- **HU4.** Como personal de la tienda, quiero ver los pedidos nuevos en cuanto lleguen para poder atenderlos.
- **HU5.** Como personal de la tienda, quiero cambiar el estado de un pedido para avisar al cliente cómo va.

## 3. Alcance

### 3.1 Lo que sí se implementa

Todo lo siguiente corresponde a la app móvil:

- Pantallas de registro e inicio de sesión, con sesión guardada (JWT) y guardián de rutas según el rol.
- Módulo del cliente (`src/client`): catálogo, carrito que se conserva en el dispositivo, confirmación del pedido con llave de idempotencia y pantalla "Mis pedidos" con el estado actualizado en vivo.
- Módulo del personal (`src/admin`): lista de pedidos en vivo y cambio al siguiente estado válido.
- Capa de Infraestructura: cliente HTTP con token, repositorios y escucha de SSE con reconexión.
- Capas de Aplicación y Dominio: casos de uso y reglas de los estados.
- Una API simulada (mock) que respete el contrato, para trabajar sin depender del servidor.
- Pruebas automatizadas del dominio y de los casos de uso, además de un guion de prueba manual en Android.

### 3.2 Lo que queda fuera

- **El servidor.** Su construcción corresponde a otro proyecto; aquí solo consumimos su contrato.
- **La web.** Integrar los pedidos entregados con ventas y corte del día es parte del proyecto web.
- Las notificaciones push con FCM, porque dependen de los pendientes P1 y P4.
- El trabajo sin conexión del personal y su sincronización, que depende de P2.
- El pago en línea (P5). El pago se realiza en la tienda al recoger.
- La cancelación de pedidos y otros estados adicionales.
- Cambios al escáner que ya existe, alta o edición de productos y publicación en tiendas de aplicaciones (P3).

## 4. Reglas del incremento

1. Un pedido recién creado aparece como `pendiente`.
2. El cliente solo consulta sus propios pedidos. Únicamente el personal cambia estados.
3. La app solo ofrece al personal el siguiente estado válido. Aun así, si el servidor responde 409, se muestra un mensaje y se recarga el pedido.
4. Un pedido debe tener al menos un producto con cantidad entera mayor o igual a 1. La app no permite confirmar un carrito vacío.
5. El carrito se vacía solo cuando el servidor confirma el pedido. Si falla la red, se conserva, y el reintento usa la misma llave de idempotencia.
6. El total que ve el cliente antes de confirmar es estimado. Al crear el pedido se muestra el total que devuelve el servidor.
7. Si se corta el flujo SSE, la app intenta reconectarse y vuelve a pedir la lista completa para no perder cambios.
8. Si un cliente intenta abrir una ruta de `src/admin`, la app lo redirige. Si el token vence (401), se cierra la sesión y se envía al inicio de sesión.

## 5. Contrato de API que consume la app

Este contrato se mantiene sin cambios durante el incremento. Si el servidor necesita modificarlo, primero lo acordamos y actualizamos esta tabla.

| Método | Ruta | Rol | Respuestas que la app debe manejar |
|---|---|---|---|
| POST | `/auth/register` | público | 201, 400, 409 (correo repetido) |
| POST | `/auth/login` | público | 200 con JWT y rol, 401 |
| GET | `/productos` | cliente y personal | 200 |
| POST | `/pedidos` | cliente | 201, 400, 200 si la llave ya existía |
| GET | `/pedidos/mios` | cliente | 200 |
| GET | `/pedidos` | personal | 200 |
| PATCH | `/pedidos/{id}/estado` | personal | 200, 403, 404, 409 |
| GET | `/pedidos/eventos` | cliente y personal | Flujo SSE (el cliente solo recibe los suyos) |

## 6. Criterios de aceptación

Cada criterio se puede comprobar de una forma concreta, que indicamos en la tabla.

| # | Criterio | Cómo se verifica |
|---|---|---|
| CA1 | Un usuario nuevo se registra y entra. Con contraseña incorrecta, la app muestra el error y no permite el acceso | Prueba manual en Android y prueba del caso de uso con repositorio simulado |
| CA2 | El cliente ve el catálogo y su carrito se conserva al cerrar y volver a abrir la app | Prueba manual en Android |
| CA3 | Al confirmar, el pedido aparece en "Mis pedidos" como `pendiente`, con el total que devolvió el servidor | Prueba manual y prueba del caso de uso |
| CA4 | Si falla la red al confirmar, el carrito se conserva. Al reintentar se usa la misma llave y no se duplica el pedido | Prueba automatizada del caso de uso y prueba manual en modo avión |
| CA5 | El personal ve un pedido nuevo en 3 segundos o menos, sin recargar | Dos dispositivos (o un dispositivo y el mock), midiendo el tiempo |
| CA6 | El personal pasa el pedido por los cuatro estados y el cliente ve cada cambio en 3 segundos o menos | Prueba con dos dispositivos |
| CA7 | La app no ofrece saltos de estado. Ante un 409 simulado, muestra un mensaje y recarga el pedido | Prueba automatizada del dominio y mock que responde 409 |
| CA8 | Un cliente no puede abrir rutas de `src/admin`. Un 403 de la API se muestra sin cerrar la app | Prueba manual y prueba del guardián de rutas |
| CA9 | Ante un 401 (token vencido), la app cierra la sesión y envía al inicio de sesión | Prueba con mock que responde 401 |
| CA10 | Al activar y desactivar el modo avión, las listas quedan actualizadas | Prueba manual en Android |
| CA11 | `src/client` no importa de `src/admin`; Presentación no importa de Infraestructura; el Dominio no importa Ionic ni Capacitor | Revisión con reglas de lint o búsqueda de importaciones |
| CA12 | `npm run build` y las pruebas terminan sin errores, y se puede sincronizar con Android y compilar el APK de depuración | Ejecución en terminal |

## 7. Definición de terminado

Consideramos terminado el incremento cuando:

- Los criterios CA1 a CA12 están verificados y anotados en la tabla de `IMPLEMENTATION_PLAN.md`.
- No hay secretos ni URL fijas dentro del repositorio.
- Los pendientes P1 a P5 siguen sin implementarse.
- Se ensayó la demostración del flujo completo en un Android real, con la API real si está lista, o con la simulada dejando constancia.

## 8. Riesgos

| Riesgo | Cómo lo manejamos |
|---|---|
| El servidor no está listo a tiempo | Desarrollamos contra la API simulada que respeta el contrato |
| El flujo SSE se interrumpe en redes móviles | Reconexión automática y recarga completa de la lista (regla 7) |
| Falta de tiempo | Priorizamos primero la base y el flujo del cliente, luego el del personal. Si hace falta, recortamos primero CA10 |
| El contrato cambia a mitad del incremento | Mantenemos el contrato congelado y registramos cualquier acuerdo en este documento |

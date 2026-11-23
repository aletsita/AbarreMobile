# PROJECT_CONTEXT.md — Tendero móvil

Este documento reúne el contexto general de la aplicación móvil de Tendero. Lo escribimos para que cualquier persona del equipo, o quien revise el proyecto, entienda qué estamos construyendo, con qué herramientas y bajo qué reglas. Si alguna decisión cambia, primero se actualiza este archivo y después el código.

Última actualización: 22 de noviembre de 2026

## 1. ¿Qué es Tendero móvil?

Tendero es un sistema pensado para tiendas locales, como abarrotes y misceláneas. Su idea principal es que el celular funcione como lector de código de barras y como punto de venta, de manera que el dueño no tenga que comprar una pistola lectora. Este proyecto corresponde únicamente a la **aplicación móvil para Android**.

La aplicación atiende a dos tipos de usuario:

- **Personal de la tienda** (rol `personal`): escanea productos, da de alta o actualiza el inventario y atiende los pedidos.
- **Cliente** (rol `cliente`): consulta el catálogo, arma un carrito y hace un pedido para recogerlo en la tienda ("pide y recoge"). Después puede ver en qué estado va su pedido.

La app está desarrollada con React 18, TypeScript, Ionic React y Capacitor.

### Componentes con los que se relaciona

La aplicación móvil no trabaja sola. Depende de otros dos proyectos que se desarrollan de forma independiente. Aquí solo los mencionamos como referencia:

| Componente | Descripción | Relación con la app móvil |
|---|---|---|
| Servidor (API) | ASP.NET Core con PostgreSQL | La app lo consume mediante REST y SSE. Más adelante también enviará notificaciones push con FCM. Nosotros nos basamos en su contrato de API |
| Web (caja y panel) | Proyecto en React, separado | Recibe los pedidos para registrarlos en ventas y en el corte del día. No se modifica en este incremento |

## 2. Arquitectura aprobada

Estas decisiones vienen del documento de arquitectura y las tomamos como punto de partida:

- **Estilo:** arquitectura por capas (Presentación, Aplicación, Dominio e Infraestructura), combinada con un modelo cliente–servidor basado en eventos. Elegimos las capas para separar la pantalla de las reglas del negocio, y los eventos para que los pedidos se actualicen en vivo.
- **Capas:** la capa de Presentación no se comunica directamente con la API; lo hace a través de los casos de uso de la capa de Aplicación. Esta usa el Dominio (entidades y reglas) y la Infraestructura (HTTP, almacenamiento local, cámara y SSE).
- **Módulos por rol:** `src/admin` para el personal y `src/client` para el cliente. El módulo del cliente nunca importa nada del módulo del personal, y el escáner solo existe en `src/admin`.
- **Patrones:** Adaptador (cámara y notificaciones), Repositorio (acceso a datos) y Observador (actualización de pedidos en vivo). Además usamos mecanismos que no son patrones: guardián de rutas, llave de idempotencia, carga diferida y transiciones de estado.
- **Seguridad:** se usa JWT con el rol del usuario en cada petición. La interfaz oculta lo que no corresponde, pero quien realmente valida los permisos es el servidor.
- **Estados del pedido:** `pendiente → preparando → listo → entregado`. Si se intenta un salto que no es válido, el servidor lo rechaza.
- **Funcionamiento sin conexión:** el personal tendrá una cola local ordenada con un identificador único por operación. El cliente necesita conexión, pero conserva su carrito.

## 3. Decisiones

### 3.1 Decisiones aprobadas

| # | Decisión | Razón principal |
|---|---|---|
| D1 | Usar Ionic React con Capacitor | Aprovechamos lo que ya sabemos de React y TypeScript, y nos da acceso a la cámara y a Android |
| D2 | Capas y cliente–servidor por eventos | Separa la interfaz de las reglas y permite ver los pedidos al momento |
| D3 | Módulos separados por rol | Evita que el cliente llegue a funciones del personal |
| D4 | JWT con rol en cada petición | La autorización real la hace el servidor |
| D5 | Estados de pedido en orden lineal | Evita estados contradictorios |
| D6 | Web y móvil como proyectos independientes | Es un requisito de la materia |
| D7 | Cola sin conexión solo para el personal | El cliente necesita conocer el inventario real |
| D8 | Servidor con ASP.NET Core y PostgreSQL | Decisión del equipo; la app solo depende del contrato de la API |

### 3.2 Decisiones pendientes

Estos puntos todavía no están resueltos, por lo que no los implementamos hasta decidirlos.

| # | Pendiente | Qué afecta en la app |
|---|---|---|
| P1 | Regla entre push y SSE (la idea de "enviar push solo si no hay SSE activo" es solo una propuesta) | Notificaciones |
| P2 | Endpoint y política de conflictos para sincronizar el trabajo sin conexión | Cola del personal |
| P3 | Dónde se alojará el servidor | Despliegue |
| P4 | Proyecto y credenciales de Firebase (FCM) | Notificaciones push |
| P5 | Pago en línea del pedido | Por ahora el pago se hace en la tienda al recoger |

## 4. Reglas del proyecto

1. Ningún archivo de `src/client` importa de `src/admin`.
2. La capa de Presentación nunca llama a la API directamente; siempre pasa por un caso de uso.
3. El Dominio no depende de Ionic, de Capacitor ni de librerías de HTTP.
4. El token se envía en cada petición. La app no decide por sí sola qué rol tiene: lo toma de lo que indica el servidor.
5. Todo pedido se crea con una llave de idempotencia, y un reintento usa la misma llave para no duplicarlo.
6. La app no calcula el precio final. Muestra un total estimado, y el total oficial es el que devuelve el servidor.
7. Los secretos y las URL de configuración van en archivos de entorno, no en el código ni en el repositorio.
8. Cada incremento termina con sus criterios de aceptación verificados.

## 5. Restricciones

- Por ahora la aplicación es solo para Android. Capacitor deja abierta la posibilidad de iOS más adelante.
- Somos un equipo de estudiantes con tiempo limitado, así que preferimos soluciones simples y comprobables.
- No contamos con presupuesto para servicios de pago.
- Debemos poder desarrollar y probar la app aunque el servidor todavía no esté listo, por lo que usamos una API simulada que respeta el contrato.
- Usamos el término "tiendas locales" en toda la documentación.

## 6. Fuera del alcance en esta etapa

No incluimos facturación fiscal, varias sucursales, programas de lealtad, publicación en tiendas de aplicaciones, soporte para iOS ni pagos en línea.

## 7. Documentos relacionados

- `CURRENT_TASK.md`: describe el incremento actual y sus criterios de aceptación.
- `IMPLEMENTATION_PLAN.md`: explica los pasos para construirlo.

# Tendero · Mobile (celular)

La app del celular de Abarré. Al abrirla muestra una animación con el logo y luego **Iniciar sesión**. Todos entran con correo y contraseña, y la cuenta decide qué pantallas ve cada quien:

- **Personal de la tienda:** si el correo es el de un usuario activo de la caja (Dueño, Cajero o Inventario), primero vincula el celular con la caja y luego escanea o busca productos por código, los manda a la caja, revisa y edita el inventario (con escáner), da de alta productos nuevos, y prepara y entrega pedidos escaneando el QR del cliente.
- **Cliente («Pide y recoge»):** cualquier otra cuenta. Arma su súper, hace el pedido, lo sigue en «Mis pedidos» y recibe notificaciones cuando la tienda cambia el estado. Paga al recoger.

Es una app nativa de **Android** hecha con Capacitor. Durante el desarrollo también corre en el navegador.

Hecho con React 18, TypeScript, Ionic React 8, Vite 5 y Capacitor 8 (`@capacitor/preferences`, `@capacitor-mlkit/barcode-scanning`, `@capacitor/local-notifications`, `@capacitor/app`, `capacitor-secure-storage-plugin`).

Todo pasa por el servidor del proyecto web ([tendero-web](../tendero-web), `npm run dev:server`):

- `/api`: cuentas, catálogo y pedidos. Ver [API.md](API.md).
- `/__sync`: sincronización del celular de la tienda con la caja. Ver [SYNC_PROTOCOL.md](SYNC_PROTOCOL.md).

**La caja tiene que estar abierta** (`npm run dev` en tendero-web, en el navegador) para que los clientes vean el catálogo actualizado y puedan hacer pedidos.

## Requisitos

- Node.js 20 o superior
- Para Android: Android Studio (trae el JDK 21 en `jbr/`) con el SDK de Android 36

## Configuración

```bash
npm install
cp .env.example .env
```

La app usa **una sola dirección** del servidor (`tendero.servidor`, guardada en el teléfono) para la API y la sincronización. Se puede poner de tres formas:

- En `.env` con `VITE_SYNC_URL`, como valor inicial al compilar.
- En **Iniciar sesión → Servidor de la tienda → Cambiar** (por ejemplo `192.168.1.20:8787`).
- Al vincular el celular de la tienda: viene dentro del QR de **Dispositivos → Vincular nuevo celular**.

| Dónde corre la app | `VITE_SYNC_URL` inicial |
|---|---|
| Navegador en la misma PC (`npm run dev`) | `http://localhost:8787/__sync` |
| Emulador de Android | `http://10.0.2.2:8787/__sync` (10.0.2.2 es la PC vista desde el emulador) |
| Producción | `https://tu-dominio.com/__sync` |

### Cuentas

- **Clientes:** tocan **Crear una cuenta** en la app.
- **Personal:** también crea su cuenta en la app, con el **mismo correo** que tiene en la caja (**Ajustes → Usuarios**). Si el usuario está activo en la caja, entra como personal; si lo desactivan, la próxima vez que inicie sesión entra como cliente.

### Conectar con la caja

1. En la PC de la caja: `npm run dev:server` y `npm run dev` en tendero-web. El servidor imprime la dirección para el celular (`Para el celular (misma Wi-Fi): http://192.168.1.20:8787/__sync`).
2. Conecta el celular a la misma Wi‑Fi.
3. Inicia sesión con una cuenta de personal. La app abre **Vincular con la caja**.
4. En la caja abre **Dispositivos → Vincular nuevo celular** y en el celular escanea el QR, o elige **Escribir código** y pon la dirección y los 6 dígitos.

En la app nativa la red local usa `http://`, así que compila en modo desarrollo (`CAP_MODE=development`, que es el valor por defecto si `VITE_SYNC_URL` no empieza con `https://`).

## Desarrollo en el navegador

```bash
npm run dev    # http://localhost:5174
```

Usa el puerto 5174 para no chocar con la web (5173). Ese origen ya está permitido en el CORS del servidor. En el navegador el escáner usa la cámara web (`BarcodeDetector`). Sin cámara, escribe el código en el campo de búsqueda del escáner.

## Android

```bash
npm run cap:sync      # build + npx cap sync android
npm run cap:android   # build + sync + abre Android Studio
```

Desde Android Studio, ejecuta la app en el emulador o en un celular. También puedes compilar desde la terminal:

```bash
cd android
./gradlew assembleDebug   # android/app/build/outputs/apk/debug/app-debug.apk
```

Si `gradlew` no encuentra Java, define `JAVA_HOME` con el JDK de Android Studio, por ejemplo `C:\Program Files\Android\Android Studio\jbr`.

### Modo desarrollo y modo producción

`capacitor.config.ts` cambia según `CAP_MODE`. Esa variable se lee del entorno o de `.env`, y se aplica al ejecutar `npx cap sync`:

| | `CAP_MODE=development` | `CAP_MODE=production` |
|---|---|---|
| La app se sirve como | `http://localhost` (`androidScheme: 'http'`) | `https://localhost` (`androidScheme: 'https'`) |
| Tráfico HTTP sin cifrar (`cleartext`) | permitido | bloqueado |
| `android.allowMixedContent` | `true` | `false` |
| Servidor | `http://IP-de-tu-PC:8787` en la red local | servidor con HTTPS |

Si no defines `CAP_MODE`, se deduce de `VITE_SYNC_URL`: `https://` corresponde a producción; cualquier otra, o ninguna, a desarrollo.

Desarrollo usa `http` porque una página `https://localhost` no puede abrir un `EventSource` hacia una URL `http://` (contenido mixto). Para publicar la app usa un servidor con HTTPS y `CAP_MODE=production`.

> Al cambiar de modo cambia el origen de la app (`http://localhost` ↔ `https://localhost`). Los datos que la app guardó en `localStorage` con el otro origen no se ven. La cola de cambios sin subir no se pierde, porque está en Preferences.

Si Windows pregunta por el firewall al levantar el servidor, permite el acceso de Node.js en redes privadas, porque si no el celular no lo alcanza.

### Escáner

`src/admin/scanner/scanner.ts` ofrece una sola interfaz (`useScanner`):

- **App nativa:** usa ML Kit (`@capacitor-mlkit/barcode-scanning`). Toca **Abrir cámara**: la cámara ocupa toda la pantalla con el mismo visor, la linterna y un botón para cerrar (también cierra el botón atrás). Al leer un código, la cámara se oculta mientras se muestra el resultado y vuelve a abrirse al cerrarlo. El permiso `CAMERA` está en el `AndroidManifest.xml`. Si el permiso se niega, **Reintentar** abre los ajustes de la app.
- **Navegador:** usa la cámara web con `BarcodeDetector` (`src/admin/scanner/useBarcodeCamera.ts`).

### Cambios sin conexión

La cola de cambios sin subir (`tendero.pendientes.movil`) se guarda en `@capacitor/preferences` dentro de la app nativa, porque el sistema puede borrar `localStorage`, y en `localStorage` en el navegador. La primera vez que la app nativa arranca, mueve a Preferences la cola que hubiera en `localStorage`, sin cambiar su formato.

## Roles y seguridad

La regla: **el cliente no tiene acceso al escáner ni a nada de administración.** Se cuida en tres capas:

1. **Servidor:** el rol viaja en el token firmado (`role: 'cliente' | 'personal'`) y se decide al iniciar sesión según los usuarios de la caja. Las rutas de pedidos responden 403 a quien no es cliente.
2. **Código:** `src/admin/` (lo de la tienda) y `src/client/` (lo del cliente) son paquetes separados que se cargan con `React.lazy`. Una sesión de cliente nunca descarga el de la tienda (ni el escáner ni ML Kit).
3. **Navegación:** `src/session/guard.ts` dice qué rutas puede abrir cada rol y `src/session/history.ts` cambia una ruta ajena por el inicio del rol antes de que la vea el router (URL escrita a mano, `push`, botón atrás). El permiso de cámara solo se pide dentro del escáner.

El token se guarda en almacenamiento seguro (`capacitor-secure-storage-plugin`, Android Keystore), no en `localStorage` ni en Preferences. Al abrir la app, el rol del token decide a qué pantallas entra. Cambiar de cuenta exige cerrar sesión (**Perfil** para clientes, **Ajustes** para el personal). Un 401 cierra la sesión y vuelve a **Iniciar sesión** con un aviso. Cerrar sesión no desvincula el celular de la caja.

## Notificaciones

Son **notificaciones locales** del sistema (`@capacitor/local-notifications`), sin Firebase. La app recibe en vivo los cambios de sus pedidos (`GET /api/pedidos/eventos`) y, si no está a la vista, muestra una notificación en la barra con sonido. Al tocarla se abre ese pedido. Con la app en primer plano el aviso aparece dentro de la app.

- Llegan con la app abierta o en segundo plano. **No llegan si la app se cerró por completo** (para eso haría falta push con Firebase).
- El canal de Android es `pedidos` (importancia alta).
- El permiso `POST_NOTIFICATIONS` (Android 13+) se pide después del primer pedido, con una explicación antes. También se puede activar en **Perfil**.

## Rutas

| Ruta | Pantalla |
|------|----------|
| `/` | Redirige al inicio del rol |
| `/entrar` | Iniciar sesión (todos) y dirección del servidor |
| `/registro` | Crear cuenta |
| `/cliente/tienda` | Catálogo con búsqueda y categorías |
| `/cliente/producto/:id` | Detalle, descripción, disponibilidad y cantidad |
| `/cliente/carrito` | Carrito y nota para la tienda |
| `/cliente/confirmar` | Resumen y envío del pedido |
| `/cliente/pedido-creado/:id` | Folio y estado |
| `/cliente/pedidos` | Mis pedidos (Activos / Historial) |
| `/cliente/pedido/:id` | Detalle con línea de tiempo; si se agotó algo, el aviso con «Elegir otro producto», «Quitar lo agotado y seguir» o «Cancelar pedido» |
| `/cliente/pedido/:id/cambiar` | Editar el mismo pedido: productos parecidos a los agotados y los demás del pedido |
| `/cliente/perfil` | Datos, notificaciones, tema y cerrar sesión |
| `/movil/inicio` | Personal: va a vincular el celular o directo al escáner |
| `/movil/vincular` | Vincular el celular con la caja (QR, o dirección + código de 6 dígitos) |
| `/movil/escaner` | Cámara y búsqueda por código de barras; muestra la cuenta abierta de la caja (o su cliente) |
| `/movil/inventario` | Inventario como en la caja: filtros, búsqueda y escáner (abre el producto o lo da de alta) |
| `/movil/pedidos` | Pedidos de clientes: preparar, marcar listo y entregar |
| `/movil/entregar` | Escanear el QR del cliente (o sus 6 números) y cobrar |
| `/movil/enviados` | Actividad por secciones: lo enviado a la caja, productos editados e inventario, pedidos atendidos |
| `/movil/ajustes` | Cuenta y cerrar sesión, celular vinculado, cambios pendientes, tema |
| `/movil/producto-nuevo` | Alta de producto |
| `/movil/producto/:id` | Editar producto |

## Estructura

```
android/                  proyecto nativo de Android (Capacitor)
capacitor.config.ts       appId com.tendero.app, modo desarrollo/producción
src/
├─ App.tsx                animación de inicio, sesión y guardián: elige el árbol de pantallas por rol (carga perezosa)
├─ api/                   llamadas a la API (index.ts) y transporte HTTP
├─ session/               sesión y token seguro, reglas de rutas por rol, historial con guardián
├─ inicio/                animación de inicio, iniciar sesión, crear cuenta, dirección del servidor
├─ client/                Pide y recoge: catálogo, carrito, pedidos, notificaciones, perfil
├─ admin/                 la parte del personal de la tienda
│  ├─ AdminApp.tsx        rutas /movil/* y sesión de dispositivo
│  ├─ context/            estado, sincronización y cola sin conexión
│  ├─ lib/ hooks/         sincronización, escáner, cola en Preferences, búsqueda, fotos, cámara web
│  ├─ components/         buscador por código, escáner, estados de sincronización, etc.
│  └─ pages/              pantallas del celular de la tienda
├─ components/            piezas compartidas: encabezado, formularios, estados vacíos, marca
├─ data/                  modelos y datos iniciales
├─ lib/                   dirección del servidor, tema y estado de la conexión
└─ theme/                 colores y estilos globales
```

# Tendero · Mobile (celular)

La app del celular de Abarré. Tiene dos roles, y cada uno ve solo sus pantallas:

- **Tienda (personal):** escanea o busca productos por código, los manda a la caja, da de alta productos nuevos y registra entradas de inventario.
- **Cliente («Pide y recoge»):** se registra, arma su súper, hace el pedido, lo sigue en «Mis pedidos» y recibe avisos cuando la tienda cambia el estado. Paga al recoger.

Es una app nativa de **Android** hecha con Capacitor. Durante el desarrollo también corre en el navegador.

Hecho con React 18, TypeScript, Ionic React 8, Vite 5 y Capacitor 8 (`@capacitor/preferences`, `@capacitor-mlkit/barcode-scanning`, `@capacitor/push-notifications`, `@capacitor/app`, `capacitor-secure-storage-plugin`).

> **El backend de clientes aún no existe.** Mientras no se defina `VITE_API_URL`, la app usa un **servidor simulado** que vive dentro de ella (`src/api/sim`). La propuesta de rutas que simula está en [API_SIMULADA.md](API_SIMULADA.md); cuando llegue `API_CONTRACT.md` se ajusta `src/api/`.

Se conecta al servidor de sincronización del proyecto web ([tendero-web](../tendero-web), `npm run dev:server`). El contrato entre los dos está en [SYNC_PROTOCOL.md](SYNC_PROTOCOL.md).

## Requisitos

- Node.js 20 o superior
- Para Android: Android Studio (trae el JDK 21 en `jbr/`) con el SDK de Android 36

## Configuración

```bash
npm install
cp .env.example .env
```

**No hace falta configurar la dirección del servidor.** El celular la toma al vincularse: viene dentro del QR que muestra la caja en **Dispositivos → Vincular nuevo celular**, o la escribes a mano junto con el código de 6 dígitos (por ejemplo `192.168.1.20:8787`). Se guarda en el teléfono (`tendero.servidor`) y se usa en adelante.

`VITE_SYNC_URL` en `.env` es **opcional**: solo da una dirección inicial antes de vincular.

| Dónde corre la app | `VITE_SYNC_URL` inicial (opcional) |
|---|---|
| Navegador en la misma PC (`npm run dev`) | `http://localhost:8787/__sync` |
| Emulador de Android | `http://10.0.2.2:8787/__sync` (10.0.2.2 es la PC vista desde el emulador) |
| Producción | `https://tu-dominio.com/__sync` |

### Conectar con la caja

1. En la PC de la caja: `npm run dev:server` y `npm run dev` en tendero-web. El servidor imprime la dirección para el celular (`Para el celular (misma Wi-Fi): http://192.168.1.20:8787/__sync`).
2. Conecta el celular a la misma Wi‑Fi.
3. En la caja abre **Dispositivos → Vincular nuevo celular**.
4. En el celular abre **Vincular con la caja** y escanea el QR, o elige **Escribir código** y pon la dirección y los 6 dígitos.

En la app nativa la red local usa `http://`, así que compila en modo desarrollo (`CAP_MODE=development`, que es el valor por defecto si `VITE_SYNC_URL` no empieza con `https://`).

## Desarrollo en el navegador

```bash
npm run dev    # http://localhost:5174
```

Usa el puerto 5174 para no chocar con la web (5173). Ese origen ya está permitido en el CORS del servidor. En el navegador el escáner usa la cámara web (`BarcodeDetector`). **Simular escaneo** y la captura manual funcionan igual.

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

`src/admin/lib/scanner.ts` ofrece una sola interfaz (`useScanner`):

- **App nativa:** usa ML Kit (`@capacitor-mlkit/barcode-scanning`). Toca **Abrir cámara**: la cámara ocupa toda la pantalla con el mismo visor, la linterna y un botón para cerrar (también cierra el botón atrás). Al leer un código, la cámara se oculta mientras se muestra el resultado y vuelve a abrirse al cerrarlo. El permiso `CAMERA` está en el `AndroidManifest.xml`. Si el permiso se niega, **Reintentar** abre los ajustes de la app.
- **Navegador:** usa la cámara web con `BarcodeDetector` (`src/admin/hooks/useBarcodeCamera.ts`).

### Cambios sin conexión

La cola de cambios sin subir (`tendero.pendientes.movil`) se guarda en `@capacitor/preferences` dentro de la app nativa, porque el sistema puede borrar `localStorage`, y en `localStorage` en el navegador. La primera vez que la app nativa arranca, mueve a Preferences la cola que hubiera en `localStorage`, sin cambiar su formato.

## Roles y seguridad

La regla: **el cliente no tiene acceso al escáner ni a nada de administración.** Se cuida en tres capas:

1. **Servidor:** el rol viaja en el token (`role: 'cliente' | 'dispositivo'`) y las rutas de la tienda responden 403 al cliente. Hoy lo hace el servidor simulado; el real debe hacer lo mismo.
2. **Código:** `src/admin/` (lo de la tienda) y `src/client/` (lo del cliente) son paquetes separados que se cargan con `React.lazy`. Una sesión de cliente nunca descarga el de la tienda (ni el escáner ni ML Kit).
3. **Navegación:** `src/session/guard.ts` dice qué rutas puede abrir cada rol y `src/session/history.ts` cambia una ruta ajena por el inicio del rol antes de que la vea el router (URL escrita a mano, `push`, botón atrás). El permiso de cámara solo se pide dentro del escáner.

El token se guarda en almacenamiento seguro (`capacitor-secure-storage-plugin`, Android Keystore), no en `localStorage` ni en Preferences. Al abrir la app, el rol del token decide a qué pantallas entra. Cambiar de rol exige cerrar sesión. Un 401 cierra la sesión y vuelve al inicio con un aviso.

El celular de la tienda pide su token de rol dispositivo en cuanto se vincula con la caja (o al abrir la app, si ya estaba vinculado). Si no hay conexión sigue trabajando sin token, como antes, y lo pide cuando vuelve.

## Notificaciones (Firebase)

Sin `google-services.json` la app compila y funciona: las notificaciones push quedan apagadas y el log dice `[push] No hay android/app/google-services.json…`. Con el servidor simulado, los avisos se simulan dentro de la app.

Para activarlas:

1. En la consola de Firebase crea una app Android con el paquete `com.tendero.app` y descarga `google-services.json`.
2. Ponlo en **`android/app/google-services.json`** (está en `.gitignore`).
3. No hay que cambiar Gradle: `android/build.gradle` ya trae `classpath 'com.google.gms:google-services:4.4.4'` y `android/app/build.gradle` aplica el plugin `com.google.gms.google-services` solo si el archivo existe.
4. `npx cap sync android` y vuelve a compilar.

El canal de Android es `pedidos` (importancia alta) y es el canal por defecto de FCM (`AndroidManifest.xml`). El permiso `POST_NOTIFICATIONS` (Android 13+) se pide después del primer pedido, con una explicación antes. El servidor debe mandar el `orderId` en `data`: al tocar la notificación se abre ese pedido.

## Rutas

| Ruta | Pantalla |
|------|----------|
| `/` | Redirige al inicio del rol |
| `/inicio` | Sin sesión: «Soy cliente» o «Soy de la tienda» |
| `/cliente/entrar`, `/cliente/registro` | Iniciar sesión y crear cuenta de cliente |
| `/cliente/tienda` | Catálogo con búsqueda y categorías |
| `/cliente/producto/:id` | Detalle y cantidad |
| `/cliente/carrito` | Carrito y nota para la tienda |
| `/cliente/confirmar` | Resumen y envío del pedido |
| `/cliente/pedido-creado/:id` | Folio y estado |
| `/cliente/pedidos` | Mis pedidos (Activos / Historial) |
| `/cliente/pedido/:id` | Detalle con línea de tiempo |
| `/cliente/perfil` | Datos, avisos, cerrar sesión (y el panel de simulación) |
| `/movil/bienvenida` | Bienvenida |
| `/movil/vincular` | Vincular el celular con la caja (QR, o dirección + código de 6 dígitos) |
| `/movil/escaner` | Cámara y búsqueda por código de barras |
| `/movil/enviados` | Actividad: lo enviado a la caja y lo guardado sin conexión |
| `/movil/ajustes` | Celular vinculado, cambios pendientes, tema |
| `/movil/producto-nuevo` | Alta de producto |
| `/movil/producto/:id` | Editar producto |

## Estructura

```
android/                  proyecto nativo de Android (Capacitor)
capacitor.config.ts       appId com.tendero.app, modo desarrollo/producción
src/
├─ App.tsx                sesión y guardián: elige el árbol de pantallas por rol (carga perezosa)
├─ api/                   llamadas al servidor (index.ts), transporte HTTP y servidor simulado (sim/)
├─ session/               sesión y token seguro, reglas de rutas por rol, historial con guardián
├─ inicio/                elegir rol, iniciar sesión, crear cuenta
├─ client/                Pide y recoge: catálogo, carrito, pedidos, avisos push, perfil
├─ admin/                 la parte de la tienda, sin cambios de comportamiento
│  ├─ AdminApp.tsx        rutas /movil/* y sesión de dispositivo
│  ├─ context/            estado, sincronización y cola sin conexión
│  ├─ lib/ hooks/         sincronización, escáner, cola en Preferences, búsqueda, fotos, cámara web
│  ├─ components/         buscador por código, escáner, estados de sincronización, etc.
│  └─ pages/              pantallas del celular de la tienda
├─ components/            piezas compartidas: encabezado, formularios, estados vacíos, marca
├─ data/                  modelos y datos iniciales
├─ lib/                   tema y estado de la conexión
└─ theme/                 colores y estilos globales
```

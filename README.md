# Tendero · Mobile (celular)

La app del celular de Abarré: escanea o busca productos por código, los manda a la caja, da de alta productos nuevos y registra entradas de inventario. Es una app nativa de **Android** hecha con Capacitor. Durante el desarrollo también corre en el navegador.

Hecho con React 18, TypeScript, Ionic React 8, Vite 5 y Capacitor 8 (`@capacitor/preferences`, `@capacitor-mlkit/barcode-scanning`).

Se conecta al servidor de sincronización del proyecto web ([tendero-web](../tendero-web), `npm run dev:server`). El contrato entre los dos está en [SYNC_PROTOCOL.md](SYNC_PROTOCOL.md).

## Requisitos

- Node.js 20 o superior
- Para Android: Android Studio (trae el JDK 21 en `jbr/`) con el SDK de Android 36

## Configuración

```bash
npm install
cp .env.example .env
```

En `.env`, `VITE_SYNC_URL` es **obligatoria** y debe ser una URL absoluta. Dentro de la app nativa una ruta relativa no llega a ningún servidor. Si falta o no es absoluta, la app muestra un aviso en lugar de abrirse.

| Dónde corre la app | `VITE_SYNC_URL` |
|---|---|
| Navegador en la misma PC (`npm run dev`) | `http://localhost:8787/__sync` |
| Emulador de Android | `http://10.0.2.2:8787/__sync` (10.0.2.2 es la PC vista desde el emulador) |
| Celular físico en la misma Wi‑Fi | `http://IP-de-tu-PC:8787/__sync`, por ejemplo `http://192.168.1.20:8787/__sync` |
| Producción | `https://tu-dominio.com/__sync` |

El valor se incrusta al compilar. Si lo cambias, vuelve a ejecutar `npm run cap:sync`.

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

Si no defines `CAP_MODE`, se deduce de `VITE_SYNC_URL`: `https://` corresponde a producción y cualquier otra a desarrollo.

Desarrollo usa `http` porque una página `https://localhost` no puede abrir un `EventSource` hacia una URL `http://` (contenido mixto). Para publicar la app usa un servidor con HTTPS y `CAP_MODE=production`.

> Al cambiar de modo cambia el origen de la app (`http://localhost` ↔ `https://localhost`). Los datos que la app guardó en `localStorage` con el otro origen no se ven. La cola de cambios sin subir no se pierde, porque está en Preferences.

Si Windows pregunta por el firewall al levantar el servidor, permite el acceso de Node.js en redes privadas, porque si no el celular no lo alcanza.

### Escáner

`src/lib/scanner.ts` ofrece una sola interfaz (`useScanner`):

- **App nativa:** usa ML Kit (`@capacitor-mlkit/barcode-scanning`). Toca **Abrir cámara**: la cámara ocupa toda la pantalla con el mismo visor, la linterna y un botón para cerrar (también cierra el botón atrás). Al leer un código, la cámara se oculta mientras se muestra el resultado y vuelve a abrirse al cerrarlo. El permiso `CAMERA` está en el `AndroidManifest.xml`. Si el permiso se niega, **Reintentar** abre los ajustes de la app.
- **Navegador:** usa la cámara web con `BarcodeDetector` (`src/hooks/useBarcodeCamera.ts`).

### Cambios sin conexión

La cola de cambios sin subir (`tendero.pendientes.movil`) se guarda en `@capacitor/preferences` dentro de la app nativa, porque el sistema puede borrar `localStorage`, y en `localStorage` en el navegador. La primera vez que la app nativa arranca, mueve a Preferences la cola que hubiera en `localStorage`, sin cambiar su formato.

## Rutas

| Ruta | Pantalla |
|------|----------|
| `/` | Redirige a la bienvenida |
| `/movil/bienvenida` | Bienvenida |
| `/movil/vincular` | Vincular el celular con la caja (QR o código de 6 dígitos) |
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
├─ App.tsx                rutas
├─ context/AppContext.tsx estado, sincronización y cola sin conexión
├─ data/                  modelos y datos iniciales
├─ hooks/                 cámara web con lector de códigos
├─ lib/                   sincronización, escáner, cola en Preferences, búsqueda, fotos, tema
├─ components/            buscador por código, escáner, estados de sincronización, etc.
├─ mobile/                pantallas del celular
└─ theme/                 colores y estilos globales
```

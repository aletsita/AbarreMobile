# Reporte de entorno y configuración — Tendero móvil

En este reporte dejamos constancia de las herramientas, versiones y configuración con las que desarrollamos y ejecutamos la aplicación móvil de Tendero. El objetivo es que cualquier persona pueda reproducir el entorno y comprobar que el proyecto funciona.

Fecha del reporte: 22 de noviembre de 2026

Elaboró: Emiliano

## 1. Repositorio

El código del proyecto se encuentra en GitHub. Para la revisión usamos la rama `develop`, que es donde está el trabajo más reciente.

| Dato | Valor |
|---|---|
| Enlace | https://github.com/aletsita/AbarreMobile/tree/develop |
| Visibilidad | `Público` |
| Rama estable | `main` |
| Rama de trabajo | `develop` |
| Personas con acceso | `Profesor y equipo` |

Antes de entregar, comprobamos que el enlace abre desde una ventana de incógnito, para asegurarnos de que quien revise pueda entrar.

## 2. Equipo de desarrollo

Estas son las características del equipo y de los dispositivos en los que probamos la aplicación.

| Dato | Valor |
|---|---|
| Sistema operativo | `Windows 11` |
| Editor de código | `Visual Studio Code` |
| Dispositivo de prueba | `Samsung galaxy s26 ultra - Android 17` |

## 3. Herramientas y versiones

La siguiente tabla indica qué herramientas se necesitan y para qué sirve cada una. Las versiones se obtienen con el script `collect-versions.sh`.

| Herramienta | Versión instalada | Para qué se usa |
|---|---|---|
| Node.js | | Ejecutar la aplicación y compilarla |
| npm | | Instalar y administrar las dependencias |
| Git | | Controlar las versiones del código |
| Ionic CLI | | Levantar el servidor de desarrollo |
| Android Studio | | Usar el emulador y generar el APK |
| JDK | | Compilar la parte de Android con Gradle |
| Android SDK (API objetivo) | | Definir la plataforma Android de destino |
| Capacitor | | Conectar la app web con las funciones nativas del celular |

## 4. Dependencias principales

Estas son las librerías más importantes del proyecto. Sus versiones exactas quedan fijadas en el archivo `package-lock.json`.

| Paquete | Versión (`package.json`) | Función |
|---|---|---|
| react y react-dom | | Construcción de la interfaz |
| typescript | | Tipado del código |
| @ionic/react | | Componentes pensados para móvil |
| @capacitor/core, cli y android | | Generación de la aplicación nativa de Android |
| Herramienta de compilación (Vite u otra) | | Compilar el proyecto |
| Herramienta de pruebas | | Ejecutar las pruebas automatizadas |

## 5. Configuración

Para que la aplicación funcione se necesita una configuración mínima, que describimos a continuación.

| Elemento | Detalle |
|---|---|
| Variables de entorno | `VITE_API_URL`, definida en `.env` a partir de `.env.example`. El archivo `.env` está en `.gitignore` para no subir datos privados |
| Datos de Android | Identificador de la app: `<appId>`. Versiones mínima y objetivo del SDK: `<minSdk / targetSdk>`, definidas en `android/variables.gradle` |
| Permisos | Cámara (para el escáner) e Internet |
| API | Real en `<URL>` o simulada con `npm run mock` |

## 6. Verificación de que el proyecto se ejecuta

Para comprobar que las instrucciones del README son suficientes, clonamos el repositorio en una carpeta limpia y seguimos los pasos tal cual. Registramos el resultado de cada comprobación.

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Clonar el repositorio e instalar con `npm install` | Pendiente | |
| Abrir la app con `ionic serve` | Pendiente | |
| Compilar con `npm run build` sin errores | Pendiente | |
| Sincronizar con `npx cap sync android` sin errores | Pendiente | |
| Ejecutar la app en el emulador o en un celular | Pendiente | |
| Iniciar sesión (con la API real o la simulada) | Pendiente | |
| Pasar `npm run lint` y `npm test` | Pendiente | |

## 7. Evidencia de versionamiento

Utilizamos Git para llevar el historial de cambios, con una rama estable (`main`), una rama de integración (`develop`) y ramas por tarea. Los cambios se integran con pull request.

| Dato | Valor |
|---|---|
| Número de commits | `21` |
| Ramas | `remotes/origin/HEAD -> origin/main, remotes/origin/develop, remotes/origin/feature/Alexa` |
| Autores | `aletsita, Monge25, Nicoletha` |
| Etiquetas | `v0.1.0` |
| Archivos ignorados | `node_modules`, `.env`, carpetas de compilación de Android y credenciales (ver `.gitignore`) |

Los datos anteriores se obtienen con estos comandos:

```bash
git log --oneline --graph --decorate -n 20
git shortlog -sn
git branch -a
git tag
```
## 8. Problemas encontrados y soluciones

Aquí anotamos los inconvenientes que tuvimos al configurar el entorno y cómo los resolvimos, por si a alguien más le ocurre.


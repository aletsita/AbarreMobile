import type { CapacitorConfig } from '@capacitor/cli';
import { existsSync, readFileSync } from 'node:fs';

// CAP_MODE elige cómo carga la app y a qué servidor puede hablar:
//   development: la app se sirve como http://localhost y puede abrir http://IP-de-tu-PC:8787 (texto claro).
//   production:  la app se sirve como https://localhost y solo habla con un servidor HTTPS.
// Si no se define, se deduce de VITE_SYNC_URL (https:// → production; http:// o vacía → development).
// La dirección real la elige el celular al vincularse (QR o escrita a mano); en la red local es http://, así
// que para usar la app con la caja de la tienda compila en development.
// Se lee del entorno o del archivo .env; se aplica al ejecutar `npx cap sync`.
const dotenv = (file: string): Record<string, string> =>
  existsSync(file)
    ? Object.fromEntries(
        readFileSync(file, 'utf8')
          .split(/\r?\n/)
          .map((l) => l.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/))
          .filter((m): m is RegExpMatchArray => !!m)
          .map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]),
      )
    : {};
const env: Record<string, string | undefined> = { ...dotenv('.env'), ...dotenv('.env.local'), ...process.env };
const mode = env.CAP_MODE ?? (env.VITE_SYNC_URL?.startsWith('https://') ? 'production' : 'development');
if (mode !== 'development' && mode !== 'production') throw new Error(`CAP_MODE inválido: ${mode}`);
const dev = mode === 'development';

const config: CapacitorConfig = {
  appId: 'com.tendero.app',
  appName: 'Tendero',
  webDir: 'dist',
  server: {
    // Una página https://localhost no puede abrir EventSource a una URL http:// (contenido mixto)
    androidScheme: dev ? 'http' : 'https',
    cleartext: dev,
  },
  android: {
    allowMixedContent: dev,
  },
};

export default config;

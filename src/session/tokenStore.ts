import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

// El token va en almacenamiento seguro (Android Keystore), no en localStorage ni en Preferences.
// En el navegador el plugin cae a localStorage codificado: solo sirve para desarrollar.
const KEY = 'tendero.token';

export async function readToken(): Promise<string | null> {
  try {
    const { value } = await SecureStoragePlugin.get({ key: KEY });
    return value || null;
  } catch {
    return null; // no existe la clave
  }
}

export async function saveToken(token: string) {
  await SecureStoragePlugin.set({ key: KEY, value: token });
}

export async function clearToken() {
  try {
    await SecureStoragePlugin.remove({ key: KEY });
  } catch {
    /* ya no estaba */
  }
}

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// En la app nativa la cola sin subir va en Preferences: el sistema puede borrar localStorage
export const nativeQueue = Capacitor.isNativePlatform();

const parse = <T>(raw: string): T[] => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
};

export async function loadQueue<T>(key: string): Promise<T[]> {
  try {
    const { value } = await Preferences.get({ key });
    if (value !== null) return parse<T>(value);
    // Primera vez: se pasa la cola que había en localStorage tal cual, con la misma clave y formato
    const legacy = localStorage.getItem(key);
    if (legacy === null) return [];
    await Preferences.set({ key, value: legacy });
    localStorage.removeItem(key);
    return parse<T>(legacy);
  } catch {
    return [];
  }
}

export async function saveQueue(key: string, ops: unknown[]) {
  try {
    await Preferences.set({ key, value: JSON.stringify(ops) });
  } catch {
    // almacenamiento no disponible
  }
}

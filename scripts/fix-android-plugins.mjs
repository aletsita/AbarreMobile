// Corre después de npm install (postinstall). El plugin de Android Gradle 9 ya no acepta
// getDefaultProguardFile('proguard-android.txt') y algunos plugins de Capacitor todavía lo traen
// (por ejemplo capacitor-secure-storage-plugin 0.13). Se cambia por 'proguard-android-optimize.txt'
// en los build.gradle de los plugins dentro de node_modules.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', 'node_modules');
const OLD = "getDefaultProguardFile('proguard-android.txt')";
const NEW = "getDefaultProguardFile('proguard-android-optimize.txt')";

const packages = existsSync(root)
  ? readdirSync(root).flatMap((name) =>
      name.startsWith('@') ? readdirSync(join(root, name)).map((sub) => join(root, name, sub)) : [join(root, name)],
    )
  : [];

let fixed = 0;
for (const dir of packages) {
  const file = join(dir, 'android', 'build.gradle');
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (!text.includes(OLD)) continue;
  writeFileSync(file, text.replaceAll(OLD, NEW));
  fixed++;
  console.log(`fix-android-plugins: ${file}`);
}
if (fixed === 0) console.log('fix-android-plugins: nada que corregir');

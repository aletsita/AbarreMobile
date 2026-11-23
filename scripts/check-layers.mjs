// Reglas de dependencia de la vista de desarrollo (documento de arquitectura):
// - app (App.tsx, main.tsx) puede importar de admin, client y shared
// - admin y client solo importan de shared, nunca entre sí
// - shared (todo lo demás en src/) no importa de admin ni de client
// - el plugin de la cámara solo se usa en admin/scanner
// Uso: npm run check:capas (sale con código 1 si alguna regla se rompe)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const APP_FILES = new Set(['App.tsx', 'main.tsx']);
const CAMERA_PLUGIN = '@capacitor-mlkit/barcode-scanning';
const CAMERA_HOME = ['admin', 'scanner'];

const layerOf = (file) => {
  const parts = relative(SRC, file).split(sep);
  if (parts.length === 1 && APP_FILES.has(parts[0])) return 'app';
  if (parts[0] === 'admin' || parts[0] === 'client') return parts[0];
  return 'shared';
};

const ALLOWED = {
  app: ['app', 'admin', 'client', 'shared'],
  admin: ['admin', 'shared'],
  client: ['client', 'shared'],
  shared: ['shared'],
};

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

// import … from '…', export … from '…', import '…' e import('…')
const IMPORT_RE = /(?:^|[^\w.])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|[^\w.])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const errors = [];
for (const file of files(SRC)) {
  const code = readFileSync(file, 'utf8');
  const from = layerOf(file);
  const rel = relative(ROOT, file).split(sep).join('/');
  for (const m of code.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3];
    const line = code.slice(0, m.index).split('\n').length;
    if (spec === CAMERA_PLUGIN || spec.startsWith(`${CAMERA_PLUGIN}/`)) {
      const parts = relative(SRC, file).split(sep);
      if (parts[0] !== CAMERA_HOME[0] || parts[1] !== CAMERA_HOME[1]) errors.push(`${rel}:${line} usa el plugin de la cámara fuera de src/admin/scanner`);
      continue;
    }
    if (!spec.startsWith('.')) continue;
    const target = resolve(dirname(file), spec);
    if (!target.startsWith(SRC)) continue;
    const to = layerOf(target);
    if (!ALLOWED[from].includes(to)) errors.push(`${rel}:${line} (${from}) no puede importar de ${to}: '${spec}'`);
  }
}

if (errors.length) {
  console.error(`Reglas de dependencia rotas (${errors.length}):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('Reglas de dependencia: OK (app → admin/client/shared, admin y client → shared, cámara solo en admin/scanner)');

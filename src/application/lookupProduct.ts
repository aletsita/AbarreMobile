import { suggestedName, type LookupResult, type ProductLookup } from '../domain/productLookup';
import { openFoodFacts } from '../infrastructure/openFoodFacts';

// Caso de uso: autocompletar el alta de un producto con su código de barras.
// Las pantallas llaman aquí y no al adaptador; para cambiar de fuente basta con pasar otro `ProductLookup`.
const TIMEOUT_MS = 6000;

export interface ProductDraft {
  name: string;
  image?: Blob;
  source: string;
}

export type AutofillResult = { status: 'listo'; draft: ProductDraft } | Exclude<LookupResult, { status: 'encontrado' }>;

export async function autofillProduct(barcode: string, source: ProductLookup = openFoodFacts): Promise<AutofillResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await source.find(barcode, ctrl.signal);
    if (r.status !== 'encontrado') return r;
    const image = r.info.imageUrl ? await downloadImage(r.info.imageUrl, ctrl.signal) : undefined;
    return { status: 'listo', draft: { name: suggestedName(r.info), image, source: r.source } };
  } finally {
    clearTimeout(timer);
  }
}

// La foto es opcional: si no baja (sin permiso CORS, lenta), el alta sigue sin ella
async function downloadImage(url: string, signal: AbortSignal): Promise<Blob | undefined> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return blob.type.startsWith('image/') ? blob : undefined;
  } catch {
    return undefined;
  }
}

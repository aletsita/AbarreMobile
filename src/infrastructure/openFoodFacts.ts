import type { LookupResult, ProductLookup } from '../domain/productLookup';

// Adaptador de Open Food Facts (https://world.openfoodfacts.org): base pública y gratuita, sin clave.
// Solo se piden los campos que se usan para no bajar la ficha completa.
const BASE = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'product_name,product_name_es,brands,quantity,image_front_small_url,image_front_url';

interface OffResponse {
  status?: number;
  product?: {
    product_name?: string;
    product_name_es?: string;
    brands?: string;
    quantity?: string;
    image_front_small_url?: string;
    image_front_url?: string;
  };
}

export const openFoodFacts: ProductLookup = {
  source: 'Open Food Facts',
  async find(barcode, signal): Promise<LookupResult> {
    if (!/^\d{8,14}$/.test(barcode)) return { status: 'no-encontrado' };
    if (!navigator.onLine) return { status: 'sin-conexion' };
    let res: Response;
    try {
      res = await fetch(`${BASE}/${barcode}.json?fields=${FIELDS}`, { signal, headers: { Accept: 'application/json' } });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return { status: 'error' };
      return { status: 'sin-conexion' };
    }
    // Un código que no está en la base responde 404 con status 0
    if (res.status === 404) return { status: 'no-encontrado' };
    if (!res.ok) return { status: 'error' };
    const body = (await res.json().catch(() => null)) as OffResponse | null;
    const p = body?.product;
    const name = (p?.product_name_es || p?.product_name || '').trim();
    if (body?.status !== 1 || !p || !name) return { status: 'no-encontrado' };
    return {
      status: 'encontrado',
      source: this.source,
      info: {
        name,
        brand: p.brands?.split(',')[0]?.trim() || undefined,
        quantity: p.quantity?.trim() || undefined,
        imageUrl: p.image_front_url || p.image_front_small_url || undefined,
      },
    };
  },
};

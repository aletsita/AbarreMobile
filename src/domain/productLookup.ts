// Datos de un producto que se pueden sacar de una base pública a partir de su código de barras.
// El precio y la existencia nunca vienen de aquí: los captura la persona.
export interface ProductInfo {
  name: string;
  brand?: string;
  quantity?: string; // presentación: "600 ml", "109 g"
  imageUrl?: string;
}

export type LookupResult =
  | { status: 'encontrado'; info: ProductInfo; source: string }
  | { status: 'no-encontrado' }
  | { status: 'sin-conexion' }
  | { status: 'error' };

// Puerto: cualquier fuente (Open Food Facts u otra) se conecta implementando esta interfaz
export interface ProductLookup {
  readonly source: string;
  find(barcode: string, signal?: AbortSignal): Promise<LookupResult>;
}

// Nombre sugerido para el catálogo: "Galletas Emperador 109 g", sin repetir la marca si ya viene en el nombre
export function suggestedName(info: ProductInfo): string {
  const parts = [info.name.trim()];
  if (info.brand && !info.name.toLowerCase().includes(info.brand.toLowerCase())) parts.push(info.brand.trim());
  if (info.quantity && !info.name.toLowerCase().includes(info.quantity.toLowerCase())) parts.push(info.quantity.trim());
  return parts.filter(Boolean).join(' ');
}

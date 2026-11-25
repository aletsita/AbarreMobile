import type { CatalogProduct, CatalogUpdate } from '../../api/types';

// Aplica un aviso `catalogo` del servidor: quita lo oculto o borrado, cambia lo que ya estaba (en su lugar)
// y agrega al inicio lo que apareció
export function mergeCatalog(all: CatalogProduct[], u: CatalogUpdate): CatalogProduct[] {
  const gone = new Set(u.quitados ?? []);
  const incoming = new Map((u.productos ?? []).map((p) => [p.id, p]));
  const kept = all.filter((p) => !gone.has(p.id)).map((p) => incoming.get(p.id) ?? p);
  const known = new Set(kept.map((p) => p.id));
  const added = [...incoming.values()].filter((p) => !known.has(p.id) && !gone.has(p.id));
  return [...added, ...kept];
}

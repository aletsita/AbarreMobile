import { isWeighed, qtyText } from '../../domain/weight';
import { stockLevel, type Product } from '../../data/models';
import './StockBadge.css';

const LABEL = { ok: 'En stock', poco: 'Poco stock', sin: 'Sin stock' } as const;

export function StockBadge({ product, compact }: { product: Product; compact?: boolean }) {
  const level = stockLevel(product);
  return (
    <span className={`stock-badge level-${level}`}>
      <span className="stock-dot" aria-hidden="true" />
      {compact ? (isWeighed(product) ? qtyText(product.stock, 'peso') : `${product.stock} pzas`) : `${LABEL[level]} · ${qtyText(product.stock, product.saleType)}`}
    </span>
  );
}

/**
 * FASE 7B — Puente modelo normalizado → motor e-commerce 7A.
 *
 * El motor 7A consume PageSnapshot. Aquí se construye una vista DERIVADA de
 * la auditoría que:
 *  - enriquece las páginas rastreadas que tienen correspondencia confirmada
 *    con metadatos del conector (`source`), sin tocar HTML, título ni score;
 *  - agrega snapshots de entidades de la tienda que el crawler NO encontró,
 *    marcadas con `statusCode: 0` (estado HTTP desconocido: no se rastrearon).
 *
 * NADA de esto se persiste sobre la auditoría original: `withStoreData`
 * devuelve una copia. `score`, `findings` y `coverage` se conservan tal cual.
 */
import type { Audit, PageSnapshot } from "../types";
import type { CommerceMatch, NormalizedCategory, NormalizedProduct } from "./types";

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url.startsWith("/") ? url : `/${url}`;
  }
}

function availabilityToSource(value: string) {
  return value;
}

/** Metadatos de conector de un producto (solo campos realmente entregados). */
export function productSourceMeta(
  product: NormalizedProduct,
): Record<string, string | number | boolean | undefined> {
  const meta: Record<string, string | number | boolean | undefined> = {
    connector: product.source,
    storeId: product.storeId,
    productId: product.externalId,
  };
  if (product.sku) meta["sku"] = product.sku;
  if (product.price) meta["price"] = product.price;
  if (product.currency) meta["currency"] = product.currency;
  if (product.availability !== "unknown")
    meta["availability"] = availabilityToSource(product.availability);
  if (product.brand) meta["brand"] = product.brand;
  if (product.name) meta["name"] = product.name;
  if (product.variants.length) meta["variants"] = product.variants.length;
  if (product.status !== "unknown") meta["status"] = product.status;
  return meta;
}

export function categorySourceMeta(
  category: NormalizedCategory,
): Record<string, string | number | boolean | undefined> {
  const meta: Record<string, string | number | boolean | undefined> = {
    connector: category.source,
    storeId: category.storeId,
    categoryId: category.externalId,
  };
  if (category.name) meta["name"] = category.name;
  if (category.parentId) meta["parentId"] = category.parentId;
  if (category.productIds.length) meta["productCount"] = category.productIds.length;
  return meta;
}

function wordsOf(text: string | undefined) {
  if (!text) return 0;
  return text
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Snapshot de una entidad de tienda que el crawler no rastreó. */
function productSnapshot(product: NormalizedProduct): PageSnapshot {
  const url = product.url ?? "";
  return {
    id: `store-${product.storeId}-p-${product.externalId}`,
    url,
    path: url ? pathOf(url) : `/(sin URL)/${product.externalId}`,
    pageType: "product",
    statusCode: 0,
    title: product.seo?.title ?? product.name,
    metaDescription: product.seo?.description,
    h1: product.name ? [product.name] : [],
    h2: [],
    h3: [],
    wordCount: wordsOf(product.description),
    textSample: product.description?.slice(0, 400),
    images: product.images.map((i) => ({ src: i.url, alt: i.alt })),
    internalLinks: [],
    externalLinks: 0,
    schemaTypes: [],
    depth: 0,
    hasViewport: true,
    source: productSourceMeta(product),
  };
}

function categorySnapshot(
  category: NormalizedCategory,
  products: NormalizedProduct[],
): PageSnapshot {
  const url = category.url ?? "";
  const children = products.filter((p) => p.categoryIds.includes(category.externalId));
  return {
    id: `store-${category.storeId}-c-${category.externalId}`,
    url,
    path: url ? pathOf(url) : `/(sin URL)/cat-${category.externalId}`,
    pageType: "category",
    statusCode: 0,
    title: category.seo?.title ?? category.name,
    metaDescription: category.seo?.description,
    h1: category.name ? [category.name] : [],
    h2: [],
    h3: [],
    wordCount: wordsOf(category.description),
    images: [],
    internalLinks: children
      .filter((p) => p.url)
      .map((p) => ({ href: p.url as string, anchor: p.name ?? "" })),
    externalLinks: 0,
    schemaTypes: [],
    depth: 1,
    hasViewport: true,
    source: categorySourceMeta(category),
  };
}

export interface StoreDataInput {
  audit: Audit;
  products: NormalizedProduct[];
  categories: NormalizedCategory[];
  matches: CommerceMatch[];
}

export interface StoreAugmentation {
  /** Copia de la auditoría con metadatos de tienda (solo lectura). */
  audit: Audit;
  enrichedPages: number;
  addedPages: number;
}

/**
 * Devuelve una copia de la auditoría lista para `analyzeEcommerce`.
 * Solo se enriquecen páginas con correspondencia CONFIRMADA
 * (`store-and-crawler`). Las inciertas no reciben datos.
 */
export function withStoreData({
  audit,
  products,
  categories,
  matches,
}: StoreDataInput): StoreAugmentation {
  const confirmed = matches.filter((m) => m.state === "store-and-crawler" && m.pageId);
  const productByExternalId = new Map(products.map((p) => [p.externalId, p]));
  const categoryByExternalId = new Map(categories.map((c) => [c.externalId, c]));

  const metaByPageId = new Map<string, Record<string, string | number | boolean | undefined>>();
  const matchedProductIds = new Set<string>();
  const matchedCategoryIds = new Set<string>();
  for (const m of confirmed) {
    if (m.entity === "product") {
      const p = productByExternalId.get(m.externalId);
      if (!p) continue;
      matchedProductIds.add(p.externalId);
      metaByPageId.set(m.pageId as string, productSourceMeta(p));
    } else {
      const c = categoryByExternalId.get(m.externalId);
      if (!c) continue;
      matchedCategoryIds.add(c.externalId);
      metaByPageId.set(m.pageId as string, categorySourceMeta(c));
    }
  }

  const pages: PageSnapshot[] = audit.pages.map((p) => {
    const meta = metaByPageId.get(p.id);
    return meta ? { ...p, source: { ...(p.source ?? {}), ...meta } } : p;
  });

  const extra: PageSnapshot[] = [
    ...products
      .filter((p) => !matchedProductIds.has(p.externalId) && p.status !== "unavailable")
      .map(productSnapshot),
    ...categories
      .filter((c) => !matchedCategoryIds.has(c.externalId))
      .map((c) => categorySnapshot(c, products)),
  ];

  return {
    audit: { ...audit, pages: [...pages, ...extra] },
    enrichedPages: metaByPageId.size,
    addedPages: extra.length,
  };
}

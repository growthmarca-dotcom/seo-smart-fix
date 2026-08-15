/**
 * FASE 7A — Detección de e-commerce y clasificación de entidades.
 * Determinista, agnóstica de plataforma y basada exclusivamente en datos ya
 * capturados: patrones de URL, schema declarado, enlaces internos, metadatos
 * del conector (`page.source`) y exclusiones del rastreo.
 */
import type { Audit, PageSnapshot } from "../types";
import type {
  AvailabilityState,
  EcommerceDetection,
  EcommerceDetectionSignal,
  EcommerceType,
  EntityConfidence,
} from "./types";

const PRODUCT_PATTERNS = [
  /\/productos?\//,
  /\/product(s)?\//,
  /\/p\/[^/]+/,
  /\/item(s)?\//,
  /\/articulo\//,
];
const CATEGORY_PATTERNS = [
  /\/categorias?\//,
  /\/categor(y|ies)\//,
  /\/colecciones?\//,
  /\/collections?\//,
  /\/c\/[^/]+/,
];
const COLLECTION_PATTERNS = [/\/colecciones?\//, /\/collections?\//];
const CART_PATTERNS = [/\/(carrito|cart|basket)(\/|$)/];
const CHECKOUT_PATTERNS = [/\/(checkout|pagar|finalizar-compra|payment)(\/|$)/];
const SEARCH_PATTERNS = [/\/(buscar|busqueda|search)(\/|$|\?)/];
const PAGINATION_PATH = /\/(page|pagina|p)\/(\d+)\/?$/;
const FACET_PARAMS = [
  "color",
  "colour",
  "talle",
  "size",
  "marca",
  "brand",
  "precio",
  "price",
  "min",
  "max",
  "filter",
  "filtro",
  "filters",
  "orden",
  "order",
  "order_by",
  "sort",
  "sort_by",
  "sortby",
  "tag",
  "atributo",
];
const VARIANT_PARAMS = ["variant", "variante", "variation", "sku", "talle", "color"];
const PAGE_PARAMS = ["page", "pagina", "pag", "p"];

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((r) => r.test(value));
}

export function urlParts(url: string) {
  let path = url;
  let query = "";
  const qi = url.indexOf("?");
  if (qi >= 0) {
    path = url.slice(0, qi);
    query = url.slice(qi + 1);
  }
  try {
    const u = new URL(url);
    path = u.pathname;
    query = u.search.replace(/^\?/, "");
  } catch {
    /* URLs relativas o no parseables: se usa el corte manual. */
  }
  const params = query
    ? query
        .split("&")
        .filter(Boolean)
        .map((p) => p.split("=")[0]?.toLowerCase() ?? "")
        .filter(Boolean)
    : [];
  return { path: path.toLowerCase(), params };
}

export function isProductLikeUrl(url: string) {
  return matchesAny(urlParts(url).path, PRODUCT_PATTERNS);
}

export function isCategoryLikeUrl(url: string) {
  return matchesAny(urlParts(url).path, CATEGORY_PATTERNS);
}

export function facetParametersOf(url: string) {
  const { params } = urlParts(url);
  const facets = params.filter((p) => FACET_PARAMS.includes(p));
  // Más de un parámetro no reconocido también es señal de faceta/ordenamiento.
  if (facets.length === 0 && params.filter((p) => !PAGE_PARAMS.includes(p)).length >= 2) {
    return params.filter((p) => !PAGE_PARAMS.includes(p));
  }
  return facets;
}

export function paginationNumberOf(url: string): number | null {
  const { path, params } = urlParts(url);
  const m = PAGINATION_PATH.exec(path);
  if (m?.[2]) return Number(m[2]);
  if (!params.some((p) => PAGE_PARAMS.includes(p))) return null;
  try {
    const u = new URL(url);
    for (const key of PAGE_PARAMS) {
      const v = u.searchParams.get(key);
      if (v && /^\d+$/.test(v)) return Number(v);
    }
  } catch {
    /* no parseable */
  }
  return null;
}

export function variantParametersOf(url: string) {
  return urlParts(url).params.filter((p) => VARIANT_PARAMS.includes(p));
}

/** Metadato de conector, si existe. Nunca se inventa un valor. */
export function sourceValue(page: PageSnapshot, keys: string[]): string | undefined {
  const src = page.source;
  if (!src) return undefined;
  for (const key of Object.keys(src)) {
    if (!keys.includes(key.toLowerCase())) continue;
    const v = src[key];
    if (v === undefined || v === null || v === "") continue;
    return String(v);
  }
  return undefined;
}

export function availabilityOf(page: PageSnapshot): AvailabilityState {
  const raw = sourceValue(page, ["availability", "stock", "disponibilidad"]);
  if (!raw) return "unknown";
  const v = raw.toLowerCase();
  if (/(discontinu|deprecat|baja)/.test(v)) return "discontinued";
  if (/(out.?of.?stock|agotado|sin.?stock|0)/.test(v)) return "out-of-stock";
  if (/(in.?stock|disponible|available|true)/.test(v)) return "in-stock";
  return "unknown";
}

export function isIndexable(page: PageSnapshot) {
  const robots = (page.robotsMeta ?? "").toLowerCase();
  if (robots.includes("noindex")) return { indexable: false, note: "Meta robots con noindex." };
  if (page.statusCode >= 400)
    return { indexable: false, note: `Respuesta HTTP ${page.statusCode}.` };
  if (page.statusCode >= 300)
    return { indexable: false, note: `Redirección HTTP ${page.statusCode}.` };
  return { indexable: true, note: "Sin noindex y respuesta HTTP 2xx." };
}

export interface EntityClassification {
  ecommerceType: EcommerceType;
  confidence: EntityConfidence;
  signals: string[];
}

/**
 * Clasifica una página en el modelo e-commerce. Combina el `pageType` de la
 * Fase 3 (que no se modifica) con patrones de URL, schema y metadatos.
 */
export function classifyEcommercePage(
  page: PageSnapshot,
  rootUrl?: string,
): EntityClassification {
  const { path, params } = urlParts(page.url);
  const signals: string[] = [];
  const schema = page.schemaTypes.map((s) => s.toLowerCase());
  const hasProductSchema = schema.includes("product") || schema.includes("productgroup");
  if (hasProductSchema) signals.push("Schema Product declarado");
  if (schema.includes("offer")) signals.push("Schema Offer declarado");
  if (sourceValue(page, ["productid", "sku", "itemid"])) signals.push("Identificador de producto del conector");

  const rootPath = (() => {
    if (!rootUrl) return "/";
    try {
      return new URL(rootUrl).pathname.toLowerCase() || "/";
    } catch {
      return "/";
    }
  })();

  if (matchesAny(path, CHECKOUT_PATTERNS)) {
    signals.push("Patrón de URL de checkout");
    return { ecommerceType: "checkout", confidence: "high", signals };
  }
  if (matchesAny(path, CART_PATTERNS)) {
    signals.push("Patrón de URL de carrito");
    return { ecommerceType: "cart", confidence: "high", signals };
  }
  if (matchesAny(path, SEARCH_PATTERNS) || params.includes("q") || params.includes("s")) {
    signals.push("Patrón de búsqueda interna");
    return { ecommerceType: "search", confidence: "medium", signals };
  }

  const pageNumber = paginationNumberOf(page.url);
  if (pageNumber !== null && pageNumber > 1) {
    signals.push(`Patrón de paginación (página ${pageNumber})`);
    return { ecommerceType: "pagination", confidence: "high", signals };
  }

  const facets = facetParametersOf(page.url);
  if (facets.length > 0) {
    signals.push(`Parámetros de filtro/orden: ${facets.join(", ")}`);
    return { ecommerceType: "faceted", confidence: facets.length > 1 ? "high" : "medium", signals };
  }

  const productLike = matchesAny(path, PRODUCT_PATTERNS);
  const variantParams = variantParametersOf(page.url);
  if ((productLike || hasProductSchema) && variantParams.length > 0) {
    signals.push(`Parámetros de variante: ${variantParams.join(", ")}`);
    return { ecommerceType: "product-variant", confidence: "medium", signals };
  }

  if (productLike || hasProductSchema || page.pageType === "product") {
    if (productLike) signals.push("Patrón de URL de producto");
    if (page.pageType === "product") signals.push("Tipo de página producto (Fase 3)");
    const strong = [productLike, hasProductSchema, page.pageType === "product"].filter(Boolean).length;
    return {
      ecommerceType: "product",
      confidence: strong >= 2 ? "high" : "medium",
      signals,
    };
  }

  if (path === rootPath || path === "/" || path === "") {
    signals.push("URL raíz de la tienda");
    return { ecommerceType: "store-home", confidence: "high", signals };
  }

  const categoryLike = matchesAny(path, CATEGORY_PATTERNS);
  const collectionLike = matchesAny(path, COLLECTION_PATTERNS);
  if (categoryLike || page.pageType === "category") {
    if (categoryLike) signals.push("Patrón de URL de categoría/colección");
    if (page.pageType === "category") signals.push("Tipo de página categoría (Fase 3)");
    const segments = path.split("/").filter(Boolean);
    const anchorIndex = segments.findIndex((s) =>
      /^(categorias?|categor(y|ies)|colecciones?|collections?|c)$/.test(s),
    );
    const depthAfterAnchor = anchorIndex >= 0 ? segments.length - anchorIndex - 1 : 0;
    if (collectionLike && depthAfterAnchor <= 1) {
      return { ecommerceType: "collection", confidence: "medium", signals };
    }
    if (depthAfterAnchor >= 2) {
      signals.push("Ruta de categoría anidada");
      return { ecommerceType: "subcategory", confidence: "medium", signals };
    }
    return {
      ecommerceType: "category",
      confidence: categoryLike && page.pageType === "category" ? "high" : "medium",
      signals,
    };
  }

  if (page.pageType === "article" || /\/(blog|notas|novedades)\//.test(path)) {
    signals.push("Contenido editorial");
    return { ecommerceType: "article", confidence: "medium", signals };
  }

  if (page.pageType === "contact" || page.pageType === "landing" || page.pageType === "other") {
    return { ecommerceType: "informational", confidence: "low", signals };
  }

  return { ecommerceType: "unknown", confidence: "low", signals };
}

const MIN_CONFIDENCE = 45;

/**
 * Detección a nivel auditoría. Requiere al menos DOS señales distintas y una
 * confianza mínima: una única señal débil nunca declara que el sitio es
 * e-commerce.
 */
export function detectEcommerce(audit: Audit): EcommerceDetection {
  const pages = audit.pages;
  const excluded = audit.coverage?.excluded ?? [];

  const productLike = pages.filter((p) => isProductLikeUrl(p.url)).length;
  const categoryLike = pages.filter((p) => isCategoryLikeUrl(p.url)).length;
  const productSchema = pages.filter((p) =>
    p.schemaTypes.some((s) => /^(product|productgroup)$/i.test(s)),
  ).length;
  const offerSchema = pages.filter((p) => p.schemaTypes.some((s) => /^offer$/i.test(s))).length;
  const cartOrCheckout =
    pages.filter((p) => {
      const { path } = urlParts(p.url);
      return matchesAny(path, CART_PATTERNS) || matchesAny(path, CHECKOUT_PATTERNS);
    }).length +
    excluded.filter((e) => {
      const { path } = urlParts(e.url);
      return matchesAny(path, CART_PATTERNS) || matchesAny(path, CHECKOUT_PATTERNS);
    }).length;
  const connectorProductData = pages.filter((p) =>
    sourceValue(p, ["productid", "sku", "itemid"]),
  ).length;

  const categoryToProductLinks = pages
    .filter((p) => isCategoryLikeUrl(p.url) || p.pageType === "category")
    .reduce(
      (sum, p) => sum + p.internalLinks.filter((l) => isProductLikeUrl(l.href)).length,
      0,
    );

  const signals: EcommerceDetectionSignal[] = [];
  const add = (
    id: string,
    label: string,
    detail: string,
    weight: number,
    occurrences: number,
  ) => {
    if (occurrences > 0) signals.push({ id, label, detail, weight, occurrences });
  };

  add(
    "product-schema",
    "Schema Product / ProductGroup",
    "Páginas que declaran datos estructurados de producto.",
    30,
    productSchema,
  );
  add("offer-schema", "Schema Offer", "Páginas que declaran una oferta.", 12, offerSchema);
  add(
    "product-urls",
    "URLs con patrón de producto",
    "Rutas del tipo /producto/, /product/, /p/ o /item/.",
    productLike >= 2 ? 25 : 10,
    productLike,
  );
  add(
    "category-urls",
    "URLs con patrón de categoría o colección",
    "Rutas del tipo /categoria/, /category/ o /collections/.",
    categoryLike >= 2 ? 18 : 8,
    categoryLike,
  );
  add(
    "cart-checkout",
    "URLs de carrito o checkout",
    "Detectadas entre las páginas analizadas o entre las URLs excluidas del rastreo.",
    18,
    cartOrCheckout,
  );
  add(
    "category-product-links",
    "Enlaces categoría → producto",
    "Enlaces internos reales desde listados hacia fichas de producto.",
    categoryToProductLinks >= 2 ? 15 : 6,
    categoryToProductLinks,
  );
  add(
    "connector-product-data",
    "Metadatos de producto del conector",
    "El origen de los datos aporta identificadores de producto.",
    12,
    connectorProductData,
  );

  const confidence = Math.min(100, signals.reduce((sum, s) => sum + s.weight, 0));
  const isEcommerce = signals.length >= 2 && confidence >= MIN_CONFIDENCE;

  return {
    auditId: audit.id,
    isEcommerce,
    confidence,
    signals,
    criterion: `Se requieren al menos 2 señales distintas y una confianza ≥ ${MIN_CONFIDENCE}/100. Detectadas: ${signals.length} señales, confianza ${confidence}/100.`,
    counts: {
      productLike,
      categoryLike,
      productSchema,
      offerSchema,
      cartOrCheckout,
      categoryToProductLinks,
      connectorProductData,
    },
  };
}

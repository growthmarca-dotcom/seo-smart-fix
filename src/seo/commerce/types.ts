/**
 * FASE 7B — MODELO NORMALIZADO DE COMERCIO (agnóstico de plataforma).
 *
 * Capa intermedia entre un adaptador de plataforma (Tienda Nube, y en el
 * futuro WooCommerce/Shopify) y el motor e-commerce de la Fase 7A.
 * El motor 7A NO conoce estos tipos: consume PageSnapshot, por lo que la
 * conversión ocurre en `to-snapshots.ts`.
 *
 * SOLO LECTURA: ninguna entidad de este módulo describe operaciones de
 * escritura. Editar productos, títulos, precios, stock o imágenes pertenece
 * a la Fase 8 y no está implementado en ninguna parte de esta capa.
 *
 * AISLAMIENTO: cada entidad importada conserva `storeId` + `auditId`.
 */
import type { AvailabilityState } from "../ecommerce/types";

/** Origen del dato. `demo` nunca se presenta como conexión real. */
export type CommerceSource = "tiendanube" | "demo";

export const COMMERCE_SOURCE_LABELS: Record<CommerceSource, string> = {
  tiendanube: "Tienda Nube (API real)",
  demo: "Tienda demo (datos mock)",
};

/** Estados visibles de la conexión con una tienda. */
export type StoreConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "syncing"
  | "synced"
  | "error"
  | "auth-required"
  | "no-data";

export const STORE_STATUS_LABELS: Record<StoreConnectionStatus, string> = {
  disconnected: "No conectado",
  connecting: "Conectando",
  connected: "Conectado",
  syncing: "Sincronizando",
  synced: "Sincronizado",
  error: "Error",
  "auth-required": "Autorización requerida",
  "no-data": "Sin datos",
};

/** Estado de publicación tal como lo informa la plataforma. */
export type ProductStatus = "published" | "unpublished" | "unavailable" | "unknown";

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  published: "Publicado",
  unpublished: "No publicado",
  unavailable: "Ya no disponible en la tienda",
  unknown: "Desconocido",
};

export interface NormalizedImage {
  source: CommerceSource;
  externalId: string;
  url: string;
  /** Solo si la plataforma lo entrega. Nunca se genera un ALT inventado. */
  alt?: string | undefined;
  position?: number | undefined;
}

export interface NormalizedVariant {
  source: CommerceSource;
  externalId: string;
  productExternalId: string;
  sku?: string | undefined;
  price?: string | undefined;
  currency?: string | undefined;
  availability: AvailabilityState;
  /** Atributos solo cuando la API los expone (talle, color, …). */
  attributes: Array<{ name: string; value: string }>;
}

export interface NormalizedSeo {
  title?: string | undefined;
  description?: string | undefined;
}

export interface NormalizedProduct {
  source: CommerceSource;
  externalId: string;
  auditId: string;
  storeId: string;
  name?: string | undefined;
  description?: string | undefined;
  /** URL pública si la API la entrega o puede derivarse del handle + dominio. */
  url?: string | undefined;
  status: ProductStatus;
  images: NormalizedImage[];
  variants: NormalizedVariant[];
  /** externalId de las categorías declaradas por la plataforma. */
  categoryIds: string[];
  price?: string | undefined;
  currency?: string | undefined;
  availability: AvailabilityState;
  sku?: string | undefined;
  brand?: string | undefined;
  seo?: NormalizedSeo | undefined;
  updatedAt?: string | undefined;
}

export interface NormalizedCategory {
  source: CommerceSource;
  externalId: string;
  auditId: string;
  storeId: string;
  name?: string | undefined;
  url?: string | undefined;
  parentId?: string | undefined;
  productIds: string[];
  description?: string | undefined;
  seo?: NormalizedSeo | undefined;
  updatedAt?: string | undefined;
}

/** Error de API registrado sin romper la auditoría completa. */
export interface CommerceApiError {
  at: string;
  scope: "auth" | "products" | "categories" | "store" | "rate-limit";
  message: string;
  status?: number | undefined;
}

/** Conexión con UNA tienda. Los tokens NUNCA se guardan aquí. */
export interface StoreConnection {
  source: CommerceSource;
  storeId: string;
  name?: string | undefined;
  domain?: string | undefined;
  status: StoreConnectionStatus;
  connectedAt: string;
  lastSyncAt?: string | undefined;
  error?: string | undefined;
  apiErrors: CommerceApiError[];
  /** Auditorías asociadas (histórico). Una tienda puede tener varias. */
  auditIds: string[];
}

/** Una importación = una tienda + una auditoría + una sincronización. */
export interface StoreImport {
  auditId: string;
  storeId: string;
  source: CommerceSource;
  syncedAt: string;
  /** Se incrementa en cada sincronización de la misma auditoría. */
  syncVersion: number;
  products: NormalizedProduct[];
  categories: NormalizedCategory[];
  errors: CommerceApiError[];
  /** Páginas consumidas de la API en la última sincronización. */
  apiPages: number;
}

export interface StoreImportCounts {
  products: number;
  publishedProducts: number;
  unavailableProducts: number;
  categories: number;
  variants: number;
  images: number;
  imagesWithoutAlt: number;
  productsWithoutCategory: number;
  productsWithoutUrl: number;
}

export function countImport(imp: StoreImport | undefined): StoreImportCounts {
  const products = imp?.products ?? [];
  const images = products.flatMap((p) => p.images);
  return {
    products: products.length,
    publishedProducts: products.filter((p) => p.status === "published").length,
    unavailableProducts: products.filter((p) => p.status === "unavailable").length,
    categories: imp?.categories.length ?? 0,
    variants: products.reduce((s, p) => s + p.variants.length, 0),
    images: images.length,
    imagesWithoutAlt: images.filter((i) => !i.alt || !i.alt.trim()).length,
    productsWithoutCategory: products.filter((p) => p.categoryIds.length === 0).length,
    productsWithoutUrl: products.filter((p) => !p.url).length,
  };
}

/* ------------------------- Claves estables ------------------------- */

/** Clave de deduplicación de entidad: storeId + externalId. */
export function entityKey(storeId: string, externalId: string): string {
  return `${storeId}::${externalId}`;
}

/** Clave de dato dependiente: storeId + externalId + childId. */
export function childKey(storeId: string, externalId: string, childId: string): string {
  return `${storeId}::${externalId}::${childId}`;
}

/* ------------------------- Matching con crawler ------------------------- */

export type MatchState =
  | "store-and-crawler"
  | "store-only"
  | "crawler-only"
  | "uncertain";

export const MATCH_STATE_LABELS: Record<MatchState, string> = {
  "store-and-crawler": "Entidad de la tienda con URL rastreada",
  "store-only": "Entidad de la tienda sin URL rastreada",
  "crawler-only": "URL rastreada sin entidad en la tienda",
  uncertain: "Correspondencia incierta (requiere revisión)",
};

export type MatchMethod = "normalized-url" | "connector-id" | "name-hint" | "none";

export const MATCH_METHOD_LABELS: Record<MatchMethod, string> = {
  "normalized-url": "URL normalizada",
  "connector-id": "Identificador de la plataforma",
  "name-hint": "Coincidencia de nombre (no confirmada)",
  none: "Sin método aplicable",
};

export interface CommerceMatch {
  auditId: string;
  storeId: string;
  entity: "product" | "category";
  externalId: string;
  name?: string | undefined;
  storeUrl?: string | undefined;
  pageId?: string | undefined;
  pageUrl?: string | undefined;
  state: MatchState;
  method: MatchMethod;
  detail: string;
}

export interface MatchSummary {
  matched: number;
  storeOnly: number;
  crawlerOnly: number;
  uncertain: number;
}

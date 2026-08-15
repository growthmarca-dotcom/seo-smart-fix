/**
 * FASE 7A — Modelo conceptual E-COMMERCE agnóstico de plataforma.
 *
 * Capa aditiva y derivada: NO rastrea, NO ejecuta el motor de reglas
 * (src/seo/rules.ts), NO toca el SEO Score, GSC, arquitectura ni contenido.
 * Solo interpreta lo que el crawler (o, en el futuro, cualquier conector que
 * entregue la misma estructura) ya dejó en la auditoría.
 *
 * Ninguna entidad existe fuera de un `auditId`: no hay estado compartido ni
 * comparaciones entre auditorías.
 */
import type { Category, PageType, Severity } from "../types";

/** Tipo de entidad e-commerce. Convive con `pageType` (Fase 3), no lo reemplaza. */
export type EcommerceType =
  | "store-home"
  | "category"
  | "subcategory"
  | "product"
  | "product-variant"
  | "collection"
  | "article"
  | "informational"
  | "cart"
  | "checkout"
  | "search"
  | "faceted"
  | "pagination"
  | "unknown";

export const ECOMMERCE_TYPE_LABELS: Record<EcommerceType, string> = {
  "store-home": "Home de tienda",
  category: "Categoría",
  subcategory: "Subcategoría",
  product: "Producto",
  "product-variant": "Variante de producto",
  collection: "Colección",
  article: "Artículo / blog",
  informational: "Informativa",
  cart: "Carrito",
  checkout: "Checkout",
  search: "Búsqueda interna",
  faceted: "Filtro / faceta",
  pagination: "Paginación",
  unknown: "Sin clasificar",
};

/** Confianza de una clasificación individual. */
export type EntityConfidence = "high" | "medium" | "low";

export const ENTITY_CONFIDENCE_LABELS: Record<EntityConfidence, string> = {
  high: "Confianza alta",
  medium: "Confianza media",
  low: "Confianza baja",
};

/** Jerarquía: distingue evidencia real de inferencia por URL. */
export type HierarchyConfidence = "confirmed" | "inferred" | "insufficient";

export const HIERARCHY_CONFIDENCE_LABELS: Record<HierarchyConfidence, string> = {
  confirmed: "Jerarquía confirmada por enlaces internos",
  inferred: "Jerarquía inferida por patrón de URL",
  insufficient: "Evidencia insuficiente",
};

/** Disponibilidad: nunca se asume, solo se reporta lo que llega. */
export type AvailabilityState = "in-stock" | "out-of-stock" | "discontinued" | "unknown";

export const AVAILABILITY_LABELS: Record<AvailabilityState, string> = {
  "in-stock": "Disponible",
  "out-of-stock": "Agotado temporalmente",
  discontinued: "Discontinuado",
  unknown: "Desconocida",
};

/** Señal usada por la detección de e-commerce a nivel sitio. */
export interface EcommerceDetectionSignal {
  id: string;
  label: string;
  detail: string;
  /** Aporte a la confianza (0-100). Ninguna señal débil alcanza por sí sola. */
  weight: number;
  occurrences: number;
}

export interface EcommerceDetection {
  auditId: string;
  isEcommerce: boolean;
  /** 0-100. */
  confidence: number;
  signals: EcommerceDetectionSignal[];
  /** Criterio aplicado, mostrado en la UI para que el resultado sea explicable. */
  criterion: string;
  counts: {
    productLike: number;
    categoryLike: number;
    productSchema: number;
    offerSchema: number;
    cartOrCheckout: number;
    categoryToProductLinks: number;
    connectorProductData: number;
  };
}

/** Página interpretada en clave e-commerce. */
export interface EcommercePage {
  auditId: string;
  pageId: string;
  url: string;
  path: string;
  ecommerceType: EcommerceType;
  confidence: EntityConfidence;
  pageType: PageType;
  contextLabel: string;
  parentPageId?: string | undefined;
  parentConfidence: HierarchyConfidence;
  categoryId?: string | undefined;
  productId?: string | undefined;
  canonical?: string | undefined;
  indexable: boolean;
  indexabilityNote: string;
  detectedSignals: string[];
  depth: number;
  statusCode: number;
  /** Hallazgos generales (Fase 1-3) ya existentes para esta URL: se referencian, no se duplican. */
  relatedFindingIds: string[];
}

export interface ProductSchemaStatus {
  hasProduct: boolean;
  hasOffer: boolean;
  hasAggregateRating: boolean;
  hasBreadcrumb: boolean;
  hasProductGroup: boolean;
  status: "missing" | "incomplete" | "present";
  /** Campos declarados por el conector y ausentes. Vacío si no hay datos de conector. */
  missingFields: string[];
}

export interface EcommerceProduct {
  auditId: string;
  pageId: string;
  url: string;
  path: string;
  name?: string | undefined;
  sku?: string | undefined;
  price?: string | undefined;
  currency?: string | undefined;
  availability: AvailabilityState;
  brand?: string | undefined;
  images: Array<{ src: string; alt?: string | undefined }>;
  description?: string | undefined;
  wordCount: number;
  schema: ProductSchemaStatus;
  categoryPageId?: string | undefined;
  categoryConfidence: HierarchyConfidence;
  inbound: number;
  orphanState: string;
  depth: number;
  indexable: boolean;
  isVariant: boolean;
  variantOfPageId?: string | undefined;
}

export interface EcommerceCategory {
  auditId: string;
  pageId: string;
  url: string;
  path: string;
  name?: string | undefined;
  isSubcategory: boolean;
  parentCategoryPageId?: string | undefined;
  parentConfidence: HierarchyConfidence;
  /** URLs de producto enlazadas realmente desde esta categoría. */
  productLinks: string[];
  wordCount: number;
  hasH1: boolean;
  /** Umbral contextual (Fase 3). null = el contexto no espera contenido propio. */
  minWords: number | null;
  inbound: number;
  outbound: number;
  depth: number;
  indexable: boolean;
  orphanState: string;
}

/** Clasificación de una señal e-commerce. */
export type EcommerceClass = "problem" | "improvement" | "review";

export const ECOMMERCE_CLASS_LABELS: Record<EcommerceClass, string> = {
  problem: "Problema",
  improvement: "Mejora",
  review: "Señal para revisar",
};

/** Regla/señal e-commerce declarativa. */
export interface EcommerceSignalDef {
  id: string;
  name: string;
  category: Category;
  classification: EcommerceClass;
  severity?: Severity | undefined;
  /** Tipos e-commerce a los que aplica. */
  ecommerceTypes: EcommerceType[];
  /** Tipos generales (Fase 3) compatibles. Vacío = sin restricción. */
  pageTypes?: PageType[] | undefined;
  explanation: string;
  recommendation: string;
  criterion: string;
  /** Datos mínimos; sin ellos la señal NO se evalúa (no se inventa evidencia). */
  requiresEvidence: string;
  /** Regla general existente que ya cubre el problema (se referencia, no se duplica). */
  reusesRuleId?: string | undefined;
}

export interface EcommerceFinding {
  id: string;
  auditId: string;
  pageId: string;
  pageUrl: string;
  pagePath: string;
  signalId: string;
  signalName: string;
  ecommerceType: EcommerceType;
  pageType: PageType;
  category: Category;
  classification: EcommerceClass;
  severity?: Severity | undefined;
  current: string;
  explanation: string;
  recommendation: string;
  criterion: string;
  evidence: string[];
  /** Diagnósticos generales ya existentes relacionados con esta URL. */
  relatedFindingIds: string[];
}

/** Grupo de URLs de faceta/filtro con el mismo patrón base. */
export interface FacetCluster {
  baseUrl: string;
  urls: string[];
  parameters: string[];
  indexableCount: number;
}

export interface PaginationSeries {
  baseUrl: string;
  urls: string[];
  maxPage: number;
  indexableCount: number;
  canonicalToFirst: number;
}

export interface VariantGroup {
  mainPageId?: string | undefined;
  mainUrl?: string | undefined;
  variantUrls: string[];
  hasProductGroupSchema: boolean;
  duplicateContent: boolean;
  canonicalCoverage: "all" | "partial" | "none";
}

export interface EcommerceStats {
  pages: number;
  products: number;
  categories: number;
  subcategories: number;
  collections: number;
  variants: number;
  facets: number;
  paginated: number;
  cartCheckout: number;
  productsWithSchema: number;
  productsWithoutInbound: number;
  productsWithoutCategory: number;
  categoriesWithoutProducts: number;
  problems: number;
  improvements: number;
  reviews: number;
}

export interface EcommerceAnalysis {
  auditId: string;
  detection: EcommerceDetection;
  pages: EcommercePage[];
  products: EcommerceProduct[];
  categories: EcommerceCategory[];
  findings: EcommerceFinding[];
  facets: FacetCluster[];
  pagination: PaginationSeries[];
  variants: VariantGroup[];
  /** Capacidades reales de datos disponibles en esta auditoría. */
  capabilities: {
    connectorPricing: boolean;
    connectorAvailability: boolean;
    schemaTypes: boolean;
    anchors: boolean;
  };
  stats: EcommerceStats;
}

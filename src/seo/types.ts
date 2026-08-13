/**
 * SEO Fixer — Modelos y tipos del núcleo.
 * Este archivo es agnóstico de plataforma: el motor universal trabaja
 * siempre sobre PageSnapshot, sin importar de dónde vengan los datos
 * (crawler web genérico, Tienda Nube, Mercado Libre, WordPress, etc.).
 */

export type Severity = "critical" | "important" | "improvement" | "ok";

export type Category =
  | "onpage"
  | "technical"
  | "structured-data"
  | "performance"
  | "local"
  | "content"
  | "authority";

/**
 * Naturaleza del hallazgo. Permite separar hechos verificables de
 * recomendaciones basadas en buenas prácticas del sector.
 * - technical: fallo técnico comprobable (HTTP, redirecciones, enlaces rotos).
 * - indexation: afecta directamente rastreo o indexación (noindex, robots, canonical).
 * - onpage: elemento on-page ausente o mal formado (hecho, no opinión).
 * - opportunity: oportunidad de contenido o enlazado interno.
 * - heuristic: recomendación basada en buenas prácticas, no una regla de Google.
 */
export type FindingKind = "technical" | "indexation" | "onpage" | "opportunity" | "heuristic";

export type PlatformId = "generic-web" | "tiendanube" | "mercadolibre";

export type PageType =
  | "home"
  | "product"
  | "category"
  | "article"
  | "landing"
  | "contact"
  | "other";

/** Cómo se descubrió una URL durante el rastreo. */
export type DiscoverySource = "seed" | "sitemap" | "internal-link" | "both";


/** Representación normalizada de una página / publicación / producto. */
export interface PageSnapshot {
  id: string;
  url: string;
  path: string;
  pageType: PageType;
  statusCode: number;
  redirectedFrom?: string[] | undefined;
  contentType?: string | undefined;
  title?: string | undefined;
  metaDescription?: string | undefined;
  h1: string[];
  h2: string[];
  h3: string[];
  wordCount: number;
  textSample?: string | undefined;
  contentHash?: string | undefined;
  images: Array<{
    src: string;
    alt?: string | undefined;
    fileName?: string | undefined;
    sizeKb?: number | undefined;
  }>;
  internalLinks: Array<{ href: string; anchor: string }>;
  externalLinks: number;
  canonical?: string | undefined;
  robotsMeta?: string | undefined;
  schemaTypes: string[];
  depth: number;
  hasViewport: boolean;
  htmlSizeKb?: number | undefined;
  responseMs?: number | undefined;
  /** Origen del descubrimiento de la URL (sitemap, enlace interno o ambos). */
  discoveredVia?: DiscoverySource | undefined;
  /** Señales locales detectadas (teléfono, dirección, horario). */
  localSignals?:
    | { phone?: string | undefined; address?: string | undefined; openingHours?: boolean }
    | undefined;
  /** Metadatos del conector de origen (id de producto, categoría, etc.). */
  source?: Record<string, string | number | boolean | undefined> | undefined;
}

/** Motivo por el que una URL descubierta no se analizó. */
export type ExclusionReason =
  | "limit-reached"
  | "robots-disallow"
  | "non-html"
  | "external-host"
  | "duplicate-normalized"
  | "fetch-error";

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  "limit-reached": "Fuera del límite de rastreo",
  "robots-disallow": "Bloqueada por robots.txt",
  "non-html": "Recurso no HTML",
  "external-host": "Fuera del dominio",
  "duplicate-normalized": "Duplicada tras normalizar",
  "fetch-error": "Error al descargar",
};

/** Cobertura del rastreo: qué se descubrió, analizó, excluyó y falló. */
export interface CrawlCoverage {
  limit: number;
  limitReached: boolean;
  respectRobots: boolean;
  robotsTxtFound: boolean;
  robotsRulesApplied: number;
  sitemapsFound: string[];
  urlsFromSitemap: number;
  urlsFromLinks: number;
  urlsFromBoth: number;
  discovered: number;
  analyzed: number;
  excluded: Array<{ url: string; reason: ExclusionReason; detail?: string | undefined }>;
  errors: Array<{ url: string; reason: string }>;
  redirects: Array<{ from: string; to: string; status: number }>;
}


/** Contexto del sitio: lo que solo se sabe mirando todas las páginas. */
export interface SiteContext {
  rootUrl: string;
  platform: PlatformId;
  robotsTxt?:
    | { found: boolean; disallowsAll?: boolean | undefined; sitemapDeclared?: boolean | undefined }
    | undefined;
  sitemap?: { found: boolean; urlCount?: number | undefined; url?: string | undefined } | undefined;
  pages: PageSnapshot[];
  brokenLinks?: Array<{ from: string; to: string; status: number }> | undefined;
}

export interface Finding {
  id: string;
  ruleId: string;
  ruleName: string;
  pageId: string;
  pageUrl: string;
  category: Category;
  severity: Severity;
  /** 1-10, cuánto puede afectar rastreo/indexación/posicionamiento. */
  impact: number;
  field?: string | undefined;
  current: string;
  problem: string;
  explanation: string;
  suggestion?: string | undefined;
}

export type ChangeStatus = "pending" | "approved" | "rejected" | "applied";

export interface ChangeProposal {
  id: string;
  auditId: string;
  findingId: string;
  pageId: string;
  pageUrl: string;
  field: string;
  category: Category;
  severity: Severity;
  currentValue: string;
  suggestedValue: string;
  editedValue?: string | undefined;
  status: ChangeStatus;
  /** ¿El conector de origen permite escribir este campo? */
  writable: boolean;
  createdAt: string;
  updatedAt: string;
  note?: string | undefined;
}

export interface CategoryScore {
  category: Category;
  score: number;
  weight: number;
  findings: number;
}

export interface SeoScore {
  total: number;
  categories: CategoryScore[];
}

export type AuditStatus = "queued" | "discovering" | "analyzing" | "done" | "error";

export interface AuditProgress {
  discovered: number;
  analyzed: number;
  issues: number;
  message?: string | undefined;
}

export interface Audit {
  id: string;
  name: string;
  platform: PlatformId;
  rootUrl: string;
  isDemo: boolean;
  status: AuditStatus;
  createdAt: string;
  finishedAt?: string | undefined;
  crawlLimit: number;
  respectRobots: boolean;
  progress: AuditProgress;
  pages: PageSnapshot[];
  findings: Finding[];
  score?: SeoScore | undefined;
  error?: string | undefined;
  sitemapFound?: boolean | undefined;
  robotsFound?: boolean | undefined;
}

export interface HistoryEntry {
  id: string;
  at: string;
  auditId: string;
  action: string;
  detail: string;
}

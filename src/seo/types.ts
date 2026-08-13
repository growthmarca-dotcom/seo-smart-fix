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

export type PlatformId = "generic-web" | "tiendanube" | "mercadolibre";

export type PageType =
  | "home"
  | "product"
  | "category"
  | "article"
  | "landing"
  | "contact"
  | "other";

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
  /** Señales locales detectadas (teléfono, dirección, horario). */
  localSignals?:
    | { phone?: string | undefined; address?: string | undefined; openingHours?: boolean }
    | undefined;
  /** Metadatos del conector de origen (id de producto, categoría, etc.). */
  source?: Record<string, string | number | boolean | undefined> | undefined;
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

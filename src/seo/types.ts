import type { EvidenceItem } from "./evidence";

/**
 * SEO Fixer — Modelos y tipos del núcleo.
 * Este archivo es agnóstico de plataforma: el motor universal trabaja
 * siempre sobre PageSnapshot, sin importar de dónde vengan los datos
 * (crawler web genérico, Tienda Nube, Mercado Libre, WordPress, etc.).
 */

export type Severity = "critical" | "important" | "improvement" | "ok";

export type Category =
  "onpage" | "technical" | "structured-data" | "performance" | "local" | "content" | "authority";

/**
 * Naturaleza del hallazgo. Permite separar hechos verificables de
 * recomendaciones basadas en buenas prácticas del sector.
 * - technical: fallo técnico comprobable (HTTP, redirecciones, enlaces rotos).
 * - indexation: afecta directamente rastreo o indexación (noindex, robots, canonical).
 * - onpage: elemento on-page ausente o mal formado (hecho, no opinión).
 * - content: calidad o duplicación de contenido.
 * - structure: arquitectura, profundidad y enlazado interno.
 * - images: imágenes, ALT y nombres de archivo.
 * - opportunity: oportunidad de contenido o enlazado interno.
 * - heuristic: recomendación basada en buenas prácticas, no una regla de Google.
 */
export type FindingKind =
  | "technical"
  | "indexation"
  | "onpage"
  | "content"
  | "structure"
  | "images"
  | "opportunity"
  | "heuristic";

export type PlatformId = "generic-web" | "tiendanube" | "mercadolibre";

export type PageType =
  "home" | "product" | "category" | "article" | "landing" | "contact" | "other";

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
  /** Encabezado HTTP X-Robots-Tag, si la respuesta lo trae. */
  xRobotsTag?: string | undefined;
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

/** Estado de robots.txt detectado en el rastreo. */
export type RobotsState =
  "missing" | "empty" | "valid" | "invalid" | "fetch-error" | "disallow-all";

export const ROBOTS_STATE_LABELS: Record<RobotsState, string> = {
  missing: "robots.txt inexistente (HTTP 404)",
  empty: "robots.txt accesible pero sin directivas",
  valid: "robots.txt válido",
  invalid: "robots.txt con contenido no válido",
  "fetch-error": "robots.txt no se pudo leer",
  "disallow-all": "robots.txt bloquea todo el sitio (Disallow: /)",
};

export interface RobotsReport {
  state: RobotsState;
  /** Se encontró un archivo servido en /robots.txt. */
  found: boolean;
  /** Directivas aplicables a nuestro user-agent. */
  groupsFound: number;
  userAgentGroup?: string | undefined;
  disallow: string[];
  allow: string[];
  sitemaps: string[];
  /** Líneas que no se pudieron interpretar. */
  parseWarnings: string[];
  /** true si el crawler aplicó realmente las reglas. */
  applied: boolean;
  /** Política efectiva usada en el rastreo (auditorías antiguas: ausente). */
  policy?: RobotsPolicy | undefined;
}

export type RobotsPolicy = "apply" | "no-rules" | "ignored" | "restricted-unverified";

export const ROBOTS_POLICY_LABELS: Record<RobotsPolicy, string> = {
  apply: "Se respetaron las reglas de robots.txt para el agente SEOFixerBot",
  "no-rules": "Sin reglas aplicables (archivo inexistente o vacío): se rastreó sin restricciones",
  ignored: "El usuario desactivó el respeto de robots.txt para esta auditoría",
  "restricted-unverified": "robots.txt no se pudo leer o interpretar: por precaución solo se analizó la página de inicio",
};

/** Tipo de documento sitemap procesado. */
export type SitemapKind = "sitemap" | "index" | "child" | "inaccessible" | "invalid";

export const SITEMAP_KIND_LABELS: Record<SitemapKind, string> = {
  sitemap: "Sitemap",
  index: "Sitemap index",
  child: "Sitemap hijo",
  inaccessible: "Sitemap inaccesible",
  invalid: "Sitemap inválido",
};

export interface SitemapDoc {
  url: string;
  kind: SitemapKind;
  urlCount: number;
  status?: number | undefined;
  detail?: string | undefined;
}

/** Clasificación del estado de un enlace verificado. */
export type LinkStatusClass =
  | "ok"
  | "redirect"
  | "not-found"
  | "gone"
  | "forbidden"
  | "rate-limited"
  | "server-error"
  | "timeout"
  | "network-error"
  | "unknown";

export const LINK_STATUS_LABELS: Record<LinkStatusClass, string> = {
  ok: "Válida",
  redirect: "Redirección",
  "not-found": "404 no encontrada",
  gone: "410 eliminada",
  forbidden: "403 prohibida",
  "rate-limited": "429 límite de peticiones",
  "server-error": "Error 5xx del servidor",
  timeout: "Timeout",
  "network-error": "Error de conexión",
  unknown: "Sin verificar",
};

/** Estados que se consideran rotura definitiva del enlace. */
export const DEFINITIVE_BROKEN: LinkStatusClass[] = ["not-found", "gone"];

export interface LinkCheck {
  url: string;
  status: number;
  statusClass: LinkStatusClass;
  /** URL final si hubo redirección. */
  finalUrl?: string | undefined;
  /** true cuando el fallo puede ser temporal (429, 5xx, timeout). */
  temporary: boolean;
  from: string[];
}

/** Registro de una URL modificada al normalizar. */
export interface NormalizationRecord {
  from: string;
  to: string;
  reasons: string[];
}

/** Motivo por el que una URL descubierta no se analizó. */
export type ExclusionReason =
  | "limit-reached"
  | "robots-disallow"
  | "robots-unverified"
  | "non-html"
  | "external-host"
  | "duplicate-normalized"
  | "fetch-error"
  | "not-html-response";

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  "limit-reached": "Fuera del límite de rastreo",
  "robots-disallow": "Bloqueada por robots.txt",
  "robots-unverified": "No rastreada: robots.txt no verificable",
  "non-html": "Recurso no HTML",
  "external-host": "Fuera del dominio",
  "duplicate-normalized": "Duplicada tras normalizar",
  "fetch-error": "Error al descargar",
  "not-html-response": "La respuesta no era HTML",
};

/** Cobertura del rastreo: qué se descubrió, analizó, excluyó y falló. */
export interface CrawlCoverage {
  limit: number;
  limitReached: boolean;
  respectRobots: boolean;
  robotsTxtFound: boolean;
  robotsRulesApplied: number;
  /** Informe detallado de robots.txt. */
  robots?: RobotsReport | undefined;
  /** Sitemaps procesados con su tipo y cantidad de URLs. */
  sitemapDocs?: SitemapDoc[] | undefined;
  /** URLs descubiertas y no analizadas por haberse agotado el límite. */
  pending?: number | undefined;
  /** URLs bloqueadas por robots.txt. */
  blocked?: number | undefined;
  /** Porcentaje analizadas / descubiertas. */
  coveragePct?: number | undefined;
  /** URLs cuya forma canónica difería de la encontrada. */
  normalizations?: NormalizationRecord[] | undefined;
  /** Resultado de las verificaciones de enlaces. */
  linkChecks?: LinkCheck[] | undefined;
  /** Verificaciones de enlaces realizadas / presupuesto disponible. */
  linkChecksUsed?: number | undefined;
  linkCheckBudget?: number | undefined;
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
    | {
        found: boolean;
        disallowsAll?: boolean | undefined;
        sitemapDeclared?: boolean | undefined;
        state?: RobotsState | undefined;
      }
    | undefined;
  sitemap?:
    | {
        found: boolean;
        urlCount?: number | undefined;
        url?: string | undefined;
        docs?: SitemapDoc[] | undefined;
      }
    | undefined;
  pages: PageSnapshot[];
  brokenLinks?:
    | Array<{
        from: string;
        to: string;
        status: number;
        statusClass?: LinkStatusClass | undefined;
        temporary?: boolean | undefined;
      }>
    | undefined;
  coverage?: CrawlCoverage | undefined;
}

export interface Finding {
  id: string;
  ruleId: string;
  ruleName: string;
  pageId: string;
  pageUrl: string;
  category: Category;
  /** Naturaleza del hallazgo: hecho técnico, indexación, on-page, oportunidad o heurística. */
  kind: FindingKind;
  severity: Severity;
  /** 1-10, cuánto puede afectar rastreo/indexación/posicionamiento. */
  impact: number;
  field?: string | undefined;
  current: string;
  problem: string;
  explanation: string;
  suggestion?: string | undefined;
  /** Evidencia adicional (enlaces rotos, URLs duplicadas, imágenes afectadas). */
  evidence?: EvidenceItem[] | undefined;
}

export type ChangeStatus = "pending" | "approved" | "rejected" | "applied";

export interface ChangeEvent {
  at: string;
  status: ChangeStatus;
  detail?: string | undefined;
}

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
  /** Historial de estados de la propuesta. */
  history?: ChangeEvent[] | undefined;
}

export interface CategoryScore {
  category: Category;
  score: number;
  weight: number;
  findings: number;
  /** Penalización ponderada acumulada de la categoría (0-100). */
  penalty: number;
  /** Cantidad de comprobaciones aplicables en la categoría. */
  checks: number;
}

/** Acción con mayor impacto sobre el score. */
export interface ScoreDriver {
  ruleId: string;
  ruleName: string;
  category: Category;
  kind: FindingKind;
  severity: Severity;
  occurrences: number;
  /** Puntos de score que se recuperan aproximadamente al resolverlo. */
  points: number;
}

/** Score por naturaleza del problema (técnico, indexación, on-page, ...). */
export interface KindScore {
  kind: FindingKind;
  score: number;
  findings: number;
}

export interface SeoScore {
  total: number;
  categories: CategoryScore[];
  /** Salud por naturaleza del hallazgo. Opcional para auditorías guardadas antes. */
  kinds?: KindScore[] | undefined;
  /** Explicación de las acciones con mayor impacto en el score. */
  drivers: ScoreDriver[];
  pagesAnalyzed: number;
  method: string;
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
  coverage?: CrawlCoverage | undefined;
}

export interface HistoryEntry {
  id: string;
  at: string;
  auditId: string;
  action: string;
  detail: string;
}

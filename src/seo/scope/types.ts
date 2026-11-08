/**
 * Etapa 1 — Contratos del clasificador heurístico de URLs (capa aditiva).
 *
 * Solo DESCRIBE señales. Ningún tipo de este archivo decide incluir o excluir
 * una URL del alcance: esa decisión es humana y llega en etapas posteriores.
 * Los nombres evitan colisionar con `ExclusionReason` de `src/seo/types.ts`
 * (exclusiones del crawler), que no se toca.
 */

/** Estado tri-valor: "unknown" cuando los datos guardados no alcanzan para afirmarlo. */
export type TriState = "yes" | "no" | "unknown";

/**
 * Contexto de navegación. El crawler actual NO conserva si un enlace estaba en
 * <nav>, <header> o <footer>; por eso esos tres quedan siempre "unknown" y solo
 * se ofrece una señal APROXIMADA (enlace recurrente en muchas páginas).
 */
export interface NavigationSignals {
  inMainNav: TriState;
  inHeader: TriState;
  inFooter: TriState;
  /** Aproximación: enlazada desde ≥ 50 % de las páginas con enlaces (≥ 3 páginas). No confirma menú. */
  recurringLinkApprox: boolean;
  /** Páginas distintas que la enlazan. */
  linkingPagesCount: number;
  /** Profundidad de rastreo registrada (no equivale a pertenecer al menú). */
  crawlDepth: number;
  limitation: string;
}

export interface SitemapSignal {
  /** "yes" solo con evidencia explícita; nunca "no" sin lista explícita del sitemap. */
  inSitemap: TriState;
  source: "explicit-list" | "discovery-record" | "none";
}

export interface IndexabilitySignals {
  hasNoindexDirective: boolean;
  /** Canonical declarada que apunta a otra URL. No es noindex. */
  hasCanonicalConflict: boolean;
  /** Solo por directiva noindex o HTTP fuera de 2xx; la canonical NO lo activa. */
  isNonIndexable: boolean;
  canonicalTarget?: string | undefined;
}

export interface PossibleDuplicateSignals {
  /** Slug con sufijo numérico (-1, -2…) o copia/copy. Señal, no confirmación. */
  hasNumericSuffix: boolean;
  /** Otras URLs con el mismo title normalizado (no vacío). */
  sharesTitleWithCount: number;
  /** true si alguna de las dos señales anteriores aparece. Siempre "posible". */
  possibleDuplicate: boolean;
}

export interface PossibleResidualSignals {
  /** Coincidencia léxica con slugs de prueba/borrador conocidos. */
  matchesResidualToken: boolean;
  matchedToken?: string | undefined;
  /** Title genérico de plantilla CMS ("Página", "Untitled"…). */
  hasPlaceholderTitle: boolean;
  possibleResidual: boolean;
}

export interface UrlClassification {
  url: string;
  key: string;
  path: string;
  statusCode: number;
  isSeed: boolean;
  navigation: NavigationSignals;
  sitemap: SitemapSignal;
  inboundLinksCount: number;
  /** 0 enlaces internos entrantes y no es la raíz. Hecho de arquitectura, no residual. */
  isOrphan: boolean;
  duplicates: PossibleDuplicateSignals;
  residual: PossibleResidualSignals;
  indexability: IndexabilitySignals;
  /** HTTP 401/403. */
  isRestricted: boolean;
  /** HTTP 2xx con contenido HTML legible. */
  hasSufficientData: boolean;
}

export interface ClassifyOptions {
  /** Lista explícita de URLs del sitemap, si se dispone. Habilita "no". */
  sitemapUrls?: readonly string[] | undefined;
}

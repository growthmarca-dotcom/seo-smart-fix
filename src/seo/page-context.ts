/**
 * FASE 3 — Cobertura contextual de reglas On-Page (capa derivada, solo lectura).
 * Usa los perfiles de page-profiles.ts y las reglas existentes para saber
 * qué reglas se aplican a una página y cuáles se omiten por su contexto.
 */
import { RULES, rulesForPlatform, type SeoRule } from "./rules";
import { PAGE_PROFILES, ruleMatchesPageType } from "./page-profiles";
import type { PageSnapshot, PageType } from "./types";

export * from "./page-profiles";

export interface RuleCoverage {
  applied: SeoRule[];
  /** Reglas omitidas porque su contexto no corresponde a este tipo de página. */
  skippedByContext: SeoRule[];
}

/**
 * Reglas evaluadas y omitidas por contexto para una página concreta.
 * Se calcula con las mismas funciones que usa el motor, así que la UI
 * no puede desincronizarse del comportamiento real.
 */
export function ruleCoverageFor(
  page: PageSnapshot,
  platformTags: string[] = [],
  disabledRules: string[] = [],
): RuleCoverage {
  const rules = rulesForPlatform(platformTags).filter((r) => !disabledRules.includes(r.id));
  const applied: SeoRule[] = [];
  const skippedByContext: SeoRule[] = [];
  for (const rule of rules) {
    if (!ruleMatchesPageType(rule, page)) {
      skippedByContext.push(rule);
      continue;
    }
    if (rule.appliesTo && !rule.appliesTo(page)) {
      skippedByContext.push(rule);
      continue;
    }
    applied.push(rule);
  }
  return { applied, skippedByContext };
}

/** Reglas que declaran contexto por tipo de página (para la pantalla de reglas). */
export function contextualRules() {
  return RULES.filter((r) => r.pageTypes || r.excludedPageTypes);
}

export const PAGE_CONTEXT_LABELS: Record<PageType | "institutional", string> = {
  home: PAGE_PROFILES.home.label,
  category: PAGE_PROFILES.category.label,
  product: PAGE_PROFILES.product.label,
  article: PAGE_PROFILES.article.label,
  landing: PAGE_PROFILES.landing.label,
  contact: PAGE_PROFILES.contact.label,
  institutional: PAGE_PROFILES.institutional.label,
  other: PAGE_PROFILES.other.label,
};

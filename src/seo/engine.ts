/**
 * Audit Engine universal. Entrada: SiteContext (páginas normalizadas).
 * Salida: hallazgos priorizados + SEO Score ponderado.
 * No conoce ninguna plataforma en particular.
 */
import { CATEGORY_WEIGHTS, rulesForPlatform } from "./rules";
import type { Category, Finding, SeoScore, Severity, SiteContext } from "./types";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  important: 1,
  improvement: 2,
  ok: 3,
};

const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 22,
  important: 10,
  improvement: 3,
  ok: 0,
};

export function runAudit(site: SiteContext, platformTags: string[] = []) {
  const rules = rulesForPlatform(platformTags);
  const findings: Finding[] = [];

  for (const page of site.pages) {
    for (const rule of rules) {
      if (rule.appliesTo && !rule.appliesTo(page)) continue;
      let result = null;
      try {
        result = rule.check(page, site);
      } catch {
        result = null;
      }
      if (!result) continue;
      findings.push({
        id: `${page.id}:${rule.id}`,
        ruleId: rule.id,
        ruleName: rule.name,
        pageId: page.id,
        pageUrl: page.url,
        category: rule.category,
        severity: result.severity ?? rule.severity,
        impact: rule.impact,
        field: rule.field,
        current: result.current,
        problem: result.problem,
        explanation: rule.explanation,
        suggestion: result.suggestion,
      });
    }
  }

  return { findings: prioritize(findings), score: computeScore(site, findings) };
}

/** Prioriza por severidad, luego por impacto estimado. */
export function prioritize(findings: Finding[]) {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      b.impact - a.impact ||
      a.pageUrl.localeCompare(b.pageUrl),
  );
}

export function computeScore(site: SiteContext, findings: Finding[]): SeoScore {
  const pageCount = Math.max(site.pages.length, 1);
  const categories = (Object.keys(CATEGORY_WEIGHTS) as Category[])
    .filter((c) => CATEGORY_WEIGHTS[c] > 0)
    .map((category) => {
      const catFindings = findings.filter((f) => f.category === category);
      const penalty = catFindings.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);
      const score = Math.max(0, Math.round(100 - penalty / pageCount));
      return { category, score, weight: CATEGORY_WEIGHTS[category], findings: catFindings.length };
    });

  const total = Math.round(
    categories.reduce((sum, c) => sum + c.score * c.weight, 0) /
      categories.reduce((sum, c) => sum + c.weight, 0),
  );

  return { total, categories };
}

export function countBySeverity(findings: Finding[]) {
  return findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    },
    { critical: 0, important: 0, improvement: 0, ok: 0 } as Record<Severity, number>,
  );
}

export function scoreLabel(score: number) {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Bueno";
  if (score >= 50) return "Regular";
  return "Crítico";
}

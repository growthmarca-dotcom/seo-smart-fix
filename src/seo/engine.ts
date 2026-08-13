/**
 * Audit Engine universal. Entrada: SiteContext (páginas normalizadas).
 * Salida: hallazgos priorizados + SEO Score ponderado por categoría y severidad.
 * No conoce ninguna plataforma en particular.
 */
import { CATEGORY_WEIGHTS, rulesForPlatform } from "./rules";
import type {
  Category,
  CategoryScore,
  Finding,
  FindingKind,
  ScoreDriver,
  SeoScore,
  Severity,
  SiteContext,
} from "./types";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  important: 1,
  improvement: 2,
  ok: 3,
};

/** Peso base por severidad. */
const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 24,
  important: 10,
  improvement: 3,
  ok: 0,
};

/**
 * Factor por naturaleza del hallazgo: los hechos técnicos y de indexación
 * pesan completo; las recomendaciones heurísticas pesan bastante menos porque
 * no son reglas del buscador.
 */
const KIND_FACTOR: Record<FindingKind, number> = {
  indexation: 1,
  technical: 1,
  onpage: 0.85,
  opportunity: 0.6,
  heuristic: 0.35,
};

/** Saturación: evita que una categoría caiga a 0 por muchos avisos menores. */
const SATURATION = 14;

export const SCORE_METHOD =
  "Score ponderado por categoría, severidad, impacto estimado y naturaleza del hallazgo, normalizado por cantidad de páginas analizadas. Es una guía de priorización interna: no predice ni garantiza posiciones en Google.";

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
        kind: rule.kind,
        severity: result.severity ?? rule.severity,
        impact: rule.impact,
        field: rule.field,
        current: result.current,
        problem: result.problem,
        explanation: rule.explanation,
        suggestion: result.suggestion,
        evidence: result.evidence,
      });
    }
  }

  return {
    findings: prioritize(findings),
    score: computeScore(site, findings, platformTags),
  };
}

/** Prioriza por severidad, luego por impacto y naturaleza (hechos antes que heurísticas). */
export function prioritize(findings: Finding[]) {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      b.impact * KIND_FACTOR[b.kind] - a.impact * KIND_FACTOR[a.kind] ||
      a.pageUrl.localeCompare(b.pageUrl),
  );
}

function penaltyOf(f: Finding) {
  return SEVERITY_PENALTY[f.severity] * (f.impact / 10) * KIND_FACTOR[f.kind];
}

/** Penalización 0-100 saturada y normalizada por páginas analizadas. */
function categoryScoreFrom(raw: number, pages: number) {
  const per = raw / Math.max(1, pages);
  const penalty = (100 * per) / (per + SATURATION);
  return { penalty: Math.round(penalty), score: Math.max(0, Math.round(100 - penalty)) };
}

export function computeScore(
  site: SiteContext,
  findings: Finding[],
  platformTags: string[] = [],
): SeoScore {
  const pages = Math.max(site.pages.length, 1);
  const rules = rulesForPlatform(platformTags);

  const categories: CategoryScore[] = (Object.keys(CATEGORY_WEIGHTS) as Category[])
    .filter((c) => CATEGORY_WEIGHTS[c] > 0)
    .map((category) => {
      const catFindings = findings.filter((f) => f.category === category);
      const raw = catFindings.reduce((sum, f) => sum + penaltyOf(f), 0);
      const { score, penalty } = categoryScoreFrom(raw, pages);
      return {
        category,
        score,
        penalty,
        weight: CATEGORY_WEIGHTS[category],
        findings: catFindings.length,
        checks: rules.filter((r) => r.category === category).length,
      };
    })
    .filter((c) => c.checks > 0);

  const weightSum = categories.reduce((sum, c) => sum + c.weight, 0) || 1;
  const total = Math.round(categories.reduce((sum, c) => sum + c.score * c.weight, 0) / weightSum);

  return {
    total,
    categories,
    drivers: computeDrivers(findings, categories, pages, weightSum),
    pagesAnalyzed: site.pages.length,
    method: SCORE_METHOD,
  };
}

/**
 * Calcula, regla por regla, cuántos puntos de score se recuperarían al
 * resolverla. Permite explicar el score en lugar de solo contar errores.
 */
function computeDrivers(
  findings: Finding[],
  categories: CategoryScore[],
  pages: number,
  weightSum: number,
): ScoreDriver[] {
  const byRule = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byRule.get(f.ruleId);
    if (list) list.push(f);
    else byRule.set(f.ruleId, [f]);
  }

  const drivers: ScoreDriver[] = [];
  for (const [ruleId, list] of byRule) {
    const first = list[0];
    if (!first) continue;
    const cat = categories.find((c) => c.category === first.category);
    if (!cat) continue;
    const catFindings = findings.filter((f) => f.category === first.category);
    const rawAll = catFindings.reduce((sum, f) => sum + penaltyOf(f), 0);
    const rawWithout = catFindings
      .filter((f) => f.ruleId !== ruleId)
      .reduce((sum, f) => sum + penaltyOf(f), 0);
    const gain =
      ((categoryScoreFrom(rawWithout, pages).score - categoryScoreFrom(rawAll, pages).score) *
        cat.weight) /
      weightSum;
    const worst = list.reduce(
      (acc, f) => (SEVERITY_ORDER[f.severity] < SEVERITY_ORDER[acc.severity] ? f : acc),
      first,
    );
    drivers.push({
      ruleId,
      ruleName: first.ruleName,
      category: first.category,
      kind: first.kind,
      severity: worst.severity,
      occurrences: list.length,
      points: Math.round(gain * 10) / 10,
    });
  }

  return drivers.sort((a, b) => b.points - a.points || b.occurrences - a.occurrences).slice(0, 8);
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

export function countByKind(findings: Finding[]) {
  return findings.reduce(
    (acc, f) => {
      acc[f.kind] = (acc[f.kind] ?? 0) + 1;
      return acc;
    },
    { technical: 0, indexation: 0, onpage: 0, opportunity: 0, heuristic: 0 } as Record<
      FindingKind,
      number
    >,
  );
}

export function scoreLabel(score: number) {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Bueno";
  if (score >= 50) return "Regular";
  return "Crítico";
}

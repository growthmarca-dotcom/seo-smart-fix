/**
 * Madurez, cobertura y suficiencia del diagnóstico integral.
 * - "Sin evaluar", "Sin datos" y "No aplica" nunca valen cero.
 * - "Sin datos" cuenta como no cubierto; "No aplica" se excluye solo con justificación.
 * - Integraciones no cuentan hasta conectarse.
 * - El SEO entra como UN indicador (0–1) del control "web-seo-health".
 * - NO se redistribuyen pesos: si falta información, el resultado es "Diagnóstico parcial" sin índice.
 */
import type { Industry } from "@/companies/model";
import { DIMENSIONS, controlsFor, type DimensionId } from "./dimensions";
import { isJustifiedNotApplicable, type CompanyDiagnosis } from "./model";
import { SUFFICIENCY, criticalControlsFor, weightsFor } from "./weights";

/** Cobertura mínima para considerar una dimensión con madurez representativa (propuesto). */
export const MIN_COVERAGE = SUFFICIENCY.minRelevantCoverage;
export const SEO_CONTROL_ID = "web-seo-health";

export interface DimensionResult {
  id: DimensionId;
  title: string;
  /** Controles evaluables (excluye No aplica justificado e integraciones). */
  applicable: number;
  evaluated: number;
  noData: number;
  coverage: number; // 0–1
  /** 0–100 sobre lo evaluado, o undefined si no hay nada evaluado. */
  maturity: number | undefined;
  sufficient: boolean;
  needsImprovement: string[];
}

export interface DiagnosisInputs {
  /** Puntuación SEO 0–100 de la auditoría asociada más reciente, si existe. */
  seoScore?: number | undefined;
}

export function dimensionResults(industry: Industry, d: CompanyDiagnosis | undefined, inputs: DiagnosisInputs = {}): DimensionResult[] {
  return DIMENSIONS.map((dim) => {
    let applicable = 0;
    let evaluated = 0;
    let noData = 0;
    let sum = 0;
    const needsImprovement: string[] = [];
    for (const c of controlsFor(industry, dim.id)) {
      if (c.source === "integration") continue;
      if (c.id === SEO_CONTROL_ID) {
        applicable++;
        if (inputs.seoScore !== undefined) {
          evaluated++;
          sum += Math.max(0, Math.min(100, inputs.seoScore)) / 100;
        }
        continue;
      }
      const s = d?.controls[c.id];
      const st = s?.status ?? "unevaluated";
      if (st === "not-applicable" && s && isJustifiedNotApplicable(s)) continue;
      applicable++;
      if (st === "no-data") { noData++; continue; }
      if (st !== "meets" && st !== "needs-improvement") continue;
      evaluated++;
      if (st === "meets") sum += 1;
      else needsImprovement.push(c.id);
    }
    const coverage = applicable ? evaluated / applicable : 0;
    return {
      id: dim.id,
      title: dim.title,
      applicable,
      evaluated,
      noData,
      coverage,
      maturity: evaluated ? Math.round((sum / evaluated) * 100) : undefined,
      sufficient: applicable > 0 && coverage >= MIN_COVERAGE,
      needsImprovement,
    };
  });
}

export interface GlobalIndex {
  status: "complete" | "partial";
  /** 0–100 solo cuando status = "complete". Nunca se calcula con pesos redistribuidos. */
  value: number | undefined;
  /** Cobertura total (evaluados / aplicables), siempre visible. */
  totalCoverage: number;
  /** Controles críticos del rubro aún sin evaluar (o con "Sin datos"). */
  missingCritical: string[];
  /** Motivos legibles por los que el diagnóstico es parcial. */
  reasons: string[];
}

export function globalIndex(
  industry: Industry,
  results: DimensionResult[],
  d?: CompanyDiagnosis | undefined,
  inputs: DiagnosisInputs = {},
): GlobalIndex {
  const w = weightsFor(industry);
  const applicable = results.reduce((s, r) => s + r.applicable, 0);
  const evaluated = results.reduce((s, r) => s + r.evaluated, 0);
  const totalCoverage = applicable ? evaluated / applicable : 0;
  const reasons: string[] = [];

  if (totalCoverage < SUFFICIENCY.minTotalCoverage)
    reasons.push(`Cobertura total ${Math.round(totalCoverage * 100)} % (mínimo propuesto ${SUFFICIENCY.minTotalCoverage * 100} %).`);

  for (const r of results) {
    if (r.applicable === 0) continue;
    if (w[r.id] >= SUFFICIENCY.relevantWeight && r.coverage < SUFFICIENCY.minRelevantCoverage)
      reasons.push(`«${r.title}» con cobertura ${Math.round(r.coverage * 100)} % (mínimo propuesto ${SUFFICIENCY.minRelevantCoverage * 100} %).`);
    else if (r.maturity === undefined) reasons.push(`«${r.title}» sin controles evaluados.`);
  }

  const relevantIds = new Set(controlsFor(industry).map((c) => c.id));
  const missingCritical = criticalControlsFor(industry).filter((id) => {
    if (!relevantIds.has(id)) return false;
    if (id === SEO_CONTROL_ID) return inputs.seoScore === undefined;
    const s = d?.controls[id];
    if (!s) return true;
    if (s.status === "not-applicable") return !isJustifiedNotApplicable(s);
    return s.status !== "meets" && s.status !== "needs-improvement";
  });
  if (missingCritical.length) reasons.push(`Faltan controles críticos del rubro: ${missingCritical.join(", ")}.`);

  if (reasons.length) return { status: "partial", value: undefined, totalCoverage, missingCritical, reasons };

  const used = results.filter((r) => r.applicable > 0);
  const wsum = used.reduce((s, r) => s + w[r.id], 0);
  const value = Math.round(used.reduce((s, r) => s + r.maturity! * w[r.id], 0) / wsum);
  return { status: "complete", value, totalCoverage, missingCritical, reasons };
}

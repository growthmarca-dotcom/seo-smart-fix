/**
 * Madurez, cobertura e índice global del diagnóstico integral.
 * - "Sin evaluar" y "No aplica" no suman ni restan.
 * - Controles de origen "integration" se informan pero no cuentan hasta conectarse.
 * - El SEO entra como UN indicador (0–1) del control "web-seo-health".
 * - Una dimensión con cobertura < MIN_COVERAGE queda "incompleta" y no entra al índice global.
 */
import type { Industry } from "@/companies/model";
import { DIMENSIONS, controlsFor, type DimensionId } from "./dimensions";
import type { CompanyDiagnosis } from "./model";
import { weightsFor } from "./weights";

export const MIN_COVERAGE = 0.5;
export const SEO_CONTROL_ID = "web-seo-health";

export interface DimensionResult {
  id: DimensionId;
  title: string;
  /** Controles evaluables (excluye No aplica e integraciones). */
  applicable: number;
  evaluated: number;
  coverage: number; // 0–1
  /** 0–100, o undefined si no hay nada evaluado. */
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
      const st = d?.controls[c.id]?.status ?? "unevaluated";
      if (st === "not-applicable") continue;
      applicable++;
      if (st === "unevaluated") continue;
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
      coverage,
      maturity: evaluated ? Math.round((sum / evaluated) * 100) : undefined,
      sufficient: applicable > 0 && coverage >= MIN_COVERAGE,
      needsImprovement,
    };
  });
}

export interface GlobalIndex {
  /** 0–100, o undefined si ninguna dimensión tiene cobertura suficiente. */
  value: number | undefined;
  basedOn: number;
  total: number;
}

export function globalIndex(industry: Industry, results: DimensionResult[]): GlobalIndex {
  const w = weightsFor(industry);
  const used = results.filter((r) => r.sufficient && r.maturity !== undefined);
  const wsum = used.reduce((s, r) => s + w[r.id], 0);
  return {
    value: wsum ? Math.round(used.reduce((s, r) => s + r.maturity! * w[r.id], 0) / wsum) : undefined,
    basedOn: used.length,
    total: results.length,
  };
}

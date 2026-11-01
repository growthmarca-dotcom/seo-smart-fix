/**
 * Etapa B3.1 — Síntesis profesional de UNA evaluación integral. Lógica pura, calculada al vuelo:
 * no guarda nada, no inventa cifras ni causas. Cada ítem remite a un control y su estado guardado.
 * "Sin evaluar", "Sin datos" y "No aplica" nunca generan fortalezas ni mejoras: van a límites.
 */
import type { Company } from "@/companies/model";
import { DIMENSIONS, controlsFor, type DiagnosisControl, type DimensionId } from "./dimensions";
import { assessmentAsDiagnosis, isJustifiedNotApplicable, type AssessmentControlState, type CompanyAssessment } from "./model";
import { SEO_CONTROL_ID, dimensionResults, globalIndex, type DimensionResult, type GlobalIndex } from "./scoring";
import { criticalControlsFor, weightsFor } from "./weights";
import { suggestedAreasFor } from "@/proposals/work-areas";

/** Origen del dato mostrado junto a cada ítem. */
export type DataOrigin = "verified" | "client" | "professional";
export const DATA_ORIGIN_LABELS: Record<DataOrigin, string> = {
  verified: "Comprobado (con evidencia)",
  client: "Informado por el cliente",
  professional: "Observación profesional",
};

export const SERVICE_PENDING = "Servicio a definir por MarCa";

export interface SynthesisItem {
  controlId: string;
  title: string;
  dimension: DimensionId;
  dimensionTitle: string;
  origin: DataOrigin;
  critical: boolean;
  notes: string;
  evidenceUrl?: string | undefined;
}

export interface PriorityItem extends SynthesisItem {
  /** Áreas de trabajo sugeridas (solo sugerencia; la combinación final la decide MarCa). */
  suggestedAreas: string[];
  /** Texto mostrado: áreas sugeridas o SERVICE_PENDING si no hay. */
  service: string;
}

export type LimitKind = "unevaluated" | "no-data" | "not-applicable" | "unjustified-not-applicable" | "integration";
export const LIMIT_LABELS: Record<LimitKind, string> = {
  unevaluated: "Sin evaluar",
  "no-data": "Sin datos",
  "not-applicable": "No aplica (justificado)",
  "unjustified-not-applicable": "«No aplica» sin justificación (se considera sin evaluar)",
  integration: "Requiere integración futura",
};

export interface LimitItem {
  controlId: string;
  title: string;
  dimensionTitle: string;
  kind: LimitKind;
  /** Justificación de «No aplica», si existe. */
  justification?: string | undefined;
}

export interface Synthesis {
  partial: boolean;
  index: GlobalIndex;
  results: DimensionResult[];
  strengths: SynthesisItem[];
  priorities: PriorityItem[];
  limits: LimitItem[];
}

export function originOf(control: DiagnosisControl, state: AssessmentControlState): DataOrigin {
  if (state.evidenceUrl) return "verified";
  return control.source === "client" ? "client" : "professional";
}

export function buildSynthesis(company: Pick<Company, "industry">, a: CompanyAssessment): Synthesis {
  const diag = assessmentAsDiagnosis(a);
  const results = dimensionResults(company.industry, diag);
  const index = globalIndex(company.industry, results, diag);
  const critical = new Set(criticalControlsFor(company.industry));
  const weights = weightsFor(company.industry);
  const dimTitle = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d.title])) as Record<DimensionId, string>;
  const dimOrder = Object.fromEntries(DIMENSIONS.map((d, i) => [d.id, i])) as Record<DimensionId, number>;

  const strengths: SynthesisItem[] = [];
  const priorities: PriorityItem[] = [];
  const limits: LimitItem[] = [];

  for (const c of controlsFor(company.industry)) {
    if (c.id === SEO_CONTROL_ID) continue; // referencia técnica separada, nunca parte de la síntesis
    const base = { controlId: c.id, title: c.title, dimensionTitle: dimTitle[c.dimension] };
    if (c.source === "integration") {
      limits.push({ ...base, kind: "integration" });
      continue;
    }
    const s = a.controls[c.id];
    if (!s || s.status === "unevaluated") {
      limits.push({ ...base, kind: "unevaluated" });
      continue;
    }
    if (s.status === "no-data") {
      limits.push({ ...base, kind: "no-data" });
      continue;
    }
    if (s.status === "not-applicable") {
      limits.push(isJustifiedNotApplicable(s) ? { ...base, kind: "not-applicable", justification: s.notes.trim() } : { ...base, kind: "unjustified-not-applicable" });
      continue;
    }
    const item: SynthesisItem = {
      ...base,
      dimension: c.dimension,
      origin: originOf(c, s),
      critical: critical.has(c.id),
      notes: s.notes ?? "",
      evidenceUrl: s.evidenceUrl,
    };
    if (s.status === "meets") strengths.push(item);
    else if (s.status === "needs-improvement") {
      const areas = suggestedAreasFor(c.id).map((x) => x.name);
      priorities.push({ ...item, suggestedAreas: areas, service: areas.length ? `Áreas sugeridas: ${areas.join(" · ")}` : SERVICE_PENDING });
    }
  }

  // Prioridad: críticos primero, luego peso propuesto de la dimensión, luego orden del catálogo (estable).
  const catalogOrder = new Map(controlsFor(company.industry).map((c, i) => [c.id, i]));
  priorities.sort(
    (x, y) =>
      Number(y.critical) - Number(x.critical) ||
      weights[y.dimension] - weights[x.dimension] ||
      dimOrder[x.dimension] - dimOrder[y.dimension] ||
      catalogOrder.get(x.controlId)! - catalogOrder.get(y.controlId)!,
  );

  return { partial: index.status !== "complete", index, results, strengths, priorities, limits };
}

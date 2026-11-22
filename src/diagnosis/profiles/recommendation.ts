/**
 * Etapa D1 — Complejidad, recomendación orientativa de perfil y métricas de cobertura. Lógica pura.
 * La recomendación no reemplaza la decisión del auditor ni el alcance contratado.
 */
import type { Industry } from "@/companies/model";
import { controlsFor } from "../dimensions";
import { isJustifiedNotApplicable, type CompanyDiagnosis } from "../model";
import { SEO_CONTROL_ID, dimensionResults, globalIndex, type DiagnosisInputs } from "../scoring";
import { criticalControlsFor } from "../weights";
import { controlsForProfile } from "./catalog-sizing";
import {
  AUDIT_PROFILE_LABELS,
  type AuditProfileId,
  type BusinessComplexityInputs,
  type BusinessComplexityResult,
  type ComplexityLevel,
  type CoverageMetrics,
  type ProfileRecommendation,
  type ProfileRecommendationInputs,
} from "./types";

const STRUCTURAL_FIELDS: (keyof BusinessComplexityInputs)[] = [
  "channels",
  "operationalStructure",
  "locationsCount",
  "targetMarkets",
  "hasTransactionalPlatform",
  "hasDirectBookingEngine",
  "catalogSize",
  "hasStockSync",
  "isMultiCurrency",
];

/** Clasifica complejidad solo con datos informados. Sin datos estructurales → "unknown", nunca "low". */
export function evaluateBusinessComplexity(i: BusinessComplexityInputs): BusinessComplexityResult {
  const uninformedFields = (["industry", ...STRUCTURAL_FIELDS] as (keyof BusinessComplexityInputs)[]).filter((k) => {
    const v = i[k];
    return v === undefined || (Array.isArray(v) && v.length === 0);
  });
  const high: string[] = [];
  const medium: string[] = [];
  const low: string[] = [];

  if (i.hasTransactionalPlatform === true) high.push("Venta con pago en línea");
  if (i.hasDirectBookingEngine === true) high.push("Motor de reservas directas");
  if (i.hasStockSync === true) high.push("Stock o disponibilidad sincronizados");
  if (i.isMultiCurrency === true) high.push("Operación multimoneda");
  if (i.catalogSize === "large") high.push("Catálogo extenso");
  if (i.operationalStructure === "franchise") high.push("Estructura de franquicia");
  if (i.locationsCount !== undefined && i.locationsCount > 3) high.push(`${i.locationsCount} sedes`);
  if (i.targetMarkets?.includes("international")) high.push("Mercado internacional");

  if (i.operationalStructure === "multi-location" || (i.locationsCount !== undefined && i.locationsCount >= 2 && i.locationsCount <= 3))
    medium.push("Varias sedes");
  if (i.catalogSize === "medium") medium.push("Catálogo mediano");
  if (i.channels && i.channels.length >= 3) medium.push(`${i.channels.length} canales declarados`);
  if (i.targetMarkets?.some((m) => m === "national" || m === "regional")) medium.push("Mercado regional o nacional");

  if (i.hasTransactionalPlatform === false) low.push("Sin venta con pago en línea (confirmado)");
  if (i.hasDirectBookingEngine === false) low.push("Sin motor de reservas directas (confirmado)");
  if (i.operationalStructure === "single-location" || i.locationsCount === 1) low.push("Sede única (confirmado)");
  if (i.catalogSize === "small") low.push("Catálogo reducido");

  let level: ComplexityLevel;
  let factors: string[];
  if (high.length) [level, factors] = ["high", high];
  else if (medium.length) [level, factors] = ["medium", medium];
  else if (low.length) [level, factors] = ["low", low];
  else [level, factors] = ["unknown", ["No hay datos suficientes sobre canales, estructura ni operación"]];
  return { level, factors, uninformedFields };
}

const L = AUDIT_PROFILE_LABELS;

export function recommendAuditProfile(inputs: ProfileRecommendationInputs): ProfileRecommendation {
  const complexity = evaluateBusinessComplexity(inputs.complexityInputs);
  const requested = inputs.requestedScope?.profile;
  const factorText = complexity.factors.join("; ");

  if (requested) {
    const notes: string[] = [`Se respeta el alcance contratado: ${L[requested]}.`];
    if (complexity.level === "high" && requested !== "integral360")
      notes.push(`El negocio presenta complejidad alta (${factorText}); las dimensiones fuera del perfil quedarán sin relevar y debe informarse al cliente.`);
    if (complexity.level === "unknown") notes.push("La complejidad operativa no fue informada.");
    return { status: "contracted", suggestedProfile: requested, requestedProfile: requested, complexity, alternatives: [], explanation: notes.join(" ") };
  }

  let suggested: AuditProfileId;
  let explanation: string;
  let alternatives: AuditProfileId[];
  switch (complexity.level) {
    case "unknown":
      suggested = "essential";
      alternatives = ["professional"];
      explanation = "Sin alcance acordado y sin datos de complejidad: se sugiere Esencial como punto de partida. Completar canales y estructura antes de dimensionar una mayor profundidad.";
      break;
    case "low":
      suggested = "essential";
      alternatives = ["professional"];
      explanation = `Complejidad baja confirmada (${factorText}): se sugiere Esencial. Acordar el alcance con el cliente.`;
      break;
    case "medium":
      suggested = "professional";
      alternatives = ["essential"];
      explanation = `Complejidad media (${factorText}): se sugiere Profesional como base. Esencial si el cliente solo busca destrabar barreras críticas.`;
      break;
    case "high":
      suggested = "professional";
      alternatives = ["essential", "integral360"];
      explanation = `Complejidad alta (${factorText}): se sugiere Profesional como base. Esencial si el cliente solo busca destrabar barreras críticas; Integral 360 solo si contrata una auditoría exhaustiva con analítica, integraciones o revisión transversal.`;
  }
  return { status: "exploratory", suggestedProfile: suggested, complexity, alternatives, explanation };
}

/** Relevado = meets o needs-improvement (mismo criterio que scoring.ts). */
const isEvaluated = (st: string | undefined) => st === "meets" || st === "needs-improvement";

export function calculateCoverageMetrics(
  profileId: AuditProfileId,
  industry: Industry,
  d: CompanyDiagnosis | undefined,
  inputs: DiagnosisInputs = {},
): CoverageMetrics {
  const profileControls = controlsForProfile(profileId, industry);
  let profileApplicable = 0;
  let profileEvaluated = 0;
  for (const c of profileControls) {
    if (c.source === "integration" || c.id === SEO_CONTROL_ID) continue;
    const st = d?.controls[c.id];
    if (st && st.status === "not-applicable" && isJustifiedNotApplicable(st)) continue;
    profileApplicable++;
    if (isEvaluated(st?.status)) profileEvaluated++;
  }

  const relevant = new Set(controlsFor(industry).map((c) => c.id));
  let criticalApplicable = 0;
  let criticalEvaluated = 0;
  const criticalDeficits: string[] = [];
  for (const id of criticalControlsFor(industry)) {
    if (!relevant.has(id) || id === SEO_CONTROL_ID) continue;
    const st = d?.controls[id];
    if (st && st.status === "not-applicable" && isJustifiedNotApplicable(st)) continue;
    criticalApplicable++;
    if (isEvaluated(st?.status)) {
      criticalEvaluated++;
      if (st!.status === "needs-improvement") criticalDeficits.push(id);
    }
  }

  const index = globalIndex(industry, dimensionResults(industry, d, inputs), d, inputs);
  return {
    profileControlIds: profileControls.map((c) => c.id),
    profileApplicable,
    profileEvaluated,
    profileCoverage: profileApplicable ? profileEvaluated / profileApplicable : 0,
    totalCoverage: index.totalCoverage,
    criticalApplicable,
    criticalEvaluated,
    criticalCoverage: criticalApplicable ? criticalEvaluated / criticalApplicable : 1,
    criticalDeficits,
    isGlobalIndexSufficient: index.status === "complete",
  };
}

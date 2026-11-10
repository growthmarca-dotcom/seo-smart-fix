/**
 * Etapa 3 — Presets orientativos de revisión del alcance.
 * Solo devuelven SUGERENCIAS de revisión. Nunca excluyen URLs ni eligen un
 * motivo de exclusión: la decisión y el motivo son siempre humanos.
 */
import type { UrlClassification } from "./types";

export type ScopePresetId = "integral" | "small-business" | "b2b-services" | "tourism" | "ecommerce";

export interface ScopePreset {
  id: ScopePresetId;
  label: string;
  description: string;
}

export const SCOPE_PRESETS: readonly ScopePreset[] = [
  { id: "integral", label: "Integral", description: "Revisa solo indicios fuertes: posibles residuales y posibles duplicados." },
  { id: "small-business", label: "Comercio pequeño", description: "Agrega revisión de páginas huérfanas sin enlaces entrantes." },
  { id: "b2b-services", label: "Servicios B2B", description: "Revisa residuales, duplicados y huérfanas; prioriza páginas recurrentes." },
  { id: "tourism", label: "Turismo", description: "Revisa residuales, duplicados y huérfanas; prioriza páginas recurrentes." },
  { id: "ecommerce", label: "E-commerce", description: "Revisa residuales, duplicados y páginas no indexables." },
];

export type SuggestedAction = "review_for_exclusion" | "priority_include";

export interface ScopeReviewSuggestion {
  url: string;
  suggestedAction: SuggestedAction;
  /** Indicio heurístico que motivó la sugerencia. No es una confirmación. */
  heuristicReason: string;
}

export function suggestForPreset(
  presetId: ScopePresetId,
  classifications: readonly UrlClassification[],
): ScopeReviewSuggestion[] {
  const orphans = presetId !== "integral";
  const nonIndexable = presetId === "ecommerce";
  const priority = presetId === "b2b-services" || presetId === "tourism";
  const out: ScopeReviewSuggestion[] = [];
  for (const c of classifications) {
    if (c.isSeed) {
      out.push({ url: c.url, suggestedAction: "priority_include", heuristicReason: "Página de inicio del sitio." });
      continue;
    }
    const reasons: string[] = [];
    if (c.residual.possibleResidual) reasons.push("Posible página residual o de prueba");
    if (c.duplicates.possibleDuplicate) reasons.push("Posible duplicado");
    if (orphans && c.isOrphan) reasons.push("Sin enlaces internos entrantes");
    if (nonIndexable && c.indexability.isNonIndexable) reasons.push("No indexable");
    if (reasons.length) {
      out.push({ url: c.url, suggestedAction: "review_for_exclusion", heuristicReason: reasons.join(" · ") + "." });
    } else if (priority && c.navigation.recurringLinkApprox) {
      out.push({ url: c.url, suggestedAction: "priority_include", heuristicReason: "Enlazada desde muchas páginas (aproximación)." });
    }
  }
  return out;
}

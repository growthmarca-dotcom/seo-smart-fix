/**
 * Relevancia de dimensiones, criticidad de controles y umbrales de suficiencia por rubro.
 * TODOS los valores son HIPÓTESIS PROPUESTAS, pendientes de validación por MarCa:
 * se rotulan como "propuestos" en cualquier pantalla o informe que los use.
 * Cada perfil de pesos suma 100. El SEO es solo un indicador dentro de "web".
 */
import type { Industry } from "@/companies/model";
import { isTourismIndustry } from "@/companies/model";
import type { DimensionId } from "./dimensions";

export type WeightProfile = "tourism" | "restaurant" | "ecommerce" | "real-estate" | "professional-services" | "generic";
export type Weights = Record<DimensionId, number>;

export const WEIGHTS_ARE_PROPOSED = true;

export const WEIGHT_PROFILES: Record<WeightProfile, Weights> = {
  tourism: { web: 20, visibility: 20, sales: 20, brand: 10, channels: 20, opportunities: 10 },
  restaurant: { web: 10, visibility: 30, sales: 15, brand: 15, channels: 20, opportunities: 10 },
  ecommerce: { web: 30, visibility: 10, sales: 20, brand: 10, channels: 20, opportunities: 10 },
  "real-estate": { web: 15, visibility: 15, sales: 25, brand: 10, channels: 20, opportunities: 15 },
  // Perfil preparado; el rubro "Servicios profesionales" aún no existe (requiere aprobación).
  "professional-services": { web: 15, visibility: 20, sales: 25, brand: 15, channels: 15, opportunities: 10 },
  generic: { web: 20, visibility: 15, sales: 20, brand: 15, channels: 15, opportunities: 15 },
};

/** Controles críticos propuestos por perfil: sin ellos evaluados no hay índice global. */
export const CRITICAL_CONTROLS: Record<WeightProfile, string[]> = {
  tourism: ["ch-booking", "ch-whatsapp", "vis-ota"],
  restaurant: ["vis-gbp", "vis-reviews"],
  ecommerce: ["ch-booking", "web-seo-health"],
  "real-estate": ["sales-followup", "ch-forms"],
  "professional-services": ["sales-response", "sales-quotes"],
  generic: ["web-offer-clarity", "ch-whatsapp"],
};

/** Umbrales propuestos de suficiencia (no son política definitiva). */
export const SUFFICIENCY = {
  /** Cobertura total mínima (evaluados / aplicables). */
  minTotalCoverage: 0.7,
  /** Las dimensiones con peso ≥ este valor son "relevantes" para el rubro. */
  relevantWeight: 20,
  /** Cobertura mínima de cada dimensión relevante. */
  minRelevantCoverage: 0.5,
} as const;

export function weightProfileFor(industry: Industry): WeightProfile {
  if (isTourismIndustry(industry)) return "tourism";
  if (industry === "restaurant") return "restaurant";
  if (industry === "ecommerce") return "ecommerce";
  if (industry === "real-estate") return "real-estate";
  return "generic";
}

export const weightsFor = (industry: Industry): Weights => WEIGHT_PROFILES[weightProfileFor(industry)];
export const criticalControlsFor = (industry: Industry): string[] => CRITICAL_CONTROLS[weightProfileFor(industry)];

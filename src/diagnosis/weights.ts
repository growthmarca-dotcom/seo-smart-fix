/**
 * Pesos del índice global por rubro (valores iniciales propuestos, pendientes de aprobación de MarCa).
 * Cada perfil suma 100. El SEO es solo un indicador dentro de "web": nunca pesa más que esa dimensión.
 */
import type { Industry } from "@/companies/model";
import { isTourismIndustry } from "@/companies/model";
import type { DimensionId } from "./dimensions";

export type WeightProfile = "tourism" | "restaurant" | "ecommerce" | "generic";
export type Weights = Record<DimensionId, number>;

export const WEIGHT_PROFILES: Record<WeightProfile, Weights> = {
  tourism: { web: 20, visibility: 20, sales: 20, brand: 10, channels: 20, opportunities: 10 },
  restaurant: { web: 10, visibility: 30, sales: 15, brand: 15, channels: 20, opportunities: 10 },
  ecommerce: { web: 30, visibility: 10, sales: 20, brand: 10, channels: 20, opportunities: 10 },
  generic: { web: 20, visibility: 15, sales: 20, brand: 15, channels: 15, opportunities: 15 },
};

export function weightProfileFor(industry: Industry): WeightProfile {
  if (isTourismIndustry(industry)) return "tourism";
  if (industry === "restaurant") return "restaurant";
  if (industry === "ecommerce") return "ecommerce";
  return "generic";
}

export const weightsFor = (industry: Industry): Weights => WEIGHT_PROFILES[weightProfileFor(industry)];

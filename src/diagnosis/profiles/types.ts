/**
 * Etapa D1 — Dimensionamiento según el perfil de auditoría. Tipos puros.
 * Los perfiles son PROFUNDIDAD de relevamiento, no escalas de puntaje: no alteran scoring, pesos ni umbrales.
 * Estados: se reutiliza ControlStatus de ../model (sin nomenclatura paralela).
 */
import type { Industry } from "@/companies/model";

export type AuditProfileId = "essential" | "professional" | "integral360";
export const AUDIT_PROFILES: AuditProfileId[] = ["essential", "professional", "integral360"];
export const AUDIT_PROFILE_LABELS: Record<AuditProfileId, string> = {
  essential: "Esencial",
  professional: "Profesional",
  integral360: "Integral 360",
};

export type VerificationMode = "auto" | "registry" | "external-test" | "integration";
export const VERIFICATION_MODE_LABELS: Record<VerificationMode, string> = {
  auto: "Automático (motores del sistema)",
  registry: "Registro manual del auditor",
  "external-test": "Prueba interactiva externa",
  integration: "Integración con API / plataforma",
};

export type EvidenceNature = "verified-fact" | "client-provided" | "professional-observation" | "hypothesis";
export const EVIDENCE_NATURE_LABELS: Record<EvidenceNature, string> = {
  "verified-fact": "Hecho comprobado",
  "client-provided": "Dato aportado por el cliente",
  "professional-observation": "Observación del auditor",
  hypothesis: "Hipótesis / Inferencia profesional",
};

/** Suficiencia contextual (D0): sin jerarquía rígida de fuentes. */
export interface EvidenceSufficiencyCriteria {
  claimSupported: string;
  sourceOrigin: string;
  capturedAt: string;
  scopeAndCoverage: string;
}

export interface ControlSizing {
  controlId: string;
  /** Perfil habitual de entrada. Los controles críticos del rubro se incluyen en todos los perfiles. */
  minProfile: AuditProfileId;
  mode: VerificationMode;
  /** Profundidad diferenciada por perfil, sin duplicar controles. */
  depthGuidance?: Partial<Record<AuditProfileId, string>>;
}

export type ComplexityLevel = "unknown" | "low" | "medium" | "high";
export const COMPLEXITY_LABELS: Record<ComplexityLevel, string> = {
  unknown: "No informado",
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

/** Todas opcionales: undefined = no informado (nunca se infiere). */
export interface BusinessComplexityInputs {
  industry?: Industry | undefined;
  channels?: string[] | undefined;
  operationalStructure?: "single-location" | "multi-location" | "franchise" | "pure-digital" | undefined;
  locationsCount?: number | undefined;
  targetMarkets?: ("local" | "regional" | "national" | "international")[] | undefined;
  hasTransactionalPlatform?: boolean | undefined;
  hasDirectBookingEngine?: boolean | undefined;
  catalogSize?: "small" | "medium" | "large" | undefined;
  hasStockSync?: boolean | undefined;
  isMultiCurrency?: boolean | undefined;
}

/** Factores declarados fuera de la inferencia en D1 (no se reciben ni se suponen). */
export const OUT_OF_SCOPE_FACTORS = [
  "Volumen de facturación o transacciones",
  "Integración con ERP / CRM",
  "Tamaño del equipo de atención",
  "Inversión publicitaria activa",
] as const;

export interface BusinessComplexityResult {
  level: ComplexityLevel;
  factors: string[];
  uninformedFields: (keyof BusinessComplexityInputs)[];
}

export interface RequestedScopeInfo {
  profile?: AuditProfileId | undefined;
  objective?: string | undefined;
  timeframeWeeks?: number | undefined;
}

export interface ProfileRecommendationInputs {
  complexityInputs: BusinessComplexityInputs;
  requestedScope?: RequestedScopeInfo | undefined;
}

export interface ProfileRecommendation {
  status: "contracted" | "exploratory";
  suggestedProfile: AuditProfileId;
  requestedProfile?: AuditProfileId | undefined;
  complexity: BusinessComplexityResult;
  /** Alternativas que el auditor puede considerar; nunca reemplazan su decisión. */
  alternatives: AuditProfileId[];
  explanation: string;
}

export interface CoverageMetrics {
  profileControlIds: string[];
  profileApplicable: number;
  profileEvaluated: number;
  /** evaluados / aplicables del perfil (0 si no hay aplicables). */
  profileCoverage: number;
  /** De scoring.globalIndex (sin reinterpretar). */
  totalCoverage: number;
  criticalApplicable: number;
  criticalEvaluated: number;
  /** Críticos relevados (meets o needs-improvement) / críticos aplicables; 1 si no hay. */
  criticalCoverage: number;
  /** Críticos relevados con "Requiere mejora": evaluados pero déficit. */
  criticalDeficits: string[];
  /** De scoring.globalIndex: status === "complete". */
  isGlobalIndexSufficient: boolean;
}

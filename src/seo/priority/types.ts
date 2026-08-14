/**
 * FASE 6B — Modelo de correlación GSC + auditoría + priorización.
 *
 * Capa NUEVA, derivada y explicable. No modifica:
 * crawler, descubrimiento, robots.txt, sitemap, reglas, diagnósticos (2.3),
 * On-Page contextual (3), arquitectura (4), contenido (5), importación GSC (6A),
 * score.total, score por categorías, score.drivers ni el aislamiento por auditId.
 */
import type { Category, PageType, Severity } from "@/seo/types";
import type { GscDataSource, GscMetrics } from "@/seo/gsc/types";

/** Prioridad final. Derivada de señales reales, nunca de un valor oculto. */
export type PriorityLevel = "high" | "medium" | "low";

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const PRIORITY_DOTS: Record<PriorityLevel, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

/** Tipos de oportunidad correlacionada de esta fase. */
export type OpportunityType =
  | "ctr-snippet"
  | "position-margin"
  | "impressions-low-ctr"
  | "impressions-low-position"
  | "performance-with-seo-issue"
  | "architecture-connectivity"
  | "content-demand";

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  "ctr-snippet": "Oportunidad de snippet (CTR)",
  "position-margin": "Margen potencial de posición",
  "impressions-low-ctr": "Impresiones con muy pocos clics (CTR bajo)",
  "impressions-low-position": "Impresiones con muy pocos clics (posición baja)",
  "performance-with-seo-issue": "Visibilidad orgánica + problema SEO",
  "architecture-connectivity": "Visibilidad orgánica + baja conectividad interna",
  "content-demand": "Demanda orgánica + contenido a revisar",
};

/**
 * Escalas EXPLÍCITAS de la capa de priorización (0–4 cada una).
 * No son métricas de Google ni forman parte del SEO Score.
 */
export const PRIORITY_SCALES = {
  impact: {
    label: "Impacto potencial",
    description:
      "Volumen de visibilidad ya existente en el período (impresiones y clics no obtenidos). No es una previsión de clics.",
    max: 4,
  },
  evidence: {
    label: "Evidencia",
    description:
      "Suficiencia de datos: impresiones, cantidad de consultas y días con datos en el período importado.",
    max: 4,
  },
  relevance: {
    label: "Relevancia",
    description:
      "Cercanía competitiva (posición media) y existencia de un hallazgo/diagnóstico SEO relacionado en la misma auditoría.",
    max: 4,
  },
  ease: {
    label: "Facilidad",
    description:
      "Cuán directa es la acción: editar un campo on-page es más directo que rehacer contenido o replantear enlazado interno.",
    max: 4,
  },
} as const;

export type PriorityFactorId = keyof typeof PRIORITY_SCALES;

/** Pesos documentados de la prioridad final (suman 1). */
export const PRIORITY_WEIGHTS: Record<PriorityFactorId, number> = {
  impact: 0.35,
  evidence: 0.25,
  relevance: 0.25,
  ease: 0.15,
};

/** Cortes de prioridad sobre el índice 0–100 derivado de los factores. */
export const PRIORITY_CUTOFFS = { high: 65, medium: 40 };

export interface PriorityFactor {
  id: PriorityFactorId;
  label: string;
  /** Valor 0–4 en la escala declarada. */
  value: number;
  max: number;
  weight: number;
  /** Por qué ese valor: señal concreta observada. */
  reason: string;
}

/** Diagnóstico relacionado (referencia, NO copia del diagnóstico original). */
export interface OpportunityDiagnosticRef {
  findingId: string;
  ruleId: string;
  ruleName: string;
  severity: Severity;
  category: Category;
  field?: string | undefined;
}

/** Evidencia GSC del período. `trend` solo existe con datos suficientes. */
export interface OpportunityGscEvidence {
  property: string;
  source: GscDataSource;
  period: { startDate: string; endDate: string };
  metrics: GscMetrics;
  queries: number;
  /** Días distintos con datos en el período (para decidir si hay tendencia). */
  daysWithData: number;
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  /** Comparación primera vs segunda mitad del período; undefined si no alcanza. */
  trend?:
    | {
        direction: "up" | "down" | "flat";
        firstHalfImpressions: number;
        secondHalfImpressions: number;
        note: string;
      }
    | undefined;
}

/** Oportunidad correlacionada de la Fase 6B. */
export interface SeoOpportunity {
  id: string;
  auditId: string;
  auditName: string;
  isDemo?: boolean | undefined;
  url: string;
  path: string;
  pageId?: string | undefined;
  pageType?: PageType | undefined;
  type: OpportunityType;
  typeLabel: string;
  category: Category;
  /** Estado del cruce GSC ↔ auditoría (siempre "both" o "gsc-only" aquí). */
  matchState: "both" | "gsc-only";
  gsc: OpportunityGscEvidence;
  diagnostics: OpportunityDiagnosticRef[];
  ruleIds: string[];
  evidence: string[];
  explanation: string;
  recommendation: string;
  priority: PriorityLevel;
  /** Índice 0–100 de la capa de priorización. NO es el SEO Score. */
  priorityIndex: number;
  factors: PriorityFactor[];
  /** Frase completa de explicabilidad. */
  priorityExplanation: string;
}

export interface PrioritySummary {
  auditId: string;
  source: GscDataSource;
  property: string;
  period: { startDate: string; endDate: string };
  opportunities: SeoOpportunity[];
  counts: Record<PriorityLevel, number>;
  /** URLs con datos GSC relacionadas con páginas de la auditoría. */
  matchedUrls: number;
  /** URLs con datos GSC que el crawler no analizó (no es un error por sí mismo). */
  gscOnlyUrls: string[];
  /** URLs de la auditoría sin datos GSC en el período (no genera oportunidad). */
  auditOnlyUrls: string[];
}

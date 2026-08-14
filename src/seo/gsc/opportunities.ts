/**
 * FASE 6A — Señales derivadas GSC + crawler.
 * Capa aditiva: NO modifica score.total, categorías, drivers, pesos ni severidades.
 * Lenguaje deliberadamente no causal ("oportunidad" / "señal para revisar").
 */
import type { Audit } from "@/seo/types";
import { metricsByPage, relevantFindings } from "./import";
import type { GscRow, GscSignal } from "./types";

/** Umbrales explícitos y documentados de la capa GSC. */
export const GSC_THRESHOLDS = {
  /** Impresiones mínimas para considerar que hay volumen suficiente. */
  minImpressions: 100,
  /** CTR por debajo del cual se marca como relativamente bajo. */
  lowCtr: 0.02,
  /** Posición media que se considera relativamente alta. */
  goodPosition: 10,
  /** Clics máximos para "impresiones sin clics". */
  fewClicks: 2,
};

function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

/**
 * Construye señales para UNA auditoría. `rows` debe estar ya filtrado
 * por auditId y propiedad (ver rowsForAudit).
 */
export function buildGscSignals(audit: Audit, rows: GscRow[]): GscSignal[] {
  const t = GSC_THRESHOLDS;
  const signals: GscSignal[] = [];

  for (const p of metricsByPage(rows, audit.pages)) {
    const metrics = {
      clicks: p.clicks,
      impressions: p.impressions,
      ctr: p.ctr,
      position: p.position,
    };
    const base = {
      auditId: audit.id,
      page: p.page,
      pageId: p.pageId,
      metrics,
      queries: p.queries,
    };
    const findings = relevantFindings(audit, p.pageId);

    if (p.impressions >= t.minImpressions && p.ctr < t.lowCtr) {
      signals.push({
        ...base,
        id: "high-impressions-low-ctr",
        name: "Muchas impresiones con CTR relativamente bajo",
        evidence: [`${p.impressions} impresiones`, `CTR ${pct(p.ctr)}`, `${p.clicks} clics`],
        explanation:
          "Esta URL acumula un volumen de impresiones relevante y presenta un CTR relativamente bajo en el período seleccionado.",
        recommendation:
          "Podría ser conveniente revisar title y meta description para evaluar si representan mejor la intención de las consultas.",
        classification: "oportunidad",
      });
    }

    if (p.impressions >= t.minImpressions / 2 && p.position <= t.goodPosition && p.ctr < t.lowCtr) {
      signals.push({
        ...base,
        id: "good-position-low-ctr",
        name: "Posición relativamente alta con CTR bajo",
        evidence: [`Posición media ${p.position.toFixed(1)}`, `CTR ${pct(p.ctr)}`],
        explanation:
          "La URL aparece en posiciones relativamente altas y aun así su CTR es bajo respecto al volumen de impresiones.",
        recommendation:
          "Podría revisarse el snippet (title, meta description, datos estructurados) para entender la diferencia.",
        classification: "señal para revisar",
      });
    }

    if (p.impressions >= t.minImpressions && p.clicks <= t.fewClicks) {
      signals.push({
        ...base,
        id: "impressions-no-clicks",
        name: "Impresiones con muy pocos clics",
        evidence: [`${p.impressions} impresiones`, `${p.clicks} clics`],
        explanation:
          "Search Console registra impresiones pero prácticamente ningún clic en el período.",
        recommendation:
          "Conviene revisar las consultas asociadas para comprobar si la página responde a esa intención.",
        classification: "señal para revisar",
      });
    }

    if (p.impressions >= t.minImpressions && p.pageId && findings.length === 0) {
      signals.push({
        ...base,
        id: "performance-without-onpage-findings",
        name: "Rendimiento orgánico sin hallazgos importantes",
        evidence: [`${p.impressions} impresiones`, "Sin hallazgos críticos ni importantes"],
        explanation:
          "La URL tiene rendimiento orgánico real y el crawler no detectó hallazgos críticos ni importantes.",
        recommendation:
          "Es una candidata razonable para trabajar contenido o enlazado interno antes que otras URLs.",
        classification: "oportunidad",
      });
    }

    if (p.impressions > 0 && findings.length > 0) {
      signals.push({
        ...base,
        id: "performance-with-seo-issues",
        name: "Rendimiento orgánico real con hallazgos SEO",
        evidence: [
          `${p.impressions} impresiones`,
          `${p.clicks} clics`,
          ...findings.slice(0, 3).map((f) => `${f.ruleName} (${f.severity})`),
        ],
        explanation:
          "Existe rendimiento orgánico real en esta URL y además hallazgos SEO relacionados detectados por el crawler.",
        recommendation:
          "Revisar los hallazgos de esta URL en su diagnóstico antes de intervenir en otras páginas sin tráfico.",
        classification: "señal para revisar",
      });
    }
  }

  return signals.sort((a, b) => b.metrics.impressions - a.metrics.impressions);
}

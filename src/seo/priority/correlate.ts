/**
 * FASE 6B — Correlación GSC ↔ crawler ↔ diagnósticos ↔ arquitectura ↔ contenido
 * y priorización explicable.
 *
 * SOLO LECTURA sobre las capas existentes. No recalcula el score, no ejecuta
 * reglas, no rastrea y no modifica la normalización del crawler: para el cruce
 * usa la normalización local de la Fase 6A (`normalizeForMatch`).
 *
 * Aislamiento: todas las entradas provienen de la MISMA `Audit` y de filas GSC
 * ya filtradas por `rowsForAudit(auditId, property, period)`.
 */
import type { Audit, Category, Finding, PageSnapshot } from "@/seo/types";
import { normalizeForMatch } from "@/seo/gsc/normalize";
import { metricsByPage, metricsByQuery } from "@/seo/gsc/import";
import type { GscConnection, GscRow } from "@/seo/gsc/types";
import { buildLinkGraph, type LinkGraph } from "@/seo/link-graph";
import { analyzeContent, type ContentAnalysis, type ContentItem } from "@/seo/content-analysis";
import {
  OPPORTUNITY_TYPE_LABELS,
  PRIORITY_CUTOFFS,
  PRIORITY_LABELS,
  PRIORITY_SCALES,
  PRIORITY_WEIGHTS,
  type OpportunityDiagnosticRef,
  type OpportunityGscEvidence,
  type OpportunityType,
  type PriorityFactor,
  type PriorityFactorId,
  type PriorityLevel,
  type PrioritySummary,
  type SeoOpportunity,
} from "./types";

/**
 * Umbrales DOCUMENTADOS de la capa de correlación 6B.
 * Son criterios de la herramienta, no valores de Google.
 */
export const CORRELATION_THRESHOLDS = {
  /** Impresiones mínimas para hablar de visibilidad significativa. */
  minImpressions: 100,
  /** Impresiones mínimas para una señal más débil (se refleja en Evidencia). */
  minImpressionsSoft: 50,
  /** CTR por debajo del cual se considera relativamente bajo. */
  lowCtr: 0.02,
  /** Posición media considerada competitiva (cerca de la primera página). */
  competitivePosition: 10,
  /** Banda de "margen potencial de posición". */
  positionMarginMin: 8,
  positionMarginMax: 20,
  /** Posición media a partir de la cual la visibilidad es lejana. */
  farPosition: 20,
  /** Clics máximos para considerar "prácticamente sin clics". */
  fewClicks: 2,
  /** Enlaces internos entrantes considerados baja conectividad. */
  lowInbound: 1,
  /** Días con datos mínimos para calcular una tendencia (nunca con 1 período corto). */
  minDaysForTrend: 14,
  /** Consultas mínimas para reforzar la evidencia. */
  queriesForEvidence: 3,
} as const;

const CONTENT_SIGNALS_FOR_DEMAND = new Set([
  "content-insufficient",
  "content-structure-weak",
  "content-similar-potential",
  "cannibalization-potential",
  "content-differentiation",
]);

function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

function pathOf(url: string) {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function refOf(f: Finding): OpportunityDiagnosticRef {
  return {
    findingId: f.id,
    ruleId: f.ruleId,
    ruleName: f.ruleName,
    severity: f.severity,
    category: f.category,
    field: f.field,
  };
}

const SNIPPET_RULE_FIELDS = new Set(["title", "metaDescription"]);

function factor(
  id: PriorityFactorId,
  value: number,
  reason: string,
): PriorityFactor {
  const scale = PRIORITY_SCALES[id];
  return {
    id,
    label: scale.label,
    value: Math.max(0, Math.min(scale.max, value)),
    max: scale.max,
    weight: PRIORITY_WEIGHTS[id],
    reason,
  };
}

/** Índice 0–100 a partir de los factores declarados (ponderación explícita). */
export function priorityIndexOf(factors: PriorityFactor[]): number {
  const total = factors.reduce((s, f) => s + (f.value / f.max) * f.weight, 0);
  return Math.round(total * 100);
}

export function priorityLevelOf(index: number): PriorityLevel {
  if (index >= PRIORITY_CUTOFFS.high) return "high";
  if (index >= PRIORITY_CUTOFFS.medium) return "medium";
  return "low";
}

function impactFactor(impressions: number, clicks: number): PriorityFactor {
  const t = CORRELATION_THRESHOLDS;
  const lost = Math.max(0, impressions - clicks);
  let value = 1;
  if (impressions >= t.minImpressions * 100) value = 4;
  else if (impressions >= t.minImpressions * 20) value = 3;
  else if (impressions >= t.minImpressions) value = 2;
  else if (impressions >= t.minImpressionsSoft) value = 1;
  else value = 0;
  return factor(
    "impact",
    value,
    `${impressions} impresiones y ${clicks} clics en el período (${lost} impresiones sin clic).`,
  );
}

function evidenceFactor(gsc: OpportunityGscEvidence): PriorityFactor {
  const t = CORRELATION_THRESHOLDS;
  let value = 0;
  if (gsc.metrics.impressions >= t.minImpressions) value += 2;
  else if (gsc.metrics.impressions >= t.minImpressionsSoft) value += 1;
  if (gsc.queries >= t.queriesForEvidence) value += 1;
  else if (gsc.queries >= 1) value += 0.5;
  if (gsc.daysWithData >= t.minDaysForTrend) value += 1;
  else if (gsc.daysWithData >= 3) value += 0.5;
  return factor(
    "evidence",
    Math.round(value * 2) / 2,
    `${gsc.queries} consulta(s) y ${gsc.daysWithData} día(s) con datos en ${gsc.period.startDate} → ${gsc.period.endDate}.`,
  );
}

function relevanceFactor(
  position: number,
  diagnostics: OpportunityDiagnosticRef[],
): PriorityFactor {
  const t = CORRELATION_THRESHOLDS;
  let value = 0;
  let posNote: string;
  if (position > 0 && position <= t.competitivePosition) {
    value += 2;
    posNote = `posición media ${position.toFixed(1)} (competitiva)`;
  } else if (position > 0 && position <= t.farPosition) {
    value += 1.5;
    posNote = `posición media ${position.toFixed(1)} (margen intermedio)`;
  } else {
    value += 0.5;
    posNote = `posición media ${position.toFixed(1)} (lejana)`;
  }
  const critical = diagnostics.some((d) => d.severity === "critical");
  const important = diagnostics.some((d) => d.severity === "important");
  if (critical) value += 2;
  else if (important) value += 1.5;
  else if (diagnostics.length > 0) value += 1;
  return factor(
    "relevance",
    value,
    `${posNote}; ${
      diagnostics.length === 0
        ? "sin diagnóstico SEO relacionado"
        : `${diagnostics.length} diagnóstico(s) relacionado(s)`
    }.`,
  );
}

const EASE_BY_TYPE: Record<OpportunityType, { value: number; reason: string }> = {
  "ctr-snippet": { value: 3, reason: "Acción concreta sobre title/meta description." },
  "position-margin": {
    value: 2,
    reason: "Requiere resolver hallazgos SEO y revisar la página completa.",
  },
  "impressions-low-ctr": { value: 3, reason: "Revisión de snippet y de la intención de las consultas." },
  "impressions-low-position": {
    value: 1,
    reason: "La visibilidad es lejana: exige trabajo de fondo, no un ajuste puntual.",
  },
  "performance-with-seo-issue": {
    value: 3,
    reason: "El diagnóstico existente ya indica qué corregir.",
  },
  "architecture-connectivity": {
    value: 2,
    reason: "Implica agregar enlaces internos desde páginas relacionadas.",
  },
  "content-demand": { value: 1, reason: "Implica ampliar o reescribir contenido." },
};

function easeFactor(
  type: OpportunityType,
  diagnostics: OpportunityDiagnosticRef[],
): PriorityFactor {
  const base = EASE_BY_TYPE[type];
  const editable = diagnostics.some((d) => d.field);
  const value = editable ? Math.min(4, base.value + 1) : base.value;
  return factor(
    "ease",
    value,
    editable
      ? `${base.reason} Existe un campo editable propuesto (${diagnostics.find((d) => d.field)?.field}).`
      : base.reason,
  );
}

function explainPriority(
  level: PriorityLevel,
  index: number,
  factors: PriorityFactor[],
): string {
  const parts = factors.map((f) => `${f.label} ${f.value}/${f.max}`);
  return `Esta oportunidad está priorizada como ${PRIORITY_LABELS[level]} (índice ${index}/100 de la capa de priorización, independiente del SEO Score) porque: ${parts.join(
    " · ",
  )}.`;
}

function buildGscEvidence(
  connection: Pick<GscConnection, "property" | "source" | "period">,
  rows: GscRow[],
  metrics: { clicks: number; impressions: number; ctr: number; position: number },
  queries: number,
): OpportunityGscEvidence {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const period = {
    startDate: connection.period?.startDate ?? dates[0] ?? "",
    endDate: connection.period?.endDate ?? dates[dates.length - 1] ?? "",
  };
  const topQueries = metricsByQuery(rows)
    .slice(0, 5)
    .map((q) => ({
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      position: q.position,
    }));

  const evidence: OpportunityGscEvidence = {
    property: connection.property.siteUrl,
    source: connection.source,
    period,
    metrics,
    queries,
    daysWithData: dates.length,
    topQueries,
  };

  // Tendencia: solo con suficientes días. Nunca se inventa con un único período corto.
  if (dates.length >= CORRELATION_THRESHOLDS.minDaysForTrend) {
    const mid = Math.floor(dates.length / 2);
    const firstDates = new Set(dates.slice(0, mid));
    const first = rows
      .filter((r) => firstDates.has(r.date))
      .reduce((s, r) => s + r.impressions, 0);
    const second = rows
      .filter((r) => !firstDates.has(r.date))
      .reduce((s, r) => s + r.impressions, 0);
    const delta = first === 0 ? 0 : (second - first) / first;
    evidence.trend = {
      direction: delta > 0.1 ? "up" : delta < -0.1 ? "down" : "flat",
      firstHalfImpressions: first,
      secondHalfImpressions: second,
      note: `Comparación de impresiones entre la primera y la segunda mitad del período (${dates.length} días con datos). No es una previsión.`,
    };
  }

  return evidence;
}

export interface CorrelationInput {
  audit: Audit;
  /** Filas ya filtradas por auditId + propiedad + período (Fase 6A). */
  rows: GscRow[];
  connection: Pick<GscConnection, "auditId" | "property" | "source" | "period">;
  graph?: LinkGraph | undefined;
  content?: ContentAnalysis | undefined;
}

/**
 * Construye las oportunidades correlacionadas y priorizadas de UNA auditoría.
 * Devuelve también la clasificación de URLs (ambas fuentes / solo GSC / solo auditoría).
 */
export function buildSeoPriorities(input: CorrelationInput): PrioritySummary {
  const { audit, rows, connection } = input;
  const t = CORRELATION_THRESHOLDS;

  // Aislamiento defensivo: nunca correlacionar filas de otra auditoría/propiedad.
  const safeRows = rows.filter(
    (r) => r.auditId === audit.id && r.property === connection.property.siteUrl,
  );

  const graph = input.graph ?? buildLinkGraph(audit);
  const content = input.content ?? analyzeContent(audit, graph);
  const contentByPage = new Map<string, ContentItem[]>();
  for (const item of content.items) {
    if (item.auditId !== audit.id) continue;
    const list = contentByPage.get(item.pageId);
    if (list) list.push(item);
    else contentByPage.set(item.pageId, [item]);
  }

  const pageMetrics = metricsByPage(safeRows, audit.pages);
  const rowsByPage = new Map<string, GscRow[]>();
  for (const row of safeRows) {
    if (!row.page) continue;
    const list = rowsByPage.get(row.page);
    if (list) list.push(row);
    else rowsByPage.set(row.page, [row]);
  }

  const gscKeys = new Set(pageMetrics.map((p) => normalizeForMatch(p.page)));
  const opportunities: SeoOpportunity[] = [];
  const gscOnlyUrls: string[] = [];

  for (const p of pageMetrics) {
    const pageRows = rowsByPage.get(p.page) ?? [];
    const metrics = {
      clicks: p.clicks,
      impressions: p.impressions,
      ctr: p.ctr,
      position: p.position,
    };
    const gsc = buildGscEvidence(connection, pageRows, metrics, p.queries);
    const page: PageSnapshot | undefined = p.pageId
      ? audit.pages.find((x) => x.id === p.pageId)
      : undefined;
    if (!p.pageId) gscOnlyUrls.push(p.page);

    const findings = audit.findings.filter(
      (f) => p.pageId && f.pageId === p.pageId && f.severity !== "ok",
    );
    const actionable = findings.filter((f) => f.severity !== "improvement");
    const snippetFindings = findings.filter(
      (f) => SNIPPET_RULE_FIELDS.has(f.field ?? "") || SNIPPET_RULE_FIELDS.has(f.ruleId),
    );
    const linkMetrics = p.pageId ? graph.byPageId[p.pageId] : undefined;
    const contentItems = (p.pageId ? contentByPage.get(p.pageId) : undefined) ?? [];
    const demandContent = contentItems.filter((i) => CONTENT_SIGNALS_FOR_DEMAND.has(i.signalId));

    const push = (
      type: OpportunityType,
      opts: {
        category: Category;
        diagnostics: OpportunityDiagnosticRef[];
        evidence: string[];
        explanation: string;
        recommendation: string;
      },
    ) => {
      const factors = [
        impactFactor(p.impressions, p.clicks),
        evidenceFactor(gsc),
        relevanceFactor(p.position, opts.diagnostics),
        easeFactor(type, opts.diagnostics),
      ];
      const index = priorityIndexOf(factors);
      const level = priorityLevelOf(index);
      opportunities.push({
        id: `${audit.id}:${type}:${normalizeForMatch(p.page)}`,
        auditId: audit.id,
        auditName: audit.name,
        isDemo: audit.isDemo,
        url: p.page,
        path: page?.path ?? pathOf(p.page),
        pageId: p.pageId,
        pageType: page?.pageType,
        type,
        typeLabel: OPPORTUNITY_TYPE_LABELS[type],
        category: opts.category,
        matchState: p.pageId ? "both" : "gsc-only",
        gsc,
        diagnostics: opts.diagnostics,
        ruleIds: [...new Set(opts.diagnostics.map((d) => d.ruleId))],
        evidence: opts.evidence,
        explanation: opts.explanation,
        recommendation: opts.recommendation,
        priority: level,
        priorityIndex: index,
        factors,
        priorityExplanation: explainPriority(level, index, factors),
      });
    };

    const baseEvidence = [
      `${p.impressions} impresiones`,
      `${p.clicks} clics`,
      `CTR ${pct(p.ctr)}`,
      `Posición media ${p.position.toFixed(1)}`,
      `${p.queries} consulta(s)`,
    ];

    // 1) Oportunidad de CTR / snippet: impresiones suficientes + posición competitiva + CTR bajo.
    if (
      p.impressions >= t.minImpressions &&
      p.position > 0 &&
      p.position <= t.competitivePosition &&
      p.ctr < t.lowCtr
    ) {
      push("ctr-snippet", {
        category: "onpage",
        diagnostics: snippetFindings.map(refOf),
        evidence: [
          ...baseEvidence,
          ...snippetFindings.map((f) => `Crawler: ${f.ruleName}`),
        ],
        explanation:
          "Alta visibilidad con CTR relativamente bajo: la URL acumula impresiones en posiciones competitivas y recibe pocos clics en el período." +
          (snippetFindings.length > 0
            ? " Además existe un hallazgo On-Page relacionado con el snippet."
            : ""),
        recommendation:
          "Revisar title y meta description para comprobar si representan la intención de las consultas asociadas. No se puede afirmar que modificarlos aumente los clics.",
      });
    }

    // 2) Margen potencial de posición: banda 8–20 con hallazgos resolubles.
    if (
      p.impressions >= t.minImpressionsSoft &&
      p.position >= t.positionMarginMin &&
      p.position <= t.positionMarginMax
    ) {
      push("position-margin", {
        category: actionable[0]?.category ?? "onpage",
        diagnostics: actionable.map(refOf),
        evidence: [
          ...baseEvidence,
          ...actionable.slice(0, 3).map((f) => `Crawler: ${f.ruleName} (${f.severity})`),
        ],
        explanation:
          "Esta página ya obtiene visibilidad en Google y presenta margen potencial de mejora: su posición media está en una banda intermedia." +
          (actionable.length > 0
            ? " Existen hallazgos SEO resolubles detectados en la misma auditoría."
            : " No se detectaron hallazgos críticos ni importantes."),
        recommendation:
          "Revisar los hallazgos de esta URL y la cobertura de las consultas asociadas. No se puede afirmar que corregirlos produzca una subida determinada de posiciones.",
      });
    }

    // 3) Impresiones sin clics: se distingue CTR bajo de posición muy baja.
    if (p.impressions >= t.minImpressions && p.clicks <= t.fewClicks) {
      const farAway = p.position > t.farPosition;
      push(farAway ? "impressions-low-position" : "impressions-low-ctr", {
        category: farAway ? "content" : "onpage",
        diagnostics: (farAway ? actionable : snippetFindings).map(refOf),
        evidence: baseEvidence,
        explanation: farAway
          ? `La URL registra impresiones pero su posición media (${p.position.toFixed(1)}) es lejana: los clics no se explican por el snippet.`
          : `La URL registra impresiones en posiciones alcanzables (${p.position.toFixed(1)}) y prácticamente no obtiene clics: es un caso de CTR bajo.`,
        recommendation: farAway
          ? "Revisar cobertura temática e intención de las consultas asociadas antes de retocar el snippet."
          : "Revisar el snippet y la correspondencia entre las consultas asociadas y el contenido de la página.",
      });
    }

    // 4) Problema SEO + rendimiento real (no duplica el diagnóstico: lo referencia).
    if (p.impressions >= t.minImpressionsSoft && actionable.length > 0) {
      push("performance-with-seo-issue", {
        category: actionable[0]!.category,
        diagnostics: actionable.map(refOf),
        evidence: [
          ...baseEvidence,
          ...actionable.slice(0, 3).map((f) => `Crawler: ${f.ruleName} (${f.severity})`),
        ],
        explanation:
          "Alta visibilidad + problema SEO: existe rendimiento orgánico real en esta URL y además hallazgos detectados por el crawler en la misma auditoría.",
        recommendation:
          "Priorizar el diagnóstico existente de esta URL frente a páginas sin visibilidad. El diagnóstico original no se modifica.",
      });
    }

    // 5) Arquitectura + GSC: visibilidad con baja conectividad interna.
    if (
      p.impressions >= t.minImpressionsSoft &&
      linkMetrics &&
      linkMetrics.depth > 0 &&
      linkMetrics.inbound <= t.lowInbound
    ) {
      push("architecture-connectivity", {
        category: "technical",
        diagnostics: [],
        evidence: [
          ...baseEvidence,
          `${linkMetrics.inbound} enlace(s) interno(s) entrante(s)`,
          `${linkMetrics.inboundPages} página(s) enlazándola`,
          `Profundidad ${linkMetrics.depth}`,
        ],
        explanation:
          "Página con visibilidad orgánica y baja conectividad interna: recibe impresiones y casi no está enlazada dentro del sitio. No se afirma causalidad entre ambas señales.",
        recommendation:
          "Evaluar enlaces internos desde páginas relacionadas de la misma auditoría, con anchor text descriptivo.",
      });
    }

    // 6) Contenido + GSC: demanda orgánica con contenido a revisar.
    if (p.impressions >= t.minImpressionsSoft && demandContent.length > 0) {
      push("content-demand", {
        category: "content",
        diagnostics: demandContent
          .map((i) => i.relatedFindingId)
          .filter((fid): fid is string => Boolean(fid))
          .map((fid) => audit.findings.find((f) => f.id === fid))
          .filter((f): f is Finding => Boolean(f))
          .map(refOf),
        evidence: [...baseEvidence, ...demandContent.slice(0, 3).map((i) => i.signalName)],
        explanation:
          "Página con demanda orgánica y oportunidad de ampliar/revisar contenido. No se afirma que el contenido sea la causa del rendimiento observado.",
        recommendation:
          "Revisar la señal de contenido de la Fase 5 junto con las consultas asociadas de esta URL.",
      });
    }
  }

  const auditOnlyUrls = audit.pages
    .filter((p) => !gscKeys.has(normalizeForMatch(p.url)))
    .map((p) => p.url);

  const counts: Record<PriorityLevel, number> = { high: 0, medium: 0, low: 0 };
  for (const o of opportunities) counts[o.priority] += 1;

  const dates = [...new Set(safeRows.map((r) => r.date))].sort();

  return {
    auditId: audit.id,
    source: connection.source,
    property: connection.property.siteUrl,
    period: {
      startDate: connection.period?.startDate ?? dates[0] ?? "",
      endDate: connection.period?.endDate ?? dates[dates.length - 1] ?? "",
    },
    opportunities: opportunities.sort(
      (a, b) =>
        b.priorityIndex - a.priorityIndex ||
        b.gsc.metrics.impressions - a.gsc.metrics.impressions,
    ),
    counts,
    matchedUrls: pageMetrics.filter((p) => p.pageId).length,
    gscOnlyUrls,
    auditOnlyUrls,
  };
}

/** Consultas de UNA auditoría con la URL asociada (para la tabla de consultas). */
export function queriesWithPages(rows: GscRow[], audit: Audit) {
  const groups = new Map<
    string,
    { query: string; page?: string | undefined; clicks: number; impressions: number; positionWeighted: number }
  >();
  for (const row of rows) {
    if (!row.query || row.auditId !== audit.id) continue;
    const key = `${row.query}|${row.page ?? ""}`;
    const g = groups.get(key);
    if (g) {
      g.clicks += row.clicks;
      g.impressions += row.impressions;
      g.positionWeighted += row.position * row.impressions;
    } else {
      groups.set(key, {
        query: row.query,
        page: row.page,
        clicks: row.clicks,
        impressions: row.impressions,
        positionWeighted: row.position * row.impressions,
      });
    }
  }
  const pageIndex = new Map(audit.pages.map((p) => [normalizeForMatch(p.url), p]));
  return [...groups.values()]
    .map((g) => ({
      query: g.query,
      page: g.page ?? "",
      pageId: g.page ? pageIndex.get(normalizeForMatch(g.page))?.id : undefined,
      clicks: g.clicks,
      impressions: g.impressions,
      ctr: g.impressions > 0 ? g.clicks / g.impressions : 0,
      position: g.impressions > 0 ? g.positionWeighted / g.impressions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

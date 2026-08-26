/**
 * Capa de DIAGNÓSTICO (derivada, solo lectura).
 *
 * No ejecuta reglas, no rastrea, no recalcula el score: toma los hallazgos y
 * el score ya guardados en cada auditoría y los combina con la definición de
 * la regla que los originó para producir un diagnóstico accionable
 * (problema, ubicación, severidad, impacto, qué detectamos, recomendación,
 * impacto estimado en puntos y agrupación por regla).
 *
 * Todo diagnóstico queda atado a su `auditId` porque se construye siempre a
 * partir de una `Audit` concreta.
 *
 * PRIORIDAD POR HALLAZGO (sin GSC): cada Diagnostic lleva `relevance`, `ease`,
 * `priorityLabel` y `priorityExplanation` derivados SOLO de severity + campo
 * editable, reutilizando las escalas declaradas en `src/seo/priority/types`
 * (PRIORITY_SCALES). No depende de datos de Search Console.
 */
import { RULES } from "./rules";
import type { Audit, Category, Finding, FindingKind, PageType, Severity } from "./types";
import { PRIORITY_SCALES, type PriorityLevel } from "@/seo/priority/types";
import { editableFieldEase, severityRelevance } from "@/seo/priority/factors";

export function getRule(ruleId: string) {
  return RULES.find((r) => r.id === ruleId);
}

export interface Diagnostic {
  key: string;
  /** Aislamiento: auditoría dueña del hallazgo. */
  auditId: string;
  auditName: string;
  isDemo?: boolean | undefined;
  findingId: string;
  ruleId: string;
  ruleName: string;
  pageId: string;
  pageUrl: string;
  pagePath: string;
  pageType?: PageType | undefined;
  category: Category;
  kind: FindingKind;
  severity: Severity;
  field?: string | undefined;
  /** Valor actual detectado por el crawler/regla. */
  current: string;
  /** Qué detectamos exactamente (texto de la regla que disparó). */
  detected: string;
  /** Por qué importa (explicación declarada por la regla). */
  why?: string | undefined;
  /** Qué recomendamos (sugerencia concreta de la regla). */
  recommendation?: string | undefined;
  evidence?: string[] | undefined;
  /** Puntos de score que el sistema ya calculó para esta regla (score.drivers). */
  estimatedPoints?: number | undefined;
  /** Cantidad de URLs afectadas por la misma regla dentro de la auditoría. */
  occurrences: number;
  /** true cuando la regla no aporta datos suficientes para un diagnóstico fiable. */
  pending: boolean;
  pendingReason?: string | undefined;
  /**
   * Relevancia del hallazgo (escala 0–4, misma que PRIORITY_SCALES.relevance).
   * Sin GSC: deriva únicamente de la severidad.
   */
  relevance: number;
  /**
   * Facilidad de resolución (escala 0–4, misma que PRIORITY_SCALES.ease).
   * Sin GSC: deriva únicamente de si el hallazgo tiene un campo editable.
   */
  ease: number;
  /** Etiqueta simple: "alta" / "media" / "baja". Derivada de severity + relevance + ease. */
  priorityLabel: string;
  /** Frase corta que explica por qué tiene esa prioridad (sin mencionar GSC). */
  priorityExplanation: string;
}

function pathOf(url: string) {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Factores de prioridad SIN GSC — reuso directo del núcleo compartido
// (src/seo/priority/factors.ts): severityRelevance y editableFieldEase.
// Sin GSC, la severidad y el campo editable son las únicas señales
// disponibles por hallazgo.
// ---------------------------------------------------------------------------

const DIAGNOSTIC_PRIORITY_LABELS: Record<PriorityLevel, string> = {
  high: "alta",
  medium: "media",
  low: "baja",
};

/**
 * Etiqueta de prioridad derivada SOLO de severity + ease (relevance es función
 * de severity, así que entra implícitamente). Escala simple y explicable,
 * sin índice 0-100 ni datos de GSC.
 *
 *   critical            → alta  (siempre, independientemente de la facilidad)
 *   important + campo   → alta
 *   important sin campo → media
 *   improvement + campo → media
 *   improvement s/campo → baja
 *   ok                  → baja
 */
function diagnosticPriorityLevel(severity: Severity, ease: number): PriorityLevel {
  const easyField = PRIORITY_SCALES.ease.max;
  if (severity === "critical") return "high";
  if (severity === "important") return ease >= easyField ? "high" : "medium";
  if (severity === "improvement") return ease >= easyField ? "medium" : "low";
  return "low";
}

const SEVERITY_TEXT: Record<Severity, string> = {
  critical: "crítica",
  important: "importante",
  improvement: "mejora",
  ok: "ok",
};

function diagnosticPriorityExplanation(
  level: PriorityLevel,
  severity: Severity,
  relevance: number,
  ease: number,
  fieldName?: string,
): string {
  const easeNote = fieldName
    ? `Tiene campo editable (${fieldName}), por lo que es directo de corregir.`
    : "No tiene campo editable automático, requiere revisión manual.";
  return `Prioridad ${DIAGNOSTIC_PRIORITY_LABELS[level]}: severidad ${SEVERITY_TEXT[severity]}, relevancia ${relevance}/${PRIORITY_SCALES.relevance.max} y facilidad ${ease}/${PRIORITY_SCALES.ease.max}. ${easeNote}`;
}

export function buildDiagnostic(audit: Audit, finding: Finding): Diagnostic {
  const rule = getRule(finding.ruleId);
  const page = audit.pages.find((p) => p.id === finding.pageId);
  const driver = (audit.score?.drivers ?? []).find((d) => d.ruleId === finding.ruleId);
  const occurrences = audit.findings.filter((f) => f.ruleId === finding.ruleId).length;

  const why = finding.explanation ?? rule?.explanation;
  const missing: string[] = [];
  if (!why?.trim()) missing.push("explicación de impacto");
  if (!finding.problem?.trim()) missing.push("descripción del problema");
  if (!finding.suggestion?.trim() && !rule?.field) missing.push("recomendación concreta");

  const field = finding.field ?? rule?.field;
  const relevance = diagnosticRelevance(finding.severity);
  const ease = diagnosticEase(Boolean(field));
  const priorityLevel = diagnosticPriorityLevel(finding.severity, ease);
  const priorityLabel = DIAGNOSTIC_PRIORITY_LABELS[priorityLevel];
  const priorityExplanation = diagnosticPriorityExplanation(
    priorityLevel,
    finding.severity,
    relevance,
    ease,
    field,
  );

  return {
    key: `${audit.id}:${finding.id}`,
    auditId: audit.id,
    auditName: audit.name,
    isDemo: audit.isDemo,
    findingId: finding.id,
    ruleId: finding.ruleId,
    ruleName: finding.ruleName,
    pageId: finding.pageId,
    pageUrl: finding.pageUrl,
    pagePath: page?.path ?? pathOf(finding.pageUrl),
    pageType: page?.pageType,
    category: finding.category,
    kind: finding.kind,
    severity: finding.severity,
    field,
    current: finding.current,
    detected: finding.problem,
    why,
    recommendation: finding.suggestion,
    evidence: finding.evidence,
    estimatedPoints: driver?.points,
    occurrences,
    pending: missing.length > 0,
    pendingReason: missing.length
      ? `Regla pendiente de definición: falta ${missing.join(", ")}.`
      : undefined,
    relevance,
    ease,
    priorityLabel,
    priorityExplanation,
  };
}

export function buildDiagnosticById(audit: Audit, findingId: string): Diagnostic | null {
  const finding = audit.findings.find((f) => f.id === findingId);
  return finding ? buildDiagnostic(audit, finding) : null;
}

export interface DiagnosticGroup {
  auditId: string;
  ruleId: string;
  ruleName: string;
  category: Category;
  kind: FindingKind;
  /** Severidad más alta observada en el grupo. */
  severity: Severity;
  /** Puntos ya calculados por el sistema para esta regla. */
  estimatedPoints?: number | undefined;
  why?: string | undefined;
  items: Diagnostic[];
  /** Prioridad más alta del grupo ("alta" / "media" / "baja"). */
  priorityLabel: string;
  /** Relevancia máxima del grupo (escala 0–4). */
  relevance: number;
  /** Facilidad máxima del grupo (escala 0–4). */
  ease: number;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  important: 1,
  improvement: 2,
  ok: 3,
};

const PRIORITY_ORDER: Record<string, number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

/** Agrupa los hallazgos de UNA auditoría por regla, conservando el orden de prioridad ya existente. */
export function groupDiagnostics(audit: Audit, findings?: Finding[]): DiagnosticGroup[] {
  const source = findings ?? audit.findings;
  const groups = new Map<string, DiagnosticGroup>();

  for (const finding of source) {
    const diagnostic = buildDiagnostic(audit, finding);
    const group = groups.get(finding.ruleId);
    if (group) {
      group.items.push(diagnostic);
      if (SEVERITY_ORDER[diagnostic.severity] < SEVERITY_ORDER[group.severity]) {
        group.severity = diagnostic.severity;
      }
      // Agregar prioridad: mantener el máximo (más urgente) del grupo.
      if ((PRIORITY_ORDER[diagnostic.priorityLabel] ?? 2) < (PRIORITY_ORDER[group.priorityLabel] ?? 2)) {
        group.priorityLabel = diagnostic.priorityLabel;
      }
      group.relevance = Math.max(group.relevance, diagnostic.relevance);
      group.ease = Math.max(group.ease, diagnostic.ease);
    } else {
      groups.set(finding.ruleId, {
        auditId: audit.id,
        ruleId: diagnostic.ruleId,
        ruleName: diagnostic.ruleName,
        category: diagnostic.category,
        kind: diagnostic.kind,
        severity: diagnostic.severity,
        estimatedPoints: diagnostic.estimatedPoints,
        why: diagnostic.why,
        items: [diagnostic],
        priorityLabel: diagnostic.priorityLabel,
        relevance: diagnostic.relevance,
        ease: diagnostic.ease,
      });
    }
  }

  return [...groups.values()].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (PRIORITY_ORDER[a.priorityLabel] ?? 2) - (PRIORITY_ORDER[b.priorityLabel] ?? 2) ||
      b.relevance + b.ease - (a.relevance + a.ease) ||
      (b.estimatedPoints ?? 0) - (a.estimatedPoints ?? 0) ||
      b.items.length - a.items.length,
  );
}

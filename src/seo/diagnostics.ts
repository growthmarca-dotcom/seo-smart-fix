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
 */
import { RULES } from "./rules";
import type { Audit, Category, Finding, FindingKind, PageType, Severity } from "./types";

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
}

function pathOf(url: string) {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
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
    field: finding.field ?? rule?.field,
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
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  important: 1,
  improvement: 2,
  ok: 3,
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
      });
    }
  }

  return [...groups.values()].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (b.estimatedPoints ?? 0) - (a.estimatedPoints ?? 0) ||
      b.items.length - a.items.length,
  );
}

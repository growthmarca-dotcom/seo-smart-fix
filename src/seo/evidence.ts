/**
 * Evidence Engine — Fase 1: contrato común de evidencia.
 *
 * Objetivo de esta fase: definir UN solo tipo de evidencia compartido por
 * todos los modelos que hoy exponen `evidence: string[]`
 * (Finding, RuleResult, Diagnostic, ContentItem, EcommerceFinding,
 * GscOpportunitySignal, Opportunity), SIN reemplazar todavía `string[]`
 * ni migrar las reglas.
 *
 * Retrocompatibilidad: `EvidenceItem` incluye `string`, por lo que toda
 * evidencia histórica persistida (localStorage) sigue siendo válida y
 * legible sin migración de datos.
 *
 * Esta capa es pura: no importa reglas, plataformas ni UI.
 */

/** Naturaleza del dato de evidencia. */
export type EvidenceKind =
  /** Valor detectado actualmente (title real, meta real, etc.). */
  | "value"
  /** Valor o umbral esperado (referencia contextual). */
  | "expected"
  /** URL afectada o relacionada. */
  | "url"
  /** Cantidad medida (ocurrencias, enlaces, imágenes). */
  | "count"
  /** Fragmento literal de HTML/texto. */
  | "snippet"
  /** Nota libre: equivalente estructurado de la evidencia string actual. */
  | "note";

/** Evidencia estructurada. `label` siempre es legible por el usuario final. */
export interface StructuredEvidence {
  kind: EvidenceKind;
  /** Etiqueta corta y legible. Ej: "Title actual", "Umbral contextual". */
  label: string;
  /** Valor detectado, ya formateado para mostrar. */
  value?: string | undefined;
  /** Valor esperado / de referencia, para comparaciones lado a lado. */
  expected?: string | undefined;
  /** URL asociada (clickeable en la UI). */
  url?: string | undefined;
  /** Cantidad numérica asociada. */
  count?: number | undefined;
  /** Fragmento literal (HTML o texto) sin formatear. */
  snippet?: string | undefined;
}

/**
 * Contrato común. Un `string` se interpreta como nota libre, exactamente
 * igual que la evidencia actual.
 */
export type EvidenceItem = string | StructuredEvidence;

/** Lista de evidencia en el contrato común. */
export type EvidenceList = EvidenceItem[];

/** true si el item es evidencia estructurada (y no una string histórica). */
export function isStructuredEvidence(item: EvidenceItem): item is StructuredEvidence {
  return typeof item === "object" && item !== null && "kind" in item && "label" in item;
}

/** Convierte cualquier item al formato estructurado, sin perder información. */
export function toStructuredEvidence(item: EvidenceItem): StructuredEvidence {
  if (isStructuredEvidence(item)) return item;
  return { kind: "note", label: item };
}

/** Normaliza una lista mixta (o ausente) a evidencia estructurada. */
export function normalizeEvidence(
  items?: readonly EvidenceItem[] | undefined,
): StructuredEvidence[] {
  if (!items) return [];
  return items.map(toStructuredEvidence);
}

/**
 * Texto plano de un item, apto para las vistas actuales que renderizan
 * strings. Mantiene la UI existente funcionando sin cambios.
 */
export function evidenceText(item: EvidenceItem): string {
  if (!isStructuredEvidence(item)) return item;
  const parts: string[] = [];
  if (item.value !== undefined && item.value !== "") parts.push(item.value);
  if (item.count !== undefined) parts.push(String(item.count));
  if (item.expected !== undefined && item.expected !== "")
    parts.push(`esperado: ${item.expected}`);
  if (item.url) parts.push(item.url);
  if (item.snippet !== undefined && item.snippet !== "") parts.push(item.snippet);
  const detail = parts.join(" · ");
  return detail ? `${item.label}: ${detail}` : item.label;
}

/** Proyecta una lista mixta a `string[]` (compatibilidad con modelos actuales). */
export function evidenceToStrings(items?: readonly EvidenceItem[] | undefined): string[] {
  if (!items) return [];
  return items.map(evidenceText);
}

/* ------------------------------------------------------------------ */
/* Constructores. Azúcar para que las reglas migren sin repetir kinds. */
/* ------------------------------------------------------------------ */

export const evidence = {
  value(label: string, value: string): StructuredEvidence {
    return { kind: "value", label, value };
  },
  expected(label: string, expected: string, value?: string): StructuredEvidence {
    return { kind: "expected", label, expected, value };
  },
  url(label: string, url: string): StructuredEvidence {
    return { kind: "url", label, url, value: url };
  },
  count(label: string, count: number): StructuredEvidence {
    return { kind: "count", label, count };
  },
  snippet(label: string, snippet: string): StructuredEvidence {
    return { kind: "snippet", label, snippet };
  },
  note(label: string): StructuredEvidence {
    return { kind: "note", label };
  },
};

/**
 * Evidence Engine — Etapa 3: modelo de presentación de evidencia.
 * Puro (sin React): decide qué partes se muestran por cada item, evitando
 * URLs duplicadas y etiquetas redundantes. No altera datos almacenados.
 */
import { isStructuredEvidence, type EvidenceItem, type EvidenceKind } from "./evidence";

export interface EvidenceDisplay {
  kind: EvidenceKind;
  /** Etiqueta visible; vacía cuando sería redundante con el dato. */
  label: string;
  value?: string;
  expected?: string;
  url?: string;
  count?: number;
  snippet?: string;
  /** true si el item original era un string histórico. */
  legacy: boolean;
}

const GENERIC_URL_LABELS = new Set(["url", "url afectada", "dirección"]);
const nonEmpty = (s?: string) => (s !== undefined && s.trim() !== "" ? s : undefined);

export function toEvidenceDisplay(item: EvidenceItem): EvidenceDisplay {
  if (!isStructuredEvidence(item)) return { kind: "note", label: item, legacy: true };
  const url = nonEmpty(item.url);
  let value = nonEmpty(item.value);
  // La URL ya se muestra como enlace: no repetirla como valor.
  if (url && value && value.trim() === url.trim()) value = undefined;
  let label = item.label;
  if (value && label.trim() === value.trim()) value = undefined;
  if (url && (label.trim() === url.trim() || (item.kind === "url" && GENERIC_URL_LABELS.has(label.trim().toLowerCase()) && !value)))
    label = "";
  const out: EvidenceDisplay = { kind: item.kind, label, legacy: false };
  if (value) out.value = value;
  const expected = nonEmpty(item.expected);
  if (expected) out.expected = expected;
  if (url) out.url = url;
  if (item.count !== undefined) out.count = item.count;
  const snippet = nonEmpty(item.snippet);
  if (snippet) out.snippet = snippet;
  return out;
}

/** Línea de texto sin duplicados (para informe/impresión). */
export function evidenceLine(item: EvidenceItem): string {
  const d = toEvidenceDisplay(item);
  if (d.legacy) return d.label;
  const parts: string[] = [];
  if (d.value) parts.push(d.value);
  if (d.count !== undefined) parts.push(String(d.count));
  if (d.expected) parts.push(`esperado: ${d.expected}`);
  if (d.url) parts.push(d.url);
  if (d.snippet) parts.push(d.snippet);
  const detail = parts.join(" · ");
  if (!d.label) return detail;
  return detail ? `${d.label}: ${detail}` : d.label;
}

/** Usa evidenceItems si existen; si no, las strings históricas. */
export function pickEvidence(d: {
  evidence?: readonly string[] | undefined;
  evidenceItems?: readonly EvidenceItem[] | undefined;
}): EvidenceItem[] {
  if (d.evidenceItems && d.evidenceItems.length > 0) return [...d.evidenceItems];
  return [...(d.evidence ?? [])];
}

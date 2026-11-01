/**
 * Equivalencias entre la evaluación comercial turística (por auditoría) y el diagnóstico integral
 * (por empresa). Fuente única: el valor turístico se LEE, no se copia. Si ambos tienen valor
 * y difieren, se informa el conflicto; nunca se elige en silencio.
 */
import type { CommercialControlState, CommercialReview, CommercialStatus } from "@/seo/tourism/commercial-review";
import { isJustifiedNotApplicable, type ControlState, type ControlStatus } from "./model";

/** id turístico → id del diagnóstico. Controles sin equivalencia quedan exclusivos de turismo. */
export const TOURISM_EQUIVALENCES: Record<string, string> = {
  "property-info": "web-offer-clarity",
  "photos-description": "brand-content",
  "contact-whatsapp": "ch-whatsapp",
  "booking-engine": "ch-booking",
  "mobile-path": "web-mobile",
  "ota-consistency": "vis-ota",
  "value-proposition": "brand-value",
  measurement: "sales-conversion",
  // "rates-policies": exclusivo de turismo. "trust": pendiente de decisión (dividir reseñas / confianza).
};

const STATUS_MAP: Record<CommercialStatus, ControlStatus> = {
  verified: "meets",
  "needs-review": "needs-improvement",
  "not-applicable": "not-applicable",
};

export interface ResolvedControl {
  state: ControlState | undefined;
  source: "diagnosis" | "tourism" | "none";
  conflict: boolean;
  /** true si la fuente turística dice "No aplica" sin justificación (se trata como Sin evaluar). */
  unjustifiedNotApplicable?: boolean;
}

function fromTourism(t: CommercialControlState): ControlState | undefined {
  if (!t.status) return undefined;
  return { status: STATUS_MAP[t.status], notes: t.notes ?? "", evidenceUrl: t.evidenceUrl, updatedAt: t.updatedAt ?? "" };
}

/** Resuelve el valor de un control del diagnóstico considerando la evaluación turística vinculada. */
export function resolveControl(
  diagnosisControlId: string,
  own: ControlState | undefined,
  review: CommercialReview | undefined,
): ResolvedControl {
  const tid = Object.keys(TOURISM_EQUIVALENCES).find((k) => TOURISM_EQUIVALENCES[k] === diagnosisControlId);
  let t = tid && review?.controls[tid] ? fromTourism(review.controls[tid]!) : undefined;
  let unjustifiedNotApplicable = false;
  if (t && t.status === "not-applicable" && !isJustifiedNotApplicable(t)) {
    t = { ...t, status: "unevaluated" };
    unjustifiedNotApplicable = true;
  }
  const flag = unjustifiedNotApplicable ? { unjustifiedNotApplicable } : {};
  const ownSet = own && own.status !== "unevaluated" ? own : undefined;
  const tSet = t && t.status !== "unevaluated" ? t : undefined;
  if (ownSet && tSet) return { state: ownSet, source: "diagnosis", conflict: ownSet.status !== tSet.status, ...flag };
  if (ownSet) return { state: ownSet, source: "diagnosis", conflict: false, ...flag };
  if (tSet) return { state: tSet, source: "tourism", conflict: false };
  if (t) return { state: t, source: "tourism", conflict: false, ...flag };
  return { state: undefined, source: "none", conflict: false };
}

/* ------------------------------------------------------------------ */
/* Evaluación vigente entre varias auditorías vinculadas.              */
/* ------------------------------------------------------------------ */

export interface ReviewCandidate {
  auditId: string;
  /** Fecha de la auditoría (finishedAt ?? createdAt). */
  auditDate: string;
  review: CommercialReview | undefined;
}

export interface CurrentReviewChoice {
  /** Evaluación usada; undefined si ninguna auditoría tiene controles evaluados. */
  current: (ReviewCandidate & { reviewUpdatedAt: string }) | undefined;
  /** "latest" = regla por defecto; "selected" = elegida explícitamente. */
  reason: "latest" | "selected" | "none";
  /** Las demás evaluaciones con datos, más recientes primero. Nunca se descartan. */
  others: (ReviewCandidate & { reviewUpdatedAt: string })[];
}

const hasEvaluated = (r: CommercialReview | undefined) => !!r && Object.values(r.controls).some((c) => !!c.status);

/**
 * Por defecto, la auditoría vinculada más reciente con al menos un control evaluado.
 * Si se pasa selectedAuditId válido (con datos), se usa esa. Las demás quedan en `others`.
 */
export function pickCurrentReview(candidates: ReviewCandidate[], selectedAuditId?: string): CurrentReviewChoice {
  const withData = candidates
    .filter((c) => hasEvaluated(c.review))
    .map((c) => ({ ...c, reviewUpdatedAt: c.review!.updatedAt }))
    .sort((a, b) => b.auditDate.localeCompare(a.auditDate) || b.reviewUpdatedAt.localeCompare(a.reviewUpdatedAt));
  if (!withData.length) return { current: undefined, reason: "none", others: [] };
  const sel = selectedAuditId ? withData.find((c) => c.auditId === selectedAuditId) : undefined;
  const current = sel ?? withData[0]!;
  return { current, reason: sel ? "selected" : "latest", others: withData.filter((c) => c !== current) };
}

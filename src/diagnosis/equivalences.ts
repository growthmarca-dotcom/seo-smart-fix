/**
 * Equivalencias entre la evaluación comercial turística (por auditoría) y el diagnóstico integral
 * (por empresa). Fuente única: el valor turístico se LEE, no se copia. Si ambos tienen valor
 * y difieren, se informa el conflicto; nunca se elige en silencio.
 */
import type { CommercialControlState, CommercialReview, CommercialStatus } from "@/seo/tourism/commercial-review";
import type { ControlState, ControlStatus } from "./model";

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
  const t = tid && review?.controls[tid] ? fromTourism(review.controls[tid]!) : undefined;
  const ownSet = own && own.status !== "unevaluated" ? own : undefined;
  if (ownSet && t) return { state: ownSet, source: "diagnosis", conflict: ownSet.status !== t.status };
  if (ownSet) return { state: ownSet, source: "diagnosis", conflict: false };
  if (t) return { state: t, source: "tourism", conflict: false };
  return { state: undefined, source: "none", conflict: false };
}

/**
 * Evaluación comercial para alojamientos turísticos (asistida / manual).
 * Capa separada de los hallazgos SEO automáticos: no lee reglas, no genera
 * hallazgos y no modifica el SEO Score ni las prioridades. Un control solo
 * cambia de estado cuando lo decide quien audita; nunca se marca automáticamente.
 */

export type CommercialStatus = "verified" | "needs-review" | "not-applicable";

export const COMMERCIAL_STATUS_LABELS: Record<CommercialStatus, string> = {
  verified: "Verificado",
  "needs-review": "Requiere revisión",
  "not-applicable": "No aplica",
};

export const UNEVALUATED_LABEL = "Sin evaluar";

export interface CommercialControlDef {
  id: string;
  title: string;
  guidance: string;
}

export const COMMERCIAL_CONTROLS: CommercialControlDef[] = [
  { id: "property-info", title: "Información del alojamiento clara y completa", guidance: "Tipo de alojamiento, ubicación o zona y capacidad o unidades cuando corresponda." },
  { id: "photos-description", title: "Fotografías y descripción", guidance: "Permiten entender la propuesta: espacios, servicios y entorno." },
  { id: "contact-whatsapp", title: "Contacto y WhatsApp visibles y funcionales", guidance: "Probar que teléfono, correo y WhatsApp funcionen y estén a la vista." },
  { id: "booking-engine", title: "Motor de reservas y recorrido de reserva", guidance: "Existe un camino para reservar y se entiende cada paso." },
  { id: "rates-policies", title: "Disponibilidad, tarifas, condiciones y políticas", guidance: "Comprensibles cuando se publican (cancelación, depósito, check-in/out)." },
  { id: "mobile-path", title: "Consulta o reserva desde el celular", guidance: "Recorrer la consulta o reserva desde un teléfono." },
  { id: "ota-consistency", title: "Presencia en OTAs y coherencia de la información", guidance: "Si corresponde: datos, fotos y precios coherentes entre sitio y plataformas como Booking o Airbnb." },
  { id: "value-proposition", title: "Diferenciación y propuesta de valor", guidance: "Queda claro por qué elegir este alojamiento frente a otros de la zona." },
  { id: "trust", title: "Confianza", guidance: "Reseñas, políticas, datos de contacto e información verificable del negocio." },
  { id: "measurement", title: "Medición de consultas y reservas", guidance: "Si existen: herramientas analíticas y registro de consultas o reservas." },
];

export interface CommercialControlState {
  status?: CommercialStatus | undefined;
  notes: string;
  updatedAt?: string | undefined;
}

/** Una evaluación pertenece a UNA auditoría. */
export interface CommercialReview {
  auditId: string;
  controls: Record<string, CommercialControlState>;
  updatedAt: string;
}

const STATUSES = new Set<CommercialStatus>(["verified", "needs-review", "not-applicable"]);

export function emptyReview(auditId: string, at = new Date().toISOString()): CommercialReview {
  return { auditId, controls: {}, updatedAt: at };
}

/** Actualiza un control sin tocar los demás. Ignora ids y estados desconocidos. */
export function updateControl(
  review: CommercialReview,
  controlId: string,
  patch: { status?: CommercialStatus | null; notes?: string },
  at = new Date().toISOString(),
): CommercialReview {
  if (!COMMERCIAL_CONTROLS.some((c) => c.id === controlId)) return review;
  if (patch.status != null && !STATUSES.has(patch.status)) return review;
  const prev = review.controls[controlId] ?? { notes: "" };
  const next: CommercialControlState = {
    status: patch.status === null ? undefined : (patch.status ?? prev.status),
    notes: patch.notes ?? prev.notes,
    updatedAt: at,
  };
  return { ...review, controls: { ...review.controls, [controlId]: next }, updatedAt: at };
}

export interface CommercialRow extends CommercialControlDef {
  status?: CommercialStatus | undefined;
  statusLabel: string;
  notes: string;
}

/** Filas en el orden de los controles; los no evaluados quedan "Sin evaluar". */
export function reviewRows(review: CommercialReview | undefined): CommercialRow[] {
  return COMMERCIAL_CONTROLS.map((c) => {
    const s = review?.controls[c.id];
    const status = s?.status && STATUSES.has(s.status) ? s.status : undefined;
    return { ...c, status, statusLabel: status ? COMMERCIAL_STATUS_LABELS[status] : UNEVALUATED_LABEL, notes: s?.notes ?? "" };
  });
}

export function reviewSummary(review: CommercialReview | undefined) {
  const rows = reviewRows(review);
  const count = (s?: CommercialStatus) => rows.filter((r) => r.status === s).length;
  return {
    total: rows.length,
    verified: count("verified"),
    needsReview: count("needs-review"),
    notApplicable: count("not-applicable"),
    unevaluated: count(undefined),
  };
}

export function hasAnyEvaluation(review: CommercialReview | undefined): boolean {
  return reviewRows(review).some((r) => r.status || r.notes.trim());
}

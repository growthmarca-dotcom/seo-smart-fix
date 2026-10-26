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

/* ------------------------------------------------------------------ */
/* Integración en el informe: diagnóstico comercial y plan de acción.  */
/* Solo se consideran controles marcados "Requiere revisión" por quien */
/* audita. Nunca se infiere un problema de un control sin evaluar.     */
/* ------------------------------------------------------------------ */

export type CommercialPriority = "alta" | "media" | "baja";

export interface CommercialActionDef {
  priority: CommercialPriority;
  consequence: string;
  action: string;
}

/**
 * Prioridad según cercanía al momento de consulta/reserva:
 * alta = bloquea o dificulta el contacto/reserva directa;
 * media = afecta la decisión de reservar; baja = estratégico/medición.
 */
export const COMMERCIAL_ACTIONS: Record<string, CommercialActionDef> = {
  "contact-whatsapp": { priority: "alta", consequence: "Se pueden perder consultas si el visitante no encuentra o no logra usar el teléfono, el correo o WhatsApp.", action: "Dejar visibles en todas las páginas el teléfono, el correo y WhatsApp, y probar que cada uno funcione." },
  "booking-engine": { priority: "alta", consequence: "Un recorrido de reserva confuso o inexistente puede llevar al huésped a reservar por intermediarios o a abandonar.", action: "Ofrecer un camino de reserva claro desde las páginas principales y revisar que cada paso se entienda." },
  "mobile-path": { priority: "alta", consequence: "Gran parte de las consultas llegan desde el celular; si el recorrido falla allí, se pierden reservas.", action: "Recorrer la consulta y la reserva desde un teléfono y corregir los pasos que traben el proceso." },
  "property-info": { priority: "media", consequence: "Si no se entiende qué se ofrece, dónde y para cuántas personas, el visitante compara con otras opciones.", action: "Completar tipo de alojamiento, zona y capacidad o unidades en un lugar visible." },
  "photos-description": { priority: "media", consequence: "Fotos o descripciones insuficientes reducen la confianza para reservar.", action: "Mostrar fotos representativas de espacios, servicios y entorno, con una descripción clara." },
  "rates-policies": { priority: "media", consequence: "Tarifas o condiciones poco claras generan dudas, consultas repetidas o abandono.", action: "Explicar de forma simple tarifas (si se publican), cancelación, depósito y horarios de ingreso y salida." },
  "value-proposition": { priority: "media", consequence: "Sin una diferencia clara, la decisión se apoya solo en el precio.", action: "Expresar en la página principal por qué elegir este alojamiento frente a otros de la zona." },
  trust: { priority: "media", consequence: "La falta de reseñas, políticas o datos verificables reduce la confianza para reservar directamente.", action: "Mostrar reseñas reales, políticas y datos de contacto verificables del negocio." },
  "ota-consistency": { priority: "baja", consequence: "Información distinta entre el sitio y plataformas de reserva confunde al huésped.", action: "Revisar que datos, fotos y precios coincidan entre el sitio y las plataformas donde se publica." },
  measurement: { priority: "baja", consequence: "Sin medición no se sabe cuántas consultas o reservas genera el sitio.", action: "Registrar las consultas y reservas que llegan desde el sitio con una herramienta de análisis." },
};

export interface CommercialIssue extends CommercialActionDef {
  id: string;
  title: string;
  notes: string;
}

/** Controles "Requiere revisión", uno por control (sin duplicados), ordenados por prioridad. */
export function commercialIssues(review: CommercialReview | undefined): CommercialIssue[] {
  const order: Record<CommercialPriority, number> = { alta: 0, media: 1, baja: 2 };
  const seen = new Set<string>();
  const out: CommercialIssue[] = [];
  for (const r of reviewRows(review)) {
    if (r.status !== "needs-review" || seen.has(r.id)) continue;
    const def = COMMERCIAL_ACTIONS[r.id];
    if (!def) continue;
    seen.add(r.id);
    out.push({ id: r.id, title: r.title, notes: r.notes, ...def });
  }
  return out.sort((a, b) => order[a.priority] - order[b.priority]);
}

export function commercialIssuesByPriority(review: CommercialReview | undefined, p: CommercialPriority) {
  return commercialIssues(review).filter((i) => i.priority === p);
}

/**
 * Diagnóstico integral por empresa. Lógica pura: el store solo llama a estas funciones.
 * Un control sin registro = "unevaluated" (sin evaluar), nunca cero.
 */
export type ControlStatus = "unevaluated" | "no-data" | "meets" | "needs-improvement" | "not-applicable";
export const CONTROL_STATUS_LABELS: Record<ControlStatus, string> = {
  unevaluated: "Sin evaluar",
  "no-data": "Sin datos",
  meets: "Cumple",
  "needs-improvement": "Requiere mejora",
  "not-applicable": "No aplica",
};

export interface ControlState {
  status: ControlStatus;
  notes: string;
  evidenceUrl?: string | undefined;
  updatedAt: string;
}

export interface CompanyDiagnosis {
  companyId: string;
  controls: Record<string, ControlState>;
  updatedAt: string;
}

const STATUSES = new Set<ControlStatus>(["unevaluated", "no-data", "meets", "needs-improvement", "not-applicable"]);

/** "No aplica" solo excluye el control si tiene justificación escrita (en notas). */
export function isJustifiedNotApplicable(s: Pick<ControlState, "status" | "notes">): boolean {
  return s.status === "not-applicable" && (s.notes ?? "").trim().length > 0;
}

export function emptyDiagnosis(companyId: string, at: string): CompanyDiagnosis {
  return { companyId, controls: {}, updatedAt: at };
}

export function setControl(
  d: CompanyDiagnosis,
  controlId: string,
  patch: Partial<Pick<ControlState, "status" | "notes" | "evidenceUrl">>,
  at: string,
): CompanyDiagnosis {
  if (patch.status && !STATUSES.has(patch.status)) return d;
  const prev = d.controls[controlId] ?? { status: "unevaluated" as const, notes: "", updatedAt: at };
  const next: ControlState = { ...prev, ...patch, updatedAt: at };
  // "No aplica" sin justificación se rechaza.
  if (next.status === "not-applicable" && !isJustifiedNotApplicable(next)) return d;
  if (patch.evidenceUrl !== undefined) next.evidenceUrl = patch.evidenceUrl.trim() || undefined;
  return { ...d, controls: { ...d.controls, [controlId]: next }, updatedAt: at };
}

/** Normaliza datos guardados. Estados previos sin diagnósticos → []. Descarta empresas inexistentes. */
export function migrateDiagnoses(loaded: unknown, companyIds: string[]): CompanyDiagnosis[] {
  const known = new Set(companyIds);
  const seen = new Set<string>();
  if (!Array.isArray(loaded)) return [];
  return loaded
    .filter((d): d is CompanyDiagnosis => !!d && typeof d === "object" && typeof (d as CompanyDiagnosis).companyId === "string")
    .filter((d) => known.has(d.companyId) && !seen.has(d.companyId) && (seen.add(d.companyId), true))
    .map((d) => ({
      companyId: d.companyId,
      updatedAt: d.updatedAt ?? new Date(0).toISOString(),
      controls: Object.fromEntries(
        Object.entries(d.controls && typeof d.controls === "object" ? d.controls : {})
          .filter(([, c]) => c && STATUSES.has(c.status))
          .map(([id, c]) => [id, { status: c.status, notes: c.notes ?? "", evidenceUrl: c.evidenceUrl, updatedAt: c.updatedAt ?? "" }]),
      ),
    }));
}

/* ------------------------------------------------------------------ */
/* Etapa B.1 — Evaluación integral por empresa (historial, sin borrado). */
/* ------------------------------------------------------------------ */
/*
 * Estados: se reutiliza ControlStatus (sin tipos nuevos). La UI de MarCa Audit ofrecerá cuatro
 * estados visibles: Cumple (meets), Requiere mejora (needs-improvement), Sin evaluar (unevaluated)
 * y No aplica (not-applicable, con justificación obligatoria). "no-data" se conserva solo para
 * compatibilidad con el motor (cuenta como no cubierto). El cálculo de scoring.ts no cambia:
 * una evaluación se puede pasar como CompanyDiagnosis con assessmentAsDiagnosis().
 */

export type AssessmentStatus = "in-progress" | "completed";
export type ControlSourceKind = "manual" | "tourism-import" | "client-provided";

export interface AssessmentControlState extends ControlState {
  sourceKind?: ControlSourceKind | undefined;
}

export interface CompanyAssessment {
  id: string;
  companyId: string;
  title: string;
  evaluator?: string | undefined;
  /** YYYY-MM-DD */
  assessmentDate: string;
  status: AssessmentStatus;
  controls: Record<string, AssessmentControlState>;
  executiveSummary?: string | undefined;
  /** Si se precargó desde una evaluación turística, la auditoría de origen (solo referencia). */
  tourismSourceAuditId?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentInput {
  title?: string | undefined;
  evaluator?: string | undefined;
  assessmentDate?: string | undefined;
  executiveSummary?: string | undefined;
}

export type AssessmentMetaPatch = Partial<Pick<CompanyAssessment, "title" | "evaluator" | "assessmentDate" | "status" | "executiveSummary">>;

const ASSESSMENT_STATUSES = new Set<AssessmentStatus>(["in-progress", "completed"]);
const SOURCE_KINDS = new Set<ControlSourceKind>(["manual", "tourism-import", "client-provided"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyAssessment(id: string, companyId: string, at: string, input: AssessmentInput = {}): CompanyAssessment {
  const date = input.assessmentDate && DATE_RE.test(input.assessmentDate) ? input.assessmentDate : at.slice(0, 10);
  return {
    id,
    companyId,
    title: input.title?.trim() || `Evaluación integral ${date}`,
    evaluator: input.evaluator?.trim() || undefined,
    assessmentDate: date,
    status: "in-progress",
    controls: {},
    executiveSummary: input.executiveSummary?.trim() || undefined,
    createdAt: at,
    updatedAt: at,
  };
}

/** Actualiza un control. Rechaza estados desconocidos y "No aplica" sin justificación (devuelve el original). */
export function updateAssessmentControl(
  a: CompanyAssessment,
  controlId: string,
  patch: Partial<Pick<AssessmentControlState, "status" | "notes" | "evidenceUrl" | "sourceKind">>,
  at: string,
): CompanyAssessment {
  if (patch.status && !STATUSES.has(patch.status)) return a;
  if (patch.sourceKind && !SOURCE_KINDS.has(patch.sourceKind)) return a;
  const prev = a.controls[controlId] ?? { status: "unevaluated" as const, notes: "", updatedAt: at };
  const next: AssessmentControlState = { ...prev, ...patch, sourceKind: patch.sourceKind ?? (patch.status || patch.notes !== undefined || patch.evidenceUrl !== undefined ? "manual" : prev.sourceKind), updatedAt: at };
  if (next.status === "not-applicable" && !isJustifiedNotApplicable(next)) return a;
  if (patch.evidenceUrl !== undefined) next.evidenceUrl = patch.evidenceUrl.trim() || undefined;
  return { ...a, controls: { ...a.controls, [controlId]: next }, updatedAt: at };
}

export function updateAssessmentMeta(a: CompanyAssessment, patch: AssessmentMetaPatch, at: string): CompanyAssessment {
  if (patch.status && !ASSESSMENT_STATUSES.has(patch.status)) return a;
  if (patch.assessmentDate !== undefined && !DATE_RE.test(patch.assessmentDate)) return a;
  const next = { ...a, ...patch, updatedAt: at };
  if (patch.title !== undefined) next.title = patch.title.trim() || a.title;
  return next;
}

const TOURISM_STATUS: Record<string, ControlStatus> = {
  verified: "meets",
  "needs-review": "needs-improvement",
  "not-applicable": "not-applicable",
};

/**
 * Copia POR VALOR los controles turísticos equivalentes como valores iniciales.
 * `equivalences` = id turístico → id del diagnóstico (TOURISM_EQUIVALENCES).
 * No muta `review`. Sobrescribe solo controles aún sin evaluar en la evaluación integral.
 * "No aplica" sin justificación se importa como "Sin evaluar" con aviso.
 */
export function importTourismEquivalences(
  a: CompanyAssessment,
  review: { auditId: string; controls: Record<string, { status?: string | undefined; notes: string; evidenceUrl?: string | undefined }> },
  equivalences: Record<string, string>,
  at: string,
): CompanyAssessment {
  const controls: Record<string, AssessmentControlState> = { ...a.controls };
  let imported = 0;
  for (const [tid, target] of Object.entries(equivalences)) {
    const t = review.controls[tid];
    if (!t || !t.status || !TOURISM_STATUS[t.status]) continue;
    const own = controls[target];
    if (own && own.status !== "unevaluated") continue; // nunca pisa una evaluación propia
    let status = TOURISM_STATUS[t.status]!;
    let notes = t.notes ?? "";
    if (status === "not-applicable" && !notes.trim()) {
      status = "unevaluated";
      notes = "Importado como «Sin evaluar»: la evaluación turística indicaba «No aplica» sin justificación.";
    }
    controls[target] = { status, notes, evidenceUrl: t.evidenceUrl, sourceKind: "tourism-import", updatedAt: at };
    imported++;
  }
  if (!imported) return a;
  return { ...a, controls, tourismSourceAuditId: review.auditId, updatedAt: at };
}

/** Adaptador para reutilizar scoring.ts sin cambios. */
export function assessmentAsDiagnosis(a: CompanyAssessment): CompanyDiagnosis {
  return { companyId: a.companyId, controls: a.controls, updatedAt: a.updatedAt };
}

/** Normaliza evaluaciones guardadas. Nunca descarta evaluaciones de empresas conocidas; ignora registros corruptos. */
export function migrateAssessments(loaded: unknown): CompanyAssessment[] {
  if (!Array.isArray(loaded)) return [];
  const seen = new Set<string>();
  return loaded
    .filter((x): x is CompanyAssessment => !!x && typeof x === "object" && typeof (x as CompanyAssessment).id === "string" && typeof (x as CompanyAssessment).companyId === "string")
    .filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
    .map((x) => ({
      ...x,
      title: typeof x.title === "string" ? x.title : "Evaluación integral",
      assessmentDate: typeof x.assessmentDate === "string" ? x.assessmentDate : (x.createdAt ?? "").slice(0, 10),
      status: ASSESSMENT_STATUSES.has(x.status) ? x.status : "in-progress",
      controls: Object.fromEntries(
        Object.entries(x.controls && typeof x.controls === "object" ? x.controls : {}).filter(([, c]) => c && STATUSES.has(c.status)),
      ),
      createdAt: x.createdAt ?? new Date(0).toISOString(),
      updatedAt: x.updatedAt ?? x.createdAt ?? new Date(0).toISOString(),
    }));
}

/**
 * Núcleo Empresas + Roadmap de seguimiento (lógica pura, sin React ni storage).
 *
 * - Una empresa tiene UNA instancia propia de roadmap (copiada de una plantilla).
 *   Nunca se comparte una plantilla mutable entre empresas.
 * - Las auditorías SEO se asocian por id; no se duplican datos ni hallazgos.
 * - El store (src/store/app-store.ts) solo llama a estas funciones; así la
 *   persistencia puede migrar a un backend real sin cambiar las reglas.
 */
import { TOURISM_TEMPLATE, GENERIC_TEMPLATE, type TemplatePhase } from "./templates";

export type Industry =
  | "tourism-lodging"
  | "hotel"
  | "cabins"
  | "hostel"
  | "restaurant"
  | "real-estate"
  | "ecommerce"
  | "other";

export const INDUSTRY_LABELS: Record<Industry, string> = {
  "tourism-lodging": "Alojamiento turístico",
  hotel: "Hotel",
  cabins: "Cabañas / dúplex",
  hostel: "Hostel",
  restaurant: "Restaurante / gastronomía",
  "real-estate": "Inmobiliaria",
  ecommerce: "E-commerce",
  other: "Otro",
};

export const TOURISM_INDUSTRIES: Industry[] = ["tourism-lodging", "hotel", "cabins", "hostel"];
export const isTourismIndustry = (i: Industry) => TOURISM_INDUSTRIES.includes(i);

export type CompanyStatus = "prospect" | "active" | "paused" | "closed";
export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  prospect: "Prospecto",
  active: "Activa",
  paused: "En pausa",
  closed: "Finalizada",
};

export interface Company {
  id: string;
  tradeName: string;
  legalName?: string;
  website?: string;
  industry: Industry;
  contactName?: string;
  email?: string;
  phone?: string;
  location?: string;
  notes?: string;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
  /** Auditorías SEO asociadas (solo ids; los datos viven en `audits`). */
  auditIds: string[];
}

export type CompanyInput = Omit<Company, "id" | "createdAt" | "updatedAt" | "auditIds">;

export type TaskStatus = "pending" | "in-progress" | "blocked" | "done" | "not-applicable";
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendiente",
  "in-progress": "En curso",
  blocked: "Bloqueada",
  done: "Completada",
  "not-applicable": "No aplica",
};
export type TaskPriority = "high" | "medium" | "low";
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export interface TaskEvidence {
  id: string;
  at: string;
  url?: string;
  note: string;
}
export interface TaskLogEntry {
  at: string;
  detail: string;
  from?: TaskStatus;
  to?: TaskStatus;
}
export interface RoadmapTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  owner?: string;
  dueDate?: string; // YYYY-MM-DD
  notes: string;
  evidence: TaskEvidence[];
  /** Marca la tarea que se vincula con auditorías SEO existentes. */
  kind?: "seo-audit";
  linkedAuditIds?: string[];
  updatedAt: string;
  log: TaskLogEntry[];
}
export interface RoadmapPhase {
  id: string;
  key: string;
  title: string;
  tasks: RoadmapTask[];
}
export interface Roadmap {
  id: string;
  companyId: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
  phases: RoadmapPhase[];
}

export interface Ctx {
  now: () => string;
  newId: () => string;
}

// ---------------------------------------------------------------- validación

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeWebsite(raw: string | undefined): string | undefined {
  const v = (raw ?? "").trim();
  if (!v) return undefined;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function validateCompanyInput(input: Partial<CompanyInput>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.tradeName?.trim()) errors.tradeName = "Ingresá el nombre comercial.";
  else if (input.tradeName.trim().length > 120) errors.tradeName = "Máximo 120 caracteres.";
  if (!input.industry || !(input.industry in INDUSTRY_LABELS)) errors.industry = "Elegí un rubro.";
  if (input.email?.trim() && !EMAIL_RE.test(input.email.trim())) errors.email = "El email no parece válido.";
  const web = normalizeWebsite(input.website);
  if (web) {
    try {
      const u = new URL(web);
      if (!u.hostname.includes(".")) errors.website = "La dirección del sitio no parece válida.";
    } catch {
      errors.website = "La dirección del sitio no parece válida.";
    }
  }
  if (input.phone?.trim() && !/^[\d\s()+\-.]{6,}$/.test(input.phone.trim()))
    errors.phone = "El teléfono solo puede tener números, espacios y + ( ) -.";
  return errors;
}

function clean(input: CompanyInput): CompanyInput {
  const t = (s?: string) => (s?.trim() ? s.trim() : undefined);
  return {
    tradeName: input.tradeName.trim(),
    legalName: t(input.legalName),
    website: normalizeWebsite(input.website),
    industry: input.industry,
    contactName: t(input.contactName),
    email: t(input.email),
    phone: t(input.phone),
    location: t(input.location),
    notes: t(input.notes),
    status: input.status ?? "prospect",
  };
}

// ---------------------------------------------------------------- creación

function taskFromTemplate(t: TemplatePhase["tasks"][number], ctx: Ctx, at: string): RoadmapTask {
  return {
    id: ctx.newId(),
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: "pending",
    notes: "",
    evidence: [],
    kind: t.kind,
    linkedAuditIds: t.kind === "seo-audit" ? [] : undefined,
    updatedAt: at,
    log: [{ at, detail: "Tarea creada desde la plantilla" }],
  };
}

export function buildRoadmap(companyId: string, industry: Industry, ctx: Ctx): Roadmap {
  const at = ctx.now();
  const tpl = isTourismIndustry(industry) ? TOURISM_TEMPLATE : GENERIC_TEMPLATE;
  return {
    id: ctx.newId(),
    companyId,
    templateId: tpl.id,
    createdAt: at,
    updatedAt: at,
    // Copia profunda: cada empresa recibe objetos nuevos con ids propios.
    phases: tpl.phases.map((p) => ({
      id: ctx.newId(),
      key: p.key,
      title: p.title,
      tasks: p.tasks.map((t) => taskFromTemplate(t, ctx, at)),
    })),
  };
}

export function createCompany(input: CompanyInput, ctx: Ctx): { company: Company; roadmap: Roadmap } {
  const errors = validateCompanyInput(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).join(" "));
  const at = ctx.now();
  const company: Company = { ...clean(input), id: ctx.newId(), createdAt: at, updatedAt: at, auditIds: [] };
  return { company, roadmap: buildRoadmap(company.id, company.industry, ctx) };
}

export function updateCompany(company: Company, input: CompanyInput, ctx: Ctx): Company {
  const errors = validateCompanyInput(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).join(" "));
  return { ...company, ...clean(input), updatedAt: ctx.now() };
}

// ---------------------------------------------------------------- tareas

export type TaskPatch = Partial<Pick<RoadmapTask, "title" | "description" | "priority" | "status" | "owner" | "dueDate" | "notes">>;

function mapTask(r: Roadmap, taskId: string, fn: (t: RoadmapTask) => RoadmapTask, at: string): Roadmap {
  let found = false;
  const phases = r.phases.map((p) => ({
    ...p,
    tasks: p.tasks.map((t) => {
      if (t.id !== taskId) return t;
      found = true;
      return fn(t);
    }),
  }));
  return found ? { ...r, phases, updatedAt: at } : r;
}

export function updateTask(r: Roadmap, taskId: string, patch: TaskPatch, ctx: Ctx, statusNote?: string): Roadmap {
  const at = ctx.now();
  return mapTask(
    r,
    taskId,
    (t) => {
      const log = [...t.log];
      if (patch.status && patch.status !== t.status) {
        log.push({
          at,
          from: t.status,
          to: patch.status,
          detail: `Estado: ${TASK_STATUS_LABELS[t.status]} → ${TASK_STATUS_LABELS[patch.status]}${statusNote?.trim() ? ` · ${statusNote.trim()}` : ""}`,
        });
      }
      const changed = (["title", "description", "priority", "owner", "dueDate"] as const).filter(
        (k) => k in patch && (patch[k] ?? "") !== (t[k] ?? ""),
      );
      if (changed.length) log.push({ at, detail: `Editado: ${changed.join(", ")}` });
      const next: RoadmapTask = { ...t, ...patch, log, updatedAt: at };
      if (patch.title !== undefined && !patch.title.trim()) next.title = t.title;
      if (patch.owner !== undefined) next.owner = patch.owner.trim() || undefined;
      if (patch.dueDate !== undefined) next.dueDate = patch.dueDate || undefined;
      if (patch.status === "not-applicable" && statusNote?.trim())
        next.notes = [t.notes, `No aplica: ${statusNote.trim()}`].filter(Boolean).join("\n");
      return next;
    },
    at,
  );
}

export function addEvidence(r: Roadmap, taskId: string, ev: { url?: string; note: string }, ctx: Ctx): Roadmap {
  const at = ctx.now();
  const url = ev.url?.trim() ? normalizeWebsite(ev.url) : undefined;
  const note = ev.note.trim();
  if (!url && !note) return r;
  return mapTask(
    r,
    taskId,
    (t) => ({
      ...t,
      evidence: [...t.evidence, { id: ctx.newId(), at, url, note }],
      log: [...t.log, { at, detail: `Evidencia agregada${url ? `: ${url}` : ""}` }],
      updatedAt: at,
    }),
    at,
  );
}

export function addTask(
  r: Roadmap,
  phaseId: string,
  input: { title: string; description?: string; priority?: TaskPriority },
  ctx: Ctx,
): Roadmap {
  if (!input.title.trim()) return r;
  const at = ctx.now();
  const task: RoadmapTask = {
    id: ctx.newId(),
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    priority: input.priority ?? "medium",
    status: "pending",
    notes: "",
    evidence: [],
    updatedAt: at,
    log: [{ at, detail: "Tarea agregada manualmente" }],
  };
  return {
    ...r,
    updatedAt: at,
    phases: r.phases.map((p) => (p.id === phaseId ? { ...p, tasks: [...p.tasks, task] } : p)),
  };
}

export function addPhase(r: Roadmap, title: string, ctx: Ctx): Roadmap {
  if (!title.trim()) return r;
  return {
    ...r,
    updatedAt: ctx.now(),
    phases: [...r.phases, { id: ctx.newId(), key: "custom", title: title.trim(), tasks: [] }],
  };
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function moveTask(r: Roadmap, taskId: string, dir: -1 | 1, ctx: Ctx): Roadmap {
  return {
    ...r,
    updatedAt: ctx.now(),
    phases: r.phases.map((p) => {
      const i = p.tasks.findIndex((t) => t.id === taskId);
      return i === -1 ? p : { ...p, tasks: swap(p.tasks, i, i + dir) };
    }),
  };
}

export function movePhase(r: Roadmap, phaseId: string, dir: -1 | 1, ctx: Ctx): Roadmap {
  const i = r.phases.findIndex((p) => p.id === phaseId);
  return i === -1 ? r : { ...r, updatedAt: ctx.now(), phases: swap(r.phases, i, i + dir) };
}

// ---------------------------------------------------------------- auditorías

export function linkAudit(
  company: Company,
  roadmap: Roadmap | undefined,
  auditId: string,
  auditLabel: string,
  ctx: Ctx,
): { company: Company; roadmap: Roadmap | undefined } {
  if (company.auditIds.includes(auditId)) return { company, roadmap };
  const at = ctx.now();
  const nextCompany = { ...company, auditIds: [...company.auditIds, auditId], updatedAt: at };
  if (!roadmap) return { company: nextCompany, roadmap };
  const phases = roadmap.phases.map((p) => ({
    ...p,
    tasks: p.tasks.map((t) =>
      t.kind === "seo-audit"
        ? {
            ...t,
            // Se vincula, pero el estado NO cambia: la usuaria confirma.
            linkedAuditIds: [...(t.linkedAuditIds ?? []), auditId],
            log: [...t.log, { at, detail: `Auditoría SEO vinculada: ${auditLabel}` }],
            updatedAt: at,
          }
        : t,
    ),
  }));
  return { company: nextCompany, roadmap: { ...roadmap, phases, updatedAt: at } };
}

export function unlinkAudit(
  company: Company,
  roadmap: Roadmap | undefined,
  auditId: string,
  ctx: Ctx,
  detail = "Auditoría SEO desvinculada",
): { company: Company; roadmap: Roadmap | undefined } {
  if (!company.auditIds.includes(auditId)) return { company, roadmap };
  const at = ctx.now();
  const nextCompany = { ...company, auditIds: company.auditIds.filter((a) => a !== auditId), updatedAt: at };
  if (!roadmap) return { company: nextCompany, roadmap };
  const phases = roadmap.phases.map((p) => ({
    ...p,
    tasks: p.tasks.map((t) =>
      t.linkedAuditIds?.includes(auditId)
        ? {
            ...t,
            linkedAuditIds: t.linkedAuditIds.filter((a) => a !== auditId),
            log: [...t.log, { at, detail }],
            updatedAt: at,
          }
        : t,
    ),
  }));
  return { company: nextCompany, roadmap: { ...roadmap, phases, updatedAt: at } };
}

// ---------------------------------------------------------------- progreso

export interface RoadmapProgress {
  applicable: number;
  done: number;
  percent: number;
  pending: number;
  inProgress: number;
  blocked: number;
  notApplicable: number;
  /** Siguiente acción sugerida: NO implica que se haya ejecutado nada. */
  nextAction?: { phaseTitle: string; task: RoadmapTask };
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export function roadmapProgress(r: Roadmap | undefined): RoadmapProgress {
  const res: RoadmapProgress = { applicable: 0, done: 0, percent: 0, pending: 0, inProgress: 0, blocked: 0, notApplicable: 0 };
  if (!r) return res;
  let candidate: { phaseIdx: number; phaseTitle: string; task: RoadmapTask; rank: number } | undefined;
  r.phases.forEach((p, phaseIdx) =>
    p.tasks.forEach((t) => {
      if (t.status === "not-applicable") {
        res.notApplicable++;
        return;
      }
      res.applicable++;
      if (t.status === "done") res.done++;
      else if (t.status === "pending") res.pending++;
      else if (t.status === "in-progress") res.inProgress++;
      else if (t.status === "blocked") res.blocked++;
      if (t.status === "pending" || t.status === "in-progress") {
        // Primera fase abierta; dentro de ella, en curso antes que pendiente y luego prioridad.
        const rank = (t.status === "in-progress" ? 0 : 10) + PRIORITY_RANK[t.priority];
        if (!candidate || phaseIdx < candidate.phaseIdx || (phaseIdx === candidate.phaseIdx && rank < candidate.rank))
          candidate = { phaseIdx, phaseTitle: p.title, task: t, rank };
      }
    }),
  );
  res.percent = res.applicable ? Math.round((res.done / res.applicable) * 100) : 0;
  if (candidate) res.nextAction = { phaseTitle: candidate.phaseTitle, task: candidate.task };
  return res;
}

/** Tareas con fecha objetivo anterior a `today` (YYYY-MM-DD) y no cerradas. */
export function overdueTasks(r: Roadmap | undefined, today: string): RoadmapTask[] {
  if (!r) return [];
  return r.phases.flatMap((p) =>
    p.tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "not-applicable"),
  );
}

// ---------------------------------------------------------------- migración

const STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];
const PRIORITIES = Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[];

/**
 * Normaliza datos guardados (posiblemente antiguos o incompletos).
 * Estados previos sin estos campos → arrays vacíos. Nunca borra auditorías.
 */
export function migrateCompanies(
  loaded: { companies?: unknown; roadmaps?: unknown },
  knownAuditIds: string[],
): { companies: Company[]; roadmaps: Roadmap[] } {
  const audits = new Set(knownAuditIds);
  const seen = new Set<string>();
  const companies: Company[] = (Array.isArray(loaded.companies) ? loaded.companies : [])
    .filter((c): c is Company => !!c && typeof c === "object" && typeof (c as Company).id === "string" && typeof (c as Company).tradeName === "string")
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .map((c) => ({
      ...c,
      industry: c.industry in INDUSTRY_LABELS ? c.industry : "other",
      status: c.status in COMPANY_STATUS_LABELS ? c.status : "prospect",
      createdAt: c.createdAt ?? new Date(0).toISOString(),
      updatedAt: c.updatedAt ?? c.createdAt ?? new Date(0).toISOString(),
      auditIds: Array.isArray(c.auditIds) ? [...new Set(c.auditIds.filter((a) => audits.has(a)))] : [],
    }));
  const companyIds = new Set(companies.map((c) => c.id));
  const roadmapFor = new Set<string>();
  const roadmaps: Roadmap[] = (Array.isArray(loaded.roadmaps) ? loaded.roadmaps : [])
    .filter((r): r is Roadmap => !!r && typeof r === "object" && companyIds.has((r as Roadmap).companyId))
    .filter((r) => (roadmapFor.has(r.companyId) ? false : (roadmapFor.add(r.companyId), true)))
    .map((r) => ({
      ...r,
      phases: (Array.isArray(r.phases) ? r.phases : []).map((p) => ({
        ...p,
        tasks: (Array.isArray(p.tasks) ? p.tasks : []).map((t) => ({
          ...t,
          status: STATUSES.includes(t.status) ? t.status : "pending",
          priority: PRIORITIES.includes(t.priority) ? t.priority : "medium",
          notes: t.notes ?? "",
          description: t.description ?? "",
          evidence: Array.isArray(t.evidence) ? t.evidence : [],
          log: Array.isArray(t.log) ? t.log : [],
          linkedAuditIds: t.linkedAuditIds?.filter((a) => audits.has(a)),
        })),
      })),
    }));
  return { companies, roadmaps };
}

/**
 * Lógica de presentación del Informe de Seguimiento por empresa (Etapa 1).
 * Funciones puras: no modifican empresas, roadmaps ni auditorías.
 * Las auditorías se leen por id; nunca se copian sus datos.
 */
import { countBySeverity } from "@/seo/engine";
import type { Audit } from "@/seo/types";
import {
  COMPANY_STATUS_LABELS,
  INDUSTRY_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  overdueTasks,
  roadmapProgress,
  type Company,
  type Roadmap,
  type TaskStatus,
} from "./model";

export const NOT_AVAILABLE = "No informado";

export function fmtReportDate(iso?: string): string {
  if (!iso) return "No disponible";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No disponible";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

export function companyIdentityRows(c: Company): [string, string][] {
  return [
    ["Nombre comercial", c.tradeName],
    ["Razón social", c.legalName ?? NOT_AVAILABLE],
    ["Rubro", INDUSTRY_LABELS[c.industry]],
    ["Estado", COMPANY_STATUS_LABELS[c.status]],
    ["Sitio web", c.website ?? NOT_AVAILABLE],
    ["Localidad", c.location ?? NOT_AVAILABLE],
    ["Contacto", c.contactName ?? NOT_AVAILABLE],
    ["Email", c.email ?? NOT_AVAILABLE],
    ["Teléfono", c.phone ?? NOT_AVAILABLE],
  ];
}

/** Nombre visible de la auditoría; agrega la marca demo solo si el nombre no la trae ya. */
export function auditDisplayName(name: string, isDemo: boolean): string {
  if (!isDemo || /demo/i.test(name)) return name;
  return `${name} (demo)`;
}

export interface ReportTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  statusLabel: string;
  priorityLabel: string;
  owner: string;
  dueDate: string;
  overdue: boolean;
  notes: string;
  evidence: { id: string; date: string; note: string; url: string | undefined }[];
  linkedAudits: string[];
}
export interface ReportPhase {
  id: string;
  title: string;
  counts: { applicable: number; done: number; notApplicable: number };
  tasks: ReportTask[];
}

/** Roadmap completo para el informe. Usa los mismos criterios de vencida/No aplica que el modelo. */
export function roadmapPhasesForReport(
  roadmap: Roadmap | undefined,
  today: string,
  auditNames: Record<string, string>,
): ReportPhase[] {
  if (!roadmap) return [];
  const overdueIds = new Set(overdueTasks(roadmap, today).map((t) => t.id));
  return roadmap.phases.map((p) => ({
    id: p.id,
    title: p.title,
    counts: {
      applicable: p.tasks.filter((t) => t.status !== "not-applicable").length,
      done: p.tasks.filter((t) => t.status === "done").length,
      notApplicable: p.tasks.filter((t) => t.status === "not-applicable").length,
    },
    tasks: p.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      statusLabel: TASK_STATUS_LABELS[t.status],
      priorityLabel: TASK_PRIORITY_LABELS[t.priority],
      owner: t.owner ?? "Sin asignar",
      dueDate: t.dueDate ? fmtReportDate(`${t.dueDate}T12:00:00`) : "Sin fecha",
      overdue: overdueIds.has(t.id),
      notes: t.notes.trim(),
      evidence: t.evidence.map((e) => ({ id: e.id, date: fmtReportDate(e.at), note: e.note, url: e.url })),
      linkedAudits: (t.linkedAuditIds ?? []).flatMap((id) => (auditNames[id] ? [auditNames[id]!] : [])),
    })),
  }));
}

export interface AuditSummary {
  id: string;
  name: string;
  rootUrl: string;
  isDemo: boolean;
  date: string;
  score: number | undefined;
  critical: number;
  important: number;
  improvement: number;
}

/** Auditorías asociadas existentes, en el orden de `company.auditIds`. Ids huérfanos se omiten. */
export function linkedAuditSummaries(company: Company, audits: Audit[]): AuditSummary[] {
  const byId = new Map(audits.map((a) => [a.id, a]));
  return company.auditIds.flatMap((id) => {
    const a = byId.get(id);
    if (!a) return [];
    const c = countBySeverity(a.findings);
    return [{
      id: a.id,
      name: auditDisplayName(a.name, !!a.isDemo),
      rootUrl: a.rootUrl,
      isDemo: !!a.isDemo,
      date: fmtReportDate(a.finishedAt ?? a.createdAt),
      score: a.score?.total,
      critical: c.critical,
      important: c.important,
      improvement: c.improvement,
    }];
  });
}

export function executiveSummary(roadmap: Roadmap | undefined, today: string) {
  const p = roadmapProgress(roadmap);
  const overdue = overdueTasks(roadmap, today);
  return {
    hasRoadmap: !!roadmap,
    percent: p.percent,
    done: p.done,
    applicable: p.applicable,
    breakdown: [
      ["Completadas", p.done],
      ["En curso", p.inProgress],
      ["Pendientes", p.pending],
      ["Bloqueadas", p.blocked],
      ["No aplican", p.notApplicable],
    ] as [string, number][],
    nextAction: p.nextAction ? { phase: p.nextAction.phaseTitle, title: p.nextAction.task.title } : undefined,
    overdue: overdue.map((t) => ({ title: t.title, dueDate: t.dueDate! })),
  };
}

/**
 * Lógica de presentación del Informe de Seguimiento por empresa (Etapa 1).
 * Funciones puras: no modifican empresas, roadmaps ni auditorías.
 * Las auditorías se leen por id; nunca se copian sus datos.
 */
import { countBySeverity } from "@/seo/engine";
import type { Audit } from "@/seo/types";
import { COMPANY_STATUS_LABELS, INDUSTRY_LABELS, overdueTasks, roadmapProgress, type Company, type Roadmap } from "./model";

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
      name: a.name,
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

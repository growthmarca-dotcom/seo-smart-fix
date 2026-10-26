import { describe, expect, it } from "vitest";
import * as cm from "./model";

let n = 0;
const ctx: cm.Ctx = { now: () => "2026-10-25T00:00:00.000Z", newId: () => `id${++n}` };
const base: cm.CompanyInput = { tradeName: "Dúplex del Centro", industry: "cabins", status: "active" };

describe("empresas + roadmap", () => {
  it("valida nombre comercial obligatorio", () => {
    expect(cm.validateCompanyInput({ ...base, tradeName: " " })["tradeName"]).toBeTruthy();
  });

  it("crear empresa genera roadmap propio con tareas pendientes", () => {
    const { company, roadmap } = cm.createCompany(base, ctx);
    expect(roadmap.companyId).toBe(company.id);
    const tasks = roadmap.phases.flatMap((p) => p.tasks);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.status === "pending")).toBe(true);
    expect(cm.roadmapProgress(roadmap).percent).toBe(0);
  });

  it("dos empresas no comparten tareas", () => {
    const a = cm.createCompany(base, ctx).roadmap;
    const b = cm.createCompany(base, ctx).roadmap;
    const t = a.phases[0]!.tasks[0]!;
    const a2 = cm.updateTask(a, t.id, { status: "done" }, ctx);
    expect(a2.phases[0]!.tasks[0]!.status).toBe("done");
    expect(b.phases[0]!.tasks[0]!.status).toBe("pending");
  });

  it("progreso excluye 'no aplica' y cuenta completadas", () => {
    let { roadmap: r } = cm.createCompany(base, ctx);
    const tasks = r.phases.flatMap((p) => p.tasks);
    r = cm.updateTask(r, tasks[0]!.id, { status: "done" }, ctx);
    r = cm.updateTask(r, tasks[1]!.id, { status: "not-applicable" }, ctx, "sin web");
    const p = cm.roadmapProgress(r);
    expect(p.applicable).toBe(tasks.length - 1);
    expect(p.done).toBe(1);
    expect(p.percent).toBe(Math.round((1 / (tasks.length - 1)) * 100));
  });

  it("evidencia se registra y queda en el historial", () => {
    let { roadmap: r } = cm.createCompany(base, ctx);
    const id = r.phases[0]!.tasks[0]!.id;
    r = cm.addEvidence(r, id, { note: "Reunión hecha", url: "ejemplo.com/acta" }, ctx);
    const t = r.phases[0]!.tasks[0]!;
    expect(t.evidence[0]!.url).toBe("https://ejemplo.com/acta");
    expect(t.log.at(-1)!.detail).toContain("Evidencia");
  });

  it("vencidas: fecha pasada y no cerrada", () => {
    let { roadmap: r } = cm.createCompany(base, ctx);
    const [t1, t2] = r.phases.flatMap((p) => p.tasks);
    r = cm.updateTask(r, t1!.id, { dueDate: "2026-10-01" }, ctx);
    r = cm.updateTask(r, t2!.id, { dueDate: "2026-10-01", status: "done" }, ctx);
    expect(cm.overdueTasks(r, "2026-10-25").map((t) => t.id)).toEqual([t1!.id]);
  });

  it("vincular auditoría no completa la tarea SEO", () => {
    const { company, roadmap } = cm.createCompany(base, ctx);
    const res = cm.linkAudit(company, roadmap, "aud1", "Auditoría", ctx);
    expect(res.company.auditIds).toEqual(["aud1"]);
    const seo = res.roadmap!.phases.flatMap((p) => p.tasks).find((t) => t.kind === "seo-audit")!;
    expect(seo.linkedAuditIds).toEqual(["aud1"]);
    expect(seo.status).toBe("pending");
  });

  it("migración: datos viejos sin empresas → vacío; auditorías inexistentes se descartan", () => {
    expect(cm.migrateCompanies({}, [])).toEqual({ companies: [], roadmaps: [] });
    const { company, roadmap } = cm.createCompany(base, ctx);
    const out = cm.migrateCompanies({ companies: [{ ...company, auditIds: ["x", "y"] }], roadmaps: [roadmap] }, ["y"]);
    expect(out.companies[0]!.auditIds).toEqual(["y"]);
    expect(out.roadmaps).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import * as cm from "./model";

let n = 0;
const ctx: cm.Ctx = { now: () => "2026-11-01T00:00:00.000Z", newId: () => `id${++n}` };

function setup() {
  const a = cm.createCompany({ tradeName: "Dúplex del Centro", industry: "cabins", status: "active" }, ctx);
  const b = cm.createCompany({ tradeName: "Hotel Sur", industry: "hotel", status: "active" }, ctx);
  return { companies: [a.company, b.company], roadmaps: [a.roadmap, b.roadmap], A: a.company.id, B: b.company.id };
}
const seoTask = (r: cm.Roadmap) => r.phases.flatMap((p) => p.tasks).find((t) => t.kind === "seo-audit")!;
const roadmapOf = (rs: cm.Roadmap[], id: string) => rs.find((r) => r.companyId === id)!;

describe("asociación empresa ↔ auditoría desde la auditoría", () => {
  it("asocia una auditoría existente y la registra en la tarea SEO sin completarla", () => {
    const s = setup();
    const r = cm.assignAudit(s.companies, s.roadmaps, "aud1", s.A, "Aud 1", ctx);
    expect(cm.companyOfAudit(r.companies, "aud1")?.id).toBe(s.A);
    const t = seoTask(roadmapOf(r.roadmaps, s.A));
    expect(t.linkedAuditIds).toEqual(["aud1"]);
    expect(t.status).toBe("pending");
  });

  it("asociar dos veces no duplica referencias", () => {
    const s = setup();
    let r = cm.assignAudit(s.companies, s.roadmaps, "aud1", s.A, "Aud 1", ctx);
    r = cm.assignAudit(r.companies, r.roadmaps, "aud1", s.A, "Aud 1", ctx);
    expect(r.companies.find((c) => c.id === s.A)!.auditIds).toEqual(["aud1"]);
    expect(seoTask(roadmapOf(r.roadmaps, s.A)).linkedAuditIds).toEqual(["aud1"]);
  });

  it("cambiar de empresa la quita de la anterior (empresa y tarea)", () => {
    const s = setup();
    let r = cm.assignAudit(s.companies, s.roadmaps, "aud1", s.A, "Aud 1", ctx);
    r = cm.assignAudit(r.companies, r.roadmaps, "aud1", s.B, "Aud 1", ctx);
    expect(r.companies.find((c) => c.id === s.A)!.auditIds).toEqual([]);
    expect(seoTask(roadmapOf(r.roadmaps, s.A)).linkedAuditIds).toEqual([]);
    expect(r.companies.find((c) => c.id === s.B)!.auditIds).toEqual(["aud1"]);
    expect(seoTask(roadmapOf(r.roadmaps, s.B)).linkedAuditIds).toEqual(["aud1"]);
    expect(r.companies.filter((c) => c.auditIds.includes("aud1"))).toHaveLength(1);
  });

  it("quitar la asociación limpia empresa y tarea", () => {
    const s = setup();
    let r = cm.assignAudit(s.companies, s.roadmaps, "aud1", s.A, "Aud 1", ctx);
    r = cm.assignAudit(r.companies, r.roadmaps, "aud1", null, "Aud 1", ctx);
    expect(cm.companyOfAudit(r.companies, "aud1")).toBeUndefined();
    expect(seoTask(roadmapOf(r.roadmaps, s.A)).linkedAuditIds).toEqual([]);
  });

  it("empresa inexistente no altera nada (creación sin empresa válida)", () => {
    const s = setup();
    const r = cm.assignAudit(s.companies, s.roadmaps, "aud1", "no-existe", "Aud 1", ctx);
    expect(r.companies).toBe(s.companies);
    expect(r.roadmaps).toBe(s.roadmaps);
  });

  it("auditoría sin empresa: no aparece en ninguna", () => {
    const s = setup();
    expect(cm.companyOfAudit(s.companies, "aud1")).toBeUndefined();
  });

  it("borrar la auditoría (unlinkAudit) limpia referencias", () => {
    const s = setup();
    const r = cm.assignAudit(s.companies, s.roadmaps, "aud1", s.A, "Aud 1", ctx);
    const c = r.companies.find((x) => x.id === s.A)!;
    const res = cm.unlinkAudit(c, roadmapOf(r.roadmaps, s.A), "aud1", ctx, "Auditoría SEO eliminada");
    expect(res.company.auditIds).toEqual([]);
    expect(seoTask(res.roadmap!).linkedAuditIds).toEqual([]);
  });
});

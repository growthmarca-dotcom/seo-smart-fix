import { describe, expect, it } from "vitest";
import { buildRoadmap, updateTask, type Company } from "./model";
import { companyIdentityRows, executiveSummary, linkedAuditSummaries, NOT_AVAILABLE } from "./company-report";
import type { Audit } from "@/seo/types";

let n = 0;
const ctx = { now: () => "2026-11-01T10:00:00.000Z", newId: () => `id${++n}` };
const company: Company = {
  id: "c1", tradeName: "Cabañas", industry: "cabins", status: "active",
  createdAt: "", updatedAt: "", auditIds: ["a1", "ghost"],
};
const audit = {
  id: "a1", name: "Auditoría 1", rootUrl: "https://x.com", isDemo: false, createdAt: "2026-10-01T00:00:00Z",
  score: { total: 82 },
  findings: [{ severity: "critical" }, { severity: "important" }, { severity: "important" }, { severity: "improvement" }],
} as unknown as Audit;

describe("company report", () => {
  it("marca datos faltantes como No informado", () => {
    const rows = Object.fromEntries(companyIdentityRows(company));
    expect(rows["Razón social"]).toBe(NOT_AVAILABLE);
    expect(rows["Rubro"]).toBe("Cabañas / dúplex");
  });

  it("resume auditorías reales y omite ids inexistentes", () => {
    const s = linkedAuditSummaries(company, [audit]);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ score: 82, critical: 1, important: 2, improvement: 1 });
  });

  it("empresa sin auditorías devuelve lista vacía", () => {
    expect(linkedAuditSummaries({ ...company, auditIds: [] }, [audit])).toEqual([]);
  });

  it("avance excluye No aplica y detecta vencidas", () => {
    let r = buildRoadmap("c1", "cabins", ctx);
    const [t1, t2, t3] = r.phases[0]!.tasks;
    r = updateTask(r, t1!.id, { status: "done" }, ctx);
    r = updateTask(r, t2!.id, { status: "not-applicable" }, ctx);
    r = updateTask(r, t3!.id, { dueDate: "2026-10-01" }, ctx);
    const s = executiveSummary(r, "2026-11-01");
    const total = r.phases.flatMap((p) => p.tasks).length;
    expect(s.applicable).toBe(total - 1);
    expect(s.done).toBe(1);
    expect(s.percent).toBe(Math.round((1 / (total - 1)) * 100));
    expect(s.overdue.map((t) => t.title)).toEqual([t3!.title]);
    expect(s.nextAction?.title).toBe(t3!.title);
  });

  it("sin roadmap: 0% y sin próxima acción", () => {
    const s = executiveSummary(undefined, "2026-11-01");
    expect(s).toMatchObject({ hasRoadmap: false, percent: 0, nextAction: undefined });
  });
});

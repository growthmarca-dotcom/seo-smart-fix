import { describe, expect, it } from "vitest";
import type { Company } from "@/companies/model";
import type { Audit } from "@/seo/types";
import { emptyReview, updateControl, type CommercialReview } from "@/seo/tourism/commercial-review";
import { buildDiagnosisPreview } from "./preview";

const company = (industry: Company["industry"], auditIds: string[]) => ({ id: "c1", industry, auditIds }) as unknown as Company;
const audit = (id: string, date: string, score?: number, isDemo = false) =>
  ({ id, name: `Auditoría ${id}`, createdAt: date, isDemo, score: score === undefined ? undefined : { total: score } }) as unknown as Audit;
const rev = (auditId: string, at: string, control: string, status: "verified" | "needs-review" | "not-applicable", notes?: string): CommercialReview =>
  updateControl(emptyReview(auditId, at), control, { status, ...(notes ? { notes } : {}) }, at);

describe("vista previa del diagnóstico", () => {
  it("empresa sin auditorías: parcial, sin índice y todo sin evaluar", () => {
    const p = buildDiagnosisPreview(company("other", []), [], []);
    expect(p.index).toMatchObject({ status: "partial", value: undefined });
    expect(p.seo).toBeUndefined();
    const statuses = p.dimensions.flatMap((d) => d.controls.map((c) => c.status));
    expect(statuses.every((s) => s === "unevaluated" || s === "integration" || s === "seo-reference")).toBe(true);
    expect(p.missingBySource.professional?.length).toBeGreaterThan(0);
  });

  it("turismo: usa la evaluación más reciente con datos y conserva la otra", () => {
    const audits = [audit("old", "2026-03-01"), audit("new", "2026-10-20")];
    const reviews = [rev("old", "2026-03-02", "booking-engine", "needs-review"), rev("new", "2026-10-22", "booking-engine", "verified")];
    const p = buildDiagnosisPreview(company("cabins", ["old", "new"]), audits, reviews);
    expect(p.review?.current).toMatchObject({ auditId: "new", auditDate: "2026-10-20", reviewUpdatedAt: "2026-10-22" });
    expect(p.review?.others.map((o) => o.auditId)).toEqual(["old"]);
    const booking = p.dimensions.flatMap((d) => d.controls).find((c) => c.id === "ch-booking")!;
    expect(booking).toMatchObject({ status: "meets", origin: "tourism", fromAuditId: "new" });
  });

  it("selección para comparar cambia la fuente sin perder la otra", () => {
    const audits = [audit("old", "2026-03-01"), audit("new", "2026-10-20")];
    const reviews = [rev("old", "2026-03-02", "booking-engine", "needs-review"), rev("new", "2026-10-22", "booking-engine", "verified")];
    const p = buildDiagnosisPreview(company("cabins", ["old", "new"]), audits, reviews, "old");
    expect(p.review?.reason).toBe("selected");
    expect(p.dimensions.flatMap((d) => d.controls).find((c) => c.id === "ch-booking")!.status).toBe("needs-improvement");
  });

  it("rubro no turístico no lee la evaluación turística", () => {
    const p = buildDiagnosisPreview(company("restaurant", ["a"]), [audit("a", "2026-10-01")], [rev("a", "2026-10-02", "booking-engine", "verified")]);
    expect(p.review).toBeUndefined();
    expect(p.dimensions.flatMap((d) => d.controls).find((c) => c.id === "ch-booking")!.status).toBe("unevaluated");
  });

  it("score SEO: referencia de la auditoría más reciente con puntaje, sin cambiar la madurez", () => {
    const audits = [audit("a", "2026-01-01", 40), audit("b", "2026-09-01", 90), audit("c", "2026-10-01")];
    const p = buildDiagnosisPreview(company("other", ["a", "b", "c"]), audits, []);
    expect(p.seo).toMatchObject({ score: 90, auditId: "b" });
    const web = p.dimensions.find((d) => d.id === "web")!.result;
    expect(web.maturity).toBeUndefined();
    expect(web.evaluated).toBe(0);
  });

  it("«No aplica» turístico sin nota se muestra como sin evaluar con aviso", () => {
    const p = buildDiagnosisPreview(company("cabins", ["a"]), [audit("a", "2026-10-01")], [
      rev("a", "2026-10-02", "booking-engine", "not-applicable"),
      rev("a", "2026-10-02", "contact-whatsapp", "verified"),
    ].slice(0, 1).map((r) => updateControl(r, "contact-whatsapp", { status: "verified" }, "2026-10-02")));
    const booking = p.dimensions.flatMap((d) => d.controls).find((c) => c.id === "ch-booking")!;
    expect(booking.status).toBe("unevaluated");
    expect(booking.unjustifiedNotApplicable).toBe(true);
  });

  it("no modifica auditorías ni evaluaciones recibidas", () => {
    const audits = [audit("a", "2026-10-01", 70)];
    const reviews = [rev("a", "2026-10-02", "booking-engine", "not-applicable")];
    const before = JSON.stringify({ audits, reviews });
    buildDiagnosisPreview(company("cabins", ["a"]), audits, reviews);
    expect(JSON.stringify({ audits, reviews })).toBe(before);
  });

  it("auditoría demo queda marcada como demo", () => {
    const p = buildDiagnosisPreview(company("other", ["d"]), [audit("d", "2026-10-01", 80, true)], []);
    expect(p.seo?.isDemo).toBe(true);
    expect(p.linkedAudits[0]!.isDemo).toBe(true);
  });
});

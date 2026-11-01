import { describe, expect, it } from "vitest";
import { CONTROLS } from "./dimensions";
import { TOURISM_EQUIVALENCES, pickCurrentReview, resolveControl } from "./equivalences";
import { COMMERCIAL_CONTROLS, emptyReview, updateControl } from "@/seo/tourism/commercial-review";

const at = "2026-11-01T00:00:00Z";

describe("equivalencias turismo ↔ diagnóstico", () => {
  it("apuntan a controles existentes, sin duplicar destinos ni tocar SEO", () => {
    const ids = new Set(CONTROLS.map((c) => c.id));
    const targets = Object.values(TOURISM_EQUIVALENCES);
    for (const [src, dst] of Object.entries(TOURISM_EQUIVALENCES)) {
      expect(COMMERCIAL_CONTROLS.some((c) => c.id === src)).toBe(true);
      expect(ids.has(dst)).toBe(true);
    }
    expect(new Set(targets).size).toBe(targets.length);
    expect(targets).not.toContain("web-seo-health");
  });
  it("lee el valor turístico cuando el diagnóstico no tiene uno", () => {
    const rev = updateControl(emptyReview("a1", at), "booking-engine", { status: "needs-review", notes: "Abre en otra web" }, at);
    expect(resolveControl("ch-booking", undefined, rev)).toMatchObject({ source: "tourism", conflict: false, state: { status: "needs-improvement" } });
  });
  it("si ambos tienen valor distinto, informa conflicto sin elegir en silencio el turístico", () => {
    const rev = updateControl(emptyReview("a1", at), "booking-engine", { status: "verified" }, at);
    const r = resolveControl("ch-booking", { status: "needs-improvement", notes: "", updatedAt: at }, rev);
    expect(r).toMatchObject({ source: "diagnosis", conflict: true });
  });
  it("controles sin equivalencia no se resuelven desde turismo", () => {
    const rev = updateControl(emptyReview("a1", at), "rates-policies", { status: "verified" }, at);
    expect(resolveControl("sales-quotes", undefined, rev).source).toBe("none");
  });
});

describe("No aplica turístico sin justificación", () => {
  it("se trata como Sin evaluar y se avisa", () => {
    const rev = updateControl(emptyReview("a1", at), "booking-engine", { status: "not-applicable" }, at);
    const r = resolveControl("ch-booking", undefined, rev);
    expect(r.state?.status).toBe("unevaluated");
    expect(r.unjustifiedNotApplicable).toBe(true);
  });
  it("con nota se mantiene No aplica", () => {
    const rev = updateControl(emptyReview("a1", at), "booking-engine", { status: "not-applicable", notes: "Solo consultas por teléfono" }, at);
    expect(resolveControl("ch-booking", undefined, rev).state?.status).toBe("not-applicable");
  });
});

describe("evaluación vigente entre varias auditorías", () => {
  const r = (id: string, upd: string, status = true) =>
    status ? updateControl(emptyReview(id, upd), "booking-engine", { status: "verified" }, upd) : emptyReview(id, upd);
  const cands = [
    { auditId: "old", auditDate: "2026-03-01", review: r("old", "2026-03-02") },
    { auditId: "new", auditDate: "2026-10-12", review: r("new", "2026-10-14") },
    { auditId: "empty", auditDate: "2026-11-01", review: r("empty", "2026-11-01", false) },
  ];
  it("elige la más reciente con datos y conserva las demás con fechas", () => {
    const c = pickCurrentReview(cands);
    expect(c.reason).toBe("latest");
    expect(c.current).toMatchObject({ auditId: "new", auditDate: "2026-10-12", reviewUpdatedAt: "2026-10-14" });
    expect(c.others.map((o) => o.auditId)).toEqual(["old"]);
  });
  it("respeta una selección explícita sin perder la otra", () => {
    const c = pickCurrentReview(cands, "old");
    expect(c.reason).toBe("selected");
    expect(c.current?.auditId).toBe("old");
    expect(c.others.map((o) => o.auditId)).toEqual(["new"]);
  });
  it("sin evaluaciones con datos no elige ninguna", () => {
    expect(pickCurrentReview([cands[2]!])).toEqual({ current: undefined, reason: "none", others: [] });
  });
});

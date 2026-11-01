import { describe, expect, it } from "vitest";
import { CONTROLS } from "./dimensions";
import { TOURISM_EQUIVALENCES, resolveControl } from "./equivalences";
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

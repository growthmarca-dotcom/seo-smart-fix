import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_ACTIONS,
  COMMERCIAL_CONTROLS,
  commercialIssues,
  commercialIssuesByPriority,
  emptyReview,
  hasAnyEvaluation,
  updateControl,
} from "./commercial-review";

const base = () => emptyReview("a1", "2026-01-01T00:00:00Z");

describe("integración comercial en el informe", () => {
  it("cada control real tiene prioridad y acción", () => {
    for (const c of COMMERCIAL_CONTROLS) expect(COMMERCIAL_ACTIONS[c.id]).toBeDefined();
    expect(Object.keys(COMMERCIAL_ACTIONS).length).toBe(COMMERCIAL_CONTROLS.length);
  });
  it("sin evaluación no hay diagnóstico ni acciones", () => {
    expect(hasAnyEvaluation(base())).toBe(false);
    expect(hasAnyEvaluation(undefined)).toBe(false);
    expect(commercialIssues(base())).toEqual([]);
  });
  it("solo 'Requiere revisión' genera acciones; verificados y no aplica no", () => {
    let r = updateControl(base(), "booking-engine", { status: "needs-review", notes: "Botón Reservar lleva a página vacía" });
    r = updateControl(r, "trust", { status: "verified" });
    r = updateControl(r, "ota-consistency", { status: "not-applicable" });
    expect(hasAnyEvaluation(r)).toBe(true);
    const issues = commercialIssues(r);
    expect(issues.map((i) => i.id)).toEqual(["booking-engine"]);
    expect(issues[0]!.notes).toBe("Botón Reservar lleva a página vacía");
  });
  it("respeta prioridades y ordena alta → media → baja", () => {
    let r = updateControl(base(), "measurement", { status: "needs-review" });
    r = updateControl(r, "photos-description", { status: "needs-review" });
    r = updateControl(r, "contact-whatsapp", { status: "needs-review" });
    expect(commercialIssues(r).map((i) => i.priority)).toEqual(["alta", "media", "baja"]);
    expect(commercialIssuesByPriority(r, "alta").map((i) => i.id)).toEqual(["contact-whatsapp"]);
    expect(commercialIssuesByPriority(r, "baja").map((i) => i.id)).toEqual(["measurement"]);
  });
  it("sin duplicados aunque el control se actualice varias veces", () => {
    let r = updateControl(base(), "mobile-path", { status: "needs-review" });
    r = updateControl(r, "mobile-path", { notes: "Falla en iPhone" });
    r = updateControl(r, "mobile-path", { status: "needs-review" });
    const ids = commercialIssues(r).map((i) => i.id);
    expect(ids).toEqual(["mobile-path"]);
  });
});

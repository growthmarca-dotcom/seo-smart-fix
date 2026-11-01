import { describe, expect, it } from "vitest";
import { controlsFor } from "./dimensions";
import { assessmentAsDiagnosis, emptyAssessment, updateAssessmentControl, type CompanyAssessment } from "./model";
import { dimensionResults, globalIndex, SEO_CONTROL_ID } from "./scoring";
import { SERVICE_PENDING, buildSynthesis } from "./synthesis";

const AT = "2026-11-01T00:00:00Z";
const tourism = { industry: "tourism-lodging" as const };
const set = (a: CompanyAssessment, id: string, patch: Parameters<typeof updateAssessmentControl>[2]) => updateAssessmentControl(a, id, patch, AT);

describe("B3.1 — síntesis de evaluación", () => {
  it("sin evaluaciones no hay fortalezas ni prioridades, y todo queda en límites", () => {
    const s = buildSynthesis(tourism, emptyAssessment("a", "c", AT));
    expect(s.strengths).toEqual([]);
    expect(s.priorities).toEqual([]);
    expect(s.partial).toBe(true);
    expect(s.index.value).toBeUndefined();
    const expected = controlsFor("tourism-lodging").filter((c) => c.id !== SEO_CONTROL_ID).length;
    expect(s.limits).toHaveLength(expected);
  });

  it("«No aplica» va a límites con su justificación y nunca genera recomendaciones", () => {
    let a = emptyAssessment("a", "c", AT);
    a = set(a, "ch-whatsapp", { status: "not-applicable", notes: "Atiende solo por teléfono" });
    const s = buildSynthesis(tourism, a);
    expect(s.limits.find((l) => l.controlId === "ch-whatsapp")).toMatchObject({ kind: "not-applicable", justification: "Atiende solo por teléfono" });
    expect([...s.strengths, ...s.priorities].some((x) => x.controlId === "ch-whatsapp")).toBe(false);
  });

  it("«Sin datos» no genera fortaleza ni mejora", () => {
    const a = set(emptyAssessment("a", "c", AT), "web-mobile", { status: "no-data" });
    const s = buildSynthesis(tourism, a);
    expect(s.limits.find((l) => l.controlId === "web-mobile")?.kind).toBe("no-data");
  });

  it("fortalezas = Cumple; prioridades = Requiere mejora, con servicio pendiente (no inventado)", () => {
    let a = emptyAssessment("a", "c", AT);
    a = set(a, "web-mobile", { status: "meets", evidenceUrl: "https://e.test" });
    a = set(a, "brand-value", { status: "needs-improvement", notes: "Poco clara" });
    const s = buildSynthesis(tourism, a);
    expect(s.strengths.map((x) => x.controlId)).toEqual(["web-mobile"]);
    expect(s.strengths[0]!.origin).toBe("verified");
    expect(s.priorities).toHaveLength(1);
    expect(s.priorities[0]).toMatchObject({ controlId: "brand-value", origin: "professional", service: SERVICE_PENDING });
  });

  it("controles críticos primero, luego peso de la dimensión (orden estable)", () => {
    let a = emptyAssessment("a", "c", AT);
    a = set(a, "brand-value", { status: "needs-improvement" }); // marca: peso 10
    a = set(a, "web-mobile", { status: "needs-improvement" }); // web: peso 20
    a = set(a, "ch-booking", { status: "needs-improvement" }); // crítico turismo
    const ids = buildSynthesis(tourism, a).priorities.map((p) => p.controlId);
    expect(ids).toEqual(["ch-booking", "web-mobile", "brand-value"]);
    expect(buildSynthesis(tourism, a).priorities.map((p) => p.controlId)).toEqual(ids);
  });

  it("todo ítem cita un control existente del catálogo", () => {
    let a = emptyAssessment("a", "c", AT);
    a = set(a, "web-mobile", { status: "meets" });
    a = set(a, "vis-ota", { status: "needs-improvement" });
    const s = buildSynthesis(tourism, a);
    const ids = new Set(controlsFor("tourism-lodging").map((c) => c.id));
    for (const x of [...s.strengths, ...s.priorities, ...s.limits]) expect(ids.has(x.controlId)).toBe(true);
  });

  it("reutiliza el cálculo existente sin duplicarlo y no muta la evaluación", () => {
    let a = emptyAssessment("a", "c", AT);
    a = set(a, "web-mobile", { status: "meets" });
    const frozen = JSON.stringify(a);
    const s = buildSynthesis(tourism, a);
    const d = assessmentAsDiagnosis(a);
    expect(s.index).toEqual(globalIndex("tourism-lodging", dimensionResults("tourism-lodging", d), d));
    expect(JSON.stringify(a)).toBe(frozen);
  });

  it("el control SEO nunca entra en la síntesis", () => {
    const s = buildSynthesis(tourism, emptyAssessment("a", "c", AT));
    expect([...s.strengths, ...s.priorities, ...s.limits].some((x) => x.controlId === SEO_CONTROL_ID)).toBe(false);
  });
});

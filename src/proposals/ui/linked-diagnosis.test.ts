import { describe, expect, it } from "vitest";
import { controlsFor } from "@/diagnosis/dimensions";
import { emptyAssessment, updateAssessmentControl, type CompanyAssessment } from "@/diagnosis/model";
import { SEO_CONTROL_ID } from "@/diagnosis/scoring";
import { linkedDiagnosis } from "./linked-diagnosis";

const AT = "2026-11-01T00:00:00Z";
const company = { id: "c1", industry: "tourism-lodging" as const };
const set = (a: CompanyAssessment, id: string, patch: Parameters<typeof updateAssessmentControl>[2]) => updateAssessmentControl(a, id, patch, AT);

describe("P6.2 — diagnóstico vinculado en propuesta", () => {
  it("sin evaluación vinculada no hay panel", () => {
    expect(linkedDiagnosis({ companyId: "c1" }, company, [emptyAssessment("a", "c1", AT)])).toBeUndefined();
  });

  it("evaluación de otra empresa nunca se muestra", () => {
    const other = emptyAssessment("a", "c2", AT);
    expect(linkedDiagnosis({ companyId: "c1", assessmentId: "a" }, company, [other])).toBeUndefined();
    expect(linkedDiagnosis({ companyId: "c1", assessmentId: "a" }, { id: "c2", industry: "tourism-lodging" }, [other])).toBeUndefined();
  });

  it("parcial: sin índice, con prioridades, notas, evidencia y áreas sugeridas", () => {
    let a = emptyAssessment("a", "c1", AT);
    a = set(a, "ch-whatsapp", { status: "needs-improvement", notes: "Enlace roto", evidenceUrl: "https://e.test" });
    a = set(a, "web-mobile", { status: "meets" });
    const before = JSON.stringify(a);
    const d = linkedDiagnosis({ companyId: "c1", assessmentId: "a" }, company, [a])!;
    expect(d.synthesis.partial).toBe(true);
    expect(d.synthesis.index.value).toBeUndefined();
    const pr = d.synthesis.priorities.find((x) => x.controlId === "ch-whatsapp")!;
    expect(pr).toMatchObject({ notes: "Enlace roto", evidenceUrl: "https://e.test" });
    expect(pr.suggestedAreas).toContain("WhatsApp Business");
    expect(d.synthesis.strengths.map((x) => x.controlId)).toContain("web-mobile");
    expect(JSON.stringify(a)).toBe(before); // solo lectura
  });

  it("completa: muestra índice global", () => {
    let a = emptyAssessment("a", "c1", AT);
    for (const c of controlsFor("tourism-lodging")) {
      if (c.id === SEO_CONTROL_ID || c.source === "integration") continue;
      a = set(a, c.id, { status: "meets" });
    }
    const d = linkedDiagnosis({ companyId: "c1", assessmentId: "a" }, company, [a])!;
    expect(d.synthesis.partial).toBe(false);
    expect(d.synthesis.index.value).toBeTypeOf("number");
  });
});

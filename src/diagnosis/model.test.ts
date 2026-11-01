import { describe, expect, it } from "vitest";
import { TOURISM_EQUIVALENCES } from "./equivalences";
import {
  assessmentAsDiagnosis,
  emptyAssessment,
  importTourismEquivalences,
  migrateAssessments,
  updateAssessmentControl,
  updateAssessmentMeta,
} from "./model";
import { dimensionResults } from "./scoring";

const AT = "2026-11-01T17:00:00.000Z";
const base = () => emptyAssessment("a1", "c1", AT);

describe("B.1 — modelo de evaluación integral", () => {
  it("crea una evaluación vacía en curso con fecha del día", () => {
    const a = base();
    expect(a).toMatchObject({ id: "a1", companyId: "c1", status: "in-progress", assessmentDate: "2026-11-01", controls: {} });
  });

  it("rechaza «No aplica» sin justificación y lo acepta con justificación", () => {
    const a = base();
    expect(updateAssessmentControl(a, "web-mobile", { status: "not-applicable" }, AT)).toBe(a);
    const ok = updateAssessmentControl(a, "web-mobile", { status: "not-applicable", notes: "Sin sitio propio por decisión del cliente" }, AT);
    expect(ok.controls["web-mobile"]?.status).toBe("not-applicable");
  });

  it("rechaza estados desconocidos", () => {
    const a = base();
    expect(updateAssessmentControl(a, "web-mobile", { status: "bogus" as never }, AT)).toBe(a);
  });

  it("no muta la evaluación original", () => {
    const a = base();
    const snap = structuredClone(a);
    updateAssessmentControl(a, "web-mobile", { status: "meets" }, AT);
    expect(a).toEqual(snap);
  });

  it("meta: rechaza fecha inválida, conserva título si queda vacío", () => {
    const a = base();
    expect(updateAssessmentMeta(a, { assessmentDate: "01/11/2026" }, AT)).toBe(a);
    expect(updateAssessmentMeta(a, { title: "  " }, AT).title).toBe(a.title);
    expect(updateAssessmentMeta(a, { status: "completed" }, AT).status).toBe("completed");
  });

  it("Sin evaluar no cuenta como cero en la madurez (reglas C1 intactas)", () => {
    let a = base();
    a = updateAssessmentControl(a, "web-mobile", { status: "meets" }, AT);
    const web = dimensionResults("tourism-lodging", assessmentAsDiagnosis(a)).find((r) => r.id === "web")!;
    expect(web.evaluated).toBe(1);
    expect(web.maturity).toBe(100);
    expect(web.coverage).toBeLessThan(1);
  });
});

describe("B.1 — precarga turística por valor", () => {
  const review = () => ({
    auditId: "au1",
    updatedAt: AT,
    controls: {
      "property-info": { status: "verified" as const, notes: "OK", evidenceUrl: "https://x.test" },
      "mobile-path": { status: "needs-review" as const, notes: "Lento" },
      "booking-engine": { status: "not-applicable" as const, notes: "" },
      "contact-whatsapp": { notes: "solo nota" },
      "rates-policies": { status: "verified" as const, notes: "sin equivalencia" },
    },
  });

  it("copia los equivalentes, no muta la revisión y permite editar independiente", () => {
    const r = review();
    const snap = structuredClone(r);
    const a = importTourismEquivalences(base(), r, TOURISM_EQUIVALENCES, AT);
    expect(r).toEqual(snap);
    expect(a.controls["web-offer-clarity"]).toMatchObject({ status: "meets", sourceKind: "tourism-import", evidenceUrl: "https://x.test" });
    expect(a.controls["web-mobile"]?.status).toBe("needs-improvement");
    expect(a.controls["ch-booking"]?.status).toBe("unevaluated"); // N/A sin justificación
    expect(a.controls["ch-whatsapp"]).toBeUndefined(); // sin estado
    expect(Object.keys(a.controls)).toHaveLength(3);
    expect(a.tourismSourceAuditId).toBe("au1");
    const edited = updateAssessmentControl(a, "web-offer-clarity", { status: "needs-improvement" }, AT);
    expect(edited.controls["web-offer-clarity"]?.sourceKind).toBe("manual");
    expect(r).toEqual(snap);
  });

  it("no pisa controles ya evaluados en la evaluación integral", () => {
    const own = updateAssessmentControl(base(), "web-offer-clarity", { status: "needs-improvement" }, AT);
    const a = importTourismEquivalences(own, review(), TOURISM_EQUIVALENCES, AT);
    expect(a.controls["web-offer-clarity"]?.status).toBe("needs-improvement");
  });

  it("migrateAssessments: ausente → [], descarta corruptos y conserva válidos", () => {
    expect(migrateAssessments(undefined)).toEqual([]);
    const ok = base();
    expect(migrateAssessments([ok, null, { foo: 1 }, ok])).toHaveLength(1);
  });
});

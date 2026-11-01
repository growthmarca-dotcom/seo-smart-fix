import { describe, expect, it } from "vitest";
import { controlsFor } from "./dimensions";
import { criticalControlsFor } from "./weights";
import { dimensionResults, globalIndex } from "./scoring";
import { emptyDiagnosis, setControl } from "./model";
import { TOURISM_EQUIVALENCES } from "./equivalences";

const ids = (i: Parameters<typeof controlsFor>[0]) => controlsFor(i).map((c) => c.id);
const at = "2026-11-01T00:00:00.000Z";

describe("Catálogo C1 por rubro", () => {
  it("OTAs y venta directa solo en turismo", () => {
    for (const i of ["restaurant", "ecommerce", "real-estate", "other"] as const) {
      expect(ids(i)).not.toContain("vis-ota");
      expect(ids(i)).not.toContain("sales-direct");
    }
    expect(ids("hotel")).toContain("vis-ota");
  });
  it("no pregunta reservas ni compra online a quien no corresponde", () => {
    expect(ids("ecommerce")).not.toContain("ch-booking");
    expect(ids("ecommerce")).toContain("ch-checkout");
    expect(ids("cabins")).not.toContain("ch-checkout");
    expect(ids("other")).not.toContain("ch-booking");
    expect(ids("other")).not.toContain("ch-checkout");
    expect(ids("other")).not.toContain("ch-whatsapp");
    expect(ids("real-estate")).not.toContain("ch-whatsapp");
  });
  it("referencias externas es universal", () => {
    for (const i of ["hotel", "restaurant", "ecommerce", "real-estate", "other"] as const) expect(ids(i)).toContain("vis-external-references");
  });
  it("los críticos de cada rubro existen en su plantilla y no exigen WhatsApp/reservas fuera de turismo", () => {
    for (const i of ["hotel", "restaurant", "ecommerce", "real-estate", "other"] as const)
      for (const c of criticalControlsFor(i)) expect(ids(i)).toContain(c);
    for (const i of ["restaurant", "ecommerce", "real-estate", "other"] as const) {
      expect(criticalControlsFor(i)).not.toContain("ch-whatsapp");
      expect(criticalControlsFor(i)).not.toContain("ch-booking");
    }
  });
  it("equivalencias turísticas siguen apuntando a controles aplicables en turismo", () => {
    for (const t of Object.values(TOURISM_EQUIVALENCES)) expect(ids("tourism-lodging")).toContain(t);
  });
  it("referencias externas: No aplica justificado se excluye; sin justificación es Sin evaluar", () => {
    let d = setControl(emptyDiagnosis("c", at), "vis-external-references", { status: "not-applicable", notes: "Negocio abierto este mes" }, at);
    const base = dimensionResults("other", emptyDiagnosis("c", at)).find((r) => r.id === "visibility")!;
    const just = dimensionResults("other", d).find((r) => r.id === "visibility")!;
    expect(just.applicable).toBe(base.applicable - 1);
    d = setControl(emptyDiagnosis("c", at), "vis-external-references", { status: "not-applicable", notes: "" }, at);
    const unj = dimensionResults("other", d).find((r) => r.id === "visibility")!;
    expect(unj.applicable).toBe(base.applicable);
    expect(unj.evaluated).toBe(0);
  });
  it("dimensión sin datos muestra motivo «sin datos suficientes», no incumplimiento", () => {
    const r = dimensionResults("other", undefined);
    expect(r.every((x) => x.maturity === undefined && x.needsImprovement.length === 0)).toBe(true);
    const g = globalIndex("other", r);
    expect(g.value).toBeUndefined();
    expect(g.reasons.some((x) => x.includes("sin datos suficientes"))).toBe(true);
  });
});

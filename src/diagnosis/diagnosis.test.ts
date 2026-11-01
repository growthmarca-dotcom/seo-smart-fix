import { describe, expect, it } from "vitest";
import { CONTROLS, DIMENSIONS, controlsFor } from "./dimensions";
import { WEIGHT_PROFILES, weightProfileFor, weightsFor } from "./weights";
import { emptyDiagnosis, migrateDiagnoses, setControl, type CompanyDiagnosis } from "./model";
import { MIN_COVERAGE, dimensionResults, globalIndex } from "./scoring";

const at = "2026-11-01T00:00:00Z";
function withAll(industry: "cabins" | "other", dim: string, status: "meets" | "needs-improvement"): CompanyDiagnosis {
  let d = emptyDiagnosis("c1", at);
  for (const c of controlsFor(industry).filter((c) => c.dimension === dim && c.source !== "integration" && c.id !== "web-seo-health"))
    d = setControl(d, c.id, { status }, at);
  return d;
}

describe("catálogo", () => {
  it("seis dimensiones, todas con controles y ids únicos", () => {
    expect(DIMENSIONS).toHaveLength(6);
    for (const dim of DIMENSIONS) expect(controlsFor("other", dim.id).length).toBeGreaterThan(0);
    expect(new Set(CONTROLS.map((c) => c.id)).size).toBe(CONTROLS.length);
  });
  it("controles de turismo no aparecen en otros rubros", () => {
    expect(controlsFor("cabins").some((c) => c.id === "vis-ota")).toBe(true);
    expect(controlsFor("restaurant").some((c) => c.id === "vis-ota")).toBe(false);
  });
});

describe("pesos por rubro", () => {
  it("cada perfil suma 100", () => {
    for (const w of Object.values(WEIGHT_PROFILES)) expect(Object.values(w).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("rubro sin perfil usa genérico; turismo agrupa hotel/cabañas/hostel", () => {
    expect(weightProfileFor("real-estate")).toBe("generic");
    expect(weightProfileFor("hostel")).toBe("tourism");
    expect(weightsFor("restaurant").visibility).toBe(30);
  });
});

describe("madurez y cobertura", () => {
  it("sin datos no es cero: madurez indefinida, cobertura 0, sin índice global", () => {
    const r = dimensionResults("cabins", undefined);
    expect(r.every((x) => x.maturity === undefined && x.coverage === 0 && !x.sufficient)).toBe(true);
    expect(globalIndex("cabins", r)).toEqual({ value: undefined, basedOn: 0, total: 6 });
  });
  it("Sin evaluar y No aplica no suman ni restan", () => {
    let d = emptyDiagnosis("c1", at);
    d = setControl(d, "brand-identity", { status: "meets" }, at);
    d = setControl(d, "brand-value", { status: "needs-improvement" }, at);
    d = setControl(d, "brand-content", { status: "not-applicable" }, at);
    const brand = dimensionResults("other", d).find((x) => x.id === "brand")!;
    expect(brand).toMatchObject({ applicable: 3, evaluated: 2, maturity: 50, needsImprovement: ["brand-value"] });
    expect(brand.coverage).toBeCloseTo(2 / 3);
  });
  it("integraciones no cuentan en la cobertura", () => {
    const web = dimensionResults("other", undefined).find((x) => x.id === "web")!;
    expect(web.applicable).toBe(controlsFor("other", "web").filter((c) => c.source !== "integration").length);
  });
  it("dimensión bajo la cobertura mínima queda fuera del índice y se reparte el peso", () => {
    let d = withAll("other", "sales", "meets");
    d = setControl(d, "brand-identity", { status: "needs-improvement" }, at); // 1 de 4 < 50 %
    const r = dimensionResults("other", d);
    expect(r.find((x) => x.id === "brand")!.coverage).toBeLessThan(MIN_COVERAGE);
    expect(globalIndex("other", r)).toEqual({ value: 100, basedOn: 1, total: 6 });
  });
});

describe("el SEO no domina", () => {
  it("es un solo indicador de la dimensión web", () => {
    const web = dimensionResults("other", undefined, { seoScore: 80 }).find((x) => x.id === "web")!;
    expect(web).toMatchObject({ evaluated: 1, maturity: 80 });
  });
  it("un SEO de 0 solo baja el índice dentro del peso de su dimensión", () => {
    let d = withAll("other", "web", "meets");
    for (const dim of ["visibility", "sales", "brand", "channels", "opportunities"])
      d = { ...d, controls: { ...d.controls, ...withAll("other", dim, "meets").controls } };
    const r = dimensionResults("other", d, { seoScore: 0 });
    const web = r.find((x) => x.id === "web")!;
    const g = globalIndex("other", r).value!;
    // El peor caso posible: perder todo el peso de "web" (20 %) → índice ≥ 80.
    expect(g).toBeGreaterThanOrEqual(80);
    expect(web.maturity).toBe(Math.round((web.evaluated - 1) / web.evaluated * 100));
  });
});

describe("persistencia", () => {
  it("datos previos sin diagnósticos cargan vacío", () => {
    expect(migrateDiagnoses(undefined, ["c1"])).toEqual([]);
  });
  it("descarta empresas inexistentes, duplicados y estados inválidos", () => {
    const out = migrateDiagnoses(
      [
        { companyId: "c1", controls: { a: { status: "meets" }, b: { status: "rota" } } },
        { companyId: "c1", controls: {} },
        { companyId: "ghost", controls: {} },
      ],
      ["c1"],
    );
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0]!.controls)).toEqual(["a"]);
  });
  it("setControl ignora estados inválidos y limpia URL vacía", () => {
    const d = emptyDiagnosis("c1", at);
    expect(setControl(d, "x", { status: "rota" as never }, at)).toBe(d);
    expect(setControl(d, "x", { evidenceUrl: "  " }, at).controls["x"]!.evidenceUrl).toBeUndefined();
  });
});

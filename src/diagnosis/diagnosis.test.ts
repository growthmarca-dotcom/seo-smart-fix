import { describe, expect, it } from "vitest";
import { CONTROLS, DIMENSIONS, controlsFor } from "./dimensions";
import { WEIGHT_PROFILES, criticalControlsFor, weightProfileFor, weightsFor } from "./weights";
import { emptyDiagnosis, migrateDiagnoses, setControl, type CompanyDiagnosis } from "./model";
import { MIN_COVERAGE, dimensionResults, globalIndex, seoReference } from "./scoring";

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
    expect(weightProfileFor("other")).toBe("generic");
    expect(weightProfileFor("real-estate")).toBe("real-estate");
    expect(weightProfileFor("hostel")).toBe("tourism");
    expect(weightsFor("restaurant").visibility).toBe(30);
  });
});

describe("madurez y cobertura", () => {
  it("sin datos no es cero: madurez indefinida, cobertura 0, sin índice global", () => {
    const r = dimensionResults("cabins", undefined);
    expect(r.every((x) => x.maturity === undefined && x.coverage === 0 && !x.sufficient)).toBe(true);
    const g = globalIndex("cabins", r);
    expect(g).toMatchObject({ status: "partial", value: undefined, totalCoverage: 0 });
  });
  it("Sin evaluar y No aplica no suman ni restan", () => {
    let d = emptyDiagnosis("c1", at);
    d = setControl(d, "brand-identity", { status: "meets" }, at);
    d = setControl(d, "brand-value", { status: "needs-improvement" }, at);
    d = setControl(d, "brand-content", { status: "not-applicable", notes: "Sin contenidos propios: vende por catálogo de terceros." }, at);
    const brand = dimensionResults("other", d).find((x) => x.id === "brand")!;
    expect(brand).toMatchObject({ applicable: 4, evaluated: 2, maturity: 50, needsImprovement: ["brand-value"] });
    expect(brand.coverage).toBeCloseTo(2 / 4);
  });
  it("integraciones no cuentan en la cobertura", () => {
    const web = dimensionResults("other", undefined).find((x) => x.id === "web")!;
    expect(web.applicable).toBe(controlsFor("other", "web").filter((c) => c.source !== "integration" && c.id !== "web-seo-health").length);
  });
  it("dimensión con poca cobertura: diagnóstico parcial y sin redistribuir pesos", () => {
    let d = withAll("other", "sales", "meets");
    d = setControl(d, "brand-identity", { status: "needs-improvement" }, at);
    const r = dimensionResults("other", d);
    expect(r.find((x) => x.id === "brand")!.coverage).toBeLessThan(MIN_COVERAGE);
    const g = globalIndex("other", r, d);
    expect(g.status).toBe("partial");
    expect(g.value).toBeUndefined();
    expect(g.reasons.length).toBeGreaterThan(0);
  });
});

describe("el SEO es referencia, sin puntos", () => {
  it("el score SEO no cambia madurez ni cobertura de web", () => {
    const d = withAll("other", "web", "meets");
    const a = dimensionResults("other", d).find((x) => x.id === "web")!;
    const b = dimensionResults("other", d, { seoScore: 0 }).find((x) => x.id === "web")!;
    expect(b).toEqual(a);
    expect(a.maturity).toBe(100);
  });
  it("el control SEO no cuenta como aplicable ni crítico", () => {
    const web = dimensionResults("other", undefined).find((x) => x.id === "web")!;
    expect(web.applicable).toBe(controlsFor("other", "web").filter((c) => c.source !== "integration" && c.id !== "web-seo-health").length);
    expect(criticalControlsFor("ecommerce")).not.toContain("web-seo-health");
  });
  it("seoReference muestra el score acotado o nada", () => {
    expect(seoReference({ seoScore: 82.4 })).toBe(82);
    expect(seoReference({})).toBeUndefined();
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

describe("suficiencia y estados", () => {
  function full(industry: "cabins" | "other", status: "meets" | "needs-improvement" = "meets") {
    let d = emptyDiagnosis("c1", at);
    for (const dim of DIMENSIONS) d = { ...d, controls: { ...d.controls, ...withAll(industry, dim.id, status).controls } };
    return d;
  }
  it("Sin datos no vale cero y cuenta como no cubierto", () => {
    let d = emptyDiagnosis("c1", at);
    d = setControl(d, "brand-identity", { status: "meets" }, at);
    d = setControl(d, "brand-value", { status: "no-data" }, at);
    const brand = dimensionResults("other", d).find((x) => x.id === "brand")!;
    expect(brand).toMatchObject({ evaluated: 1, noData: 1, maturity: 100 });
  });
  it("No aplica sin justificación se rechaza", () => {
    const d = emptyDiagnosis("c1", at);
    expect(setControl(d, "brand-value", { status: "not-applicable" }, at)).toBe(d);
    expect(setControl(d, "brand-value", { status: "not-applicable", notes: "  " }, at)).toBe(d);
  });
  it("todo evaluado y con SEO: índice completo", () => {
    const d = full("other");
    const r = dimensionResults("other", d, { seoScore: 100 });
    expect(globalIndex("other", r, d, { seoScore: 100 })).toMatchObject({ status: "complete", value: 100, missingCritical: [] });
  });
  it("falta un control crítico del rubro: parcial aunque la cobertura sea alta", () => {
    let d = full("cabins");
    const { ["vis-ota"]: _drop, ...rest } = d.controls;
    d = { ...d, controls: rest };
    const r = dimensionResults("cabins", d, { seoScore: 90 });
    const g = globalIndex("cabins", r, d, { seoScore: 90 });
    expect(g.totalCoverage).toBeGreaterThanOrEqual(0.7);
    expect(g).toMatchObject({ status: "partial", value: undefined, missingCritical: ["vis-ota"] });
  });
  it("estado Sin datos en un crítico mantiene el diagnóstico parcial", () => {
    let d = full("other");
    d = setControl(d, "ch-primary-contact", { status: "no-data" }, at);
    const g = globalIndex("other", dimensionResults("other", d, { seoScore: 80 }), d, { seoScore: 80 });
    expect(g.missingCritical).toEqual(["ch-primary-contact"]);
  });
});

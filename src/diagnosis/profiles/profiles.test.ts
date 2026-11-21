import { describe, expect, it } from "vitest";
import type { Industry } from "@/companies/model";
import { INDUSTRY_LABELS } from "@/companies/model";
import { CONTROLS, controlsFor } from "../dimensions";
import type { CompanyDiagnosis, ControlStatus } from "../model";
import { dimensionResults, globalIndex } from "../scoring";
import { CRITICAL_CONTROLS, SUFFICIENCY, WEIGHT_PROFILES, criticalControlsFor } from "../weights";
import { CATALOG_SIZING, controlsForProfile, getControlSizing } from "./catalog-sizing";
import { calculateCoverageMetrics, evaluateBusinessComplexity, recommendAuditProfile } from "./recommendation";
import { AUDIT_PROFILES, VERIFICATION_MODE_LABELS } from "./types";

const INDUSTRIES = Object.keys(INDUSTRY_LABELS) as Industry[];
const AT = "2026-11-20T00:00:00.000Z";
const diag = (controls: Record<string, { status: ControlStatus; notes?: string }>): CompanyDiagnosis => ({
  companyId: "c1",
  updatedAt: AT,
  controls: Object.fromEntries(Object.entries(controls).map(([id, c]) => [id, { status: c.status, notes: c.notes ?? "", updatedAt: AT }])),
});

describe("D1 — correspondencia del catálogo", () => {
  it("cada control C1 tiene exactamente una entrada de dimensionamiento y viceversa", () => {
    const ids = CONTROLS.map((c) => c.id);
    const sized = CATALOG_SIZING.map((s) => s.controlId);
    expect(new Set(sized).size).toBe(sized.length);
    expect([...sized].sort()).toEqual([...ids].sort());
    for (const s of CATALOG_SIZING) {
      expect(AUDIT_PROFILES).toContain(s.minProfile);
      expect(Object.keys(VERIFICATION_MODE_LABELS)).toContain(s.mode);
    }
    expect(getControlSizing("web-performance")?.depthGuidance?.integral360).toBeTruthy();
  });
});

describe("D1 — controlsForProfile", () => {
  it("incluye siempre los críticos aplicables al rubro y crece monótonamente", () => {
    for (const ind of INDUSTRIES) {
      const applicable = new Set(controlsFor(ind).map((c) => c.id));
      const critical = criticalControlsFor(ind).filter((id) => applicable.has(id));
      const [e, pr, full] = AUDIT_PROFILES.map((p) => new Set(controlsForProfile(p, ind).map((c) => c.id))) as [Set<string>, Set<string>, Set<string>];
      const sets = [e, pr, full];
      for (const s of sets) for (const id of critical) expect(s.has(id)).toBe(true);
      for (const s of sets) for (const id of s) expect(applicable.has(id)).toBe(true);
      expect([...e].every((id) => pr.has(id))).toBe(true);
      expect([...pr].every((id) => full.has(id))).toBe(true);
      expect(full.size).toBe(applicable.size);
    }
  });
});

describe("D1 — complejidad", () => {
  it("sin datos → unknown, nunca low", () => {
    const r = evaluateBusinessComplexity({});
    expect(r.level).toBe("unknown");
    expect(r.uninformedFields).toContain("hasTransactionalPlatform");
    expect(evaluateBusinessComplexity({ industry: "hotel" }).level).toBe("unknown");
  });
  it("low solo con datos confirmados; medium y high con factores", () => {
    expect(evaluateBusinessComplexity({ hasTransactionalPlatform: false, operationalStructure: "single-location" }).level).toBe("low");
    expect(evaluateBusinessComplexity({ locationsCount: 2 }).level).toBe("medium");
    const h = evaluateBusinessComplexity({ hasTransactionalPlatform: true, hasStockSync: true });
    expect(h.level).toBe("high");
    expect(h.factors.length).toBe(2);
  });
});

describe("D1 — recomendación", () => {
  it("respeta el perfil contratado aunque la complejidad sea alta", () => {
    const r = recommendAuditProfile({ complexityInputs: { hasTransactionalPlatform: true }, requestedScope: { profile: "essential" } });
    expect(r.status).toBe("contracted");
    expect(r.suggestedProfile).toBe("essential");
    expect(r.complexity.level).toBe("high");
  });
  it("exploratoria nunca impone Integral 360", () => {
    expect(recommendAuditProfile({ complexityInputs: {} }).suggestedProfile).toBe("essential");
    const h = recommendAuditProfile({ complexityInputs: { hasTransactionalPlatform: true, isMultiCurrency: true } });
    expect(h.status).toBe("exploratory");
    expect(h.suggestedProfile).toBe("professional");
  });
});

describe("D1 — coberturas", () => {
  it("perfil Esencial completo no habilita el índice global (dinámico por rubro)", () => {
    for (const ind of INDUSTRIES) {
      const ids = controlsForProfile("essential", ind).filter((c) => c.source !== "integration" && c.id !== "web-seo-health").map((c) => c.id);
      const d = diag(Object.fromEntries(ids.map((id) => [id, { status: "meets" as const }])));
      const m = calculateCoverageMetrics("essential", ind, d);
      expect(m.profileCoverage).toBe(1);
      expect(m.profileEvaluated).toBe(ids.length);
      const idx = globalIndex(ind, dimensionResults(ind, d), d);
      expect(m.totalCoverage).toBe(idx.totalCoverage);
      expect(m.isGlobalIndexSufficient).toBe(idx.status === "complete");
      expect(m.totalCoverage).toBeLessThan(SUFFICIENCY.minTotalCoverage);
      expect(m.isGlobalIndexSufficient).toBe(false);
    }
  });
  it("criticalCoverage: needs-improvement cuenta como relevado pero es déficit; N/A justificado se excluye", () => {
    const ind: Industry = "hotel"; // críticos: ch-booking, ch-whatsapp, vis-ota
    const d = diag({
      "ch-booking": { status: "meets" },
      "ch-whatsapp": { status: "needs-improvement" },
      "vis-ota": { status: "not-applicable", notes: "No opera con OTAs" },
    });
    const m = calculateCoverageMetrics("essential", ind, d);
    expect(m.criticalApplicable).toBe(2);
    expect(m.criticalCoverage).toBe(1);
    expect(m.criticalDeficits).toEqual(["ch-whatsapp"]);
    expect(globalIndex(ind, dimensionResults(ind, d), d).missingCritical).toEqual([]);

    const d2 = diag({ "ch-booking": { status: "no-data" }, "ch-whatsapp": { status: "unevaluated" }, "vis-ota": { status: "not-applicable" } });
    const m2 = calculateCoverageMetrics("essential", ind, d2);
    expect(m2.criticalCoverage).toBe(0);
    expect(m2.criticalDeficits).toEqual([]);
  });
  it("criticalCoverage === 1 sii missingCritical vacío, en todos los rubros", () => {
    const states: ControlStatus[] = ["meets", "needs-improvement", "unevaluated", "no-data"];
    for (const ind of INDUSTRIES) {
      for (const st of states) {
        const d = diag(Object.fromEntries(criticalControlsFor(ind).map((id) => [id, { status: st }])));
        const missing = globalIndex(ind, dimensionResults(ind, d), d).missingCritical;
        expect(calculateCoverageMetrics("professional", ind, d).criticalCoverage === 1).toBe(missing.length === 0);
      }
    }
  });
});

describe("D1 — invariancia del motor", () => {
  it("consultar dimensionamiento no altera scoring, pesos, umbrales ni críticos", () => {
    const snap = JSON.stringify({ WEIGHT_PROFILES, CRITICAL_CONTROLS, SUFFICIENCY, CONTROLS });
    const d = diag({ "web-offer-clarity": { status: "meets" }, "ch-primary-contact": { status: "needs-improvement" } });
    const before = INDUSTRIES.map((i) => JSON.stringify(globalIndex(i, dimensionResults(i, d), d)));
    const dSnap = JSON.stringify(d);
    for (const i of INDUSTRIES) for (const p of AUDIT_PROFILES) {
      controlsForProfile(p, i);
      calculateCoverageMetrics(p, i, d);
    }
    recommendAuditProfile({ complexityInputs: { hasTransactionalPlatform: true } });
    expect(INDUSTRIES.map((i) => JSON.stringify(globalIndex(i, dimensionResults(i, d), d)))).toEqual(before);
    expect(JSON.stringify({ WEIGHT_PROFILES, CRITICAL_CONTROLS, SUFFICIENCY, CONTROLS })).toBe(snap);
    expect(JSON.stringify(d)).toBe(dSnap);
  });
});

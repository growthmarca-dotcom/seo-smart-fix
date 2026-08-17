import { describe, expect, it } from "vitest";
import { analyzeEcommerce } from "./analyze";
import { classifyEcommercePage, detectEcommerce, facetParametersOf, paginationNumberOf } from "./detect";
import { ECOMMERCE_SIGNALS, REUSED_RULE_IDS } from "./signals";
import { ecommerceFixture, fixturePage, nonEcommerceFixture } from "./fixtures";
import { buildDemoSite } from "../demo";
import { runAudit } from "../engine";
import type { Audit } from "../types";

function demoAudit(id = "demo-audit"): Audit {
  const site = buildDemoSite("generic-web");
  const { findings, score } = runAudit(site);
  return {
    id,
    name: "Outdoor Patagonia (demo)",
    platform: "generic-web",
    rootUrl: site.rootUrl,
    isDemo: true,
    status: "done",
    createdAt: new Date().toISOString(),
    crawlLimit: 100,
    respectRobots: true,
    progress: { discovered: site.pages.length, analyzed: site.pages.length, issues: findings.length },
    pages: site.pages,
    findings,
    score,
    coverage: site.coverage,
  };
}

describe("detección e-commerce", () => {
  it("detecta e-commerce con varias señales", () => {
    const d = detectEcommerce(ecommerceFixture());
    expect(d.isEcommerce).toBe(true);
    expect(d.signals.length).toBeGreaterThanOrEqual(2);
    expect(d.confidence).toBeGreaterThanOrEqual(45);
  });

  it("no declara e-commerce en un sitio informativo", () => {
    const d = detectEcommerce(nonEcommerceFixture());
    expect(d.isEcommerce).toBe(false);
  });

  it("no alcanza con una sola señal débil", () => {
    const audit = nonEcommerceFixture();
    audit.pages[1]!.schemaTypes = ["Offer"];
    const d = detectEcommerce(audit);
    expect(d.isEcommerce).toBe(false);
  });

  it("detecta la demo Outdoor Patagonia como e-commerce", () => {
    expect(detectEcommerce(demoAudit()).isEcommerce).toBe(true);
  });
});

describe("clasificación de entidades", () => {
  const root = "https://fixture-shop.test";
  it("clasifica producto", () => {
    const c = classifyEcommercePage(
      fixturePage({ url: `${root}/productos/remera`, depth: 2, pageType: "product" }),
      root,
    );
    expect(c.ecommerceType).toBe("product");
    expect(c.confidence).toBe("high");
  });

  it("clasifica categoría y subcategoría", () => {
    expect(
      classifyEcommercePage(fixturePage({ url: `${root}/categorias/remeras`, depth: 1, pageType: "category" }), root)
        .ecommerceType,
    ).toBe("category");
    expect(
      classifyEcommercePage(fixturePage({ url: `${root}/categorias/remeras/lisas`, depth: 2 }), root).ecommerceType,
    ).toBe("subcategory");
  });

  it("clasifica variante, faceta, paginación, carrito y checkout", () => {
    expect(
      classifyEcommercePage(fixturePage({ url: `${root}/productos/remera?variant=azul`, depth: 3 }), root)
        .ecommerceType,
    ).toBe("product-variant");
    expect(
      classifyEcommercePage(fixturePage({ url: `${root}/categorias/remeras?color=azul`, depth: 2 }), root)
        .ecommerceType,
    ).toBe("faceted");
    expect(
      classifyEcommercePage(fixturePage({ url: `${root}/categorias/remeras/page/3`, depth: 2 }), root).ecommerceType,
    ).toBe("pagination");
    expect(classifyEcommercePage(fixturePage({ url: `${root}/carrito`, depth: 1 }), root).ecommerceType).toBe("cart");
    expect(classifyEcommercePage(fixturePage({ url: `${root}/checkout`, depth: 1 }), root).ecommerceType).toBe(
      "checkout",
    );
    expect(classifyEcommercePage(fixturePage({ url: `${root}/`, depth: 0, pageType: "home" }), root).ecommerceType).toBe(
      "store-home",
    );
  });

  it("reconoce parámetros de faceta y número de página", () => {
    expect(facetParametersOf(`${root}/c/x?color=azul&talle=m`)).toContain("color");
    expect(facetParametersOf(`${root}/c/x`)).toHaveLength(0);
    expect(paginationNumberOf(`${root}/c/x/page/4`)).toBe(4);
    expect(paginationNumberOf(`${root}/c/x`)).toBeNull();
  });
});

describe("análisis derivado", () => {
  const analysis = analyzeEcommerce(ecommerceFixture());

  it("extrae productos y categorías sin inventar datos", () => {
    expect(analysis.products.length).toBeGreaterThanOrEqual(2);
    const remera = analysis.products.find((p) => p.path === "/productos/remera-lisa")!;
    expect(remera.price).toBe("19999");
    expect(remera.availability).toBe("in-stock");
    const gorra = analysis.products.find((p) => p.path === "/productos/gorra-sin-categoria")!;
    expect(gorra.price).toBeUndefined();
    expect(gorra.availability).toBe("unknown");
  });

  it("evalúa Product schema y Offer", () => {
    const ids = analysis.findings.map((f) => f.signalId);
    expect(ids).toContain("ec-product-schema-missing");
    expect(ids).toContain("ec-product-schema-incomplete");
  });

  it("detecta disponibilidad agotada como decisión condicionada", () => {
    const f = analysis.findings.find((x) => x.signalId === "ec-product-out-of-stock-review");
    expect(f?.classification).toBe("review");
    expect(f?.recommendation).toMatch(/stock volverá|reposición/i);
  });

  it("detecta categoría sin productos enlazados y arquitectura categoría → producto", () => {
    const vacia = analysis.categories.find((c) => c.path === "/categorias/vacia")!;
    expect(vacia.productLinks).toHaveLength(0);
    const remeras = analysis.categories.find((c) => c.path === "/categorias/remeras")!;
    expect(remeras.productLinks.length).toBe(1);
    expect(analysis.findings.some((f) => f.signalId === "ec-category-no-product-links")).toBe(true);
  });

  it("reutiliza la clasificación de huérfanos de la Fase 4 para productos sin enlaces", () => {
    const f = analysis.findings.find((x) => x.signalId === "ec-product-no-inbound-links");
    expect(f).toBeTruthy();
    expect(f?.evidence.join(" ")).toMatch(/orphan/);
  });

  it("agrupa facetas y paginación", () => {
    expect(analysis.facets.length).toBeGreaterThanOrEqual(1);
    expect(analysis.facets[0]!.urls.length).toBeGreaterThanOrEqual(2);
    expect(analysis.pagination.length).toBe(1);
    expect(analysis.findings.some((f) => f.signalId === "ec-pagination-canonical-to-first")).toBe(true);
  });

  it("clasifica variantes y su contenido duplicado", () => {
    expect(analysis.variants.length).toBe(1);
    expect(analysis.variants[0]!.duplicateContent).toBe(true);
    expect(analysis.findings.some((f) => f.signalId === "ec-variant-canonical-missing")).toBe(true);
  });

  it("no produce hallazgos e-commerce en sitios no e-commerce", () => {
    const a = analyzeEcommerce(nonEcommerceFixture());
    expect(a.detection.isEcommerce).toBe(false);
    expect(a.findings).toHaveLength(0);
  });

  it("mantiene el aislamiento por auditId", () => {
    const a = analyzeEcommerce(ecommerceFixture());
    const b = analyzeEcommerce(nonEcommerceFixture());
    expect(a.auditId).toBe("fixture-ecommerce");
    expect(new Set(a.findings.map((f) => f.auditId))).toEqual(new Set(["fixture-ecommerce"]));
    expect(a.products.every((p) => p.auditId === a.auditId)).toBe(true);
    expect(b.products.every((p) => p.auditId === b.auditId)).toBe(true);
  });

  it("no modifica el score ni los hallazgos del motor", () => {
    const audit = demoAudit();
    const before = JSON.stringify({ score: audit.score, findings: audit.findings });
    analyzeEcommerce(audit);
    expect(JSON.stringify({ score: audit.score, findings: audit.findings })).toBe(before);
  });

  it("referencia diagnósticos generales existentes en lugar de duplicarlos", () => {
    const audit = demoAudit();
    const a = analyzeEcommerce(audit);
    const withRefs = a.findings.filter((f) => f.relatedFindingIds.length > 0);
    expect(withRefs.length).toBeGreaterThan(0);
    const signalIds = new Set(ECOMMERCE_SIGNALS.map((s) => s.id));
    for (const ruleId of REUSED_RULE_IDS) expect(signalIds.has(ruleId)).toBe(false);
  });

  it("solo evalúa precio y disponibilidad cuando existen datos de origen", () => {
    const a = analyzeEcommerce(demoAudit());
    expect(a.capabilities.connectorPricing).toBe(false);
    expect(a.findings.some((f) => f.signalId === "ec-product-price-missing")).toBe(false);
  });
});

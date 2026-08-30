import { describe, expect, it } from "vitest";

import { runAudit } from "./engine";
import {
  evidenceText,
  evidenceToStrings,
  isStructuredEvidence,
  type EvidenceItem,
} from "./evidence";
import { RULES } from "./rules";
import type { Finding, PageSnapshot, SiteContext } from "./types";

function page(p: Partial<PageSnapshot> & { id: string; url: string }): PageSnapshot {
  return {
    path: new URL(p.url).pathname,
    pageType: "other",
    statusCode: 200,
    h1: [],
    h2: [],
    h3: [],
    wordCount: 300,
    images: [],
    internalLinks: [],
    externalLinks: 0,
    schemaTypes: [],
    depth: 1,
    hasViewport: true,
    ...p,
  } as PageSnapshot;
}

function site(pages: PageSnapshot[]): SiteContext {
  return { rootUrl: "https://demo.test", platform: "generic-web", pages };
}

describe("Finding.evidence — contrato EvidenceItem (Fase 1.1)", () => {
  it("acepta evidencia legacy en string", () => {
    const finding = { evidence: ["https://demo.test/a → HTTP 404"] } as Pick<Finding, "evidence">;
    expect(finding.evidence?.[0]).toBe("https://demo.test/a → HTTP 404");
    expect(evidenceToStrings(finding.evidence)).toEqual(["https://demo.test/a → HTTP 404"]);
  });

  it("acepta evidencia estructurada", () => {
    const finding = {
      evidence: [{ kind: "value", label: "Tipo de página", value: "Producto" }],
    } as Pick<Finding, "evidence">;
    const item = finding.evidence?.[0];
    expect(item && isStructuredEvidence(item)).toBe(true);
    expect(item && evidenceText(item)).toBe("Tipo de página: Producto");
  });

  it("permite coexistencia de ambos formatos en una misma lista", () => {
    const mixed: EvidenceItem[] = [
      "nota histórica",
      { kind: "expected", label: "Umbral contextual", expected: "300 palabras" },
    ];
    const finding = { evidence: mixed } as Pick<Finding, "evidence">;
    expect(evidenceToStrings(finding.evidence)).toEqual([
      "nota histórica",
      "Umbral contextual: esperado: 300 palabras",
    ]);
  });

  it("el motor produce evidencia estructurada en thin-content y legacy en el resto", () => {
    const thin = page({
      id: "thin",
      url: "https://demo.test/producto/carpa",
      pageType: "product",
      wordCount: 12,
      depth: 2,
    });

    const { findings } = runAudit(site([thin]));

    const thinFinding = findings.find((f) => f.ruleId === "thin-content");
    expect(thinFinding).toBeDefined();
    const items = thinFinding?.evidence ?? [];
    expect(items).toHaveLength(2);
    expect(items.every((i) => isStructuredEvidence(i))).toBe(true);
    expect(evidenceToStrings(items)).toEqual([
      expect.stringContaining("Tipo de página"),
      expect.stringContaining("Umbral contextual"),
    ]);

    // Ninguna otra regla fue migrada: el resto sigue produciendo strings.
    for (const f of findings.filter((f) => f.ruleId !== "thin-content")) {
      for (const item of f.evidence ?? []) {
        expect(typeof item).toBe("string");
      }
    }
  });

  it("thin-content sigue existiendo en el catálogo de reglas", () => {
    expect(RULES.some((r) => r.id === "thin-content")).toBe(true);
  });
});

describe("Evidence estructurada — Fase 1.2: reglas contextuales", () => {
  it("ctx-product-description-short produce evidencia estructurada esperada", () => {
    const p = page({
      id: "pds",
      url: "https://demo.test/producto/mochila",
      pageType: "product",
      wordCount: 120,
      depth: 2,
    });
    const { findings } = runAudit(site([p]));
    const f = findings.find((x) => x.ruleId === "ctx-product-description-short");
    expect(f).toBeDefined();
    const items = f?.evidence ?? [];
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(isStructuredEvidence(item)).toBe(true);
    expect(item).toMatchObject({ kind: "expected" });
    expect(item).toMatchObject({ label: "Referencia para fichas de producto" });
    expect(item).toMatchObject({ expected: expect.stringMatching(/palabras o más$/) });
    // No incluye value (no enriquecer).
    expect((item as any).value).toBeUndefined();
  });

  it("ctx-category-listing-links produce evidencia estructurada esperada", () => {
    const p = page({
      id: "cll",
      url: "https://demo.test/categoria/carpa",
      pageType: "category",
      wordCount: 300,
      depth: 1,
      internalLinks: [],
    });
    const { findings } = runAudit(site([p]));
    const f = findings.find((x) => x.ruleId === "ctx-category-listing-links");
    expect(f).toBeDefined();
    const items = f?.evidence ?? [];
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(isStructuredEvidence(item)).toBe(true);
    expect(item).toMatchObject({ kind: "expected" });
    expect(item).toMatchObject({ label: "Referencia para categorías" });
    expect(item).toMatchObject({ expected: expect.stringMatching(/^al menos \d+ enlaces internos$/) });
    // No incluye value (no enriquecer).
    expect((item as any).value).toBeUndefined();
  });

  it("ctx-product-description-short conserva su comportamiento de detección", () => {
    const tooShort = page({
      id: "ts",
      url: "https://demo.test/producto/a",
      pageType: "product",
      wordCount: 5,
      depth: 2,
    });
    const ok = page({
      id: "ok",
      url: "https://demo.test/producto/b",
      pageType: "product",
      wordCount: 600,
      depth: 2,
    });
    const inRange = page({
      id: "ir",
      url: "https://demo.test/producto/c",
      pageType: "product",
      wordCount: 120,
      depth: 2,
    });
    const { findings } = runAudit(site([tooShort, ok, inRange]));
    const ids = findings
      .filter((f) => f.ruleId === "ctx-product-description-short")
      .map((f) => f.pageId);
    // tooShort (wordCount < min*0.4) lo descarta thin-content; inRange sí dispara; ok no dispara.
    expect(ids).toContain("ir");
    expect(ids).not.toContain("ok");
  });

  it("ctx-category-listing-links conserva su comportamiento de detección", () => {
    const empty = page({
      id: "empty",
      url: "https://demo.test/categoria/a",
      pageType: "category",
      wordCount: 300,
      depth: 1,
      internalLinks: [],
    });
    const { findings } = runAudit(site([empty]));
    const f = findings.find((x) => x.ruleId === "ctx-category-listing-links");
    expect(f).toBeDefined();
    expect(f?.current).toBe("0 enlaces internos en el listado");
  });

  it("la evidencia legacy de las demás reglas continúa siendo string", () => {
    const p = page({
      id: "dup",
      url: "https://demo.test/dup",
      pageType: "other",
      wordCount: 300,
      depth: 1,
    });
    const { findings } = runAudit(site([p]));
    const migrated = new Set([
      "thin-content",
      "ctx-product-description-short",
      "ctx-category-listing-links",
    ]);
    for (const f of findings.filter((x) => !migrated.has(x.ruleId))) {
      for (const item of f.evidence ?? []) {
        expect(typeof item).toBe("string");
      }
    }
  });
});

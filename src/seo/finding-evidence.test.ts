import { describe, expect, it } from "vitest";

import { runAudit } from "./engine";
import { evidenceText, evidenceToStrings, isStructuredEvidence, type EvidenceItem } from "./evidence";
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

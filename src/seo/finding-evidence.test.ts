import { describe, expect, it } from "vitest";

import { evidenceText, evidenceToStrings, isStructuredEvidence } from "./evidence";
import { runAudit } from "./engine";
import { RULES } from "./rules";
import type { EvidenceItem, Finding, PageSnapshot, SiteContext } from "./types";

function page(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    id: "p1",
    url: "https://demo.test/producto/carpa",
    statusCode: 200,
    title: "Carpa 3 estaciones para trekking liviano",
    metaDescription:
      "Carpa liviana de 3 estaciones para trekking, con doble techo impermeable y armado rápido en cualquier terreno.",
    h1: ["Carpa 3 estaciones"],
    h2: [],
    h3: [],
    wordCount: 20,
    images: [],
    internalLinks: [],
    externalLinks: [],
    canonical: "https://demo.test/producto/carpa",
    robotsMeta: null,
    lang: "es",
    depth: 2,
    contentHash: "hash-1",
    ...(overrides as Record<string, unknown>),
  } as PageSnapshot;
}

describe("Finding.evidence — contrato EvidenceItem (Fase 1.1)", () => {
  it("acepta evidencia legacy en string", () => {
    const legacy: EvidenceItem[] = ["https://demo.test/a → HTTP 404"];
    const finding = { evidence: legacy } as Pick<Finding, "evidence">;
    expect(finding.evidence?.[0]).toBe("https://demo.test/a → HTTP 404");
    expect(evidenceToStrings(finding.evidence)).toEqual(["https://demo.test/a → HTTP 404"]);
  });

  it("acepta evidencia estructurada", () => {
    const structured: EvidenceItem[] = [{ kind: "value", label: "Tipo de página", value: "Producto" }];
    const finding = { evidence: structured } as Pick<Finding, "evidence">;
    const item = finding.evidence?.[0];
    expect(item && isStructuredEvidence(item)).toBe(true);
    expect(item && evidenceText(item)).toBe("Tipo de página: Producto");
  });

  it("permite coexistencia de ambos formatos en una misma lista", () => {
    const mixed: EvidenceItem[] = [
      "nota histórica",
      { kind: "expected", label: "Umbral contextual", expected: "300 palabras" },
    ];
    expect(evidenceToStrings(mixed)).toEqual([
      "nota histórica",
      "Umbral contextual: esperado: 300 palabras",
    ]);
  });

  it("el motor produce evidencia estructurada en thin-content y legacy en otras reglas", () => {
    const thin = page({ id: "thin", wordCount: 12 });
    const pages = [thin];
    const site: SiteContext = { pages, siteUrl: "https://demo.test" } as SiteContext;

    const { findings } = runAudit(pages, site);

    const thinFinding = findings.find((f) => f.ruleId === "thin-content");
    expect(thinFinding).toBeDefined();
    const items = thinFinding?.evidence ?? [];
    expect(items.length).toBe(2);
    expect(items.every((i) => isStructuredEvidence(i))).toBe(true);
    expect(evidenceToStrings(items)).toEqual([
      expect.stringContaining("Tipo de página"),
      expect.stringContaining("Umbral contextual"),
    ]);

    // Ninguna otra regla fue migrada: el resto sigue produciendo strings.
    const others = findings.filter((f) => f.ruleId !== "thin-content");
    for (const f of others) {
      for (const item of f.evidence ?? []) {
        expect(typeof item).toBe("string");
      }
    }
  });

  it("solo thin-content declara evidencia estructurada en el catálogo de reglas", () => {
    expect(RULES.some((r) => r.id === "thin-content")).toBe(true);
  });
});

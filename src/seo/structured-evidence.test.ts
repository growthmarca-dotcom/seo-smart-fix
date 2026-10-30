import { describe, expect, it } from "vitest";

import { runAudit } from "./engine";
import { evidenceToStrings, isStructuredEvidence, type StructuredEvidence } from "./evidence";
import type { PageSnapshot, SiteContext } from "./types";

/**
 * Fase 2.3 — Etapa 1: las 13 reglas que generan evidencia emiten
 * objetos estructurados (EvidenceItem) con el kind del dato real.
 */
function page(p: Partial<PageSnapshot> & { id: string; url: string }): PageSnapshot {
  return {
    path: new URL(p.url).pathname,
    pageType: "other",
    statusCode: 200,
    title: `Title ${p.id}`,
    metaDescription: `Descripción única de ${p.id} con texto suficiente para el buscador.`,
    h1: [`H1 ${p.id}`],
    h2: [],
    h3: [],
    wordCount: 400,
    images: [],
    internalLinks: [],
    externalLinks: 0,
    schemaTypes: [],
    depth: 1,
    hasViewport: true,
    ...p,
  } as PageSnapshot;
}

const R = "https://demo.test";
const pages: PageSnapshot[] = [
  page({
    id: "home",
    url: `${R}/`,
    pageType: "home",
    internalLinks: [{ href: `${R}/viejo`, anchor: "Viejo" }],
    robotsMeta: "noindex, follow",
    xRobotsTag: "noindex",
    canonical: `${R}/b`,
  }),
  page({
    id: "a",
    url: `${R}/a`,
    title: "Repetido",
    metaDescription: "Descripción repetida idéntica en dos páginas del sitio de prueba.",
    contentHash: "h1",
    images: [{ src: `${R}/img/x.jpg`, fileName: "x.jpg" }, { src: `${R}/img/y.jpg` }],
  }),
  page({
    id: "b",
    url: `${R}/b`,
    title: "Repetido",
    metaDescription: "Descripción repetida idéntica en dos páginas del sitio de prueba.",
    contentHash: "h1",
  }),
  page({ id: "cat", url: `${R}/categoria/x`, pageType: "category", internalLinks: [] }),
  page({ id: "prod", url: `${R}/producto/x`, pageType: "product", wordCount: 120, depth: 2 }),
  page({ id: "thin", url: `${R}/producto/y`, pageType: "product", wordCount: 10, depth: 2 }),
];
const site: SiteContext = {
  rootUrl: R,
  platform: "generic-web",
  pages,
  brokenLinks: [
    { from: `${R}/`, to: `${R}/roto`, status: 404, temporary: false },
    { from: `${R}/`, to: `${R}/lento`, status: 0, temporary: true },
  ],
  coverage: { redirects: [{ from: `${R}/viejo`, to: `${R}/nuevo` }] } as any,
};

const RULES_WITH_EVIDENCE = [
  "thin-content",
  "ctx-product-description-short",
  "ctx-category-listing-links",
  "duplicate-content",
  "duplicate-title",
  "images-alt",
  "noindex",
  "canonical-mismatch",
  "broken-internal-links",
  "internal-links-unstable",
  "internal-link-redirects",
  "duplicate-meta-description",
  "ctx-home-section-links",
];

const { findings } = runAudit(site);
const ev = (ruleId: string, pageId?: string) =>
  (findings.find((f) => f.ruleId === ruleId && (!pageId || f.pageId === pageId))?.evidence ??
    []) as StructuredEvidence[];

describe("Fase 2.3 — evidencia estructurada en las 13 reglas", () => {
  it.each(RULES_WITH_EVIDENCE)("%s emite solo evidencia estructurada", (ruleId) => {
    const items = ev(ruleId);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => isStructuredEvidence(i))).toBe(true);
  });

  it("ningún hallazgo del motor emite strings legacy", () => {
    for (const f of findings) for (const i of f.evidence ?? []) expect(typeof i).not.toBe("string");
  });

  it("duplicados documentan la URL gemela como kind url", () => {
    for (const r of ["duplicate-title", "duplicate-content", "duplicate-meta-description"]) {
      expect(ev(r, "a")).toEqual([expect.objectContaining({ kind: "url", url: `${R}/b` })]);
    }
  });

  it("images-alt documenta nombre de archivo o src real", () => {
    expect(ev("images-alt", "a").map((i) => i.value)).toEqual(["x.jpg", `${R}/img/y.jpg`]);
  });

  it("noindex conserva la fuente HTML/HTTP y el estado", () => {
    const t = evidenceToStrings(ev("noindex", "home"));
    expect(t[0]).toContain("Meta robots en el HTML");
    expect(t[0]).toContain('"noindex, follow"');
    expect(t[1]).toContain("X-Robots-Tag");
    expect(t[2]).toContain("HTTP 200");
  });

  it("enlaces rotos, inestables, redirecciones y canonical llevan url + estado", () => {
    expect(ev("broken-internal-links", "home")[0]).toMatchObject({ kind: "url", url: `${R}/roto`, value: "HTTP 404" });
    expect(ev("internal-links-unstable", "home")[0]).toMatchObject({ kind: "url", url: `${R}/lento`, value: "sin respuesta" });
    expect(ev("internal-link-redirects", "home")[0]).toMatchObject({ kind: "url", url: `${R}/viejo` });
    expect(ev("canonical-mismatch", "home")[0]).toMatchObject({ kind: "url", url: `${R}/b`, value: "HTTP 200" });
    expect(ev("ctx-home-section-links", "home")[0]).toMatchObject({ kind: "url", url: `${R}/viejo`, value: "Viejo" });
  });
});

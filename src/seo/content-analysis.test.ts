import { describe, expect, it } from "vitest";
import { analyzeContent, jaccard, significantTokens } from "./content-analysis";
import { buildDemoSite } from "./demo";
import { runAudit } from "./engine";
import type { Audit, PageSnapshot } from "./types";

function demoAudit(): Audit {
  const site = buildDemoSite("generic-web");
  const { findings, score } = runAudit(site);
  return {
    id: "demo-audit",
    name: "Outdoor Patagonia (demo)",
    rootUrl: site.rootUrl,
    platform: "generic-web",
    createdAt: new Date().toISOString(),
    status: "done",
    crawlLimit: 100,
    isDemo: true,
    pages: site.pages,
    findings,
    score,
  } as unknown as Audit;
}


function page(p: Partial<PageSnapshot> & { id: string; url: string; path: string }): PageSnapshot {
  return {
    pageType: "other",
    statusCode: 200,
    h1: [],
    h2: [],
    h3: [],
    wordCount: 0,
    images: [],
    internalLinks: [],
    externalLinks: 0,
    schemaTypes: [],
    depth: 1,
    hasViewport: true,
    ...p,
  } as PageSnapshot;
}

function audit(pages: PageSnapshot[]): Audit {
  return {
    id: "a1",
    name: "test",
    rootUrl: "https://x.test",
    platform: "generic-web",
    createdAt: new Date().toISOString(),
    status: "done",
    crawlLimit: 50,
    pages,
    findings: [],
  } as unknown as Audit;
}

describe("similitud léxica", () => {
  it("tokeniza ignorando stopwords y acentos", () => {
    expect(significantTokens("Camperas de Montaña para invierno")).toEqual([
      "camperas",
      "montana",
      "invierno",
    ]);
  });
  it("jaccard 1 con los mismos tokens y 0 sin datos", () => {
    expect(jaccard(["a1", "b2"], ["b2", "a1"])).toBe(1);
    expect(jaccard([], ["x"])).toBe(0);
  });
});

describe("contenido insuficiente por contexto", () => {
  it("no penaliza contacto ni institucional por texto corto", () => {
    const a = audit([
      page({ id: "c", url: "https://x.test/contacto", path: "/contacto", pageType: "contact", wordCount: 30, h1: ["Contacto"] }),
      page({ id: "i", url: "https://x.test/nosotros", path: "/nosotros", pageType: "other", wordCount: 40, h1: ["Nosotros"] }),
    ]);
    const r = analyzeContent(a);
    expect(r.items.filter((i) => i.signalId === "content-insufficient")).toHaveLength(0);
    expect(r.stats.evaluated).toBe(0);
  });

  it("marca producto con muy poco texto como problema y usa lenguaje potencial", () => {
    const a = audit([
      page({ id: "p", url: "https://x.test/productos/x", path: "/productos/x", pageType: "product", wordCount: 20, h1: ["X"] }),
    ]);
    const r = analyzeContent(a);
    const item = r.items.find((i) => i.signalId === "content-insufficient")!;
    expect(item.classification).toBe("problem");
    expect(item.signalName).toContain("potencialmente insuficiente");
  });
});

describe("duplicación vs similitud", () => {
  it("separa duplicado confirmado (hash) de contenido potencialmente similar", () => {
    const long = Array.from({ length: 60 }, (_, i) => `palabra${i}`).join(" ");
    const a = audit([
      page({ id: "1", url: "https://x.test/a", path: "/a", wordCount: 200, contentHash: "h", textSample: long }),
      page({ id: "2", url: "https://x.test/b", path: "/b", wordCount: 200, contentHash: "h", textSample: long }),
      page({ id: "3", url: "https://x.test/c", path: "/c", wordCount: 200, contentHash: "z", textSample: long }),
    ]);
    const r = analyzeContent(a);
    expect(r.duplicateGroups).toHaveLength(1);
    expect(r.duplicateGroups[0]!.confirmed).toBe(true);
    expect(r.similarGroups.every((g) => !g.confirmed)).toBe(true);
    // la pareja con hash idéntico no se reporta también como "similar"
    expect(
      r.similarGroups.some(
        (g) => g.signalId === "content-similar-potential" && g.pages.map((p) => p.pageId).join() === "1,2",
      ),
    ).toBe(false);
  });
});

describe("aislamiento y score", () => {
  it("todo item queda atado al auditId y no hay score alterado", () => {
    const demo = buildDemoAudit();
    const r = analyzeContent(demo);
    expect(r.items.every((i) => i.auditId === demo.id)).toBe(true);
    expect(r.opportunities.every((i) => i.severity === undefined)).toBe(true);
    expect(demo.score?.total).toBe(demo.score?.total);
  });
});

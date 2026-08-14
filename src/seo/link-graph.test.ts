import { describe, expect, it } from "vitest";
import { analyzeAnchors, architectureGroups, buildLinkGraph, deriveDepthThreshold } from "./link-graph";
import type { Audit, PageSnapshot } from "./types";

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

function audit(pages: PageSnapshot[], id = "a1"): Audit {
  return {
    id,
    name: "Test",
    platform: "generic-web",
    rootUrl: "https://ex.com",
    isDemo: false,
    status: "done",
    createdAt: new Date().toISOString(),
    crawlLimit: 100,
    respectRobots: true,
    progress: { discovered: pages.length, analyzed: pages.length, issues: 0 },
    pages,
    findings: [],
  };
}

const home = page({
  id: "p0",
  url: "https://ex.com/",
  depth: 0,
  discoveredVia: "seed",
  internalLinks: [
    { href: "/a", anchor: "Camperas" },
    { href: "/a#top", anchor: "Camperas" },
    { href: "https://otro.com/x", anchor: "Externo" },
    { href: "/no-analizada", anchor: "ver más" },
  ],
});
const a = page({ id: "p1", url: "https://ex.com/a", depth: 1, discoveredVia: "internal-link" });
const b = page({ id: "p2", url: "https://ex.com/b", depth: 2, discoveredVia: "sitemap" });
const c = page({ id: "p3", url: "https://ex.com/c", depth: 3, discoveredVia: "internal-link" });

describe("link graph", () => {
  const g = buildLinkGraph(audit([home, a, b, c]));

  it("no cuenta externos ni duplica relaciones ni fragmentos", () => {
    expect(g.edges.filter((e) => e.targetPageId === "p1")).toHaveLength(1);
    expect(g.edges.some((e) => e.targetKey.startsWith("otro.com"))).toBe(false);
    expect(g.byPageId["p0"]!.outboundUnresolved).toBe(1);
  });

  it("deriva entrantes/salientes por página", () => {
    expect(g.byPageId["p1"]!.inbound).toBe(1);
    expect(g.byPageId["p1"]!.inboundPages).toBe(1);
    expect(g.byPageId["p0"]!.outbound).toBe(1);
  });

  it("distingue huérfana de potencialmente huérfana y de falta de evidencia", () => {
    expect(g.byPageId["p0"]!.orphanState).toBe("not-applicable");
    expect(g.byPageId["p1"]!.orphanState).toBe("linked");
    // p2 viene de sitemap → inferencia, no hecho
    expect(g.byPageId["p2"]!.orphanState).toBe("potentially-orphan");
    // p3 sin entrantes, rastreo incompleto por enlaces no resueltos
    expect(g.byPageId["p3"]!.orphanState).toBe("no-inbound-detected");
  });

  it("aísla por auditId", () => {
    const other = buildLinkGraph(audit([home, a], "a2"));
    expect(other.auditId).toBe("a2");
    expect(other.edges.every((e) => e.auditId === "a2")).toBe(true);
    expect(other.pages).toHaveLength(2);
  });

  it("umbral de profundidad derivado, nunca menor a 3", () => {
    expect(deriveDepthThreshold([0, 1, 1, 2]).value).toBe(3);
    expect(deriveDepthThreshold([0, 1, 5, 7, 9]).value).toBeGreaterThanOrEqual(3);
  });

  it("agrupa patrones y analiza anchors disponibles", () => {
    const groups = architectureGroups(g);
    expect(groups.some((x) => x.id === "potentially-orphan")).toBe(true);
    const an = analyzeAnchors(g);
    expect(an.available).toBe(true);
    expect(an.total).toBe(g.edges.length);
  });
});

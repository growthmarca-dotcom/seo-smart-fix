import { describe, expect, it } from "vitest";
import type { Diagnostic } from "./diagnostics";
import type { ContentItem } from "./content-analysis";
import {
  SITEMAP_ONLY_EVIDENCE,
  groupOpportunities,
  sharedValueClusters,
  TEMPLATE_RECOMMENDATION_TEXT,
  orphanReportLabel,
  reportEvidence,
  reportRecommendation,
  templateCluster,
} from "./report-presentation";
import type { Audit, Finding } from "./types";

const diag = (o: Partial<Diagnostic>): Diagnostic =>
  ({ key: "k", pageId: "p1", pageUrl: "https://x.com/a", ruleId: "x", current: "", detected: "", evidence: [], ...o }) as Diagnostic;
const audit = { id: "a", pages: [{ id: "p1", url: "https://x.com/a", path: "/a", wordCount: 60, pageType: "article" }], findings: [] } as unknown as Audit;

describe("report-presentation", () => {
  it("sitemap-only orphan → posible huérfana con evidencia", () => {
    expect(orphanReportLabel("potentially-orphan")).toBe("Posible página huérfana");
    const ev = reportEvidence(diag({ ruleId: "orphan-page" }), audit, { p1: "potentially-orphan" });
    expect(ev).toEqual([SITEMAP_ONLY_EVIDENCE]);
  });
  it("noindex conserva mecanismo en la evidencia", () => {
    const ev = reportEvidence(diag({ ruleId: "noindex", current: "noindex", evidence: ['Encabezado HTTP X-Robots-Tag: "noindex"'] }), audit);
    expect(ev[0]).toContain("X-Robots-Tag");
  });
  it("evidencia nunca vacía", () => {
    expect(reportEvidence(diag({}), audit).length).toBeGreaterThan(0);
  });
  it("duplicate-title explica el title compartido", () => {
    const ev = reportEvidence(diag({ ruleId: "duplicate-title", current: "Una publicación", evidence: ["https://x.com/b"] }), audit);
    expect(ev[0]).toContain('"Una publicación"');
    expect(ev[1]).toContain("/b");
  });
  it("recomendaciones corregidas no vacías y sin puntos suspensivos", () => {
    for (const r of ["noindex", "duplicate-title", "meta-description-missing", "title-length", "meta-description-length", "thin-content"]) {
      const rec = reportRecommendation(diag({ ruleId: r, detected: "Title largo" }), audit.pages[0], false);
      expect(rec?.text.length).toBeGreaterThan(20);
      expect(rec?.text.endsWith("…")).toBe(false);
    }
    const thin = reportRecommendation(diag({ ruleId: "thin-content" }), audit.pages[0], false)!;
    expect(thin.text).not.toMatch(/materiales|producto/i);
  });
  it("cluster de plantillas no altera hallazgos", () => {
    const f = (id: string, pageId: string, ruleId: string) => ({ id, pageId, ruleId, ruleName: ruleId, severity: "important" }) as Finding;
    const a = { ...audit, findings: [f("1", "p1", "thin-content"), f("2", "p1", "duplicate-title"), f("3", "p2", "thin-content"), f("4", "p2", "duplicate-title")] } as Audit;
    const c = templateCluster(a)!;
    expect(c.pageIds).toEqual(["p1", "p2"]);
    expect(a.findings).toHaveLength(4);
  });
  it("oportunidades se agrupan y excluyen reservas/contacto", () => {
    const o = (pageId: string, path: string): ContentItem => ({ key: pageId, signalId: "s", signalName: "S", recommendation: "R", pageId, pagePath: path, pageType: "other" }) as ContentItem;
    const g = groupOpportunities([o("1", "/a"), o("2", "/b"), o("3", "/reservas")]);
    expect(g).toHaveLength(1);
    expect(g[0]!.pages).toHaveLength(2);
  });
  it("image-filenames: recomendación general sin ejemplos de plantilla", () => {
    const r = reportRecommendation(diag({ ruleId: "image-filenames" }), audit.pages[0], false)!;
    expect(r.text).not.toMatch(/una-publicacion|\.webp/);
  });
  it("valor compartido: un grupo por valor; plantillas solo con recomendación de retiro", () => {
    const items = ["p1", "p2", "p3"].map((id) => diag({ key: id, pageId: id, ruleId: "duplicate-title", current: "Una publicación" }));
    const tpl = sharedValueClusters(items, audit, new Set(["p1", "p2", "p3"]));
    expect(tpl).toHaveLength(1);
    expect(tpl[0]!.items).toHaveLength(3);
    expect(tpl[0]!.recommendation.text).toBe(TEMPLATE_RECOMMENDATION_TEXT);
    const mixed = sharedValueClusters(items, audit, new Set(["p1"]));
    expect(mixed[0]!.recommendation.text).toMatch(/title único/);
  });
});

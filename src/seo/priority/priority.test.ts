/**
 * FASE 6B — Tests de la capa de correlación y priorización.
 * Verifican aislamiento por auditId, tipos de oportunidad, explicabilidad
 * y que no se generan falsos positivos por ausencia de datos.
 */
import { describe, expect, it } from "vitest";
import { buildSeoPriorities, queriesWithPages, CORRELATION_THRESHOLDS } from "./correlate";
import { priorityIndexOf, priorityLevelOf } from "./correlate";
import { PRIORITY_CUTOFFS } from "./types";
import type { Audit, Finding, PageSnapshot } from "@/seo/types";
import type { GscConnection, GscRow } from "@/seo/gsc/types";

const ROOT = "https://demo.test";

function page(partial: Partial<PageSnapshot> & { id: string; path: string }): PageSnapshot {
  return {
    url: `${ROOT}${partial.path}`,
    pageType: "other",
    statusCode: 200,
    h1: ["H1"],
    h2: [],
    h3: [],
    wordCount: 600,
    images: [],
    internalLinks: [],
    externalLinks: 0,
    schemaTypes: [],
    depth: 1,
    hasViewport: true,
    ...partial,
  } as PageSnapshot;
}

function finding(partial: Partial<Finding> & { id: string; pageId: string }): Finding {
  return {
    ruleId: "meta-description-missing",
    ruleName: "Meta description ausente",
    category: "onpage",
    kind: "onpage",
    severity: "important",
    pageUrl: `${ROOT}/p`,
    current: "—",
    problem: "Falta la meta description",
    field: "metaDescription",
    ...partial,
  } as Finding;
}

function audit(): Audit {
  const pages = [
    page({ id: "p1", path: "/producto-x", pageType: "product" }),
    page({ id: "p2", path: "/categoria-y", pageType: "category", depth: 2 }),
    page({ id: "p3", path: "/sin-datos", pageType: "article" }),
  ];
  return {
    id: "A1",
    name: "Demo",
    platform: "generic-web",
    rootUrl: ROOT,
    isDemo: true,
    status: "done",
    createdAt: new Date().toISOString(),
    crawlLimit: 100,
    respectRobots: true,
    progress: { discovered: 3, analyzed: 3, issues: 1 },
    pages,
    findings: [
      finding({ id: "f1", pageId: "p1", pageUrl: `${ROOT}/producto-x` }),
    ],
    score: { total: 70, categories: [], drivers: [] },
  } as unknown as Audit;
}

function connection(auditId = "A1"): GscConnection {
  return {
    auditId,
    property: { siteUrl: "sc-domain:demo.test", type: "domain" },
    source: "demo",
    status: "connected",
    period: { id: "28d", startDate: "2026-01-01", endDate: "2026-01-28" },
    connectedAt: new Date().toISOString(),
    rows: [],
  };
}

function rowsFor(
  auditId: string,
  path: string,
  opts: { impressions: number; clicks: number; position: number; query: string; days?: number },
): GscRow[] {
  const days = opts.days ?? 20;
  const out: GscRow[] = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(Date.parse("2026-01-01") + d * 86_400_000).toISOString().slice(0, 10);
    const impressions = Math.max(1, Math.round(opts.impressions / days));
    const clicks = Math.min(impressions, Math.round(opts.clicks / days));
    out.push({
      auditId,
      property: "sc-domain:demo.test",
      date,
      query: opts.query,
      page: `${ROOT}${path}`,
      clicks,
      impressions,
      ctr: impressions ? clicks / impressions : 0,
      position: opts.position,
      importedAt: new Date().toISOString(),
    });
  }
  return out;
}

describe("modelo de priorización", () => {
  it("traduce el índice a niveles con los cortes documentados", () => {
    expect(priorityLevelOf(PRIORITY_CUTOFFS.high)).toBe("high");
    expect(priorityLevelOf(PRIORITY_CUTOFFS.medium)).toBe("medium");
    expect(priorityLevelOf(PRIORITY_CUTOFFS.medium - 1)).toBe("low");
  });

  it("el índice depende de los factores declarados", () => {
    const factors = [
      { id: "impact" as const, label: "", value: 4, max: 4, weight: 0.35, reason: "" },
      { id: "evidence" as const, label: "", value: 4, max: 4, weight: 0.25, reason: "" },
      { id: "relevance" as const, label: "", value: 4, max: 4, weight: 0.25, reason: "" },
      { id: "ease" as const, label: "", value: 4, max: 4, weight: 0.15, reason: "" },
    ];
    expect(priorityIndexOf(factors)).toBe(100);
  });
});

describe("correlación GSC + auditoría", () => {
  it("detecta oportunidad de CTR con impresiones altas, posición competitiva y CTR bajo", () => {
    const a = audit();
    const rows = rowsFor("A1", "/producto-x", {
      impressions: 15000,
      clicks: 180,
      position: 5.8,
      query: "campera trekking",
    });
    const s = buildSeoPriorities({ audit: a, rows, connection: connection() });
    const ctr = s.opportunities.find((o) => o.type === "ctr-snippet");
    expect(ctr).toBeDefined();
    expect(ctr!.pageId).toBe("p1");
    expect(ctr!.diagnostics.map((d) => d.ruleId)).toContain("meta-description-missing");
    expect(ctr!.priorityExplanation).toContain("priorizada");
    expect(ctr!.factors).toHaveLength(4);
  });

  it("distingue impresiones sin clics por CTR bajo vs posición lejana", () => {
    const a = audit();
    const near = buildSeoPriorities({
      audit: a,
      rows: rowsFor("A1", "/producto-x", {
        impressions: 4000,
        clicks: 0,
        position: 6,
        query: "q",
      }),
      connection: connection(),
    });
    expect(near.opportunities.some((o) => o.type === "impressions-low-ctr")).toBe(true);
    expect(near.opportunities.some((o) => o.type === "impressions-low-position")).toBe(false);

    const far = buildSeoPriorities({
      audit: a,
      rows: rowsFor("A1", "/producto-x", {
        impressions: 4000,
        clicks: 0,
        position: 34,
        query: "q",
      }),
      connection: connection(),
    });
    expect(far.opportunities.some((o) => o.type === "impressions-low-position")).toBe(true);
    expect(far.opportunities.some((o) => o.type === "impressions-low-ctr")).toBe(false);
  });

  it("detecta margen de posición en la banda 8–20", () => {
    const s = buildSeoPriorities({
      audit: audit(),
      rows: rowsFor("A1", "/categoria-y", {
        impressions: 9200,
        clicks: 260,
        position: 11.3,
        query: "camperas",
      }),
      connection: connection(),
    });
    expect(s.opportunities.some((o) => o.type === "position-margin")).toBe(true);
  });

  it("correlaciona rendimiento con problema SEO existente sin duplicar el diagnóstico", () => {
    const s = buildSeoPriorities({
      audit: audit(),
      rows: rowsFor("A1", "/producto-x", {
        impressions: 3000,
        clicks: 400,
        position: 4,
        query: "q",
      }),
      connection: connection(),
    });
    const o = s.opportunities.find((x) => x.type === "performance-with-seo-issue");
    expect(o).toBeDefined();
    expect(o!.diagnostics[0]!.findingId).toBe("f1");
    // Solo referencia: no copia problema/sugerencia del diagnóstico original.
    expect(Object.keys(o!.diagnostics[0]!)).not.toContain("problem");
  });

  it("no genera oportunidades para páginas sin datos GSC y las clasifica como solo auditoría", () => {
    const s = buildSeoPriorities({
      audit: audit(),
      rows: rowsFor("A1", "/producto-x", {
        impressions: 3000,
        clicks: 20,
        position: 6,
        query: "q",
      }),
      connection: connection(),
    });
    expect(s.opportunities.every((o) => o.url !== `${ROOT}/sin-datos`)).toBe(true);
    expect(s.auditOnlyUrls).toContain(`${ROOT}/sin-datos`);
  });

  it("clasifica URLs presentes solo en GSC sin tratarlas como error", () => {
    const s = buildSeoPriorities({
      audit: audit(),
      rows: rowsFor("A1", "/no-rastreada", {
        impressions: 2000,
        clicks: 5,
        position: 7,
        query: "q",
      }),
      connection: connection(),
    });
    expect(s.gscOnlyUrls).toContain(`${ROOT}/no-rastreada`);
    const o = s.opportunities.find((x) => x.url === `${ROOT}/no-rastreada`);
    expect(o?.matchState).toBe("gsc-only");
  });

  it("no calcula tendencia con pocos días de datos", () => {
    const s = buildSeoPriorities({
      audit: audit(),
      rows: rowsFor("A1", "/producto-x", {
        impressions: 2000,
        clicks: 5,
        position: 6,
        query: "q",
        days: 3,
      }),
      connection: connection(),
    });
    expect(s.opportunities[0]!.gsc.trend).toBeUndefined();
    expect(CORRELATION_THRESHOLDS.minDaysForTrend).toBeGreaterThan(3);
  });

  it("nunca correlaciona filas de otra auditoría", () => {
    const s = buildSeoPriorities({
      audit: audit(),
      rows: [
        ...rowsFor("A2", "/producto-x", {
          impressions: 90000,
          clicks: 1,
          position: 3,
          query: "otra auditoría",
        }),
      ],
      connection: connection(),
    });
    expect(s.opportunities).toHaveLength(0);
    expect(s.matchedUrls).toBe(0);
  });

  it("relaciona consultas con la URL de la misma auditoría", () => {
    const a = audit();
    const rows = rowsFor("A1", "/producto-x", {
      impressions: 1000,
      clicks: 30,
      position: 6,
      query: "campera",
    });
    const list = queriesWithPages(rows, a);
    expect(list[0]!.query).toBe("campera");
    expect(list[0]!.pageId).toBe("p1");
  });

  it("no modifica el score de la auditoría", () => {
    const a = audit();
    const before = JSON.stringify(a.score);
    buildSeoPriorities({
      audit: a,
      rows: rowsFor("A1", "/producto-x", {
        impressions: 5000,
        clicks: 3,
        position: 6,
        query: "q",
      }),
      connection: connection(),
    });
    expect(JSON.stringify(a.score)).toBe(before);
    expect(a.findings).toHaveLength(1);
  });
});

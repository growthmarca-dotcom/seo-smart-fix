import { describe, expect, it } from "vitest";
import { mergeRows, metricsByPage, metricsByQuery, matchUrls, resolvePeriod, rowsForAudit, summarize } from "./import";
import { normalizeForMatch, propertyCoversUrl, propertyType, sameUrl } from "./normalize";
import { buildGscSignals } from "./opportunities";
import type { GscRow } from "./types";
import type { Audit, PageSnapshot } from "@/seo/types";

const IMPORTED = "2026-01-01T00:00:00.000Z";

function row(p: Partial<GscRow> & { auditId: string }): GscRow {
  return {
    property: "sc-domain:ej.com",
    date: "2026-01-01",
    clicks: 1,
    impressions: 100,
    ctr: 0.01,
    position: 8,
    importedAt: IMPORTED,
    ...p,
  } as GscRow;
}

function page(url: string, id: string): PageSnapshot {
  return {
    id,
    url,
    path: new URL(url).pathname,
    pageType: "product",
    statusCode: 200,
    h1: ["x"],
    h2: [],
    h3: [],
    wordCount: 500,
    images: [],
    internalLinks: [],
    externalLinks: 0,
    schemaTypes: [],
    depth: 1,
    hasViewport: true,
  };
}

describe("normalización de URLs (local, no la del crawler)", () => {
  it("ignora www, barra final, hash y parámetros de tracking", () => {
    expect(normalizeForMatch("https://www.ej.com/a/?utm_source=x#top")).toBe("ej.com/a");
    expect(sameUrl("https://ej.com/a", "http://www.ej.com/a/")).toBe(true);
  });
  it("detecta tipo y cobertura de propiedad", () => {
    expect(propertyType("sc-domain:ej.com")).toBe("domain");
    expect(propertyType("https://ej.com/")).toBe("url-prefix");
    expect(propertyCoversUrl("sc-domain:ej.com", "https://tienda.ej.com/x")).toBe(true);
    expect(propertyCoversUrl("https://ej.com/blog/", "https://ej.com/otro")).toBe(false);
  });
});

describe("importación y deduplicación", () => {
  it("no duplica al reimportar el mismo período", () => {
    const a = [row({ auditId: "A", query: "q", page: "https://ej.com/x" })];
    const again = [row({ auditId: "A", query: "q", page: "https://ej.com/x", clicks: 5 })];
    const merged = mergeRows(a, again);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.clicks).toBe(5);
  });
  it("mantiene filas distintas por dimensión", () => {
    const merged = mergeRows(
      [row({ auditId: "A", query: "q1", page: "https://ej.com/x" })],
      [row({ auditId: "A", query: "q2", page: "https://ej.com/x" })],
    );
    expect(merged).toHaveLength(2);
  });
  it("aísla por auditId y propiedad", () => {
    const rows = [
      row({ auditId: "A", query: "q", page: "https://ej.com/x" }),
      row({ auditId: "B", query: "q", page: "https://ej.com/x" }),
      row({ auditId: "A", query: "q", page: "https://ej.com/x", property: "https://otra.com/" }),
    ];
    expect(rowsForAudit(rows, "A", "sc-domain:ej.com")).toHaveLength(1);
  });
  it("respeta el rango de fechas del período", () => {
    const rows = [
      row({ auditId: "A", date: "2026-01-01", query: "q" }),
      row({ auditId: "A", date: "2026-02-10", query: "q" }),
    ];
    const filtered = rowsForAudit(rows, "A", "sc-domain:ej.com", {
      id: "7d",
      startDate: "2026-01-01",
      endDate: "2026-01-07",
    });
    expect(filtered).toHaveLength(1);
  });
  it("calcula períodos con el retraso de publicación de GSC", () => {
    const p = resolvePeriod("7d", new Date("2026-01-31T00:00:00Z"));
    expect(p.endDate).toBe("2026-01-28");
    expect(p.startDate).toBe("2026-01-22");
  });
});

describe("agregación y correspondencia", () => {
  const rows = [
    row({ auditId: "A", query: "q1", page: "https://ej.com/x", clicks: 2, impressions: 200 }),
    row({ auditId: "A", query: "q2", page: "https://ej.com/x", clicks: 0, impressions: 300 }),
    row({ auditId: "A", query: "q1", page: "https://ej.com/sin-crawler", clicks: 1, impressions: 50 }),
  ];
  const pages = [page("https://ej.com/x", "p1"), page("https://ej.com/solo-crawler", "p2")];

  it("agrega métricas por página y consulta", () => {
    const byPage = metricsByPage(rows, pages);
    expect(byPage[0]!.impressions).toBe(500);
    expect(byPage[0]!.queries).toBe(2);
    expect(byPage[0]!.pageId).toBe("p1");
    expect(metricsByQuery(rows)).toHaveLength(2);
    expect(summarize(rows).clicks).toBe(3);
  });

  it("clasifica URLs en ambas fuentes, solo GSC y solo crawler", () => {
    const states = matchUrls(rows, pages).map((m) => `${m.url}:${m.state}`);
    expect(states).toContain("https://ej.com/x:both");
    expect(states).toContain("https://ej.com/sin-crawler:gsc-only");
    expect(states).toContain("https://ej.com/solo-crawler:audit-only");
  });
});

describe("señales derivadas", () => {
  const audit = {
    id: "A",
    pages: [page("https://ej.com/x", "p1")],
    findings: [],
  } as unknown as Audit;

  it("marca impresiones altas con CTR bajo como oportunidad y no toca el score", () => {
    const signals = buildGscSignals(audit, [
      row({ auditId: "A", query: "q", page: "https://ej.com/x", clicks: 1, impressions: 1000, ctr: 0.001 }),
    ]);
    expect(signals.some((s) => s.id === "high-impressions-low-ctr")).toBe(true);
    expect(signals.every((s) => s.classification === "oportunidad" || s.classification === "señal para revisar")).toBe(true);
    expect(signals.every((s) => s.auditId === "A")).toBe(true);
  });

  it("no genera señales de volumen cuando no hay impresiones suficientes", () => {
    const signals = buildGscSignals(audit, [
      row({ auditId: "A", query: "q", page: "https://ej.com/x", clicks: 0, impressions: 5 }),
    ]);
    expect(signals.some((s) => s.id === "high-impressions-low-ctr")).toBe(false);
  });
});

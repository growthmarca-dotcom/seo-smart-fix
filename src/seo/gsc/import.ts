/**
 * FASE 6A — Capa de importación / agregación de datos GSC.
 * Separada del crawler: solo transforma filas ya obtenidas.
 * Nunca crea filas artificiales y nunca cruza auditorías.
 */
import type { Audit, Finding, PageSnapshot } from "@/seo/types";
import { normalizeForMatch } from "./normalize";
import {
  gscRowKey,
  type GscMetrics,
  type GscPageMetrics,
  type GscPeriod,
  type GscPeriodId,
  type GscQueryMetrics,
  type GscRow,
  type GscUrlMatchState,
} from "./types";

const DAY = 86_400_000;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Períodos compatibles con GSC. Se deja 3 días de margen porque
 * Search Console publica los datos con retraso.
 */
export function resolvePeriod(
  id: Exclude<GscPeriodId, "custom">,
  today = new Date(),
): GscPeriod {
  const end = new Date(today.getTime() - 3 * DAY);
  const days = id === "7d" ? 7 : id === "28d" ? 28 : 90;
  const start = new Date(end.getTime() - (days - 1) * DAY);
  return { id, startDate: iso(start), endDate: iso(end) };
}

/**
 * Deduplicación: reimportar el mismo período actualiza las filas existentes
 * (última importación gana) en vez de duplicarlas.
 */
export function mergeRows(existing: GscRow[], incoming: GscRow[]): GscRow[] {
  const map = new Map<string, GscRow>();
  for (const row of existing) map.set(gscRowKey(row), row);
  for (const row of incoming) map.set(gscRowKey(row), row);
  return [...map.values()];
}

/** Filtra por auditoría + propiedad + rango de fechas. Aislamiento estricto. */
export function rowsForAudit(
  rows: GscRow[],
  auditId: string,
  property: string,
  period?: GscPeriod | undefined,
): GscRow[] {
  return rows.filter(
    (r) =>
      r.auditId === auditId &&
      r.property === property &&
      (!period || (r.date >= period.startDate && r.date <= period.endDate)),
  );
}

function aggregate(rows: GscRow[]): GscMetrics {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const weighted = rows.reduce((s, r) => s + r.position * r.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weighted / impressions : 0,
  };
}

export interface GscSummary extends GscMetrics {
  queries: number;
  pages: number;
  rows: number;
}

export function summarize(rows: GscRow[]): GscSummary {
  return {
    ...aggregate(rows),
    queries: new Set(rows.map((r) => r.query).filter(Boolean)).size,
    pages: new Set(rows.map((r) => r.page).filter(Boolean)).size,
    rows: rows.length,
  };
}

/** Rendimiento por URL, con relación opcional a las páginas de la auditoría. */
export function metricsByPage(rows: GscRow[], pages: PageSnapshot[] = []): GscPageMetrics[] {
  const index = new Map(pages.map((p) => [normalizeForMatch(p.url), p.id]));
  const groups = new Map<string, GscRow[]>();
  for (const row of rows) {
    if (!row.page) continue;
    const list = groups.get(row.page);
    if (list) list.push(row);
    else groups.set(row.page, [row]);
  }
  return [...groups.entries()]
    .map(([page, list]) => ({
      page,
      ...aggregate(list),
      queries: new Set(list.map((r) => r.query).filter(Boolean)).size,
      pageId: index.get(normalizeForMatch(page)),
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

export function metricsByQuery(rows: GscRow[]): GscQueryMetrics[] {
  const groups = new Map<string, GscRow[]>();
  for (const row of rows) {
    if (!row.query) continue;
    const list = groups.get(row.query);
    if (list) list.push(row);
    else groups.set(row.query, [row]);
  }
  return [...groups.entries()]
    .map(([query, list]) => ({
      query,
      ...aggregate(list),
      pages: new Set(list.map((r) => r.page).filter(Boolean)).size,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

export interface GscUrlMatch {
  url: string;
  state: GscUrlMatchState;
  pageId?: string | undefined;
  metrics?: GscMetrics | undefined;
  queries?: number | undefined;
}

/**
 * Clasificación de URLs: en ambas fuentes, solo en GSC o solo en el crawler.
 * Una URL sin datos GSC NO se considera un problema.
 */
export function matchUrls(rows: GscRow[], pages: PageSnapshot[]): GscUrlMatch[] {
  const byPage = metricsByPage(rows, pages);
  const gscKeys = new Set(byPage.map((p) => normalizeForMatch(p.page)));
  const matched: GscUrlMatch[] = byPage.map((p) => ({
    url: p.page,
    state: p.pageId ? "both" : "gsc-only",
    pageId: p.pageId,
    metrics: { clicks: p.clicks, impressions: p.impressions, ctr: p.ctr, position: p.position },
    queries: p.queries,
  }));
  const auditOnly: GscUrlMatch[] = pages
    .filter((p) => !gscKeys.has(normalizeForMatch(p.url)))
    .map((p) => ({ url: p.url, state: "audit-only" as const, pageId: p.id }));
  return [...matched, ...auditOnly];
}

/** Hallazgos on-page/indexación relevantes de una página (solo lectura). */
export function relevantFindings(audit: Audit, pageId: string | undefined): Finding[] {
  if (!pageId) return [];
  return audit.findings.filter(
    (f) => f.pageId === pageId && f.severity !== "ok" && f.severity !== "improvement",
  );
}

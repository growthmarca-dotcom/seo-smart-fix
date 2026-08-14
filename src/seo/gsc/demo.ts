/**
 * FASE 6A — Datos MOCK de Search Console, exclusivamente para la demo
 * "Outdoor Patagonia". Siempre marcados con source: "demo" y jamás
 * combinados con datos reales (`live`) en la misma vista.
 */
import type { Audit } from "@/seo/types";
import { resolvePeriod } from "./import";
import type { GscConnection, GscPeriodId, GscRow } from "./types";

const DEMO_PROPERTY = "sc-domain:outdoorpatagonia.demo";

const QUERIES: Array<{ q: string; path: string; imp: number; clicks: number; pos: number }> = [
  { q: "campera de trekking", path: "/productos/campera-cerro-torre", imp: 4200, clicks: 38, pos: 7.4 },
  { q: "campera impermeable patagonia", path: "/productos/campera-cerro-torre", imp: 1850, clicks: 12, pos: 9.1 },
  { q: "rompeviento liviano", path: "/productos/campera-rompeviento", imp: 990, clicks: 61, pos: 4.2 },
  { q: "botas de montaña", path: "/productos/botas-fitzroy", imp: 2400, clicks: 1, pos: 12.8 },
  { q: "mochila 40 litros", path: "/productos/mochila-perito-moreno", imp: 1320, clicks: 44, pos: 6.3 },
  { q: "camperas outdoor", path: "/categorias/camperas", imp: 3100, clicks: 22, pos: 8.7 },
  { q: "como elegir campera", path: "/blog/como-elegir-campera", imp: 760, clicks: 51, pos: 5.5 },
  { q: "outdoor patagonia", path: "/", imp: 2200, clicks: 410, pos: 1.4 },
  { q: "guia de abrigo montaña", path: "/blog/guia-de-abrigo", imp: 180, clicks: 0, pos: 22.6 },
  { q: "campera cerro torre opiniones", path: "/productos/campera-cerro-torre-v2", imp: 420, clicks: 3, pos: 14.1 },
];

/**
 * Genera filas mock deterministas para el período pedido.
 * No inventa combinaciones vacías: cada fila corresponde a una consulta declarada.
 */
export function buildDemoGscConnection(audit: Audit, periodId: Exclude<GscPeriodId, "custom">): GscConnection {
  const period = resolvePeriod(periodId);
  const importedAt = new Date().toISOString();
  const days = Math.max(
    1,
    Math.round(
      (Date.parse(period.endDate) - Date.parse(period.startDate)) / 86_400_000,
    ) + 1,
  );
  const root = audit.rootUrl.replace(/\/+$/, "");
  const rows: GscRow[] = [];

  for (let d = 0; d < days; d++) {
    const date = new Date(Date.parse(period.startDate) + d * 86_400_000)
      .toISOString()
      .slice(0, 10);
    for (const item of QUERIES) {
      const impressions = Math.max(1, Math.round(item.imp / days));
      const clicks = Math.min(impressions, Math.round(item.clicks / days));
      rows.push({
        auditId: audit.id,
        property: DEMO_PROPERTY,
        date,
        query: item.q,
        page: `${root}${item.path}`,
        device: d % 2 === 0 ? "MOBILE" : "DESKTOP",
        country: "arg",
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : 0,
        position: item.pos,
        importedAt,
      });
    }
  }

  return {
    auditId: audit.id,
    property: { siteUrl: DEMO_PROPERTY, type: "domain", permissionLevel: "siteOwner" },
    source: "demo",
    status: rows.length > 0 ? "connected" : "no-data",
    period,
    connectedAt: importedAt,
    lastSyncAt: importedAt,
    rows,
  };
}

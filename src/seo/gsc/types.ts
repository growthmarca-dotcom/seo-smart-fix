/**
 * FASE 6A — Modelo de datos de Google Search Console (solo lectura).
 * Capa ADITIVA: no toca PageSnapshot, Finding, SeoScore ni el crawler.
 * Todo registro conserva `auditId` + `property` para garantizar aislamiento.
 */

export type GscPropertyType = "domain" | "url-prefix";

export interface GscProperty {
  /** Identificador exacto devuelto por la API (`sc-domain:ej.com` o `https://ej.com/`). */
  siteUrl: string;
  type: GscPropertyType;
  /** permissionLevel informado por Search Console (informativo). */
  permissionLevel?: string | undefined;
}

/** Origen de los datos. Nunca se mezclan en la misma vista. */
export type GscDataSource = "live" | "demo";

export type GscConnectionStatus =
  | "disconnected"
  | "connected"
  | "importing"
  | "error"
  | "no-data";

export const GSC_STATUS_LABELS: Record<GscConnectionStatus, string> = {
  disconnected: "No conectado",
  connected: "Conectado",
  importing: "Importando",
  error: "Error de conexión",
  "no-data": "Sin datos",
};

export type GscPeriodId = "7d" | "28d" | "3m" | "custom";

export const GSC_PERIOD_LABELS: Record<GscPeriodId, string> = {
  "7d": "Últimos 7 días",
  "28d": "Últimos 28 días",
  "3m": "Últimos 3 meses",
  custom: "Período personalizado",
};

export interface GscPeriod {
  id: GscPeriodId;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
}

/**
 * Fila normalizada de Search Console. Las métricas vienen tal cual de la API;
 * si una dimensión no está disponible se deja `undefined` (nunca se inventa).
 */
export interface GscRow {
  auditId: string;
  property: string;
  /** YYYY-MM-DD */
  date: string;
  query?: string | undefined;
  page?: string | undefined;
  country?: string | undefined;
  device?: string | undefined;
  searchAppearance?: string | undefined;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  /** Fecha de importación (ISO). */
  importedAt: string;
}

/** Clave de deduplicación: misma combinación auditId+propiedad+fecha+dimensiones. */
export function gscRowKey(row: GscRow): string {
  return [
    row.auditId,
    row.property,
    row.date,
    row.query ?? "",
    row.page ?? "",
    row.country ?? "",
    row.device ?? "",
    row.searchAppearance ?? "",
  ].join("|");
}

/** Conexión GSC asociada explícitamente a UNA auditoría. */
export interface GscConnection {
  auditId: string;
  property: GscProperty;
  source: GscDataSource;
  status: GscConnectionStatus;
  period?: GscPeriod | undefined;
  connectedAt: string;
  lastSyncAt?: string | undefined;
  error?: string | undefined;
  rows: GscRow[];
}

export interface GscMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPageMetrics extends GscMetrics {
  page: string;
  queries: number;
  /** Página de la auditoría (si se pudo relacionar). */
  pageId?: string | undefined;
}

export interface GscQueryMetrics extends GscMetrics {
  query: string;
  pages: number;
}

/** Correspondencia entre URLs del crawler y URLs de GSC. */
export type GscUrlMatchState = "both" | "gsc-only" | "audit-only";

export const GSC_MATCH_LABELS: Record<GscUrlMatchState, string> = {
  both: "Encontrada en la auditoría y en GSC",
  "gsc-only": "En GSC pero no encontrada por el crawler",
  "audit-only": "Encontrada por el crawler pero sin datos GSC",
};

/** Señal derivada. Nunca afirma causalidad ni modifica el score. */
export type GscSignalId =
  | "high-impressions-low-ctr"
  | "good-position-low-ctr"
  | "impressions-no-clicks"
  | "performance-without-onpage-findings"
  | "performance-with-seo-issues";

export interface GscSignal {
  id: GscSignalId;
  name: string;
  auditId: string;
  page: string;
  pageId?: string | undefined;
  metrics: GscMetrics;
  queries: number;
  evidence: string[];
  explanation: string;
  recommendation: string;
  /** Siempre "oportunidad" o "señal para revisar": nunca un problema del score. */
  classification: "oportunidad" | "señal para revisar";
}

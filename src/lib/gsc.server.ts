/**
 * FASE 6A — Acceso real a la API de Google Search Console (solo lectura).
 *
 * OAuth: se delega al conector oficial de Google Search Console de la
 * plataforma (gateway). La app NUNCA pide ni guarda credenciales de Google:
 * envía `Authorization: Bearer LOVABLE_API_KEY` +
 * `X-Connection-Api-Key: GOOGLE_SEARCH_CONSOLE_API_KEY` y el gateway adjunta
 * el token OAuth del usuario.
 *
 * QUÉ FALTA para datos reales: vincular una conexión de Google Search Console
 * al proyecto. Sin `GOOGLE_SEARCH_CONSOLE_API_KEY` estas funciones devuelven
 * `configured: false` y la UI muestra "No conectado" (nunca datos simulados).
 */
const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

export interface GscCredentials {
  lovableApiKey: string;
  connectionApiKey: string;
}

export function readCredentials(): GscCredentials | null {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const connectionApiKey = process.env["GOOGLE_SEARCH_CONSOLE_API_KEY"];
  if (!lovableApiKey || !connectionApiKey) return null;
  return { lovableApiKey, connectionApiKey };
}

function headers(creds: GscCredentials) {
  return {
    Authorization: `Bearer ${creds.lovableApiKey}`,
    "X-Connection-Api-Key": creds.connectionApiKey,
    "Content-Type": "application/json",
  };
}

export interface SiteEntry {
  siteUrl: string;
  permissionLevel?: string;
}

/** GET /webmasters/v3/sites — propiedades verificadas de la cuenta conectada. */
export async function listSites(creds: GscCredentials): Promise<SiteEntry[]> {
  const res = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers: headers(creds) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`No se pudieron listar las propiedades [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { siteEntry?: SiteEntry[] };
  return (json.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser");
}

export interface SearchAnalyticsRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** POST /webmasters/v3/sites/{siteUrl}/searchAnalytics/query */
export async function querySearchAnalytics(
  creds: GscCredentials,
  siteUrl: string,
  body: {
    startDate: string;
    endDate: string;
    dimensions: string[];
    rowLimit?: number;
  },
): Promise<SearchAnalyticsRow[]> {
  const res = await fetch(
    `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    { method: "POST", headers: headers(creds), body: JSON.stringify(body) },
  );
  if (res.status === 403) {
    throw new Error("La cuenta conectada no tiene acceso a esta propiedad de Search Console.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Search Console devolvió un error [${res.status}]: ${text}`);
  }
  const json = (await res.json()) as { rows?: SearchAnalyticsRow[] };
  return json.rows ?? [];
}

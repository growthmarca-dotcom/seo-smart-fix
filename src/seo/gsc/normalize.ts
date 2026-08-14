/**
 * FASE 6A — Normalización LOCAL de URLs solo para relacionar GSC ↔ auditoría.
 * No modifica el normalizador del crawler (src/lib/crawl.server.ts).
 */

/**
 * Forma comparable de una URL: minúsculas en host, sin hash,
 * sin `www.`, sin barra final y sin parámetros de tracking habituales.
 */
export function normalizeForMatch(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
  url.hash = "";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const trackingPrefixes = ["utm_", "gclid", "fbclid", "mc_", "_ga"];
  const params = [...url.searchParams.entries()]
    .filter(([k]) => !trackingPrefixes.some((p) => k.toLowerCase().startsWith(p)))
    .sort(([a], [b]) => a.localeCompare(b));
  const search = params.length
    ? `?${params.map(([k, v]) => `${k}=${v}`).join("&")}`
    : "";
  const path = url.pathname.replace(/\/+$/, "");
  return `${host}${path}${search}`;
}

/** true si ambas URLs apuntan al mismo recurso a efectos de comparación. */
export function sameUrl(a: string, b: string): boolean {
  return normalizeForMatch(a) === normalizeForMatch(b);
}

/** Tipo de propiedad a partir del identificador devuelto por la API. */
export function propertyType(siteUrl: string): "domain" | "url-prefix" {
  return siteUrl.startsWith("sc-domain:") ? "domain" : "url-prefix";
}

/** true si la propiedad cubre la URL raíz de la auditoría. */
export function propertyCoversUrl(siteUrl: string, targetUrl: string): boolean {
  try {
    const target = new URL(targetUrl);
    if (siteUrl.startsWith("sc-domain:")) {
      const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
      const host = target.hostname.toLowerCase();
      return host === domain || host.endsWith(`.${domain}`);
    }
    const prefix = new URL(siteUrl);
    return target.href.startsWith(prefix.href);
  } catch {
    return false;
  }
}

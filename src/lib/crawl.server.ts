/**
 * Crawler / URL discovery para sitios públicos (solo servidor).
 *
 * Descubrimiento combinado: sitemap.xml (incluye sitemap index) + enlaces
 * internos. URLs normalizadas y deduplicadas, respeto opcional de robots.txt,
 * límite de rastreo estricto y reporte de cobertura con motivos de exclusión.
 */
import { parseHtml } from "@/seo/html";
import type {
  CrawlCoverage,
  DiscoverySource,
  ExclusionReason,
  PageSnapshot,
} from "@/seo/types";

const UA = "SEOFixerBot/0.1 (+auditoría SEO)";
const TIMEOUT_MS = 12000;
/** Tope duro de seguridad para no rastrear indiscriminadamente. */
export const MAX_CRAWL_LIMIT = 1000;
/** Máximo de enlaces internos no rastreados que se verifican para detectar roturas. */
const BROKEN_LINK_BUDGET = 60;

/** Parámetros de tracking/orden que no cambian el contenido de la página. */
const DROP_PARAMS = [
  /^utm_/i,
  /^gclid$/i,
  /^fbclid$/i,
  /^msclkid$/i,
  /^mc_(cid|eid)$/i,
  /^ref$/i,
  /^_ga$/i,
  /^yclid$/i,
  /^igshid$/i,
];

const NON_HTML_EXT =
  /\.(jpe?g|png|gif|webp|avif|svg|ico|pdf|docx?|xlsx?|pptx?|zip|rar|gz|tgz|csv|txt|xml|json|css|js|mjs|map|mp[34]|m4a|mov|avi|webm|woff2?|ttf|eot)$/i;

async function get(url: string, method: "GET" | "HEAD" = "GET") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml" },
      redirect: "follow",
      signal: controller.signal,
    });
    const body = method === "HEAD" ? "" : await res.text();
    return {
      status: res.status,
      body,
      ms: Date.now() - started,
      finalUrl: res.url || url,
      contentType: res.headers.get("content-type") ?? undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRoot(input: string) {
  const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const u = new URL(withProto);
  u.hash = "";
  return u;
}

/**
 * Normaliza una URL para deduplicar: host en minúsculas, sin hash, sin
 * parámetros de tracking, parámetros ordenados, sin `index.html` y sin barra
 * final (salvo la raíz).
 */
export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const u = base ? new URL(raw, base) : new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    u.username = "";
    u.password = "";
    for (const key of [...u.searchParams.keys()]) {
      if (DROP_PARAMS.some((re) => re.test(key))) u.searchParams.delete(key);
    }
    const entries = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    u.search = "";
    for (const [k, v] of entries) u.searchParams.append(k, v);
    u.pathname = u.pathname.replace(/\/(index|default)\.(html?|php|aspx?)$/i, "/");
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    if (u.pathname === "") u.pathname = "/";
    return u.toString();
  } catch {
    return null;
  }
}

/** Compara hosts ignorando el prefijo www para no salir del dominio pedido. */
function sameSite(a: URL, b: URL) {
  const strip = (h: string) => h.replace(/^www\./i, "").toLowerCase();
  return strip(a.hostname) === strip(b.hostname);
}

interface RobotsInfo {
  found: boolean;
  disallowsAll: boolean;
  sitemaps: string[];
  disallow: string[];
  allow: string[];
}

async function readRobots(origin: string): Promise<RobotsInfo> {
  const empty: RobotsInfo = {
    found: false,
    disallowsAll: false,
    sitemaps: [],
    disallow: [],
    allow: [],
  };
  try {
    const res = await get(`${origin}/robots.txt`);
    if (res.status >= 400 || /<html/i.test(res.body)) return empty;
    const lines = res.body.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
    const sitemaps: string[] = [];
    const disallow: string[] = [];
    const allow: string[] = [];
    // Solo se aplican los grupos que afectan a nuestro user-agent (* o SEOFixerBot).
    let applies = false;
    for (const line of lines) {
      const [rawKey, ...rest] = line.split(":");
      if (!rawKey || rest.length === 0) continue;
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(":").trim();
      if (key === "sitemap") {
        if (value) sitemaps.push(value);
        continue;
      }
      if (key === "user-agent") {
        applies = value === "*" || /seofixerbot/i.test(value);
        continue;
      }
      if (!applies || !value) continue;
      if (key === "disallow") disallow.push(value);
      if (key === "allow") allow.push(value);
    }
    return {
      found: true,
      disallowsAll: disallow.includes("/"),
      sitemaps,
      disallow,
      allow,
    };
  } catch {
    return empty;
  }
}

function matchesRobotsPath(pathWithQuery: string, pattern: string) {
  // Soporte básico de comodines * y ancla $ como usa el estándar de facto.
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\\\$$/, "$");
  try {
    return new RegExp(`^${escaped}`).test(pathWithQuery);
  } catch {
    return pathWithQuery.startsWith(pattern);
  }
}

function robotsBlocks(robots: RobotsInfo, url: string) {
  const u = new URL(url);
  const target = u.pathname + u.search;
  const longest = (list: string[]) =>
    list
      .filter((p) => matchesRobotsPath(target, p))
      .sort((a, b) => b.length - a.length)[0];
  const dis = longest(robots.disallow);
  if (!dis) return false;
  const allow = longest(robots.allow);
  // Allow más específico gana sobre Disallow.
  return !(allow && allow.length >= dis.length);
}

async function readSitemap(
  url: string,
  root: URL,
  depth = 0,
  seenSitemaps = new Set<string>(),
): Promise<{ urls: string[]; sitemaps: string[] }> {
  if (depth > 3 || seenSitemaps.has(url) || seenSitemaps.size > 25) {
    return { urls: [], sitemaps: [] };
  }
  seenSitemaps.add(url);
  try {
    const res = await get(url);
    if (res.status >= 400 || !/<(urlset|sitemapindex)/i.test(res.body)) {
      return { urls: [], sitemaps: [] };
    }
    const locs = [...res.body.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)]
      .map((m) => (m[1] ?? "").trim().replace(/&amp;/g, "&"))
      .filter(Boolean);

    if (/<sitemapindex/i.test(res.body)) {
      const urls: string[] = [];
      const sitemaps: string[] = [url];
      for (const child of locs.slice(0, 20)) {
        const nested = await readSitemap(child, root, depth + 1, seenSitemaps);
        urls.push(...nested.urls);
        sitemaps.push(...nested.sitemaps);
      }
      return { urls, sitemaps };
    }

    const urls = locs
      .map((l) => normalizeUrl(l))
      .filter((u): u is string => Boolean(u))
      .filter((u) => sameSite(new URL(u), root));
    return { urls, sitemaps: [url] };
  } catch {
    return { urls: [], sitemaps: [] };
  }
}

export interface CrawlResult {
  pages: PageSnapshot[];
  robotsFound: boolean;
  robotsDisallowAll: boolean;
  sitemapFound: boolean;
  sitemapUrlCount: number;
  discovered: number;
  errors: string[];
  coverage: CrawlCoverage;
  brokenLinks: Array<{ from: string; to: string; status: number }>;
}

interface QueueItem {
  url: string;
  depth: number;
  via: DiscoverySource;
}

export async function crawlSite(input: {
  rootUrl: string;
  limit: number;
  respectRobots: boolean;
}): Promise<CrawlResult> {
  const root = normalizeRoot(input.rootUrl);
  const origin = root.origin;
  const limit = Math.max(1, Math.min(Math.round(input.limit), MAX_CRAWL_LIMIT));
  const errors: string[] = [];
  const excluded: CrawlCoverage["excluded"] = [];
  const coverageErrors: CrawlCoverage["errors"] = [];
  const redirects: CrawlCoverage["redirects"] = [];

  const robots = await readRobots(origin);
  const robotsActive = input.respectRobots && robots.found;

  const baseCoverage = (): CrawlCoverage => ({
    limit,
    limitReached: false,
    respectRobots: input.respectRobots,
    robotsTxtFound: robots.found,
    robotsRulesApplied: robotsActive ? robots.disallow.length : 0,
    sitemapsFound: [],
    urlsFromSitemap: 0,
    urlsFromLinks: 0,
    urlsFromBoth: 0,
    discovered: 0,
    analyzed: 0,
    excluded,
    errors: coverageErrors,
    redirects,
  });

  if (robotsActive && robots.disallowsAll) {
    const coverage = baseCoverage();
    excluded.push({ url: `${origin}/`, reason: "robots-disallow", detail: "Disallow: /" });
    return {
      pages: [],
      robotsFound: robots.found,
      robotsDisallowAll: true,
      sitemapFound: false,
      sitemapUrlCount: 0,
      discovered: 0,
      errors: ["robots.txt bloquea el rastreo de todo el sitio (Disallow: /)."],
      coverage: { ...coverage, discovered: 1 },
      brokenLinks: [],
    };
  }

  // ---- Descubrimiento por sitemap (incluye sitemap index) ----
  const candidates = robots.sitemaps.length
    ? robots.sitemaps
    : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`];
  const sitemapUrls = new Set<string>();
  const sitemapsFound: string[] = [];
  for (const candidate of candidates) {
    const found = await readSitemap(candidate, root);
    if (found.urls.length) {
      found.urls.forEach((u) => sitemapUrls.add(u));
      sitemapsFound.push(...found.sitemaps);
    }
  }

  /** Origen de descubrimiento por URL normalizada. */
  const via = new Map<string, DiscoverySource>();
  const queued = new Set<string>();
  const queue: QueueItem[] = [];

  const markVia = (url: string, source: DiscoverySource) => {
    const prev = via.get(url);
    if (!prev) via.set(url, source);
    else if (prev !== source && prev !== "seed" && prev !== "both") via.set(url, "both");
  };

  const enqueue = (raw: string, depth: number, source: DiscoverySource, from?: string) => {
    const normalized = normalizeUrl(raw, origin);
    if (!normalized) return;
    const target = new URL(normalized);
    if (!sameSite(target, root)) {
      return; // enlace externo: no forma parte del alcance
    }
    if (NON_HTML_EXT.test(target.pathname)) {
      if (!queued.has(normalized)) {
        excluded.push({ url: normalized, reason: "non-html", detail: from });
      }
      return;
    }
    if (robotsActive && robotsBlocks(robots, normalized)) {
      if (!queued.has(normalized)) {
        excluded.push({ url: normalized, reason: "robots-disallow", detail: from });
      }
      return;
    }
    markVia(normalized, source);
    if (queued.has(normalized)) return;
    queued.add(normalized);
    queue.push({ url: normalized, depth, via: source });
  };

  const rootNormalized = normalizeUrl(root.toString()) ?? root.toString();
  enqueue(rootNormalized, 0, "seed");
  for (const u of sitemapUrls) enqueue(u, 1, "sitemap");

  const analyzed = new Map<string, PageSnapshot>();
  let limitReached = false;

  while (queue.length) {
    if (analyzed.size >= limit) {
      limitReached = true;
      for (const rest of queue) {
        excluded.push({ url: rest.url, reason: "limit-reached" });
      }
      break;
    }
    const next = queue.shift()!;
    if (analyzed.has(next.url)) continue;

    try {
      const res = await get(next.url);
      const finalNormalized = normalizeUrl(res.finalUrl) ?? next.url;
      if (finalNormalized !== next.url) {
        redirects.push({ from: next.url, to: finalNormalized, status: res.status });
        if (analyzed.has(finalNormalized)) {
          excluded.push({
            url: next.url,
            reason: "duplicate-normalized",
            detail: `Redirige a ${finalNormalized}`,
          });
          continue;
        }
      }
      const isHtml = (res.contentType ?? "").includes("html") || /<html/i.test(res.body);
      if (!isHtml && res.status < 400) {
        excluded.push({ url: next.url, reason: "non-html", detail: res.contentType });
        continue;
      }
      const snapshot = parseHtml({
        url: next.url,
        html: res.body,
        statusCode: res.status,
        depth: next.depth,
        responseMs: res.ms,
        contentType: res.contentType,
      });
      snapshot.discoveredVia = via.get(next.url) ?? next.via;
      if (finalNormalized !== next.url) snapshot.redirectedFrom = [next.url];
      analyzed.set(next.url, snapshot);

      if (res.status < 400) {
        for (const link of snapshot.internalLinks) {
          enqueue(link.href, next.depth + 1, "internal-link", next.url);
        }
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : "error de red";
      errors.push(`${next.url}: ${reason}`);
      coverageErrors.push({ url: next.url, reason });
      excluded.push({ url: next.url, reason: "fetch-error", detail: reason });
    }
  }

  const pages = [...analyzed.values()];

  // ---- Enlaces internos rotos ----
  const brokenLinks: CrawlResult["brokenLinks"] = [];
  const statusByUrl = new Map<string, number>();
  for (const p of pages) statusByUrl.set(normalizeUrl(p.url) ?? p.url, p.statusCode);

  const pending: Array<{ from: string; to: string }> = [];
  for (const p of pages) {
    for (const link of p.internalLinks) {
      const target = normalizeUrl(link.href, origin);
      if (!target || !sameSite(new URL(target), root) || NON_HTML_EXT.test(new URL(target).pathname))
        continue;
      const known = statusByUrl.get(target);
      if (known !== undefined) {
        if (known >= 400) brokenLinks.push({ from: p.url, to: target, status: known });
      } else if (
        !pending.some((x) => x.to === target) &&
        pending.length < BROKEN_LINK_BUDGET &&
        !(robotsActive && robotsBlocks(robots, target))
      ) {
        pending.push({ from: p.url, to: target });
      }
    }
  }
  for (const item of pending) {
    try {
      const res = await get(item.to, "HEAD");
      statusByUrl.set(item.to, res.status);
      if (res.status >= 400) brokenLinks.push({ ...item, status: res.status });
    } catch {
      /* Sin respuesta: no se afirma que esté roto. */
    }
  }

  const sources = [...via.entries()].filter(([url]) => queued.has(url));
  const coverage: CrawlCoverage = {
    ...baseCoverage(),
    limitReached,
    sitemapsFound: [...new Set(sitemapsFound)],
    urlsFromSitemap: sources.filter(([, s]) => s === "sitemap").length,
    urlsFromLinks: sources.filter(([, s]) => s === "internal-link").length,
    urlsFromBoth: sources.filter(([, s]) => s === "both").length,
    discovered: queued.size,
    analyzed: pages.length,
  };

  return {
    pages,
    robotsFound: robots.found,
    robotsDisallowAll: robots.disallowsAll,
    sitemapFound: sitemapsFound.length > 0,
    sitemapUrlCount: sitemapUrls.size,
    discovered: queued.size,
    errors: errors.slice(0, 20),
    coverage,
    brokenLinks,
  };
}

export async function analyzeSingleUrl(url: string): Promise<PageSnapshot | null> {
  const target = normalizeUrl(normalizeRoot(url).toString()) ?? normalizeRoot(url).toString();
  const res = await get(target);
  const snapshot = parseHtml({
    url: target,
    html: res.body,
    statusCode: res.status,
    depth: 0,
    responseMs: res.ms,
    contentType: res.contentType,
  });
  snapshot.discoveredVia = "seed";
  return snapshot;
}

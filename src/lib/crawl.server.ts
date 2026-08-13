/**
 * Crawler / URL discovery para sitios públicos (solo servidor).
 *
 * Descubrimiento combinado: robots.txt + sitemap.xml (incluye sitemap index y
 * sitemaps hijos) + enlaces internos. URLs normalizadas y deduplicadas con
 * registro del motivo de normalización, respeto opcional de robots.txt,
 * verificación de enlaces con caché y clasificación de estados, límite de
 * rastreo estricto y reporte de cobertura con motivos de exclusión.
 *
 * Limitaciones conocidas (no simuladas, documentadas en la UI):
 * - No ejecuta JavaScript: los enlaces generados en cliente no se descubren.
 * - Rastreo secuencial y con presupuesto de verificación de enlaces.
 * - No hay Core Web Vitals reales (requiere integración de PageSpeed).
 */
import { parseHtml } from "@/seo/html";
import type {
  CrawlCoverage,
  DiscoverySource,
  LinkCheck,
  LinkStatusClass,
  NormalizationRecord,
  PageSnapshot,
  RobotsReport,
  RobotsState,
  SitemapDoc,
} from "@/seo/types";

const UA = "SEOFixerBot/0.1 (+auditoría SEO)";
const TIMEOUT_MS = 12000;
/** Tope duro de seguridad para no rastrear indiscriminadamente. */
export const MAX_CRAWL_LIMIT = 1000;
/**
 * Presupuesto de verificaciones extra de enlaces internos no rastreados.
 * Escala con el límite de rastreo para soportar sitios grandes sin rehacer
 * el crawler, con un tope de seguridad.
 */
export function linkCheckBudget(limit: number) {
  return Math.min(400, Math.max(40, Math.round(limit * 0.5)));
}
/** Sitios grandes: tope alto de documentos sitemap, no un límite artificial pequeño. */
const MAX_SITEMAP_DOCS = 200;
const MAX_SITEMAP_DEPTH = 5;

/** Parámetros de tracking/orden que no cambian el contenido de la página. */
const DROP_PARAMS = [
  /^utm_/i,
  /^gclid$/i,
  /^fbclid$/i,
  /^msclkid$/i,
  /^mc_(cid|eid)$/i,
  /^_ga$/i,
  /^yclid$/i,
  /^igshid$/i,
  /^srsltid$/i,
];

const NON_HTML_EXT =
  /\.(jpe?g|png|gif|webp|avif|svg|ico|pdf|docx?|xlsx?|pptx?|zip|rar|gz|tgz|csv|txt|xml|json|css|js|mjs|map|mp[34]|m4a|mov|avi|webm|woff2?|ttf|eot)$/i;

interface FetchOutcome {
  status: number;
  body: string;
  ms: number;
  finalUrl: string;
  contentType?: string | undefined;
  redirected: boolean;
}

async function get(url: string, method: "GET" | "HEAD" = "GET"): Promise<FetchOutcome> {
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
      redirected: res.redirected,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Clasifica un estado HTTP o un fallo de red en una categoría explicable. */
export function classifyStatus(status: number, redirected = false): LinkStatusClass {
  if (status === -1) return "timeout";
  if (status === -2) return "network-error";
  if (status === 404) return "not-found";
  if (status === 410) return "gone";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "server-error";
  if (status >= 300 && status < 400) return "redirect";
  if (status >= 200 && status < 300) return redirected ? "redirect" : "ok";
  return "unknown";
}

/** Estados que NO permiten afirmar que un enlace esté roto de forma definitiva. */
export function isTemporary(cls: LinkStatusClass) {
  return (
    cls === "rate-limited" ||
    cls === "server-error" ||
    cls === "timeout" ||
    cls === "network-error" ||
    cls === "forbidden" ||
    cls === "unknown"
  );
}

function normalizeRoot(input: string) {
  const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const u = new URL(withProto);
  u.hash = "";
  return u;
}

export interface NormalizeOutcome {
  url: string | null;
  reasons: string[];
}

/**
 * Normaliza una URL para deduplicar y devuelve por qué cambió.
 * Se toca solo lo que no altera el contenido: host en minúsculas, protocolo,
 * fragmento, credenciales, parámetros de tracking, orden de parámetros,
 * `index.html` y barra final. El path conserva mayúsculas y el resto de los
 * parámetros porque pueden cambiar realmente la página.
 */
export function normalizeUrlDetailed(raw: string, base?: string): NormalizeOutcome {
  const reasons: string[] = [];
  try {
    const u = base ? new URL(raw, base) : new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return { url: null, reasons: ["protocolo no http(s)"] };
    if (u.hash) {
      u.hash = "";
      reasons.push("fragmento # eliminado");
    }
    if (u.hostname !== u.hostname.toLowerCase()) {
      reasons.push("host en minúsculas");
      u.hostname = u.hostname.toLowerCase();
    }
    if (u.username || u.password) {
      u.username = "";
      u.password = "";
      reasons.push("credenciales eliminadas");
    }
    if (
      (u.protocol === "http:" && u.port === "80") ||
      (u.protocol === "https:" && u.port === "443")
    ) {
      u.port = "";
      reasons.push("puerto por defecto eliminado");
    }
    const dropped: string[] = [];
    for (const key of [...u.searchParams.keys()]) {
      if (DROP_PARAMS.some((re) => re.test(key))) {
        u.searchParams.delete(key);
        dropped.push(key);
      }
    }
    if (dropped.length) reasons.push(`parámetros de tracking eliminados (${dropped.join(", ")})`);
    const entries = [...u.searchParams.entries()];
    const sorted = [...entries].sort(([a], [b]) => a.localeCompare(b));
    if (entries.map(([k]) => k).join() !== sorted.map(([k]) => k).join()) {
      reasons.push("parámetros ordenados");
    }
    u.search = "";
    for (const [k, v] of sorted) u.searchParams.append(k, v);

    let decodedPath = u.pathname;
    try {
      // Decodifica solo caracteres seguros para evitar duplicados por encoding.
      const decoded = decodeURI(u.pathname);
      if (decoded !== u.pathname) {
        decodedPath = encodeURI(decoded);
        if (decodedPath !== u.pathname) reasons.push("URL encoding normalizado");
      }
    } catch {
      /* encoding inválido: se conserva tal cual */
    }
    u.pathname = decodedPath;

    const withoutIndex = u.pathname.replace(/\/(index|default)\.(html?|php|aspx?)$/i, "/");
    if (withoutIndex !== u.pathname) {
      u.pathname = withoutIndex;
      reasons.push("index.html eliminado");
    }
    if (u.pathname.length > 1 && /\/+$/.test(u.pathname)) {
      u.pathname = u.pathname.replace(/\/+$/, "");
      reasons.push("barra final eliminada");
    }
    if (u.pathname === "") u.pathname = "/";
    return { url: u.toString(), reasons };
  } catch {
    return { url: null, reasons: ["URL inválida"] };
  }
}

export function normalizeUrl(raw: string, base?: string): string | null {
  return normalizeUrlDetailed(raw, base).url;
}

/** Compara hosts ignorando el prefijo www para no salir del dominio pedido. */
function sameSite(a: URL, b: URL) {
  const strip = (h: string) => h.replace(/^www\./i, "").toLowerCase();
  return strip(a.hostname) === strip(b.hostname);
}

/**
 * Lee e interpreta robots.txt distinguiendo grupos User-agent.
 * La ausencia del archivo NO se trata como error: se informa el estado.
 */
export async function readRobots(origin: string): Promise<RobotsReport> {
  const base: RobotsReport = {
    state: "missing",
    found: false,
    groupsFound: 0,
    disallow: [],
    allow: [],
    sitemaps: [],
    parseWarnings: [],
    applied: false,
  };
  let res: FetchOutcome;
  try {
    res = await get(`${origin}/robots.txt`);
  } catch {
    return { ...base, state: "fetch-error" };
  }
  if (res.status === 404 || res.status === 410) return { ...base, state: "missing" };
  if (res.status >= 400) {
    return { ...base, state: "fetch-error", parseWarnings: [`HTTP ${res.status}`] };
  }
  if (/<html/i.test(res.body)) {
    // Muchos hostings devuelven la página 404 con estado 200.
    return { ...base, state: "invalid", parseWarnings: ["La respuesta era HTML, no robots.txt"] };
  }
  const rawLines = res.body.split(/\r?\n/);
  if (!res.body.trim()) return { ...base, found: true, state: "empty" };

  const sitemaps: string[] = [];
  const parseWarnings: string[] = [];
  /** Grupos: user-agents que encabezan el bloque + reglas del bloque. */
  const groups: Array<{ agents: string[]; disallow: string[]; allow: string[] }> = [];
  let current: { agents: string[]; disallow: string[]; allow: string[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of rawLines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) {
      parseWarnings.push(`Línea sin "campo: valor": ${line.slice(0, 60)}`);
      continue;
    }
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) {
      parseWarnings.push(`Directiva "${key}" sin User-agent previo`);
      continue;
    }
    if (key === "disallow") {
      // "Disallow:" vacío significa permitir todo en el estándar.
      if (value) current.disallow.push(value);
      continue;
    }
    if (key === "allow") {
      if (value) current.allow.push(value);
      continue;
    }
    if (key === "crawl-delay" || key === "host" || key === "noindex") continue;
    parseWarnings.push(`Directiva no reconocida: ${key}`);
  }

  // Grupo aplicable: primero coincidencia exacta de nuestro agente, luego "*".
  const specific = groups.find((g) => g.agents.some((a) => a.includes("seofixerbot")));
  const wildcard = groups.find((g) => g.agents.includes("*"));
  const group = specific ?? wildcard;
  const state: RobotsState = group?.disallow.includes("/")
    ? "disallow-all"
    : groups.length === 0 && sitemaps.length === 0
      ? "empty"
      : "valid";

  return {
    state,
    found: true,
    groupsFound: groups.length,
    userAgentGroup: specific ? "SEOFixerBot" : wildcard ? "*" : undefined,
    disallow: group?.disallow ?? [],
    allow: group?.allow ?? [],
    sitemaps,
    parseWarnings: parseWarnings.slice(0, 10),
    applied: false,
  };
}

function matchesRobotsPath(pathWithQuery: string, pattern: string) {
  // Soporte de comodines * y ancla $ como el estándar de facto.
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

/** Devuelve el patrón Disallow que bloquea la URL, o null si está permitida. */
export function robotsBlockedBy(robots: RobotsReport, url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const target = u.pathname + u.search;
  const longest = (list: string[]) =>
    list.filter((p) => matchesRobotsPath(target, p)).sort((a, b) => b.length - a.length)[0];
  const dis = longest(robots.disallow);
  if (!dis) return null;
  const allow = longest(robots.allow);
  // Allow igual o más específico gana sobre Disallow.
  if (allow && allow.length >= dis.length) return null;
  return dis;
}

interface SitemapScan {
  urls: Set<string>;
  docs: SitemapDoc[];
}

async function scanSitemap(
  url: string,
  root: URL,
  scan: SitemapScan,
  depth = 0,
  kindHint: "sitemap" | "child" = "sitemap",
): Promise<void> {
  if (depth > MAX_SITEMAP_DEPTH || scan.docs.length >= MAX_SITEMAP_DOCS) return;
  if (scan.docs.some((d) => d.url === url)) return; // corta estructuras circulares
  let res: FetchOutcome;
  try {
    res = await get(url);
  } catch (e) {
    scan.docs.push({
      url,
      kind: "inaccessible",
      urlCount: 0,
      detail: e instanceof Error ? e.message : "error de red",
    });
    return;
  }
  if (res.status >= 400) {
    scan.docs.push({ url, kind: "inaccessible", urlCount: 0, status: res.status });
    return;
  }
  if (!/<(urlset|sitemapindex)/i.test(res.body)) {
    scan.docs.push({
      url,
      kind: "invalid",
      urlCount: 0,
      status: res.status,
      detail: "El documento no contiene <urlset> ni <sitemapindex>",
    });
    return;
  }
  const locs = [...res.body.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)]
    .map((m) => (m[1] ?? "").trim().replace(/&amp;/g, "&"))
    .filter(Boolean);

  if (/<sitemapindex/i.test(res.body)) {
    scan.docs.push({ url, kind: "index", urlCount: locs.length, status: res.status });
    for (const child of locs) {
      if (scan.docs.length >= MAX_SITEMAP_DOCS) break;
      await scanSitemap(child, root, scan, depth + 1, "child");
    }
    return;
  }

  let added = 0;
  for (const loc of locs) {
    const normalized = normalizeUrl(loc);
    if (!normalized) continue;
    try {
      if (!sameSite(new URL(normalized), root)) continue;
    } catch {
      continue;
    }
    if (!scan.urls.has(normalized)) {
      scan.urls.add(normalized);
      added += 1;
    }
  }
  scan.docs.push({ url, kind: kindHint, urlCount: added, status: res.status });
}

export interface CrawlResult {
  pages: PageSnapshot[];
  robotsFound: boolean;
  robotsDisallowAll: boolean;
  robotsState: RobotsState;
  sitemapFound: boolean;
  sitemapUrlCount: number;
  sitemapDocs: SitemapDoc[];
  discovered: number;
  errors: string[];
  coverage: CrawlCoverage;
  brokenLinks: Array<{
    from: string;
    to: string;
    status: number;
    statusClass: LinkStatusClass;
    temporary: boolean;
  }>;
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
  const budget = linkCheckBudget(limit);
  const errors: string[] = [];
  const excluded: CrawlCoverage["excluded"] = [];
  const coverageErrors: CrawlCoverage["errors"] = [];
  const redirects: CrawlCoverage["redirects"] = [];
  const normalizations: NormalizationRecord[] = [];
  const linkChecks: LinkCheck[] = [];

  const robotsReport = await readRobots(origin);
  const robotsActive = input.respectRobots && robotsReport.found && robotsReport.state !== "empty";
  const robots: RobotsReport = { ...robotsReport, applied: robotsActive };
  const disallowsAll = robots.state === "disallow-all";
  let blocked = 0;

  const recordNormalization = (raw: string, normalized: string, reasons: string[]) => {
    if (!reasons.length || raw === normalized) return;
    if (normalizations.length >= 50) return;
    if (normalizations.some((n) => n.from === raw)) return;
    normalizations.push({ from: raw, to: normalized, reasons });
  };

  // ---- Descubrimiento por sitemap (sitemap index + hijos) ----
  const scan: SitemapScan = { urls: new Set(), docs: [] };
  if (!(robotsActive && disallowsAll)) {
    const candidates = robots.sitemaps.length
      ? robots.sitemaps
      : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`];
    for (const candidate of candidates) {
      await scanSitemap(candidate, root, scan);
      // Si el candidato por defecto ya trajo URLs, no se prueban los alias.
      if (!robots.sitemaps.length && scan.urls.size > 0) break;
    }
  }
  const sitemapDocs = scan.docs;
  const sitemapUrls = scan.urls;
  const validSitemaps = sitemapDocs.filter((d) => d.kind !== "inaccessible" && d.kind !== "invalid");

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
    const { url: normalized, reasons } = normalizeUrlDetailed(raw, origin);
    if (!normalized) return;
    recordNormalization(raw, normalized, reasons);
    const target = new URL(normalized);
    if (!sameSite(target, root)) return; // enlace externo: fuera del alcance
    if (NON_HTML_EXT.test(target.pathname)) {
      if (!queued.has(normalized) && !excluded.some((e) => e.url === normalized)) {
        excluded.push({ url: normalized, reason: "non-html", detail: from });
      }
      return;
    }
    if (robotsActive) {
      const pattern = robotsBlockedBy(robots, normalized);
      if (pattern) {
        if (!queued.has(normalized) && !excluded.some((e) => e.url === normalized)) {
          excluded.push({
            url: normalized,
            reason: "robots-disallow",
            detail: `Disallow: ${pattern}`,
          });
          blocked += 1;
        }
        return;
      }
    }
    markVia(normalized, source);
    if (queued.has(normalized)) return;
    queued.add(normalized);
    queue.push({ url: normalized, depth, via: source });
  };

  const baseCoverage = (): CrawlCoverage => ({
    limit,
    limitReached: false,
    respectRobots: input.respectRobots,
    robotsTxtFound: robots.found,
    robotsRulesApplied: robotsActive ? robots.disallow.length + robots.allow.length : 0,
    robots,
    sitemapDocs,
    sitemapsFound: validSitemaps.map((d) => d.url),
    urlsFromSitemap: 0,
    urlsFromLinks: 0,
    urlsFromBoth: 0,
    discovered: 0,
    analyzed: 0,
    pending: 0,
    blocked,
    coveragePct: 0,
    normalizations,
    linkChecks,
    linkChecksUsed: 0,
    linkCheckBudget: budget,
    excluded,
    errors: coverageErrors,
    redirects,
  });

  if (robotsActive && disallowsAll) {
    excluded.push({ url: `${origin}/`, reason: "robots-disallow", detail: "Disallow: /" });
    blocked = 1;
    return {
      pages: [],
      robotsFound: robots.found,
      robotsDisallowAll: true,
      robotsState: robots.state,
      sitemapFound: false,
      sitemapUrlCount: 0,
      sitemapDocs,
      discovered: 1,
      errors: ["robots.txt bloquea el rastreo de todo el sitio (Disallow: /)."],
      coverage: { ...baseCoverage(), discovered: 1, blocked: 1, coveragePct: 0 },
      brokenLinks: [],
    };
  }

  const rootNormalized = normalizeUrl(root.toString()) ?? root.toString();
  enqueue(rootNormalized, 0, "seed");
  for (const u of sitemapUrls) enqueue(u, 1, "sitemap");

  const analyzed = new Map<string, PageSnapshot>();
  let limitReached = false;
  let pending = 0;

  while (queue.length) {
    if (analyzed.size >= limit) {
      limitReached = true;
      pending = queue.length;
      for (const rest of queue) excluded.push({ url: rest.url, reason: "limit-reached" });
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
        excluded.push({ url: next.url, reason: "not-html-response", detail: res.contentType });
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
      linkChecks.push({
        url: next.url,
        status: res.status,
        statusClass: classifyStatus(res.status, res.redirected),
        finalUrl: finalNormalized !== next.url ? finalNormalized : undefined,
        temporary: isTemporary(classifyStatus(res.status, res.redirected)),
        from: ["crawl"],
      });

      if (res.status < 400) {
        for (const link of snapshot.internalLinks) {
          enqueue(link.href, next.depth + 1, "internal-link", next.url);
        }
      }
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      const reason = aborted ? "timeout" : e instanceof Error ? e.message : "error de red";
      errors.push(`${next.url}: ${reason}`);
      coverageErrors.push({ url: next.url, reason });
      excluded.push({ url: next.url, reason: "fetch-error", detail: reason });
      linkChecks.push({
        url: next.url,
        status: aborted ? -1 : -2,
        statusClass: aborted ? "timeout" : "network-error",
        temporary: true,
        from: ["crawl"],
      });
    }
  }

  const pages = [...analyzed.values()];

  // ---- Verificación de enlaces internos con caché ----
  /** Caché de estados por URL normalizada: evita repetir verificaciones. */
  const cache = new Map<string, LinkCheck>();
  for (const check of linkChecks) cache.set(check.url, check);

  const brokenLinks: CrawlResult["brokenLinks"] = [];
  const toVerify = new Map<string, string[]>();

  for (const p of pages) {
    for (const link of p.internalLinks) {
      const target = normalizeUrl(link.href, origin);
      if (!target) continue;
      let targetUrl: URL;
      try {
        targetUrl = new URL(target);
      } catch {
        continue;
      }
      if (!sameSite(targetUrl, root) || NON_HTML_EXT.test(targetUrl.pathname)) continue;
      if (robotsActive && robotsBlockedBy(robots, target)) continue;

      const cached = cache.get(target);
      if (cached) {
        if (!cached.from.includes(p.url)) cached.from.push(p.url);
        continue;
      }
      const froms = toVerify.get(target);
      if (froms) {
        if (!froms.includes(p.url)) froms.push(p.url);
      } else if (toVerify.size < budget) {
        toVerify.set(target, [p.url]);
      }
    }
  }

  let checksUsed = 0;
  for (const [target, froms] of toVerify) {
    checksUsed += 1;
    let check: LinkCheck;
    try {
      let res = await get(target, "HEAD");
      // Algunos servidores no soportan HEAD: se reintenta con GET.
      if (res.status === 405 || res.status === 501) res = await get(target, "GET");
      const cls = classifyStatus(res.status, res.redirected);
      check = {
        url: target,
        status: res.status,
        statusClass: cls,
        finalUrl: res.finalUrl !== target ? (normalizeUrl(res.finalUrl) ?? res.finalUrl) : undefined,
        temporary: isTemporary(cls),
        from: froms,
      };
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      check = {
        url: target,
        status: aborted ? -1 : -2,
        statusClass: aborted ? "timeout" : "network-error",
        temporary: true,
        from: froms,
      };
    }
    cache.set(target, check);
    linkChecks.push(check);
    if (check.statusClass === "redirect" && check.finalUrl) {
      redirects.push({ from: target, to: check.finalUrl, status: check.status });
    }
  }

  // Un enlace es "roto" solo con estados definitivos; los temporales se marcan aparte.
  for (const check of cache.values()) {
    const definitive = check.statusClass === "not-found" || check.statusClass === "gone";
    const unstable = check.temporary && check.statusClass !== "ok";
    if (!definitive && !unstable) continue;
    for (const from of check.from) {
      if (from === "crawl") continue;
      brokenLinks.push({
        from,
        to: check.url,
        status: check.status,
        statusClass: check.statusClass,
        temporary: !definitive,
      });
    }
  }
  // Páginas rastreadas con 404/410 también rompen los enlaces que apuntan a ellas.
  for (const p of pages) {
    if (p.statusCode !== 404 && p.statusCode !== 410) continue;
    for (const other of pages) {
      if (other.id === p.id) continue;
      const links = other.internalLinks.filter((l) => normalizeUrl(l.href, origin) === p.url);
      if (!links.length) continue;
      if (brokenLinks.some((b) => b.from === other.url && b.to === p.url)) continue;
      brokenLinks.push({
        from: other.url,
        to: p.url,
        status: p.statusCode,
        statusClass: classifyStatus(p.statusCode),
        temporary: false,
      });
    }
  }

  const sources = [...via.entries()].filter(([url]) => queued.has(url));
  const discovered = queued.size + blocked;
  const coverage: CrawlCoverage = {
    ...baseCoverage(),
    limitReached,
    urlsFromSitemap: sources.filter(([, s]) => s === "sitemap").length,
    urlsFromLinks: sources.filter(([, s]) => s === "internal-link").length,
    urlsFromBoth: sources.filter(([, s]) => s === "both").length,
    discovered,
    analyzed: pages.length,
    pending,
    blocked,
    coveragePct: discovered ? Math.round((pages.length / discovered) * 1000) / 10 : 0,
    linkChecksUsed: checksUsed,
  };

  return {
    pages,
    robotsFound: robots.found,
    robotsDisallowAll: disallowsAll,
    robotsState: robots.state,
    sitemapFound: validSitemaps.some((d) => d.urlCount > 0 || d.kind === "index"),
    sitemapUrlCount: sitemapUrls.size,
    sitemapDocs,
    discovered,
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

/** Crawler / URL discovery para sitios públicos (solo servidor). */
import { parseHtml } from "@/seo/html";
import type { PageSnapshot } from "@/seo/types";

const UA = "SEOFixerBot/0.1 (+auditoría SEO)";
const TIMEOUT_MS = 12000;

async function get(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml" },
      redirect: "follow",
      signal: controller.signal,
    });
    const body = await res.text();
    return { status: res.status, body, ms: Date.now() - started, finalUrl: res.url || url, contentType: res.headers.get("content-type") ?? undefined };
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

function cleanUrl(raw: string, origin: string) {
  try {
    const u = new URL(raw, origin);
    if (u.origin !== origin) return null;
    if (!/^https?:$/.test(u.protocol)) return null;
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js|ico|mp4|woff2?)$/i.test(u.pathname)) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

async function readRobots(origin: string) {
  try {
    const res = await get(`${origin}/robots.txt`);
    if (res.status >= 400) return { found: false, disallowsAll: false, sitemaps: [] as string[] };
    const lines = res.body.split(/\r?\n/).map((l) => l.trim());
    const sitemaps = lines
      .filter((l) => /^sitemap:/i.test(l))
      .map((l) => l.split(/:\s*/).slice(1).join(":").trim())
      .filter(Boolean);
    const disallowsAll = /user-agent:\s*\*/i.test(res.body) && /disallow:\s*\/\s*$/im.test(res.body);
    return { found: true, disallowsAll, sitemaps };
  } catch {
    return { found: false, disallowsAll: false, sitemaps: [] as string[] };
  }
}

async function readSitemap(url: string, origin: string, depth = 0): Promise<string[]> {
  if (depth > 2) return [];
  try {
    const res = await get(url);
    if (res.status >= 400 || !/<(urlset|sitemapindex)/i.test(res.body)) return [];
    const locs = [...res.body.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)]
      .map((m) => (m[1] ?? "").trim())
      .filter(Boolean);
    if (/<sitemapindex/i.test(res.body)) {
      const nested: string[] = [];
      for (const child of locs.slice(0, 5)) nested.push(...(await readSitemap(child, origin, depth + 1)));
      return nested;
    }
    return locs.map((l) => cleanUrl(l, origin)).filter((u): u is string => Boolean(u));
  } catch {
    return [];
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
}

export async function crawlSite(input: {
  rootUrl: string;
  limit: number;
  respectRobots: boolean;
}): Promise<CrawlResult> {
  const root = normalizeRoot(input.rootUrl);
  const origin = root.origin;
  const limit = Math.max(1, Math.min(input.limit, 300));
  const errors: string[] = [];

  const robots = await readRobots(origin);
  if (input.respectRobots && robots.disallowsAll) {
    return {
      pages: [],
      robotsFound: robots.found,
      robotsDisallowAll: true,
      sitemapFound: false,
      sitemapUrlCount: 0,
      discovered: 0,
      errors: ["robots.txt bloquea el rastreo de todo el sitio (Disallow: /)."],
    };
  }

  const sitemapCandidates = robots.sitemaps.length
    ? robots.sitemaps
    : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  let sitemapUrls: string[] = [];
  let sitemapFound = false;
  for (const candidate of sitemapCandidates) {
    const urls = await readSitemap(candidate, origin);
    if (urls.length) {
      sitemapFound = true;
      sitemapUrls = urls;
      break;
    }
  }

  const queue: Array<{ url: string; depth: number }> = [{ url: root.toString(), depth: 0 }];
  for (const u of sitemapUrls.slice(0, limit * 2)) queue.push({ url: u, depth: 1 });

  const seen = new Set<string>();
  const pages: PageSnapshot[] = [];

  while (queue.length && pages.length < limit) {
    const next = queue.shift()!;
    const key = next.url.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const res = await get(next.url);
      const isHtml = (res.contentType ?? "").includes("html") || /<html/i.test(res.body);
      if (!isHtml && res.status < 400) continue;
      const snapshot = parseHtml({
        url: next.url,
        html: res.body,
        statusCode: res.status,
        depth: next.depth,
        responseMs: res.ms,
        contentType: res.contentType,
      });
      pages.push(snapshot);
      if (res.status < 400) {
        for (const link of snapshot.internalLinks) {
          const clean = cleanUrl(link.href, origin);
          if (clean && !seen.has(clean.replace(/\/$/, ""))) {
            queue.push({ url: clean, depth: next.depth + 1 });
          }
        }
      }
    } catch (e) {
      errors.push(`${next.url}: ${e instanceof Error ? e.message : "error de red"}`);
    }
  }

  return {
    pages,
    robotsFound: robots.found,
    robotsDisallowAll: robots.disallowsAll,
    sitemapFound,
    sitemapUrlCount: sitemapUrls.length,
    discovered: seen.size,
    errors: errors.slice(0, 20),
  };
}

export async function analyzeSingleUrl(url: string): Promise<PageSnapshot | null> {
  const target = normalizeRoot(url).toString();
  const res = await get(target);
  return parseHtml({
    url: target,
    html: res.body,
    statusCode: res.status,
    depth: 0,
    responseMs: res.ms,
    contentType: res.contentType,
  });
}

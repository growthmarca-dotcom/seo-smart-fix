/**
 * Etapa 1 — Clasificador heurístico de URLs. Función PURA: sin I/O, sin
 * almacenamiento, sin decidir inclusión/exclusión. No toca crawler ni score.
 */
import { graphKey } from "../link-graph";
import type { PageSnapshot } from "../types";
import type { ClassifyOptions, TriState, UrlClassification } from "./types";

export const NAV_LIMITATION =
  "El rastreo no conserva si el enlace estaba en menú, header o footer: esa pertenencia no está comprobada. Se informa solo una aproximación por enlace recurrente.";

const RESIDUAL_TOKENS = [
  "page",
  "pagina",
  "draft",
  "borrador",
  "test",
  "prueba",
  "ejemplo",
  "sample",
  "sample-page",
  "untitled",
  "copia",
  "copy",
];
const PLACEHOLDER_TITLES = new Set(["pagina", "page", "untitled", "sin titulo", "nueva pagina", "new page"]);
const NUMERIC_SUFFIX = /-(\d+|copia|copy)$/i;

function norm(s: string | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function lastSegment(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/").filter(Boolean);
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

export function classifyUrls(
  pages: readonly PageSnapshot[],
  seedUrl: string,
  options: ClassifyOptions = {},
): Map<string, UrlClassification> {
  const seedKey = graphKey(seedUrl);
  const keyOf = (p: PageSnapshot) => graphKey(p.url) ?? p.url;

  // Enlaces entrantes: páginas distintas que enlazan a cada destino (sin autoenlaces).
  const linkers = new Map<string, Set<string>>();
  let pagesWithLinks = 0;
  for (const p of pages) {
    const src = keyOf(p);
    const targets = new Set<string>();
    for (const l of p.internalLinks) {
      const t = graphKey(l.href, p.url);
      if (t && t !== src) targets.add(t);
    }
    if (targets.size) pagesWithLinks++;
    for (const t of targets) {
      if (!linkers.has(t)) linkers.set(t, new Set());
      linkers.get(t)!.add(src);
    }
  }

  const titleCount = new Map<string, number>();
  for (const p of pages) {
    const t = norm(p.title);
    if (t) titleCount.set(t, (titleCount.get(t) ?? 0) + 1);
  }

  const explicitSitemap = options.sitemapUrls
    ? new Set(options.sitemapUrls.map((u) => graphKey(u) ?? u))
    : undefined;

  const out = new Map<string, UrlClassification>();
  for (const p of pages) {
    const key = keyOf(p);
    const isSeed = key === seedKey;
    const linkingPagesCount = linkers.get(key)?.size ?? 0;

    let inSitemap: TriState = "unknown";
    let source: UrlClassification["sitemap"]["source"] = "none";
    if (explicitSitemap) {
      inSitemap = explicitSitemap.has(key) ? "yes" : "no";
      source = "explicit-list";
    } else if (p.discoveredVia === "sitemap" || p.discoveredVia === "both") {
      inSitemap = "yes";
      source = "discovery-record";
    }

    const seg = lastSegment(p.path);
    const base = seg.replace(NUMERIC_SUFFIX, "");
    const matchedToken = RESIDUAL_TOKENS.find((t) => seg === t || base === t);
    const hasPlaceholderTitle = PLACEHOLDER_TITLES.has(norm(p.title));
    const hasNumericSuffix = NUMERIC_SUFFIX.test(seg);
    const tNorm = norm(p.title);
    const sharesTitleWithCount = tNorm ? (titleCount.get(tNorm) ?? 1) - 1 : 0;

    const robots = `${p.robotsMeta ?? ""} ${p.xRobotsTag ?? ""}`.toLowerCase();
    const hasNoindexDirective = /\bnoindex\b|\bnone\b/.test(robots);
    const canonKey = p.canonical ? graphKey(p.canonical, p.url) : null;
    const hasCanonicalConflict = !!canonKey && canonKey !== key;
    const ok = p.statusCode >= 200 && p.statusCode < 300;

    out.set(key, {
      url: p.url,
      key,
      path: p.path,
      statusCode: p.statusCode,
      isSeed,
      navigation: {
        inMainNav: "unknown",
        inHeader: "unknown",
        inFooter: "unknown",
        recurringLinkApprox:
          pagesWithLinks >= 3 && linkingPagesCount >= 3 && linkingPagesCount / pagesWithLinks >= 0.5,
        linkingPagesCount,
        crawlDepth: p.depth,
        limitation: NAV_LIMITATION,
      },
      sitemap: { inSitemap, source },
      inboundLinksCount: linkingPagesCount,
      isOrphan: !isSeed && linkingPagesCount === 0,
      duplicates: {
        hasNumericSuffix,
        sharesTitleWithCount,
        possibleDuplicate: hasNumericSuffix || sharesTitleWithCount > 0,
      },
      residual: {
        matchesResidualToken: !!matchedToken,
        matchedToken,
        hasPlaceholderTitle,
        possibleResidual: !!matchedToken || hasPlaceholderTitle,
      },
      indexability: {
        hasNoindexDirective,
        hasCanonicalConflict,
        isNonIndexable: hasNoindexDirective || !ok,
        canonicalTarget: hasCanonicalConflict ? p.canonical : undefined,
      },
      isRestricted: p.statusCode === 401 || p.statusCode === 403,
      hasSufficientData: ok && (p.wordCount > 0 || !!p.title || p.h1.length > 0),
    });
  }
  return out;
}

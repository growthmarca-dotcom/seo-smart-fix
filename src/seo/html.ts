/**
 * Parser HTML mínimo y sin dependencias (compatible con el runtime edge).
 * Convierte HTML crudo en un PageSnapshot parcial.
 */
import type { PageSnapshot, PageType } from "./types";

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(html: string) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  );
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!m) return undefined;
  const value = m[2] ?? m[3] ?? m[4];
  return value === undefined ? undefined : decode(value);
}

function all(html: string, re: RegExp) {
  return [...html.matchAll(re)];
}

export function hashText(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

export function guessPageType(url: string): PageType {
  let p = "";
  try {
    p = new URL(url).pathname.replace(/\/+$/, "");
  } catch {
    p = url;
  }
  if (p === "" || p === "/") return "home";
  if (/\/(productos?|products?|item|mlA?\d+)/i.test(p)) return "product";
  if (/\/(categorias?|categor(y|ies)|collections?)/i.test(p)) return "category";
  if (/\/(blog|noticias|articulos?|news)/i.test(p)) return "article";
  if (/\/(contacto|contact)/i.test(p)) return "contact";
  if (/\/(landing|promo|oferta)/i.test(p)) return "landing";
  return "other";
}

export function parseHtml(input: {
  url: string;
  html: string;
  statusCode: number;
  depth: number;
  responseMs?: number | undefined;
  contentType?: string | undefined;
}): PageSnapshot {
  const { url, html } = input;
  const base = new URL(url);
  const headings = (level: number) =>
    all(html, new RegExp(`<h${level}[^>]*>([\\s\\S]*?)</h${level}>`, "gi"))
      .map((m) => stripTags(m[1] ?? ""))
      .filter(Boolean);

  const metas = all(html, /<meta\b[^>]*>/gi).map((m) => m[0]);
  const metaBy = (key: "name" | "property", value: string) => {
    const tag = metas.find((t) => (attr(t, key) || "").toLowerCase() === value);
    return tag ? attr(tag, "content") : undefined;
  };

  const links = all(html, /<link\b[^>]*>/gi).map((m) => m[0]);
  const canonicalTag = links.find((t) => (attr(t, "rel") || "").toLowerCase() === "canonical");

  const imgs = all(html, /<img\b[^>]*>/gi).map((m) => m[0]);
  const anchors = all(html, /<a\b([^>]*)>([\s\S]*?)<\/a>/gi);

  const internalLinks: PageSnapshot["internalLinks"] = [];
  let externalLinks = 0;
  for (const a of anchors) {
    const href = attr(`<a ${a[1] ?? ""}>`, "href");
    if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      const abs = new URL(href, base);
      if (abs.origin === base.origin) {
        abs.hash = "";
        internalLinks.push({ href: abs.toString(), anchor: stripTags(a[2] ?? "").slice(0, 120) });
      } else externalLinks++;
    } catch {
      /* href inválido */
    }
  }

  const schemaTypes = new Set<string>();
  for (const m of all(html, /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json: unknown = JSON.parse((m[1] ?? "").trim());
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (node && typeof node === "object") {
          const t = (node as Record<string, unknown>)["@type"];
          if (typeof t === "string") schemaTypes.add(t);
          if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && schemaTypes.add(x));
          Object.values(node as Record<string, unknown>).forEach(walk);
        }
      };
      walk(json);
    } catch {
      schemaTypes.add("INVALID_JSON_LD");
    }
  }
  for (const m of all(html, /itemtype\s*=\s*"[^"]*schema\.org\/([A-Za-z]+)"/gi)) {
    if (m[1]) schemaTypes.add(m[1]);
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const text = stripTags(html.replace(/<(nav|header|footer)[\s\S]*?<\/\1>/gi, " "));
  const phone = html.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[1];
  const address = text.match(/((Calle|Av\.?|Avenida|Ruta|Km)\s+[^.,;]{4,60})/i)?.[1];

  return {
    id: hashText(url),
    url,
    path: base.pathname + base.search,
    pageType: guessPageType(url),
    statusCode: input.statusCode,
    contentType: input.contentType,
    title: titleMatch?.[1] ? stripTags(titleMatch[1]) : undefined,
    metaDescription: metaBy("name", "description"),
    h1: headings(1),
    h2: headings(2),
    h3: headings(3),
    wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
    textSample: text.slice(0, 400),
    contentHash: hashText(text.slice(0, 2000).toLowerCase()),
    images: imgs.map((t) => {
      const src = attr(t, "src") || attr(t, "data-src") || "";
      return {
        src,
        alt: attr(t, "alt"),
        fileName: src.split("?")[0]?.split("/").pop() || undefined,
      };
    }),
    internalLinks,
    externalLinks,
    canonical: canonicalTag ? attr(canonicalTag, "href") : undefined,
    robotsMeta: metaBy("name", "robots"),
    schemaTypes: [...schemaTypes],
    depth: input.depth,
    hasViewport: Boolean(metaBy("name", "viewport")),
    htmlSizeKb: Math.round(html.length / 1024),
    responseMs: input.responseMs,
    localSignals: { phone, address, openingHours: /horario|lunes a viernes/i.test(text) },
  };
}

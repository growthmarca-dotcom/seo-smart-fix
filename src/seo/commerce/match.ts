/**
 * FASE 7B — Correspondencia entre entidades de la tienda y páginas rastreadas.
 *
 * NUNCA se asume correspondencia solo por nombre: el único método que
 * confirma una relación es la URL normalizada (o un identificador de la
 * plataforma presente en la página). La coincidencia por nombre se reporta
 * como "incierta" y jamás se usa para atribuir datos a una URL.
 */
import { normalizeForMatch } from "../gsc/normalize";
import { isProductLikeUrl, isCategoryLikeUrl, sourceValue } from "../ecommerce/detect";
import type { Audit } from "../types";
import type {
  CommerceMatch,
  MatchSummary,
  NormalizedCategory,
  NormalizedProduct,
} from "./types";

function normalizeName(name: string | undefined) {
  return (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface MatchInput {
  audit: Audit;
  storeId: string;
  products: NormalizedProduct[];
  categories: NormalizedCategory[];
}

export function matchStoreWithCrawler({
  audit,
  storeId,
  products,
  categories,
}: MatchInput): CommerceMatch[] {
  const byUrl = new Map<string, { id: string; url: string }>();
  for (const p of audit.pages) {
    const key = normalizeForMatch(p.url);
    if (key && !byUrl.has(key)) byUrl.set(key, { id: p.id, url: p.url });
  }
  // Identificadores de plataforma presentes en las páginas rastreadas.
  const byExternalId = new Map<string, { id: string; url: string }>();
  for (const p of audit.pages) {
    const ext = sourceValue(p, ["productid", "externalid", "categoryid", "itemid"]);
    if (ext && !byExternalId.has(ext)) byExternalId.set(ext, { id: p.id, url: p.url });
  }
  const byName = new Map<string, Array<{ id: string; url: string }>>();
  for (const p of audit.pages) {
    const n = normalizeName(p.h1[0] ?? p.title);
    if (!n) continue;
    const list = byName.get(n);
    if (list) list.push({ id: p.id, url: p.url });
    else byName.set(n, [{ id: p.id, url: p.url }]);
  }

  const matches: CommerceMatch[] = [];
  const usedPageIds = new Set<string>();

  const resolve = (
    entity: "product" | "category",
    externalId: string,
    name: string | undefined,
    url: string | undefined,
  ): CommerceMatch => {
    const base = { auditId: audit.id, storeId, entity, externalId, name, storeUrl: url };
    if (url) {
      const hit = byUrl.get(normalizeForMatch(url));
      if (hit) {
        usedPageIds.add(hit.id);
        return {
          ...base,
          pageId: hit.id,
          pageUrl: hit.url,
          state: "store-and-crawler",
          method: "normalized-url",
          detail: "La URL de la tienda coincide con una URL rastreada tras normalizar.",
        };
      }
    }
    const byId = byExternalId.get(externalId);
    if (byId) {
      usedPageIds.add(byId.id);
      return {
        ...base,
        pageId: byId.id,
        pageUrl: byId.url,
        state: "store-and-crawler",
        method: "connector-id",
        detail: "La página rastreada declara el mismo identificador de la plataforma.",
      };
    }
    const nameHits = byName.get(normalizeName(name)) ?? [];
    if (name && nameHits.length === 1 && nameHits[0]) {
      return {
        ...base,
        pageUrl: nameHits[0].url,
        state: "uncertain",
        method: "name-hint",
        detail:
          "Solo coincide el nombre con una URL rastreada. No se confirma la correspondencia ni se atribuyen datos.",
      };
    }
    return {
      ...base,
      state: "store-only",
      method: url ? "normalized-url" : "none",
      detail: url
        ? "La URL de la tienda no fue rastreada (fuera del límite, bloqueada o no enlazada)."
        : "La API no entregó URL pública para esta entidad.",
    };
  };

  for (const p of products) {
    matches.push(resolve("product", p.externalId, p.name, p.url));
  }
  for (const c of categories) {
    matches.push(resolve("category", c.externalId, c.name, c.url));
  }

  // URLs rastreadas que parecen producto/categoría y no tienen entidad.
  for (const page of audit.pages) {
    if (usedPageIds.has(page.id)) continue;
    const isProduct = isProductLikeUrl(page.url);
    const isCategory = !isProduct && isCategoryLikeUrl(page.url);
    if (!isProduct && !isCategory) continue;
    matches.push({
      auditId: audit.id,
      storeId,
      entity: isProduct ? "product" : "category",
      externalId: "",
      name: page.h1[0] ?? page.title,
      pageId: page.id,
      pageUrl: page.url,
      state: "crawler-only",
      method: "normalized-url",
      detail:
        "La URL parece de producto/categoría pero no existe una entidad equivalente en los datos importados.",
    });
  }

  return matches;
}

export function summarizeMatches(matches: CommerceMatch[]): MatchSummary {
  return {
    matched: matches.filter((m) => m.state === "store-and-crawler").length,
    storeOnly: matches.filter((m) => m.state === "store-only").length,
    crawlerOnly: matches.filter((m) => m.state === "crawler-only").length,
    uncertain: matches.filter((m) => m.state === "uncertain").length,
  };
}

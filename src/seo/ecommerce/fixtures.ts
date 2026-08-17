/**
 * FASE 7A — Fixtures de prueba, CLARAMENTE separados de los datos demo
 * ("Outdoor Patagonia") y de cualquier dato real. Se usan solo en pruebas
 * unitarias para cubrir variantes, facetas y paginación, que la demo no tiene.
 */
import type { Audit, PageSnapshot } from "../types";

const ROOT = "https://fixture-shop.test";

export function fixturePage(p: Partial<PageSnapshot> & { url: string; depth: number }): PageSnapshot {
  return {
    id: p.id ?? p.url,
    url: p.url,
    path: p.url.replace(ROOT, "") || "/",
    pageType: p.pageType ?? "other",
    statusCode: p.statusCode ?? 200,
    h1: p.h1 ?? [],
    h2: p.h2 ?? [],
    h3: p.h3 ?? [],
    wordCount: p.wordCount ?? 300,
    images: p.images ?? [],
    internalLinks: p.internalLinks ?? [],
    externalLinks: p.externalLinks ?? 0,
    schemaTypes: p.schemaTypes ?? [],
    depth: p.depth,
    hasViewport: true,
    title: p.title,
    metaDescription: p.metaDescription,
    canonical: p.canonical,
    robotsMeta: p.robotsMeta,
    contentHash: p.contentHash ?? p.url,
    textSample: p.textSample,
    source: p.source,
    discoveredVia: p.discoveredVia ?? "internal-link",
  };
}

export function fixtureAudit(id: string, pages: PageSnapshot[]): Audit {
  return {
    id,
    name: `Fixture ${id}`,
    platform: "generic-web",
    rootUrl: ROOT,
    isDemo: false,
    status: "done",
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    crawlLimit: 100,
    respectRobots: true,
    progress: { discovered: pages.length, analyzed: pages.length, issues: 0 },
    pages,
    findings: [],
    coverage: {
      limit: 100,
      limitReached: false,
      respectRobots: true,
      robotsTxtFound: true,
      robotsRulesApplied: 0,
      sitemapsFound: [],
      urlsFromSitemap: 0,
      urlsFromLinks: pages.length,
      urlsFromBoth: 0,
      discovered: pages.length,
      analyzed: pages.length,
      excluded: [],
      errors: [],
      redirects: [],
    },
  };
}

/** Tienda de fixture con producto, variante, faceta, paginación y categoría vacía. */
export function ecommerceFixture(): Audit {
  const pages = [
    fixturePage({
      url: `${ROOT}/`,
      depth: 0,
      pageType: "home",
      title: "Fixture Shop",
      h1: ["Fixture Shop"],
      schemaTypes: ["WebSite"],
      internalLinks: [
        { href: `${ROOT}/categorias/remeras`, anchor: "remeras" },
        { href: `${ROOT}/categorias/vacia`, anchor: "vacía" },
      ],
      discoveredVia: "seed",
    }),
    fixturePage({
      url: `${ROOT}/categorias/remeras`,
      depth: 1,
      pageType: "category",
      title: "Remeras",
      h1: ["Remeras"],
      wordCount: 40,
      internalLinks: [{ href: `${ROOT}/productos/remera-lisa`, anchor: "Remera lisa" }],
    }),
    fixturePage({
      url: `${ROOT}/categorias/vacia`,
      depth: 1,
      pageType: "category",
      title: "Categoría vacía",
      h1: ["Categoría vacía"],
      wordCount: 20,
      internalLinks: [],
    }),
    fixturePage({
      url: `${ROOT}/productos/remera-lisa`,
      depth: 2,
      pageType: "product",
      title: "Remera lisa",
      h1: ["Remera lisa"],
      canonical: `${ROOT}/productos/remera-lisa`,
      schemaTypes: ["Product", "Offer"],
      images: [{ src: "/img/remera.webp", alt: "Remera lisa" }],
      internalLinks: [{ href: `${ROOT}/categorias/remeras`, anchor: "Remeras" }],
      source: { productId: "SKU-1", price: "19999", currency: "ARS", availability: "in_stock" },
    }),
    fixturePage({
      url: `${ROOT}/productos/remera-lisa?variant=azul-m`,
      depth: 3,
      pageType: "product",
      title: "Remera lisa",
      h1: ["Remera lisa"],
      contentHash: `${ROOT}/productos/remera-lisa`,
      schemaTypes: ["Product"],
      internalLinks: [],
      source: { productId: "SKU-1-AZ", availability: "out_of_stock" },
    }),
    fixturePage({
      url: `${ROOT}/productos/gorra-sin-categoria`,
      depth: 3,
      pageType: "product",
      title: "Gorra",
      h1: ["Gorra"],
      schemaTypes: [],
      internalLinks: [],
      discoveredVia: "sitemap",
    }),
    fixturePage({
      url: `${ROOT}/categorias/remeras?color=azul&orden=precio`,
      depth: 2,
      pageType: "category",
      title: "Remeras azules",
      h1: ["Remeras"],
      internalLinks: [],
    }),
    fixturePage({
      url: `${ROOT}/categorias/remeras?color=negro`,
      depth: 2,
      pageType: "category",
      title: "Remeras negras",
      h1: ["Remeras"],
      internalLinks: [],
    }),
    fixturePage({
      url: `${ROOT}/categorias/remeras/page/2`,
      depth: 2,
      pageType: "category",
      title: "Remeras — página 2",
      h1: ["Remeras"],
      canonical: `${ROOT}/categorias/remeras`,
      internalLinks: [],
    }),
    fixturePage({
      url: `${ROOT}/carrito`,
      depth: 1,
      pageType: "other",
      title: "Carrito",
      internalLinks: [],
    }),
  ];
  return fixtureAudit("fixture-ecommerce", pages);
}

/** Sitio de fixture SIN señales e-commerce (blog institucional). */
export function nonEcommerceFixture(): Audit {
  const pages = [
    fixturePage({
      url: `${ROOT}/`,
      depth: 0,
      pageType: "home",
      title: "Estudio contable",
      h1: ["Estudio contable"],
      internalLinks: [
        { href: `${ROOT}/servicios`, anchor: "servicios" },
        { href: `${ROOT}/blog/balance-anual`, anchor: "balance" },
      ],
      discoveredVia: "seed",
    }),
    fixturePage({
      url: `${ROOT}/servicios`,
      depth: 1,
      pageType: "landing",
      title: "Servicios",
      h1: ["Servicios"],
      internalLinks: [{ href: `${ROOT}/`, anchor: "inicio" }],
    }),
    fixturePage({
      url: `${ROOT}/blog/balance-anual`,
      depth: 1,
      pageType: "article",
      title: "Balance anual",
      h1: ["Balance anual"],
      internalLinks: [{ href: `${ROOT}/`, anchor: "inicio" }],
    }),
  ];
  return fixtureAudit("fixture-non-ecommerce", pages);
}

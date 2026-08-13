/**
 * DATOS DEMO — tienda ficticia "Outdoor Patagonia".
 * Permite recorrer el flujo completo sin conectar ninguna plataforma real.
 */
import { hashText } from "./html";
import type { PageSnapshot, PlatformId, SiteContext } from "./types";

const ROOT = "https://outdoor-patagonia.demo";

function page(p: Partial<PageSnapshot> & { url: string; depth: number }): PageSnapshot {
  const url = p.url;
  return {
    id: hashText(url),
    url,
    path: url.replace(ROOT, "") || "/",
    pageType: p.pageType ?? "other",
    statusCode: p.statusCode ?? 200,
    h1: p.h1 ?? [],
    h2: p.h2 ?? [],
    h3: p.h3 ?? [],
    wordCount: p.wordCount ?? 400,
    images: p.images ?? [],
    internalLinks: p.internalLinks ?? [],
    externalLinks: p.externalLinks ?? 2,
    schemaTypes: p.schemaTypes ?? [],
    depth: p.depth,
    hasViewport: p.hasViewport ?? true,
    htmlSizeKb: p.htmlSizeKb ?? 90,
    responseMs: p.responseMs ?? 380,
    title: p.title,
    metaDescription: p.metaDescription,
    canonical: p.canonical,
    robotsMeta: p.robotsMeta,
    textSample: p.textSample,
    contentHash: p.contentHash ?? hashText(url),
    localSignals: p.localSignals,
    source: p.source,
    redirectedFrom: p.redirectedFrom,
  };
}

const links = (paths: string[], anchor = "ver más") =>
  paths.map((p) => ({ href: `${ROOT}${p}`, anchor }));

const DEMO_PAGES: PageSnapshot[] = [
  page({
    url: `${ROOT}/`,
    depth: 0,
    pageType: "home",
    title: "Outdoor Patagonia",
    metaDescription: "Tienda de indumentaria outdoor.",
    h1: ["Equipate para la montaña"],
    h2: ["Novedades", "Categorías destacadas"],
    wordCount: 320,
    canonical: `${ROOT}/`,
    schemaTypes: ["WebSite"],
    images: [
      { src: "/img/hero.jpg", alt: "Trekking en Patagonia", fileName: "hero.jpg", sizeKb: 620 },
      { src: "/img/IMG_2831.jpg", fileName: "IMG_2831.jpg", sizeKb: 410 },
    ],
    internalLinks: links(
      ["/categorias/camperas", "/categorias/calzado", "/productos/campera-cerro-torre", "/contacto"],
      "ver más",
    ),
    localSignals: { phone: "+54 9 2944 123456" },
    textSample:
      "Somos una tienda especializada en indumentaria y equipamiento de montaña en Bariloche.",
  }),
  page({
    url: `${ROOT}/categorias/camperas`,
    depth: 1,
    pageType: "category",
    title: "Camperas de trekking y montaña | Outdoor Patagonia",
    h1: ["Camperas"],
    wordCount: 90,
    canonical: `${ROOT}/categorias/camperas`,
    images: [{ src: "/img/camperas.webp", alt: "Camperas", fileName: "camperas.webp", sizeKb: 120 }],
    internalLinks: links(["/productos/campera-cerro-torre", "/productos/campera-rompeviento"]),
  }),
  page({
    url: `${ROOT}/categorias/calzado`,
    depth: 1,
    pageType: "category",
    title: "Camperas de trekking y montaña | Outdoor Patagonia",
    h1: ["Calzado", "Botas de montaña"],
    wordCount: 110,
    images: [{ src: "/img/DSC_0091.jpg", fileName: "DSC_0091.jpg", sizeKb: 380 }],
    internalLinks: links(["/productos/botas-fitzroy"]),
  }),
  page({
    url: `${ROOT}/productos/campera-cerro-torre`,
    depth: 2,
    pageType: "product",
    title: "Campera Cerro Torre impermeable 3 capas | Outdoor Patagonia",
    metaDescription:
      "Campera Cerro Torre impermeable de 3 capas, costuras selladas y capucha ajustable. Ideal para trekking de alta montaña. Envíos a todo el país.",
    h1: ["Campera Cerro Torre"],
    h2: ["Características", "Talles"],
    wordCount: 520,
    canonical: `${ROOT}/productos/campera-cerro-torre`,
    schemaTypes: ["Product"],
    images: [
      { src: "/img/campera-cerro-torre-01.webp", alt: "Campera Cerro Torre frente", fileName: "campera-cerro-torre-01.webp", sizeKb: 180 },
      { src: "/img/campera-cerro-torre-02.webp", fileName: "campera-cerro-torre-02.webp", sizeKb: 195 },
    ],
    internalLinks: links(["/categorias/camperas", "/productos/campera-rompeviento", "/envios"]),
    source: { productId: "TN-1001", attributesFilled: 9, attributesTotal: 10 },
  }),
  page({
    url: `${ROOT}/productos/campera-rompeviento`,
    depth: 2,
    pageType: "product",
    title: "Campera",
    h1: [],
    wordCount: 70,
    images: [
      { src: "/img/IMG_1102.jpg", fileName: "IMG_1102.jpg", sizeKb: 520 },
      { src: "/img/IMG_1103.jpg", fileName: "IMG_1103.jpg", sizeKb: 480 },
    ],
    internalLinks: links(["/categorias/camperas"], "click aquí"),
    source: { productId: "TN-1002", attributesFilled: 4, attributesTotal: 10 },
  }),
  page({
    url: `${ROOT}/productos/botas-fitzroy`,
    depth: 2,
    pageType: "product",
    title: "Botas Fitz Roy de cuero engrasado impermeables para trekking técnico de alta montaña en Patagonia",
    metaDescription: "Botas.",
    h1: ["Botas Fitz Roy"],
    wordCount: 260,
    canonical: `${ROOT}/productos/botas-fitzroy?variant=42`,
    schemaTypes: [],
    images: [{ src: "/img/botas-fitzroy.webp", alt: "Botas Fitz Roy", fileName: "botas-fitzroy.webp", sizeKb: 210 }],
    internalLinks: links(["/categorias/calzado", "/guia-de-talles"]),
    source: { productId: "TN-1003", attributesFilled: 6, attributesTotal: 10 },
  }),
  page({
    url: `${ROOT}/productos/mochila-perito-moreno`,
    depth: 4,
    pageType: "product",
    title: "Mochila Perito Moreno 45L | Outdoor Patagonia",
    metaDescription:
      "Mochila de trekking Perito Moreno de 45 litros con espalda ventilada, cubre lluvia incluido y ajuste de carga.",
    h1: ["Mochila Perito Moreno 45L"],
    wordCount: 340,
    robotsMeta: "noindex, follow",
    schemaTypes: ["Product"],
    images: [{ src: "/img/mochila-45l.webp", alt: "Mochila 45 litros", fileName: "mochila-45l.webp", sizeKb: 160 }],
    internalLinks: links(["/categorias/mochilas"]),
    source: { productId: "TN-1004", attributesFilled: 10, attributesTotal: 10 },
  }),
  page({
    url: `${ROOT}/categorias/mochilas`,
    depth: 1,
    pageType: "category",
    title: "Mochilas de trekking | Outdoor Patagonia",
    metaDescription: "Mochilas de trekking de 20 a 70 litros para travesías de uno o varios días.",
    h1: ["Mochilas"],
    wordCount: 180,
    canonical: `${ROOT}/categorias/mochilas`,
    schemaTypes: ["ItemList", "BreadcrumbList"],
    images: [{ src: "/img/mochilas.webp", alt: "Mochilas de trekking", fileName: "mochilas.webp", sizeKb: 140 }],
    internalLinks: links(["/productos/mochila-perito-moreno", "/"]),
  }),
  page({
    url: `${ROOT}/blog/como-elegir-campera`,
    depth: 2,
    pageType: "article",
    title: "Cómo elegir una campera de montaña: guía completa",
    metaDescription:
      "Impermeabilidad, capas, transpirabilidad y costuras selladas: todo lo que hay que mirar antes de comprar una campera de montaña.",
    h1: ["Cómo elegir una campera de montaña"],
    h2: ["Capas", "Impermeabilidad", "Costuras"],
    wordCount: 1250,
    canonical: `${ROOT}/blog/como-elegir-campera`,
    schemaTypes: ["Article"],
    images: [{ src: "/img/guia-campera.webp", alt: "Comparativa de camperas", fileName: "guia-campera.webp", sizeKb: 190 }],
    internalLinks: links(["/categorias/camperas", "/productos/campera-cerro-torre", "/blog"]),
  }),
  page({
    url: `${ROOT}/blog/como-elegir-campera-2`,
    depth: 3,
    pageType: "article",
    title: "Cómo elegir una campera de montaña: guía completa",
    metaDescription:
      "Impermeabilidad, capas, transpirabilidad y costuras selladas: todo lo que hay que mirar antes de comprar una campera de montaña.",
    h1: ["Cómo elegir una campera de montaña"],
    wordCount: 1250,
    contentHash: "duplicate-article",
    images: [],
    internalLinks: links(["/blog"]),
  }),
  page({
    url: `${ROOT}/blog/guia-de-abrigo`,
    depth: 3,
    pageType: "article",
    title: "Guía de abrigo",
    h1: ["Guía de abrigo"],
    wordCount: 1250,
    contentHash: "duplicate-article",
    images: [],
    internalLinks: links(["/blog"]),
  }),
  page({
    url: `${ROOT}/contacto`,
    depth: 1,
    pageType: "contact",
    title: "Contacto",
    h1: ["Contacto"],
    wordCount: 120,
    canonical: `${ROOT}/contacto`,
    images: [],
    internalLinks: links(["/"]),
    localSignals: { phone: "+54 9 2944 123456", openingHours: true },
    textSample: "Escribinos o visitanos en nuestro local de Bariloche.",
  }),
  page({
    url: `${ROOT}/promo/black-friday-2023`,
    depth: 2,
    pageType: "landing",
    title: "Black Friday 2023",
    h1: ["Black Friday 2023"],
    wordCount: 40,
    statusCode: 404,
    images: [],
    internalLinks: [],
  }),
  page({
    url: `${ROOT}/Productos/Campera_Cerro_Torre`,
    depth: 3,
    pageType: "product",
    title: "Campera Cerro Torre impermeable 3 capas | Outdoor Patagonia",
    h1: ["Campera Cerro Torre"],
    wordCount: 520,
    statusCode: 301,
    redirectedFrom: [`${ROOT}/tienda/campera-cerro-torre`, `${ROOT}/campera-cerro-torre`],
    images: [],
    internalLinks: [],
    hasViewport: false,
  }),
];

export function buildDemoSite(platform: PlatformId = "generic-web"): SiteContext {
  const pages = DEMO_PAGES.map((p, i) => ({
    ...p,
    discoveredVia: (i === 0 ? "seed" : i % 3 === 0 ? "sitemap" : i % 3 === 1 ? "internal-link" : "both") as
      | "seed"
      | "sitemap"
      | "internal-link"
      | "both",
  }));
  const brokenLinks = [
    { from: `${ROOT}/`, to: `${ROOT}/productos/campera-descontinuada`, status: 404 },
    { from: `${ROOT}/categorias/camperas`, to: `${ROOT}/productos/campera-descontinuada`, status: 404 },
  ];
  return {
    rootUrl: ROOT,
    platform,
    robotsTxt: { found: true, disallowsAll: false, sitemapDeclared: false },
    sitemap: { found: true, urlCount: pages.length, url: `${ROOT}/sitemap.xml` },
    pages,
    brokenLinks,
    coverage: {
      limit: 100,
      limitReached: false,
      respectRobots: true,
      robotsTxtFound: true,
      robotsRulesApplied: 3,
      sitemapsFound: [`${ROOT}/sitemap.xml`],
      urlsFromSitemap: pages.filter((p) => p.discoveredVia === "sitemap").length,
      urlsFromLinks: pages.filter((p) => p.discoveredVia === "internal-link").length,
      urlsFromBoth: pages.filter((p) => p.discoveredVia === "both").length,
      discovered: pages.length + 4,
      analyzed: pages.length,
      excluded: [
        { url: `${ROOT}/carrito`, reason: "robots-disallow", detail: "Disallow: /carrito" },
        { url: `${ROOT}/checkout`, reason: "robots-disallow", detail: "Disallow: /checkout" },
        { url: `${ROOT}/img/catalogo.pdf`, reason: "non-html", detail: "application/pdf" },
        { url: `${ROOT}/productos/campera-descontinuada`, reason: "fetch-error", detail: "HTTP 404" },
      ],
      errors: [{ url: `${ROOT}/productos/campera-descontinuada`, reason: "HTTP 404" }],
      redirects: [{ from: `${ROOT}/camperas`, to: `${ROOT}/categorias/camperas`, status: 301 }],
    },
  };
}


export const DEMO_STORE_NAME = "Outdoor Patagonia (demo)";
export const DEMO_ROOT_URL = ROOT;

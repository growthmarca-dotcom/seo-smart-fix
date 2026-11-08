import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "../types";
import { classifyUrls } from "./classifier";

const ROOT = "https://ejemplo.com/";

function page(path: string, over: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    id: path,
    url: `https://ejemplo.com${path}`,
    path,
    pageType: "other",
    statusCode: 200,
    title: `Título ${path}`,
    h1: ["H1"],
    h2: [],
    h3: [],
    wordCount: 300,
    images: [],
    internalLinks: [],
    externalLinks: 0,
    schemaTypes: [],
    depth: 1,
    hasViewport: true,
    ...over,
  };
}
const link = (p: string) => ({ href: `https://ejemplo.com${p}`, anchor: p });
const get = (m: Map<string, unknown>, p: string) =>
  (m as Map<string, ReturnType<typeof classifyUrls> extends Map<string, infer V> ? V : never>).get(
    `ejemplo.com${p === "/" ? "/" : p}`,
  )!;

describe("classifyUrls (Etapa 1)", () => {
  it("landing comercial huérfana: huérfana pero NO residual", () => {
    const m = classifyUrls(
      [page("/", { depth: 0 }), page("/escapadas-otono-2026", { discoveredVia: "sitemap", wordCount: 450 })],
      ROOT,
    );
    const c = get(m, "/escapadas-otono-2026");
    expect(c.isOrphan).toBe(true);
    expect(c.residual.possibleResidual).toBe(false);
    expect(c.sitemap.inSitemap).toBe("yes");
  });

  it("landing de campaña sin enlaces y sin datos de sitemap: sitemap desconocido, no falso", () => {
    const m = classifyUrls([page("/", { depth: 0 }), page("/promo-google-ads", { discoveredVia: "internal-link" })], ROOT);
    const c = get(m, "/promo-google-ads");
    expect(c.isOrphan).toBe(true);
    expect(c.sitemap.inSitemap).toBe("unknown");
    expect(c.residual.possibleResidual).toBe(false);
  });

  it("lista explícita de sitemap habilita 'no'", () => {
    const m = classifyUrls([page("/", { depth: 0 }), page("/a")], ROOT, { sitemapUrls: [ROOT] });
    expect(get(m, "/a").sitemap).toEqual({ inSitemap: "no", source: "explicit-list" });
    expect(get(m, "/").sitemap.inSitemap).toBe("yes");
  });

  it("depth 1 no implica menú: pertenencia al menú queda sin comprobar", () => {
    const m = classifyUrls([page("/", { depth: 0, internalLinks: [link("/servicios")] }), page("/servicios")], ROOT);
    const n = get(m, "/servicios").navigation;
    expect(n.crawlDepth).toBe(1);
    expect(n.inMainNav).toBe("unknown");
    expect(n.inHeader).toBe("unknown");
    expect(n.inFooter).toBe("unknown");
    expect(n.recurringLinkApprox).toBe(false);
  });

  it("enlace recurrente en la mayoría de las páginas activa solo la aproximación", () => {
    const L = [link("/contacto")];
    const m = classifyUrls(
      [page("/", { depth: 0, internalLinks: L }), page("/a", { internalLinks: L }), page("/b", { internalLinks: L }), page("/contacto")],
      ROOT,
    );
    const n = get(m, "/contacto").navigation;
    expect(n.recurringLinkApprox).toBe(true);
    expect(n.linkingPagesCount).toBe(3);
    expect(n.inMainNav).toBe("unknown");
  });

  it("título idéntico: solo posible duplicado", () => {
    const m = classifyUrls([page("/x", { title: "Inicio | Hotel" }), page("/y", { title: "inicio |  hotel" })], ROOT);
    expect(get(m, "/x").duplicates).toMatchObject({ sharesTitleWithCount: 1, possibleDuplicate: true });
  });

  it("variantes con sufijo numérico (caso marcagrowth -1..-5)", () => {
    const pages = [page("/optimizacin-seo-avanzada"), ...[1, 2, 3, 4, 5].map((n) => page(`/optimizacin-seo-avanzada-${n}`))];
    const m = classifyUrls(pages, ROOT);
    expect(get(m, "/optimizacin-seo-avanzada").duplicates.hasNumericSuffix).toBe(false);
    for (const n of [1, 2, 3, 4, 5]) expect(get(m, `/optimizacin-seo-avanzada-${n}`).duplicates.hasNumericSuffix).toBe(true);
  });

  it("residual evidente por token léxico", () => {
    const m = classifyUrls([page("/page"), page("/draft-2"), page("/integraciones-de-pago")], ROOT);
    expect(get(m, "/page").residual).toMatchObject({ possibleResidual: true, matchedToken: "page" });
    expect(get(m, "/draft-2").residual.matchedToken).toBe("draft");
    // "pago" no es un token residual: no hay falso positivo por subcadena.
    expect(get(m, "/integraciones-de-pago").residual.possibleResidual).toBe(false);
  });

  it("poco contenido o fuera de menú no vuelve residual a una página", () => {
    const m = classifyUrls([page("/", { depth: 0 }), page("/nota", { wordCount: 20, depth: 4 })], ROOT);
    expect(get(m, "/nota").residual.possibleResidual).toBe(false);
  });

  it("restringida (403)", () => {
    const c = get(classifyUrls([page("/privado", { statusCode: 403 })], ROOT), "/privado");
    expect(c.isRestricted).toBe(true);
    expect(c.hasSufficientData).toBe(false);
  });

  it("noindex y canonical se separan", () => {
    const m = classifyUrls(
      [page("/n", { robotsMeta: "noindex, follow" }), page("/c", { canonical: "https://ejemplo.com/otra" })],
      ROOT,
    );
    expect(get(m, "/n").indexability).toMatchObject({ hasNoindexDirective: true, hasCanonicalConflict: false, isNonIndexable: true });
    expect(get(m, "/c").indexability).toMatchObject({ hasNoindexDirective: false, hasCanonicalConflict: true, isNonIndexable: false });
  });

  it("canonical autorreferencial no es conflicto", () => {
    const c = get(classifyUrls([page("/a", { canonical: "https://www.ejemplo.com/a/" })], ROOT), "/a");
    expect(c.indexability.hasCanonicalConflict).toBe(false);
  });

  it("varias señales simultáneas no se anulan", () => {
    const m = classifyUrls(
      [page("/borrador-1", { robotsMeta: "noindex", title: "Igual" }), page("/z", { title: "Igual" })],
      ROOT,
    );
    const c = get(m, "/borrador-1");
    expect(c.residual.possibleResidual).toBe(true);
    expect(c.duplicates.hasNumericSuffix).toBe(true);
    expect(c.duplicates.sharesTitleWithCount).toBe(1);
    expect(c.indexability.hasNoindexDirective).toBe(true);
    expect(c.isOrphan).toBe(true);
  });

  it("datos insuficientes (500 sin HTML) no rompe", () => {
    const c = get(classifyUrls([page("/err", { statusCode: 500, title: undefined, h1: [], wordCount: 0 })], ROOT), "/err");
    expect(c.hasSufficientData).toBe(false);
    expect(c.indexability.isNonIndexable).toBe(true);
  });

  it("la raíz nunca es huérfana", () => {
    expect(get(classifyUrls([page("/", { depth: 0 })], ROOT), "/").isOrphan).toBe(false);
  });

  it("el resultado no contiene decisiones de inclusión/exclusión", () => {
    const c = get(classifyUrls([page("/page")], ROOT), "/page") as unknown as Record<string, unknown>;
    expect(Object.keys(c).some((k) => /exclu|inclu|scope/i.test(k))).toBe(false);
  });

  it("fixture tipo marcagrowth: micro-fichas en sitemap huérfanas no son residuales", () => {
    const nav = ["/alojamientos", "/e-commerce", "/contacto"];
    const home = page("/", { depth: 0, internalLinks: [...nav, "/servicios", "/proceso"].map(link) });
    const fichas = Array.from({ length: 8 }, (_, i) => page(`/ficha-servicio-${String.fromCharCode(97 + i)}`, { discoveredVia: "sitemap" }));
    const m = classifyUrls([home, ...nav.map((p) => page(p)), page("/servicios"), page("/proceso"), page("/page", { discoveredVia: "sitemap" }), page("/aterial-descargable", { discoveredVia: "sitemap" }), ...fichas], ROOT);
    for (const f of fichas) {
      const c = get(m, f.path);
      expect(c.isOrphan).toBe(true);
      expect(c.sitemap.inSitemap).toBe("yes");
      expect(c.residual.possibleResidual).toBe(false);
    }
    expect(get(m, "/servicios").isOrphan).toBe(false);
    expect(get(m, "/page").residual.possibleResidual).toBe(true);
    // El typo "aterial" no se detecta léxicamente: queda solo como huérfana para revisión manual.
    expect(get(m, "/aterial-descargable").residual.possibleResidual).toBe(false);
    expect(get(m, "/aterial-descargable").isOrphan).toBe(true);
  });
});

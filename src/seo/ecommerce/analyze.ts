/**
 * FASE 7A — Análisis derivado e-commerce (solo lectura, atado a un auditId).
 *
 * Reutiliza: perfiles de página (Fase 3), grafo de enlaces internos (Fase 4)
 * y los hallazgos ya calculados por el motor. NO ejecuta reglas generales,
 * NO modifica el score, NO rastrea y NO compara auditorías entre sí.
 */
import { buildLinkGraph, graphKey, type LinkGraph } from "../link-graph";
import { minWordsFor, resolvePageContext } from "../page-profiles";
import type { Audit, PageSnapshot } from "../types";
import {
  availabilityOf,
  classifyEcommercePage,
  detectEcommerce,
  facetParametersOf,
  isCategoryLikeUrl,
  isProductLikeUrl,
  isIndexable,
  paginationNumberOf,
  sourceValue,
  urlParts,
  variantParametersOf,
} from "./detect";
import { ECOMMERCE_SIGNALS, getEcommerceSignal } from "./signals";
import type {
  EcommerceAnalysis,
  EcommerceCategory,
  EcommerceFinding,
  EcommercePage,
  EcommerceProduct,
  EcommerceType,
  FacetCluster,
  HierarchyConfidence,
  PaginationSeries,
  ProductSchemaStatus,
  VariantGroup,
} from "./types";

const PRODUCT_TYPES: EcommerceType[] = ["product", "product-variant"];
const CATEGORY_TYPES: EcommerceType[] = ["category", "subcategory", "collection"];

function schemaStatusOf(page: PageSnapshot): ProductSchemaStatus {
  const schema = page.schemaTypes.map((s) => s.toLowerCase());
  const hasProduct = schema.includes("product");
  const hasProductGroup = schema.includes("productgroup");
  const hasOffer = schema.includes("offer");
  const missingFields: string[] = [];
  if (!sourceValue(page, ["name", "productname"]) && !page.h1[0] && !page.title)
    missingFields.push("name");
  if (page.images.length === 0) missingFields.push("image");
  return {
    hasProduct,
    hasProductGroup,
    hasOffer,
    hasAggregateRating: schema.includes("aggregaterating"),
    hasBreadcrumb: schema.includes("breadcrumblist"),
    status: hasProduct || hasProductGroup ? (hasOffer ? "present" : "incomplete") : "missing",
    missingFields,
  };
}

function baseUrlOf(url: string) {
  const { path } = urlParts(url);
  return path.replace(/\/(page|pagina|p)\/\d+\/?$/, "") || "/";
}

/** Categoría inferida del patrón de URL de un producto (solo inferencia). */
function inferredCategorySlug(url: string): string | null {
  const { path } = urlParts(url);
  const segments = path.split("/").filter(Boolean);
  const anchor = segments.findIndex((s) =>
    /^(categorias?|categor(y|ies)|colecciones?|collections?|c)$/.test(s),
  );
  if (anchor >= 0 && segments[anchor + 1]) return segments[anchor + 1] ?? null;
  return null;
}

export function analyzeEcommerce(audit: Audit, graphInput?: LinkGraph): EcommerceAnalysis {
  const graph = graphInput ?? buildLinkGraph(audit);
  const detection = detectEcommerce(audit);
  const auditId = audit.id;

  const findingsByPage = new Map<string, string[]>();
  for (const f of audit.findings) {
    const list = findingsByPage.get(f.pageId);
    if (list) list.push(f.id);
    else findingsByPage.set(f.pageId, [f.id]);
  }

  const keyToPageId = new Map<string, string>();
  for (const p of audit.pages) {
    const k = graphKey(p.url);
    if (k) keyToPageId.set(k, p.id);
  }

  // ---- Clasificación de entidades ----
  const classifications = new Map<string, ReturnType<typeof classifyEcommercePage>>();
  for (const p of audit.pages) classifications.set(p.id, classifyEcommercePage(p, audit.rootUrl));

  const typeOf = (pageId: string) => classifications.get(pageId)?.ecommerceType ?? "unknown";

  const categoryPageIds = audit.pages
    .filter((p) => CATEGORY_TYPES.includes(typeOf(p.id)))
    .map((p) => p.id);

  /** Categorías que enlazan realmente a cada página (evidencia, no inferencia). */
  const parentsByPage = new Map<string, string[]>();
  for (const p of audit.pages) {
    for (const link of p.internalLinks) {
      const k = graphKey(link.href, p.url);
      if (!k) continue;
      const targetId = keyToPageId.get(k);
      if (!targetId || targetId === p.id) continue;
      const list = parentsByPage.get(targetId);
      if (list) {
        if (!list.includes(p.id)) list.push(p.id);
      } else parentsByPage.set(targetId, [p.id]);
    }
  }

  function resolveParent(page: PageSnapshot): {
    parentPageId?: string | undefined;
    confidence: HierarchyConfidence;
  } {
    const linkedCategories = (parentsByPage.get(page.id) ?? []).filter((id) =>
      categoryPageIds.includes(id),
    );
    if (linkedCategories[0]) return { parentPageId: linkedCategories[0], confidence: "confirmed" };
    const slug = inferredCategorySlug(page.url);
    if (slug) {
      const inferred = audit.pages.find(
        (c) => categoryPageIds.includes(c.id) && urlParts(c.url).path.endsWith(`/${slug}`),
      );
      if (inferred) return { parentPageId: inferred.id, confidence: "inferred" };
    }
    return { confidence: "insufficient" };
  }

  // ---- Páginas e-commerce ----
  const pages: EcommercePage[] = audit.pages.map((p) => {
    const cls = classifications.get(p.id)!;
    const ctx = resolvePageContext(p);
    const idx = isIndexable(p);
    const parent = PRODUCT_TYPES.includes(cls.ecommerceType) || cls.ecommerceType === "subcategory"
      ? resolveParent(p)
      : { confidence: "insufficient" as HierarchyConfidence };
    const productId = sourceValue(p, ["productid", "sku", "itemid"]);
    return {
      auditId,
      pageId: p.id,
      url: p.url,
      path: p.path,
      ecommerceType: cls.ecommerceType,
      confidence: cls.confidence,
      pageType: p.pageType,
      contextLabel: ctx.profile.label,
      parentPageId: parent.parentPageId,
      parentConfidence: parent.confidence,
      categoryId: CATEGORY_TYPES.includes(cls.ecommerceType) ? p.id : parent.parentPageId,
      productId,
      canonical: p.canonical,
      indexable: idx.indexable,
      indexabilityNote: idx.note,
      detectedSignals: cls.signals,
      depth: p.depth,
      statusCode: p.statusCode,
      relatedFindingIds: findingsByPage.get(p.id) ?? [],
    };
  });

  const pageById = new Map(pages.map((p) => [p.pageId, p]));
  const snapshotById = new Map(audit.pages.map((p) => [p.id, p]));

  // ---- Variantes ----
  const variants: VariantGroup[] = [];
  const variantPages = pages.filter((p) => p.ecommerceType === "product-variant");
  for (const v of variantPages) {
    const base = baseUrlOf(v.url);
    const main = pages.find((p) => p.ecommerceType === "product" && baseUrlOf(p.url) === base);
    const snap = snapshotById.get(v.pageId);
    const mainSnap = main ? snapshotById.get(main.pageId) : undefined;
    const duplicate = Boolean(
      snap &&
        mainSnap &&
        ((snap.contentHash && snap.contentHash === mainSnap.contentHash) ||
          (snap.title && snap.title === mainSnap.title)),
    );
    let group = variants.find((g) => g.mainUrl === main?.url && g.mainPageId === main?.pageId);
    if (!group) {
      group = {
        mainPageId: main?.pageId,
        mainUrl: main?.url,
        variantUrls: [],
        hasProductGroupSchema: Boolean(
          mainSnap?.schemaTypes.some((s) => /productgroup/i.test(s)) ||
            snap?.schemaTypes.some((s) => /productgroup/i.test(s)),
        ),
        duplicateContent: false,
        canonicalCoverage: "none",
      };
      variants.push(group);
    }
    group.variantUrls.push(v.url);
    if (duplicate) group.duplicateContent = true;
  }
  for (const g of variants) {
    const withCanonical = g.variantUrls.filter((u) => pages.find((p) => p.url === u)?.canonical);
    g.canonicalCoverage =
      withCanonical.length === g.variantUrls.length
        ? "all"
        : withCanonical.length > 0
          ? "partial"
          : "none";
  }

  // ---- Facetas ----
  const facetMap = new Map<string, FacetCluster>();
  for (const p of pages.filter((x) => x.ecommerceType === "faceted" || x.ecommerceType === "search")) {
    const base = baseUrlOf(p.url);
    const params = facetParametersOf(p.url);
    const cluster =
      facetMap.get(base) ?? { baseUrl: base, urls: [], parameters: [], indexableCount: 0 };
    cluster.urls.push(p.url);
    for (const param of params) if (!cluster.parameters.includes(param)) cluster.parameters.push(param);
    if (p.indexable) cluster.indexableCount += 1;
    facetMap.set(base, cluster);
  }
  const facets = [...facetMap.values()];

  // ---- Paginación ----
  const pagMap = new Map<string, PaginationSeries>();
  for (const p of pages.filter((x) => x.ecommerceType === "pagination")) {
    const base = baseUrlOf(p.url);
    const num = paginationNumberOf(p.url) ?? 0;
    const series =
      pagMap.get(base) ??
      { baseUrl: base, urls: [], maxPage: 0, indexableCount: 0, canonicalToFirst: 0 };
    series.urls.push(p.url);
    series.maxPage = Math.max(series.maxPage, num);
    if (p.indexable) series.indexableCount += 1;
    if (p.canonical && urlParts(p.canonical).path === base) series.canonicalToFirst += 1;
    pagMap.set(base, series);
  }
  const pagination = [...pagMap.values()];

  // ---- Capacidades de datos reales de esta auditoría ----
  const capabilities = {
    connectorPricing: audit.pages.some((p) => sourceValue(p, ["price", "precio"])),
    connectorAvailability: audit.pages.some((p) => availabilityOf(p) !== "unknown"),
    schemaTypes: audit.pages.some((p) => p.schemaTypes.length > 0),
    anchors: graph.hasAnchorData,
  };

  // ---- Productos ----
  const products: EcommerceProduct[] = pages
    .filter((p) => PRODUCT_TYPES.includes(p.ecommerceType))
    .map((p) => {
      const snap = snapshotById.get(p.pageId)!;
      const metrics = graph.byPageId[p.pageId];
      const variantOf = variants.find((g) => g.variantUrls.includes(p.url));
      return {
        auditId,
        pageId: p.pageId,
        url: p.url,
        path: p.path,
        name: snap.h1[0] ?? sourceValue(snap, ["name", "productname"]) ?? snap.title,
        sku: sourceValue(snap, ["sku", "productid", "itemid"]),
        price: sourceValue(snap, ["price", "precio"]),
        currency: sourceValue(snap, ["currency", "pricecurrency", "moneda"]),
        availability: availabilityOf(snap),
        brand: sourceValue(snap, ["brand", "marca"]),
        images: snap.images.map((i) => ({ src: i.src, alt: i.alt })),
        description: snap.metaDescription ?? snap.textSample,
        wordCount: snap.wordCount,
        schema: schemaStatusOf(snap),
        categoryPageId: p.parentPageId,
        categoryConfidence: p.parentConfidence,
        inbound: metrics?.inboundPages ?? 0,
        orphanState: metrics?.orphanState ?? "not-applicable",
        depth: snap.depth,
        indexable: p.indexable,
        isVariant: p.ecommerceType === "product-variant",
        variantOfPageId: variantOf?.mainPageId,
      };
    });

  const productPageIds = new Set(products.map((p) => p.pageId));

  // ---- Categorías ----
  const categories: EcommerceCategory[] = pages
    .filter((p) => CATEGORY_TYPES.includes(p.ecommerceType))
    .map((p) => {
      const snap = snapshotById.get(p.pageId)!;
      const metrics = graph.byPageId[p.pageId];
      const productLinks = snap.internalLinks
        .map((l) => {
          const k = graphKey(l.href, snap.url);
          const targetId = k ? keyToPageId.get(k) : undefined;
          return { href: l.href, targetId };
        })
        .filter((l) => (l.targetId && productPageIds.has(l.targetId)) || isProductLikeUrl(l.href))
        .map((l) => l.href);
      const parent = resolveParent(snap);
      return {
        auditId,
        pageId: p.pageId,
        url: p.url,
        path: p.path,
        name: snap.h1[0] ?? snap.title,
        isSubcategory: p.ecommerceType === "subcategory",
        parentCategoryPageId: parent.parentPageId,
        parentConfidence: parent.confidence,
        productLinks: [...new Set(productLinks)],
        wordCount: snap.wordCount,
        hasH1: snap.h1.length > 0,
        minWords: minWordsFor(snap),
        inbound: metrics?.inboundPages ?? 0,
        outbound: metrics?.outbound ?? 0,
        depth: snap.depth,
        indexable: p.indexable,
        orphanState: metrics?.orphanState ?? "not-applicable",
      };
    });

  // ---- Señales ----
  const findings: EcommerceFinding[] = [];
  const emit = (
    signalId: string,
    page: EcommercePage,
    current: string,
    evidence: string[],
    overrides?: { recommendation?: string },
  ) => {
    const def = getEcommerceSignal(signalId);
    if (!def) return;
    findings.push({
      id: `${page.pageId}:${signalId}`,
      auditId,
      pageId: page.pageId,
      pageUrl: page.url,
      pagePath: page.path,
      signalId,
      signalName: def.name,
      ecommerceType: page.ecommerceType,
      pageType: page.pageType,
      category: def.category,
      classification: def.classification,
      severity: def.severity,
      current,
      explanation: def.explanation,
      recommendation: overrides?.recommendation ?? def.recommendation,
      criterion: def.criterion,
      evidence,
      relatedFindingIds: page.relatedFindingIds,
    });
  };

  if (detection.isEcommerce) {
    const deepIds = new Set(graph.pages.filter((m) => m.deep).map((m) => m.pageId));
    const noInboundStates = ["orphan", "potentially-orphan", "no-inbound-detected"];

    for (const product of products) {
      const page = pageById.get(product.pageId)!;
      if (!product.indexable && page.statusCode >= 300) continue;

      if (product.schema.status === "missing")
        emit("ec-product-schema-missing", page, "Sin schema Product ni ProductGroup.", [
          `Schemas detectados: ${snapshotById.get(product.pageId)?.schemaTypes.join(", ") || "ninguno"}`,
        ]);
      else if (product.schema.status === "incomplete")
        emit("ec-product-schema-incomplete", page, "Product declarado sin nodo Offer.", [
          `Schemas detectados: ${snapshotById.get(product.pageId)?.schemaTypes.join(", ")}`,
        ]);

      if (capabilities.connectorPricing && !product.price)
        emit("ec-product-price-missing", page, "Sin precio en los datos de origen.", [
          "Otros productos de esta auditoría sí aportan precio.",
        ]);
      if (capabilities.connectorAvailability && product.availability === "unknown")
        emit("ec-product-availability-missing", page, "Sin disponibilidad en los datos de origen.", [
          "Otros productos de esta auditoría sí aportan disponibilidad.",
        ]);
      if (product.availability === "out-of-stock" || product.availability === "discontinued")
        emit(
          "ec-product-out-of-stock-review",
          page,
          product.availability === "out-of-stock" ? "Agotado temporalmente." : "Discontinuado.",
          [`Disponibilidad informada por el origen: ${product.availability}`],
          {
            recommendation:
              product.availability === "out-of-stock"
                ? "Si el stock volverá, mantener la URL indexable e informar la reposición y alternativas."
                : "Si fue discontinuado definitivamente, redirigir al reemplazo o a la categoría; si no hay reemplazo, mantener la URL informando el estado.",
          },
        );

      if (noInboundStates.includes(product.orphanState))
        emit(
          "ec-product-no-inbound-links",
          page,
          "Producto sin enlaces internos entrantes detectados.",
          [`Clasificación de la Fase 4: ${product.orphanState}`],
        );
      else if (product.inbound === 1 && graph.crawlComplete && !product.isVariant)
        emit("ec-product-low-connectivity", page, "1 página analizada enlaza a este producto.", [
          `Enlaces entrantes: ${product.inbound}`,
        ]);

      if (product.categoryConfidence === "insufficient")
        emit("ec-product-no-category", page, "Sin categoría detectable.", [
          "Ninguna categoría analizada lo enlaza y la URL no contiene un segmento de categoría reconocible.",
        ]);
      else if (product.categoryConfidence === "inferred")
        emit("ec-hierarchy-inferred-only", page, "Jerarquía inferida por URL, no confirmada.", [
          `Categoría inferida: ${pageById.get(product.categoryPageId ?? "")?.path ?? "—"}`,
        ]);

      if (deepIds.has(product.pageId))
        emit("ec-product-too-deep", page, `Profundidad ${product.depth} clics.`, [
          `Umbral derivado del sitio: ${graph.depthThreshold.value}`,
        ]);

      const canonicalPath = product.url && page.canonical ? urlParts(page.canonical).path : null;
      if (page.canonical && canonicalPath && canonicalPath !== urlParts(product.url).path)
        emit("ec-product-canonical-cross-entity", page, `canonical → ${page.canonical}`, [
          `URL analizada: ${product.url}`,
          product.isVariant
            ? "Hay evidencia de variante: la consolidación puede ser intencional."
            : "No hay evidencia de variante para esta URL.",
        ]);
    }

    for (const category of categories) {
      const page = pageById.get(category.pageId)!;
      if (!category.indexable)
        emit("ec-category-indexability", page, page.indexabilityNote, [
          `HTTP ${page.statusCode}`,
          `robots: ${snapshotById.get(category.pageId)?.robotsMeta ?? "sin meta robots"}`,
        ]);
      if (category.productLinks.length === 0)
        emit("ec-category-no-product-links", page, "Ningún enlace a fichas de producto.", [
          `Enlaces internos totales: ${snapshotById.get(category.pageId)?.internalLinks.length ?? 0}`,
        ]);
      else if (category.minWords !== null && category.wordCount < category.minWords)
        emit(
          "ec-category-thin-context",
          page,
          `${category.wordCount} palabras (umbral contextual ${category.minWords}).`,
          [`Productos enlazados: ${category.productLinks.length}`],
        );

      if (noInboundStates.includes(category.orphanState))
        emit("ec-category-orphan", page, "Sin enlaces internos entrantes detectados.", [
          `Clasificación de la Fase 4: ${category.orphanState}`,
        ]);
      else if (category.inbound <= 1 && graph.crawlComplete)
        emit("ec-category-low-connectivity", page, `${category.inbound} página(s) la enlazan.`, [
          `Enlaces entrantes: ${category.inbound}`,
        ]);

      if (deepIds.has(category.pageId))
        emit("ec-category-deep", page, `Profundidad ${category.depth} clics.`, [
          `Umbral derivado del sitio: ${graph.depthThreshold.value}`,
        ]);
    }

    for (const group of variants) {
      for (const url of group.variantUrls) {
        const page = pages.find((p) => p.url === url);
        if (!page) continue;
        if (!page.canonical)
          emit("ec-variant-canonical-missing", page, "Sin canonical declarada.", [
            `Parámetros de variante: ${variantParametersOf(url).join(", ") || "—"}`,
            group.mainUrl ? `Producto principal detectado: ${group.mainUrl}` : "Sin producto principal detectado.",
          ]);
        if (group.duplicateContent)
          emit("ec-variant-duplicate-content", page, "Contenido o title idéntico al principal.", [
            group.mainUrl ? `Producto principal: ${group.mainUrl}` : "Grupo de variantes",
          ]);
      }
    }

    for (const cluster of facets) {
      for (const url of cluster.urls) {
        const page = pages.find((p) => p.url === url);
        if (!page) continue;
        const canonicalToBase =
          page.canonical && urlParts(page.canonical).path === cluster.baseUrl;
        if (page.indexable && !canonicalToBase)
          emit("ec-faceted-indexable", page, "URL de filtro indexable sin canonical al listado base.", [
            `Parámetros: ${facetParametersOf(url).join(", ") || "—"}`,
            `Listado base: ${cluster.baseUrl}`,
          ]);
      }
      if (cluster.urls.length >= 2) {
        const first = pages.find((p) => p.url === cluster.urls[0]);
        if (first)
          emit(
            "ec-faceted-cluster",
            first,
            `${cluster.urls.length} URLs de faceta sobre ${cluster.baseUrl}.`,
            cluster.urls.slice(0, 10),
          );
      }
    }

    for (const series of pagination) {
      for (const url of series.urls) {
        const page = pages.find((p) => p.url === url);
        if (!page) continue;
        if (!page.indexable)
          emit("ec-pagination-noindex", page, page.indexabilityNote, [
            `Listado base: ${series.baseUrl}`,
          ]);
        if (page.canonical && urlParts(page.canonical).path === series.baseUrl)
          emit("ec-pagination-canonical-to-first", page, `canonical → ${page.canonical}`, [
            `Listado base: ${series.baseUrl}`,
          ]);
      }
    }
  }

  const stats = {
    pages: pages.length,
    products: products.length,
    categories: categories.filter((c) => !c.isSubcategory).length,
    subcategories: categories.filter((c) => c.isSubcategory).length,
    collections: pages.filter((p) => p.ecommerceType === "collection").length,
    variants: pages.filter((p) => p.ecommerceType === "product-variant").length,
    facets: pages.filter((p) => p.ecommerceType === "faceted").length,
    paginated: pages.filter((p) => p.ecommerceType === "pagination").length,
    cartCheckout: pages.filter((p) => p.ecommerceType === "cart" || p.ecommerceType === "checkout")
      .length,
    productsWithSchema: products.filter((p) => p.schema.status !== "missing").length,
    productsWithoutInbound: products.filter((p) =>
      ["orphan", "potentially-orphan", "no-inbound-detected"].includes(p.orphanState),
    ).length,
    productsWithoutCategory: products.filter((p) => p.categoryConfidence === "insufficient").length,
    categoriesWithoutProducts: categories.filter((c) => c.productLinks.length === 0).length,
    problems: findings.filter((f) => f.classification === "problem").length,
    improvements: findings.filter((f) => f.classification === "improvement").length,
    reviews: findings.filter((f) => f.classification === "review").length,
  };

  return {
    auditId,
    detection,
    pages,
    products,
    categories,
    findings,
    facets,
    pagination,
    variants,
    capabilities,
    stats,
  };
}

export const ECOMMERCE_SIGNAL_COUNT = ECOMMERCE_SIGNALS.length;

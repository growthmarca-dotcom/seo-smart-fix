/** FASE 7B — tests de normalización, deduplicación, matching y puente al motor 7A. */
import { describe, expect, it } from "vitest";
import { mergeCategories, mergeProducts } from "./dedupe";
import { matchStoreWithCrawler, summarizeMatches } from "./match";
import { withStoreData } from "./to-snapshots";
import { countImport } from "./types";
import { normalizeProduct } from "../tiendanube/adapter";
import { buildDemoStoreImport, DEMO_STORE_ID } from "../tiendanube/demo";
import { ecommerceFixture } from "../ecommerce/fixtures";

const audit = ecommerceFixture();
const demo = buildDemoStoreImport(audit.id);
const imported = {
  auditId: audit.id,
  storeId: DEMO_STORE_ID,
  source: "demo" as const,
  syncedAt: new Date().toISOString(),
  syncVersion: 1,
  products: demo.products,
  categories: demo.categories,
  errors: [],
  apiPages: 0,
};

describe("adapter Tienda Nube", () => {
  it("normaliza i18n, SKU y disponibilidad sin inventar campos", () => {
    const p = normalizeProduct(
      {
        id: 91,
        name: { es: "Campera de trekking" },
        description: { es: "<p>Campera liviana</p>" },
        handle: { es: "campera-trekking" },
        published: true,
        seo_title: null,
        seo_description: null,
        categories: [{ id: 4, name: { es: "Camperas" }, handle: { es: "camperas" } }],
        variants: [
          {
            id: 501,
            product_id: 91,
            price: "89999.00",
            sku: "CAM-91",
            stock: 3,
            stock_management: true,
            values: [],
          },
        ],
        images: [{ id: 7, src: "https://cdn.example.com/c.jpg", alt: [] }],
      },
      {
        auditId: audit.id,
        storeId: DEMO_STORE_ID,
        source: "demo",
        origin: "https://outdoorpatagonia.demo",
        currency: "ARS",
      },
    );
    expect(p.name).toBe("Campera de trekking");
    expect(p.sku).toBe("CAM-91");
    expect(p.availability).toBe("in-stock");
    expect(p.url).toContain("campera-trekking");
    expect(p.currency).toBe("ARS");
  });
});

describe("deduplicación por clave estable", () => {
  it("una nueva sincronización actualiza sin duplicar", () => {
    const first = mergeProducts([], imported.products);
    const second = mergeProducts(first.items, imported.products);
    expect(second.items).toHaveLength(first.items.length);
    expect(second.created).toBe(0);
  });

  it("no borra el histórico de productos ausentes en la nueva sincronización", () => {
    const first = mergeProducts([], imported.products);
    const partial = imported.products.slice(0, 1);
    const second = mergeProducts(first.items, partial);
    expect(second.items.length).toBe(first.items.length);
  });

  it("deduplica categorías por storeId + externalId", () => {
    const merged = mergeCategories(imported.categories, imported.categories);
    expect(merged.items).toHaveLength(imported.categories.length);
  });
});

describe("matching tienda ↔ crawler", () => {
  const matches = matchStoreWithCrawler({
    audit,
    storeId: imported.storeId,
    products: imported.products,
    categories: imported.categories,
  });

  it("clasifica cada entidad en un estado explícito", () => {
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      expect(["store-and-crawler", "store-only", "crawler-only", "uncertain"]).toContain(m.state);
      expect(m.detail.length).toBeGreaterThan(0);
    }
  });

  it("el resumen cuenta todos los estados", () => {
    const s = summarizeMatches(matches);
    expect(s.matched + s.storeOnly + s.crawlerOnly + s.uncertain).toBe(matches.length);
  });
});

describe("puente al motor 7A", () => {
  it("no modifica score ni hallazgos de la auditoría original", () => {
    const matches = matchStoreWithCrawler({
      audit,
      storeId: imported.storeId,
      products: imported.products,
      categories: imported.categories,
    });
    const result = withStoreData({
      audit,
      products: imported.products,
      categories: imported.categories,
      matches,
    });
    expect(result.audit.score).toEqual(audit.score);
    expect(result.audit.findings).toHaveLength(audit.findings.length);
    expect(result.audit.pages.length).toBeGreaterThanOrEqual(audit.pages.length);
    expect(audit.pages.length).toBeLessThanOrEqual(result.audit.pages.length);
  });

  it("marca con statusCode 0 las entidades no rastreadas", () => {
    const result = withStoreData({
      audit,
      products: imported.products,
      categories: imported.categories,
      matches: [],
    });
    const added = result.audit.pages.filter((p) => p.statusCode === 0);
    expect(added.length).toBe(result.addedPages);
  });
});

describe("conteos de importación", () => {
  it("cuenta productos, categorías, variantes e imágenes", () => {
    const counts = countImport(imported);
    expect(counts.products).toBe(imported.products.length);
    expect(counts.categories).toBe(imported.categories.length);
    expect(counts.variants).toBeGreaterThan(0);
  });

  it("devuelve ceros sin importación", () => {
    expect(countImport(undefined).products).toBe(0);
  });
});

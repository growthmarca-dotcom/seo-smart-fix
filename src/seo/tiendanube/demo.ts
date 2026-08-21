/**
 * FASE 7B — Fixture DEMO de Tienda Nube, claramente identificado
 * (`source: "demo"`). NO representa una conexión real y nunca se mezcla con
 * datos `tiendanube` (live) en la misma auditoría.
 *
 * Cubre: productos publicados y no publicados, categorías con jerarquía,
 * variantes, imágenes con y sin ALT, precios, disponibilidad, un producto sin
 * categoría, un producto sin URL y URLs que el crawler no encuentra
 * (para validar los cuatro estados de correspondencia).
 */
import { normalizeImport } from "./adapter";
import type { TnCategory, TnProduct, TnStore } from "./types";
import type { NormalizedCategory, NormalizedProduct, StoreConnection } from "../commerce/types";

export const DEMO_STORE_ID = "demo-store-1";
export const DEMO_STORE_NAME = "Tienda Demo Tienda Nube";
export const DEMO_STORE_ORIGIN = "https://outdoor-patagonia.demo";

const store: TnStore = {
  id: DEMO_STORE_ID,
  name: { es: DEMO_STORE_NAME },
  url: DEMO_STORE_ORIGIN,
  main_currency: "ARS",
  main_language: "es",
};

const categories: TnCategory[] = [
  { id: 100, name: { es: "Camperas" }, handle: { es: "camperas" }, parent: 0 },
  { id: 101, name: { es: "Camperas de trekking" }, handle: { es: "camperas-trekking" }, parent: 100 },
  { id: 102, name: { es: "Calzado" }, handle: { es: "calzado" }, parent: 0 },
  { id: 103, name: { es: "Liquidación" }, handle: { es: "liquidacion" }, parent: 0 },
];

const products: TnProduct[] = [
  {
    id: 9001,
    name: { es: "Campera Cerro Torre" },
    description: {
      es: "<p>Campera impermeable de tres capas para trekking de alta montaña, con costuras selladas y capucha ajustable.</p>",
    },
    handle: { es: "campera-cerro-torre" },
    published: true,
    brand: "Outdoor Patagonia",
    seo_title: { es: "Campera Cerro Torre impermeable" },
    seo_description: { es: "Campera de trekking impermeable tres capas." },
    categories: [{ id: 100 }, { id: 101 }],
    variants: [
      { id: 1, product_id: 9001, sku: "CT-M", price: "189999.00", stock: 4, values: [{ es: "M" }] },
      { id: 2, product_id: 9001, sku: "CT-L", price: "189999.00", stock: 0, values: [{ es: "L" }] },
    ],
    images: [
      { id: 11, src: `${DEMO_STORE_ORIGIN}/img/cerro-torre-1.jpg`, alt: ["Campera Cerro Torre azul"], position: 1 },
      { id: 12, src: `${DEMO_STORE_ORIGIN}/img/cerro-torre-2.jpg`, alt: [], position: 2 },
    ],
    updated_at: "2026-08-01T10:00:00Z",
  },
  {
    id: 9002,
    name: { es: "Botas Fitz Roy" },
    description: { es: "<p>Botas de montaña con membrana impermeable.</p>" },
    handle: { es: "botas-fitzroy" },
    published: true,
    categories: [{ id: 102 }],
    variants: [
      { id: 3, product_id: 9002, sku: "FR-41", price: "245000", stock: 0, values: [{ es: "41" }] },
      { id: 4, product_id: 9002, sku: "FR-42", price: "245000", stock: 0, values: [{ es: "42" }] },
    ],
    images: [{ id: 21, src: `${DEMO_STORE_ORIGIN}/img/fitzroy.jpg`, position: 1 }],
    updated_at: "2026-08-02T10:00:00Z",
  },
  {
    id: 9003,
    name: { es: "Mochila Perito Moreno 40L" },
    handle: { es: "mochila-perito-moreno" },
    published: true,
    // Sin categoría: valida la señal "producto sin categoría".
    categories: [],
    variants: [
      { id: 5, product_id: 9003, sku: "PM-40", price: "132500", stock_management: false, values: [] },
    ],
    images: [{ id: 31, src: `${DEMO_STORE_ORIGIN}/img/mochila.jpg`, alt: ["Mochila 40 litros"], position: 1 }],
    updated_at: "2026-08-03T10:00:00Z",
  },
  {
    id: 9004,
    name: { es: "Campera Rompeviento Ushuaia" },
    handle: { es: "campera-rompeviento-ushuaia" },
    // No publicada: la tienda la tiene pero no debería estar indexable.
    published: false,
    categories: [{ id: 100 }],
    variants: [{ id: 6, product_id: 9004, sku: "RV-S", price: "98000", stock: 12, values: [{ es: "S" }] }],
    images: [],
    updated_at: "2026-08-04T10:00:00Z",
  },
  {
    id: 9005,
    name: { es: "Guantes Viedma" },
    // Sin handle ni canonical_url: queda sin URL pública (se reporta como tal).
    published: true,
    categories: [{ id: 103 }],
    variants: [{ id: 7, product_id: 9005, sku: "GV-U", price: "42000", stock: 3, values: [] }],
    images: [{ id: 41, src: `${DEMO_STORE_ORIGIN}/img/guantes.jpg`, position: 1 }],
    updated_at: "2026-08-05T10:00:00Z",
  },
];

export function buildDemoStoreImport(auditId: string): {
  products: NormalizedProduct[];
  categories: NormalizedCategory[];
} {
  return normalizeImport(
    { store, products, categories },
    {
      auditId,
      storeId: DEMO_STORE_ID,
      source: "demo",
      origin: DEMO_STORE_ORIGIN,
      currency: "ARS",
      locale: "es",
    },
  );
}

export function buildDemoStoreConnection(auditId: string): StoreConnection {
  const at = new Date().toISOString();
  return {
    source: "demo",
    storeId: DEMO_STORE_ID,
    name: DEMO_STORE_NAME,
    domain: DEMO_STORE_ORIGIN,
    status: "synced",
    connectedAt: at,
    lastSyncAt: at,
    apiErrors: [],
    auditIds: [auditId],
  };
}

/**
 * FASE 7B — Adaptador Tienda Nube → modelo normalizado.
 *
 * Funciones PURAS: no hacen red, no escriben nada y no dependen del motor 7A.
 * El motor e-commerce genérico no conoce estos tipos: solo recibe el modelo
 * normalizado de `src/seo/commerce`.
 *
 * Reglas:
 *  - Ningún campo se inventa: si la API no lo entrega, queda `undefined`.
 *  - La disponibilidad se deriva EXCLUSIVAMENTE de `stock` / `stock_management`.
 *  - La URL pública se arma con el dominio de la tienda + `handle`; si falta
 *    alguno de los dos, el producto queda sin URL (y así se reporta).
 */
import type { AvailabilityState } from "../ecommerce/types";
import { dedupeCategory, dedupeProduct } from "../commerce/dedupe";
import type {
  CommerceSource,
  NormalizedCategory,
  NormalizedImage,
  NormalizedProduct,
  NormalizedVariant,
  ProductStatus,
} from "../commerce/types";
import type { TnCategory, TnI18n, TnImage, TnProduct, TnStore, TnVariant } from "./types";

/** Texto de un campo i18n, priorizando el idioma principal de la tienda. */
export function i18nText(value: TnI18n, locale = "es"): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value.trim() || undefined;
  const preferred = value[locale];
  if (typeof preferred === "string" && preferred.trim()) return preferred.trim();
  for (const v of Object.values(value)) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

export function storeDomain(store: TnStore | undefined): string | undefined {
  const raw = store?.url ?? store?.original_domain ?? store?.domains?.[0] ?? undefined;
  if (!raw) return undefined;
  const withProtocol = raw.includes("://") ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return undefined;
  }
}

function joinUrl(origin: string | undefined, path: string | undefined): string | undefined {
  if (!origin || !path) return undefined;
  return `${origin.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function numeric(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

/** Disponibilidad de una variante, solo con los datos que entrega la API. */
export function variantAvailability(variant: TnVariant): AvailabilityState {
  if (variant.stock_management === false) return "in-stock";
  if (variant.stock === null || variant.stock === undefined) {
    return variant.stock_management === true ? "unknown" : "unknown";
  }
  return variant.stock > 0 ? "in-stock" : "out-of-stock";
}

export function normalizeImage(
  image: TnImage,
  source: CommerceSource,
  locale = "es",
): NormalizedImage | null {
  const url = image.src?.trim();
  if (!url) return null;
  const altRaw = Array.isArray(image.alt) ? image.alt.find((a) => a && a.trim()) : image.alt;
  const alt = typeof altRaw === "string" ? altRaw.trim() || undefined : undefined;
  void locale;
  return {
    source,
    externalId: String(image.id ?? url),
    url,
    alt,
    position: image.position ?? undefined,
  };
}

export function normalizeVariant(
  variant: TnVariant,
  productExternalId: string,
  source: CommerceSource,
  currency: string | undefined,
  locale = "es",
): NormalizedVariant {
  const attributes = (variant.values ?? [])
    .map((v, i) => {
      const value = i18nText(v as TnI18n, locale);
      return value ? { name: `Atributo ${i + 1}`, value } : null;
    })
    .filter((a): a is { name: string; value: string } => a !== null);
  return {
    source,
    externalId: String(variant.id ?? `${productExternalId}-v${attributes.length}`),
    productExternalId,
    sku: variant.sku?.trim() || undefined,
    price: numeric(variant.price),
    currency,
    availability: variantAvailability(variant),
    attributes,
  };
}

export interface AdapterContext {
  auditId: string;
  storeId: string;
  source: CommerceSource;
  /** Origen público de la tienda (para derivar URLs). */
  origin?: string | undefined;
  currency?: string | undefined;
  locale?: string | undefined;
}

export function normalizeProduct(raw: TnProduct, ctx: AdapterContext): NormalizedProduct {
  const locale = ctx.locale ?? "es";
  const externalId = String(raw.id ?? "");
  const variants = (raw.variants ?? []).map((v) =>
    normalizeVariant(v, externalId, ctx.source, ctx.currency, locale),
  );
  const images = (raw.images ?? [])
    .map((i) => normalizeImage(i, ctx.source, locale))
    .filter((i): i is NormalizedImage => i !== null);

  const prices = variants
    .map((v) => (v.price ? Number(v.price) : Number.NaN))
    .filter((n) => Number.isFinite(n));
  const availability: AvailabilityState = variants.length
    ? variants.some((v) => v.availability === "in-stock")
      ? "in-stock"
      : variants.every((v) => v.availability === "unknown")
        ? "unknown"
        : "out-of-stock"
    : "unknown";

  const status: ProductStatus =
    raw.published === true ? "published" : raw.published === false ? "unpublished" : "unknown";

  const handle = i18nText(raw.handle ?? null, locale);
  const url =
    raw.canonical_url?.trim() || joinUrl(ctx.origin, handle ? `productos/${handle}` : undefined);

  return dedupeProduct({
    source: ctx.source,
    externalId,
    auditId: ctx.auditId,
    storeId: ctx.storeId,
    name: i18nText(raw.name ?? null, locale),
    description: i18nText(raw.description ?? null, locale),
    url,
    status,
    images,
    variants,
    categoryIds: (raw.categories ?? [])
      .map((c) => (c.id === undefined ? "" : String(c.id)))
      .filter(Boolean),
    price: prices.length ? String(Math.min(...prices)) : undefined,
    currency: ctx.currency,
    availability,
    sku: variants.find((v) => v.sku)?.sku,
    brand: raw.brand?.trim() || undefined,
    seo: {
      title: i18nText(raw.seo_title ?? null, locale),
      description: i18nText(raw.seo_description ?? null, locale),
    },
    updatedAt: raw.updated_at ?? undefined,
  });
}

export function normalizeCategory(
  raw: TnCategory,
  ctx: AdapterContext,
  products: NormalizedProduct[] = [],
): NormalizedCategory {
  const locale = ctx.locale ?? "es";
  const externalId = String(raw.id ?? "");
  const handle = i18nText(raw.handle ?? null, locale);
  return dedupeCategory({
    source: ctx.source,
    externalId,
    auditId: ctx.auditId,
    storeId: ctx.storeId,
    name: i18nText(raw.name ?? null, locale),
    description: i18nText(raw.description ?? null, locale),
    url: joinUrl(ctx.origin, handle ? `categorias/${handle}` : undefined),
    parentId:
      raw.parent === null || raw.parent === undefined || String(raw.parent) === "0"
        ? undefined
        : String(raw.parent),
    productIds: products.filter((p) => p.categoryIds.includes(externalId)).map((p) => p.externalId),
    updatedAt: raw.updated_at ?? undefined,
  });
}

/** Normaliza una importación completa (productos + categorías relacionadas). */
export function normalizeImport(
  raw: { store?: TnStore | undefined; products: TnProduct[]; categories: TnCategory[] },
  ctx: AdapterContext,
): { products: NormalizedProduct[]; categories: NormalizedCategory[] } {
  const products = raw.products.filter((p) => p.id !== undefined).map((p) => normalizeProduct(p, ctx));
  const categories = raw.categories
    .filter((c) => c.id !== undefined)
    .map((c) => normalizeCategory(c, ctx, products));
  return { products, categories };
}

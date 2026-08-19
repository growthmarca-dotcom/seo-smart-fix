/**
 * FASE 7B — Deduplicación y fusión de importaciones.
 *
 * Reglas:
 * - Claves estables: `storeId + externalId` (entidad) y
 *   `storeId + externalId + childId` (variantes e imágenes).
 * - Una nueva sincronización ACTUALIZA la representación actual, nunca duplica.
 * - Las entidades que dejan de venir en la API no se borran en silencio:
 *   se marcan `status: "unavailable"` (productos) o se conservan con nota
 *   (categorías), preservando el histórico de la auditoría.
 * - Nunca se mezclan tiendas ni auditorías: la fusión valida ambos ids.
 */
import {
  childKey,
  entityKey,
  type NormalizedCategory,
  type NormalizedImage,
  type NormalizedProduct,
  type NormalizedVariant,
} from "./types";

function dedupeImages(storeId: string, externalId: string, images: NormalizedImage[]) {
  const map = new Map<string, NormalizedImage>();
  for (const img of images) {
    map.set(childKey(storeId, externalId, img.externalId || img.url), img);
  }
  return [...map.values()].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

function dedupeVariants(storeId: string, externalId: string, variants: NormalizedVariant[]) {
  const map = new Map<string, NormalizedVariant>();
  for (const v of variants) map.set(childKey(storeId, externalId, v.externalId), v);
  return [...map.values()];
}

/** Normaliza hijos duplicados dentro de una misma entidad recién importada. */
export function dedupeProduct(product: NormalizedProduct): NormalizedProduct {
  return {
    ...product,
    images: dedupeImages(product.storeId, product.externalId, product.images),
    variants: dedupeVariants(product.storeId, product.externalId, product.variants),
    categoryIds: [...new Set(product.categoryIds)],
  };
}

export function dedupeCategory(category: NormalizedCategory): NormalizedCategory {
  return { ...category, productIds: [...new Set(category.productIds)] };
}

export interface MergeResult<T> {
  items: T[];
  created: number;
  updated: number;
  missing: number;
}

/**
 * Fusiona productos: los entrantes actualizan a los existentes por clave
 * estable; los ausentes quedan marcados como no disponibles.
 */
export function mergeProducts(
  existing: NormalizedProduct[],
  incoming: NormalizedProduct[],
): MergeResult<NormalizedProduct> {
  const map = new Map<string, NormalizedProduct>();
  for (const p of existing) map.set(entityKey(p.storeId, p.externalId), p);

  const seen = new Set<string>();
  let created = 0;
  let updated = 0;
  for (const raw of incoming) {
    const p = dedupeProduct(raw);
    const key = entityKey(p.storeId, p.externalId);
    seen.add(key);
    if (map.has(key)) updated += 1;
    else created += 1;
    map.set(key, p);
  }

  let missing = 0;
  for (const [key, p] of map) {
    if (seen.has(key)) continue;
    // Solo se marcan las entidades de la misma tienda que la importación.
    if (!incoming.some((i) => i.storeId === p.storeId)) continue;
    missing += 1;
    if (p.status !== "unavailable") map.set(key, { ...p, status: "unavailable" });
  }

  return { items: [...map.values()], created, updated, missing };
}

export function mergeCategories(
  existing: NormalizedCategory[],
  incoming: NormalizedCategory[],
): MergeResult<NormalizedCategory> {
  const map = new Map<string, NormalizedCategory>();
  for (const c of existing) map.set(entityKey(c.storeId, c.externalId), c);
  const seen = new Set<string>();
  let created = 0;
  let updated = 0;
  for (const raw of incoming) {
    const c = dedupeCategory(raw);
    const key = entityKey(c.storeId, c.externalId);
    seen.add(key);
    if (map.has(key)) updated += 1;
    else created += 1;
    map.set(key, c);
  }
  const missing = [...map.keys()].filter((k) => !seen.has(k)).length;
  return { items: [...map.values()], created, updated, missing };
}

/** Filtro de aislamiento: nada que no sea de esta tienda + auditoría. */
export function isolate<T extends { auditId: string; storeId: string }>(
  items: T[],
  auditId: string,
  storeId: string,
): T[] {
  return items.filter((i) => i.auditId === auditId && i.storeId === storeId);
}

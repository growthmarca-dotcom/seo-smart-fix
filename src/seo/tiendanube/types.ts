/**
 * FASE 7B — Tipos CRUDOS de la API de Tienda Nube (solo los campos que se leen).
 *
 * Todos los campos son opcionales: la API puede omitirlos según el plan de la
 * tienda o los permisos (scopes) concedidos a la aplicación. El adaptador
 * nunca inventa un campo ausente.
 *
 * Endpoints usados (todos de LECTURA):
 *  - GET /v1/{store_id}/store
 *  - GET /v1/{store_id}/products?page=N&per_page=200&fields=...
 *  - GET /v1/{store_id}/categories?page=N&per_page=200
 */

/** Campo internacionalizado: `{ es: "…", pt: "…" }`. */
export type TnI18n = Record<string, string | null | undefined> | string | null;

export interface TnImage {
  id?: number | string;
  src?: string | null;
  /** Tienda Nube entrega `alt` como array de strings por idioma/imágen. */
  alt?: string[] | string | null;
  position?: number | null;
}

export interface TnVariant {
  id?: number | string;
  product_id?: number | string;
  sku?: string | null;
  price?: string | number | null;
  promotional_price?: string | number | null;
  stock?: number | null;
  /** `null` = stock infinito según la API. */
  stock_management?: boolean | null;
  values?: Array<{ es?: string | null; pt?: string | null; en?: string | null } | TnI18n>;
}

export interface TnProduct {
  id?: number | string;
  name?: TnI18n;
  description?: TnI18n;
  handle?: TnI18n;
  canonical_url?: string | null;
  published?: boolean | null;
  free_shipping?: boolean | null;
  brand?: string | null;
  seo_title?: TnI18n;
  seo_description?: TnI18n;
  categories?: Array<{ id?: number | string; name?: TnI18n; handle?: TnI18n }>;
  variants?: TnVariant[];
  images?: TnImage[];
  updated_at?: string | null;
}

export interface TnCategory {
  id?: number | string;
  name?: TnI18n;
  description?: TnI18n;
  handle?: TnI18n;
  parent?: number | string | null;
  updated_at?: string | null;
}

export interface TnStore {
  id?: number | string;
  name?: TnI18n;
  /** Dominio principal de la tienda. */
  url?: string | null;
  original_domain?: string | null;
  domains?: string[] | null;
  main_currency?: string | null;
  main_language?: string | null;
}

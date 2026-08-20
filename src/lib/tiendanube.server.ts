/**
 * FASE 7B — Acceso REAL a la API de Tienda Nube, exclusivamente de LECTURA.
 *
 * AUTENTICACIÓN (mecanismo oficial de Tienda Nube para aplicaciones):
 *   OAuth 2.0 "authorization code". El comercio autoriza la app desde
 *   https://www.tiendanube.com/apps/{client_id}/authorize y Tienda Nube
 *   devuelve un `code` que se intercambia por un access token permanente en
 *   POST https://www.tiendanube.com/apps/authorize/token.
 *   La app NUNCA pide la contraseña de la tienda.
 *
 * DÓNDE VIVEN LAS CREDENCIALES: solo en variables de entorno del servidor.
 * Nunca se envían al cliente, no se muestran en la UI y no se registran en logs.
 *
 * QUÉ DEBE CONFIGURAR EL DESARROLLADOR PARA DATOS REALES:
 *   - TIENDANUBE_CLIENT_ID      (App ID del Partner Portal)
 *   - TIENDANUBE_CLIENT_SECRET  (secreto de la app)
 *   - TIENDANUBE_ACCESS_TOKEN   (token obtenido al autorizar la tienda)
 *   - TIENDANUBE_STORE_ID       (store_id devuelto junto al token)
 *   - TIENDANUBE_USER_AGENT     (obligatorio por la API: "MiApp (mail@dominio)")
 * Sin `TIENDANUBE_ACCESS_TOKEN` + `TIENDANUBE_STORE_ID` estas funciones
 * devuelven `configured: false` y la UI muestra "Autorización requerida":
 * jamás se simula una conexión real.
 *
 * SCOPES necesarios (solo lectura): `read_products`, `read_content`.
 *
 * NO ESCRITURA: este módulo solo emite peticiones GET. No existe ninguna
 * función que haga POST/PUT/PATCH/DELETE sobre recursos de la tienda.
 */
import type { TnCategory, TnProduct, TnStore } from "@/seo/tiendanube/types";

const API_BASE = "https://api.tiendanube.com/v1";
const PER_PAGE = 200;
/** Tope de páginas por sincronización para respetar los límites de la API. */
const MAX_PAGES = 20;

export interface TnCredentials {
  accessToken: string;
  storeId: string;
  userAgent: string;
}

export function readCredentials(): TnCredentials | null {
  const accessToken = process.env["TIENDANUBE_ACCESS_TOKEN"];
  const storeId = process.env["TIENDANUBE_STORE_ID"];
  if (!accessToken || !storeId) return null;
  return {
    accessToken,
    storeId,
    userAgent: process.env["TIENDANUBE_USER_AGENT"] ?? "SEO Fixer (soporte@seofixer.app)",
  };
}

/** true si la app tiene client_id/secret para completar el flujo OAuth. */
export function oauthAppConfigured(): boolean {
  return Boolean(process.env["TIENDANUBE_CLIENT_ID"] && process.env["TIENDANUBE_CLIENT_SECRET"]);
}

/** URL de autorización oficial. No expone el secreto de la app. */
export function authorizeUrl(): string | null {
  const clientId = process.env["TIENDANUBE_CLIENT_ID"];
  if (!clientId) return null;
  return `https://www.tiendanube.com/apps/${clientId}/authorize`;
}

function headers(creds: TnCredentials) {
  return {
    Authentication: `bearer ${creds.accessToken}`,
    "User-Agent": creds.userAgent,
    "Content-Type": "application/json",
  };
}

export class TnApiError extends Error {
  status: number;
  retryAfter?: number | undefined;
  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET con manejo explícito de 401/403/429. Nunca registra el token. */
async function apiGet<T>(creds: TnCredentials, path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${API_BASE}/${creds.storeId}${path}`, { headers: headers(creds) });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "2");
    if (attempt < 1) {
      await sleep(Math.min(Math.max(retryAfter, 1), 10) * 1000);
      return apiGet<T>(creds, path, attempt + 1);
    }
    throw new TnApiError("Límite de peticiones de la API alcanzado.", 429, retryAfter);
  }
  if (res.status === 401 || res.status === 403) {
    throw new TnApiError(
      "La autorización de la tienda no es válida o fue revocada. Volvé a autorizar la aplicación.",
      res.status,
    );
  }
  if (!res.ok) {
    throw new TnApiError(`La API de Tienda Nube devolvió un error [${res.status}].`, res.status);
  }
  return (await res.json()) as T;
}

export interface PaginatedResult<T> {
  items: T[];
  pages: number;
  truncated: boolean;
}

/**
 * Paginación page/per_page: se detiene cuando una página devuelve menos
 * elementos que `per_page` (no hay más datos) o al llegar a MAX_PAGES.
 */
export async function fetchAllPages<T>(
  creds: TnCredentials,
  resource: "products" | "categories",
  params: Record<string, string> = {},
): Promise<PaginatedResult<T>> {
  const items: T[] = [];
  let page = 1;
  for (; page <= MAX_PAGES; page += 1) {
    const query = new URLSearchParams({
      page: String(page),
      per_page: String(PER_PAGE),
      ...params,
    });
    const batch = await apiGet<T[]>(creds, `/${resource}?${query.toString()}`);
    items.push(...batch);
    if (batch.length < PER_PAGE) return { items, pages: page, truncated: false };
  }
  return { items, pages: MAX_PAGES, truncated: true };
}

export async function fetchStore(creds: TnCredentials): Promise<TnStore> {
  return apiGet<TnStore>(creds, "/store");
}

export interface ReadResult {
  store?: TnStore | undefined;
  products: TnProduct[];
  categories: TnCategory[];
  apiPages: number;
  truncated: boolean;
  errors: Array<{ scope: "store" | "products" | "categories"; message: string; status?: number }>;
}

/**
 * Lectura completa de la tienda. `updatedSince` (ISO) evita volver a bajar
 * datos que no cambiaron cuando la API lo permite (`updated_at_min`).
 * Un error en un recurso se registra y no rompe el resto de la importación.
 */
export async function readStoreData(
  creds: TnCredentials,
  updatedSince?: string,
): Promise<ReadResult> {
  const errors: ReadResult["errors"] = [];
  const filter = updatedSince ? { updated_at_min: updatedSince } : {};
  let store: TnStore | undefined;
  try {
    store = await fetchStore(creds);
  } catch (e) {
    errors.push({
      scope: "store",
      message: e instanceof Error ? e.message : "Error al leer datos de la tienda.",
      ...(e instanceof TnApiError ? { status: e.status } : {}),
    });
  }

  let products: TnProduct[] = [];
  let categories: TnCategory[] = [];
  let apiPages = 0;
  let truncated = false;

  try {
    const res = await fetchAllPages<TnProduct>(creds, "products", filter);
    products = res.items;
    apiPages += res.pages;
    truncated = truncated || res.truncated;
  } catch (e) {
    errors.push({
      scope: "products",
      message: e instanceof Error ? e.message : "Error al leer productos.",
      ...(e instanceof TnApiError ? { status: e.status } : {}),
    });
  }

  try {
    const res = await fetchAllPages<TnCategory>(creds, "categories");
    categories = res.items;
    apiPages += res.pages;
    truncated = truncated || res.truncated;
  } catch (e) {
    errors.push({
      scope: "categories",
      message: e instanceof Error ? e.message : "Error al leer categorías.",
      ...(e instanceof TnApiError ? { status: e.status } : {}),
    });
  }

  return { store, products, categories, apiPages, truncated, errors };
}

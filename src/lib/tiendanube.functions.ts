/**
 * FASE 7B — Server functions de Tienda Nube (SOLO LECTURA).
 * Wrapper fino: la lógica de red vive en tiendanube.server.ts y la
 * normalización en src/seo/tiendanube/adapter.ts.
 * Los tokens nunca cruzan al cliente ni se devuelven en las respuestas.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const tiendanubeStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  const { readCredentials, oauthAppConfigured, authorizeUrl } = await import("./tiendanube.server");
  const creds = readCredentials();
  return {
    configured: creds !== null,
    appConfigured: oauthAppConfigured(),
    authorizeUrl: authorizeUrl(),
    missing: [
      ...(process.env["TIENDANUBE_CLIENT_ID"] ? [] : ["TIENDANUBE_CLIENT_ID"]),
      ...(process.env["TIENDANUBE_CLIENT_SECRET"] ? [] : ["TIENDANUBE_CLIENT_SECRET"]),
      ...(process.env["TIENDANUBE_ACCESS_TOKEN"] ? [] : ["TIENDANUBE_ACCESS_TOKEN"]),
      ...(process.env["TIENDANUBE_STORE_ID"] ? [] : ["TIENDANUBE_STORE_ID"]),
    ],
  };
});

const importInput = z.object({
  auditId: z.string().min(1),
  /** ISO. Si viene, solo se piden entidades modificadas desde esa fecha. */
  updatedSince: z.string().optional(),
});

export const tiendanubeImportFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => importInput.parse(data))
  .handler(async ({ data }) => {
    const { readCredentials, readStoreData } = await import("./tiendanube.server");
    const { normalizeImport, storeDomain, i18nText } = await import("@/seo/tiendanube/adapter");
    const creds = readCredentials();
    if (!creds) {
      return {
        ok: false as const,
        configured: false as const,
        error:
          "Falta autorizar la aplicación en Tienda Nube. Configurá TIENDANUBE_CLIENT_ID, TIENDANUBE_CLIENT_SECRET, TIENDANUBE_ACCESS_TOKEN y TIENDANUBE_STORE_ID.",
      };
    }
    const raw = await readStoreData(creds, data.updatedSince);
    if (!raw.products.length && raw.errors.length) {
      return {
        ok: false as const,
        configured: true as const,
        error: raw.errors[0]?.message ?? "Error al leer datos de Tienda Nube.",
        errors: raw.errors,
      };
    }
    const origin = storeDomain(raw.store);
    const { products, categories } = normalizeImport(raw, {
      auditId: data.auditId,
      storeId: creds.storeId,
      source: "tiendanube",
      origin,
      currency: raw.store?.main_currency ?? undefined,
      locale: raw.store?.main_language ?? "es",
    });
    return {
      ok: true as const,
      configured: true as const,
      storeId: creds.storeId,
      storeName: i18nText(raw.store?.name ?? null) ?? undefined,
      domain: origin,
      apiPages: raw.apiPages,
      truncated: raw.truncated,
      errors: raw.errors,
      products,
      categories,
    };
  });

/**
 * FASE 6A — Server functions de Search Console (solo lectura).
 * Wrapper fino: toda la lógica vive en gsc.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const gscStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  const { readCredentials } = await import("./gsc.server");
  return { configured: readCredentials() !== null };
});

export const gscListPropertiesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { readCredentials, listSites } = await import("./gsc.server");
  const creds = readCredentials();
  if (!creds) {
    return {
      ok: false as const,
      configured: false as const,
      error:
        "Falta vincular una conexión OAuth de Google Search Console al proyecto. Sin credenciales no se muestran datos reales.",
    };
  }
  try {
    const sites = await listSites(creds);
    return { ok: true as const, configured: true as const, sites };
  } catch (e) {
    return {
      ok: false as const,
      configured: true as const,
      error: e instanceof Error ? e.message : "Error al consultar Search Console.",
    };
  }
});

const importInput = z.object({
  siteUrl: z.string().min(3),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rowLimit: z.number().int().min(1).max(25000).default(5000),
});

export const gscImportFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => importInput.parse(data))
  .handler(async ({ data }) => {
    const { readCredentials, listSites, querySearchAnalytics } = await import("./gsc.server");
    const creds = readCredentials();
    if (!creds) {
      return {
        ok: false as const,
        configured: false as const,
        error: "Sin conexión OAuth de Google Search Console configurada.",
      };
    }
    try {
      const sites = await listSites(creds);
      const property = sites.find((s) => s.siteUrl === data.siteUrl);
      if (!property) {
        return {
          ok: false as const,
          configured: true as const,
          error: "La propiedad seleccionada no está verificada para la cuenta conectada.",
        };
      }
      const rows = await querySearchAnalytics(creds, property.siteUrl, {
        startDate: data.startDate,
        endDate: data.endDate,
        dimensions: ["date", "query", "page", "device", "country"],
        rowLimit: data.rowLimit,
      });
      return { ok: true as const, configured: true as const, property: property.siteUrl, rows };
    } catch (e) {
      return {
        ok: false as const,
        configured: true as const,
        error: e instanceof Error ? e.message : "Error al importar datos de Search Console.",
      };
    }
  });

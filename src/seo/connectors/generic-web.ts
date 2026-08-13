import type { PlatformConnector } from "./types";

/**
 * Conector Web Genérica: descubre URLs por sitemap.xml + rastreo interno.
 * La obtención real se hace en el servidor (src/lib/crawl.functions.ts)
 * porque requiere fetch de origen cruzado.
 */
export const genericWebConnector: PlatformConnector = {
  id: "generic-web",
  name: "Web genérica",
  description:
    "Auditoría de cualquier sitio público mediante sitemap.xml y rastreo de enlaces internos. Solo lectura: los cambios se aprueban y exportan como instrucciones.",
  status: "available",
  authModel: "none",
  ruleTags: [],
  capabilities: [
    { field: "title", label: "Title", read: true, write: false, note: "Requiere aplicar en el CMS" },
    { field: "metaDescription", label: "Meta description", read: true, write: false },
    { field: "h1", label: "Encabezados", read: true, write: false },
    { field: "images.alt", label: "ALT de imágenes", read: true, write: false },
    { field: "canonical", label: "Canonical", read: true, write: false },
    { field: "robotsMeta", label: "Meta robots", read: true, write: false },
    { field: "schema", label: "Datos estructurados", read: true, write: false },
    { field: "content", label: "Contenido", read: true, write: false },
  ],
};

import type { PlatformConnector } from "./types";

/**
 * Conector Mercado Libre — arquitectura preparada, sin API implementada.
 * Los campos declarados se ajustarán a lo que la API real permita leer
 * y modificar en cada tipo de publicación.
 */
export const mercadolibreConnector: PlatformConnector = {
  id: "mercadolibre",
  name: "Mercado Libre",
  description:
    "Auditoría de publicaciones: título, categoría, atributos de ficha técnica, descripción e imágenes.",
  status: "needs-credentials",
  authModel: "oauth2",
  ruleTags: ["mercadolibre"],
  capabilities: [
    { field: "title", label: "Título de publicación", read: true, write: true, note: "Máx. 60 caracteres" },
    { field: "content", label: "Descripción", read: true, write: true },
    { field: "attributes", label: "Atributos de ficha técnica", read: true, write: true },
    { field: "categories", label: "Categoría", read: true, write: true, note: "Con restricciones" },
    { field: "images.alt", label: "Imágenes", read: true, write: true, note: "Sin ALT propio" },
    { field: "canonical", label: "Canonical", read: false, write: false, note: "Lo controla la plataforma" },
    { field: "robotsMeta", label: "Meta robots", read: false, write: false },
  ],
};

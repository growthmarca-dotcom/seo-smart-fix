import type { PlatformConnector } from "./types";

/**
 * Conector Tienda Nube — arquitectura preparada, sin API implementada.
 * Cuando existan credenciales/autorización se implementa fetchSnapshots()
 * mapeando productos/categorías/páginas a PageSnapshot. No se simula OAuth.
 */
export const tiendanubeConnector: PlatformConnector = {
  id: "tiendanube",
  name: "Tienda Nube",
  description:
    "Auditoría de productos, categorías y páginas de la tienda, con escritura de campos SEO cuando la integración esté autorizada.",
  status: "needs-credentials",
  authModel: "oauth2",
  ruleTags: ["tiendanube"],
  capabilities: [
    { field: "title", label: "Nombre / title del producto", read: true, write: true },
    { field: "metaDescription", label: "Meta description SEO", read: true, write: true },
    { field: "content", label: "Descripción del producto", read: true, write: true },
    { field: "url", label: "Handle / URL amigable", read: true, write: true, note: "Requiere redirección" },
    { field: "images.alt", label: "ALT de imágenes", read: true, write: true },
    { field: "categories", label: "Categorías", read: true, write: true },
    { field: "schema", label: "Datos estructurados", read: true, write: false, note: "Depende del tema" },
    { field: "canonical", label: "Canonical", read: true, write: false },
  ],
};

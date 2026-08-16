/**
 * FASE 7A — Señales/reglas SEO e-commerce declarativas.
 *
 * NO duplican reglas generales: cuando un problema ya lo detecta el motor
 * (title, meta description, H1, ALT, thin content, canonical, noindex,
 * huérfanas, breadcrumb...), la capa e-commerce referencia el diagnóstico
 * existente mediante `reusesRuleId` en vez de crear una señal nueva.
 * Ninguna señal participa del SEO Score.
 */
import type { EcommerceSignalDef } from "./types";

/** Reglas generales existentes que la capa e-commerce REUTILIZA (no reimplementa). */
export const REUSED_RULE_IDS = [
  "title-missing",
  "title-length",
  "meta-description-missing",
  "meta-description-length",
  "h1-missing",
  "h1-multiple",
  "thin-content",
  "duplicate-content",
  "duplicate-title",
  "images-alt",
  "image-filenames",
  "canonical-missing",
  "canonical-mismatch",
  "noindex",
  "deep-page",
  "orphan-page",
  "breadcrumb-schema",
  "schema-recommended",
  "internal-links-few",
  "ctx-product-images-missing",
  "ctx-product-description-short",
  "ctx-product-related-links",
  "ctx-category-listing-links",
];

export const ECOMMERCE_SIGNALS: EcommerceSignalDef[] = [
  // ---------- PRODUCTOS ----------
  {
    id: "ec-product-schema-missing",
    name: "Producto sin datos estructurados Product",
    category: "structured-data",
    classification: "problem",
    severity: "important",
    ecommerceTypes: ["product", "product-variant"],
    explanation:
      "Sin marcado Product el buscador debe deducir por sí solo que la página es una ficha de producto, y no puede leer precio, moneda ni disponibilidad de forma fiable.",
    recommendation:
      "Publicar Product con name, image, description y un Offer con price, priceCurrency y availability.",
    criterion:
      "Página clasificada como producto, HTTP 2xx, y ningún schema Product ni ProductGroup declarado en el HTML rastreado.",
    requiresEvidence: "schemaTypes capturados por el crawler.",
  },
  {
    id: "ec-product-schema-incomplete",
    name: "Product schema sin Offer",
    category: "structured-data",
    classification: "improvement",
    severity: "improvement",
    ecommerceTypes: ["product", "product-variant"],
    explanation:
      "Product sin Offer deja fuera la información comercial (precio, moneda, disponibilidad), que es la parte que da contexto de compra.",
    recommendation: "Agregar el nodo Offer con price, priceCurrency y availability al Product existente.",
    criterion: "Schema Product presente y ningún schema Offer declarado en la misma URL.",
    requiresEvidence: "schemaTypes capturados por el crawler.",
  },
  {
    id: "ec-product-price-missing",
    name: "Precio ausente en los datos del producto",
    category: "structured-data",
    classification: "problem",
    severity: "important",
    ecommerceTypes: ["product", "product-variant"],
    explanation:
      "El precio es el dato comercial central de una ficha; si el origen de datos no lo entrega, la ficha queda incompleta para el usuario y para el buscador.",
    recommendation: "Completar el precio y su moneda en el producto de origen y exponerlo en la ficha.",
    criterion:
      "Solo se evalúa si la auditoría tiene al menos un producto con precio disponible: en ese caso se marcan los productos que no lo tienen. Si ninguna página aporta precio, la señal no se evalúa.",
    requiresEvidence: "Campo de precio disponible en los metadatos de origen de al menos un producto.",
  },
  {
    id: "ec-product-availability-missing",
    name: "Disponibilidad ausente en los datos del producto",
    category: "structured-data",
    classification: "improvement",
    severity: "improvement",
    ecommerceTypes: ["product", "product-variant"],
    explanation:
      "Sin disponibilidad no puede distinguirse un producto en venta de uno agotado o discontinuado, y el tratamiento SEO correcto depende exactamente de esa diferencia.",
    recommendation: "Exponer la disponibilidad del producto (disponible / agotado / discontinuado).",
    criterion:
      "Solo se evalúa si la auditoría tiene al menos un producto con disponibilidad conocida. Nunca se asume disponibilidad.",
    requiresEvidence: "Campo de disponibilidad disponible en los metadatos de origen.",
  },
  {
    id: "ec-product-out-of-stock-review",
    name: "Producto agotado o discontinuado: decisión pendiente",
    category: "content",
    classification: "review",
    ecommerceTypes: ["product", "product-variant"],
    explanation:
      "Un producto sin stock no debe desindexarse ni eliminarse automáticamente: si volverá a estar disponible conviene mantener la URL; si fue discontinuado definitivamente, corresponde redirigir o reemplazar el contenido.",
    recommendation:
      "Definir según el caso: mantener la URL con alternativas visibles si el stock volverá, o redirigir a la categoría o al reemplazo si fue discontinuado.",
    criterion: "Disponibilidad informada como agotado o discontinuado en los datos de origen.",
    requiresEvidence: "Campo de disponibilidad con valor conocido.",
  },
  {
    id: "ec-product-no-inbound-links",
    name: "Producto sin enlaces internos entrantes detectados",
    category: "technical",
    classification: "problem",
    severity: "important",
    ecommerceTypes: ["product", "product-variant"],
    explanation:
      "Un producto al que ninguna página analizada enlaza depende del sitemap para ser descubierto y recibe muy poca relevancia interna.",
    recommendation:
      "Enlazarlo desde su categoría, desde listados y desde productos relacionados cuando corresponda.",
    criterion:
      "Se reutiliza la clasificación de huérfanas de la Fase 4 (huérfana, potencialmente huérfana o sin enlaces entrantes detectados). No se crea una segunda definición de huérfano.",
    requiresEvidence: "Grafo de enlaces internos de la Fase 4.",
    reusesRuleId: "orphan-page",
  },
  {
    id: "ec-product-low-connectivity",
    name: "Producto con baja conectividad interna",
    category: "technical",
    classification: "improvement",
    severity: "improvement",
    ecommerceTypes: ["product"],
    explanation:
      "Un producto con un único enlace entrante compite en desventaja frente a fichas mejor enlazadas del mismo sitio.",
    recommendation: "Sumar enlaces desde la categoría, el blog y productos relacionados.",
    criterion: "Exactamente 1 página analizada enlaza al producto y el rastreo está resuelto.",
    requiresEvidence: "Grafo de enlaces internos de la Fase 4.",
  },
  {
    id: "ec-product-no-category",
    name: "Producto sin categoría detectable",
    category: "technical",
    classification: "improvement",
    severity: "improvement",
    ecommerceTypes: ["product", "product-variant"],
    explanation:
      "Si ninguna categoría enlaza al producto y su URL no permite inferir una, el producto queda fuera de la arquitectura temática de la tienda.",
    recommendation: "Asignarlo a una categoría y enlazarlo desde su listado.",
    criterion:
      "Ninguna categoría analizada enlaza al producto y la URL no contiene un segmento de categoría reconocible.",
    requiresEvidence: "Enlaces internos capturados y clasificación de categorías.",
  },
  {
    id: "ec-product-too-deep",
    name: "Producto demasiado profundo",
    category: "technical",
    classification: "improvement",
    severity: "improvement",
    ecommerceTypes: ["product", "product-variant"],
    explanation:
      "Cuantos más clics separan un producto de la home, menos frecuencia de rastreo y menos relevancia interna recibe.",
    recommendation: "Acortar la ruta con enlaces desde la home, listados destacados o menús.",
    criterion:
      "Profundidad por encima del umbral derivado del propio sitio en la Fase 4 (no un valor universal fijo).",
    requiresEvidence: "Profundidad de clics calculada por el crawler.",
    reusesRuleId: "deep-page",
  },
  {
    id: "ec-product-canonical-cross-entity",
    name: "Canonical del producto apunta a otra URL",
    category: "technical",
    classification: "problem",
    severity: "critical",
    ecommerceTypes: ["product", "product-variant"],
    explanation:
      "Un canonical hacia otra URL indica al buscador que esta ficha no es la versión preferida: si es una variante puede ser correcto, y si no lo es, la ficha queda excluida de los resultados.",
    recommendation:
      "Confirmar si la URL es una variante consolidada intencionalmente; si no lo es, apuntar el canonical a la propia URL.",
    criterion:
      "canonical presente y distinto de la URL de la página. Se reporta como hecho y la recomendación queda condicionada a si hay evidencia de variante.",
    requiresEvidence: "canonical capturado por el crawler.",
    reusesRuleId: "canonical-mismatch",
  },

  // ---------- CATEGORÍAS ----------
  {
    id: "ec-category-no-product-links",
    name: "Categoría sin productos enlazados",
    category: "technical",
    classification: "problem",
    severity: "important",
    ecommerceTypes: ["category", "subcategory", "collection"],
    explanation:
      "Un listado que no enlaza a ninguna ficha no cumple su función de navegación ni distribuye relevancia hacia los productos.",
    recommendation:
      "Revisar si la categoría tiene productos publicados y visibles en el HTML, o consolidarla si quedó vacía.",
    criterion:
      "Página clasificada como categoría, colección o subcategoría y ningún enlace interno hacia una URL con patrón de producto o hacia un producto detectado.",
    requiresEvidence: "Enlaces internos capturados por el crawler.",
  },
  {
    id: "ec-category-thin-context",
    name: "Categoría con contenido contextual potencialmente insuficiente",
    category: "content",
    classification: "improvement",
    severity: "improvement",
    ecommerceTypes: ["category", "subcategory", "collection"],
    explanation:
      "Un listado sin texto propio aporta poco contexto temático; no es un error en sí mismo, pero limita la capacidad de posicionar términos de categoría.",
    recommendation:
      "Sumar una introducción breve y útil que describa el tipo de producto, materiales o usos.",
    criterion:
      "La categoría SÍ enlaza productos (por lo tanto es funcional) y su cantidad de palabras está por debajo del umbral contextual del perfil de página de la Fase 3. Si el contexto no define umbral, no se evalúa.",
    requiresEvidence: "wordCount y umbral contextual definido en la Fase 3.",
    reusesRuleId: "thin-content",
  },
  {
    id: "ec-category-deep",
    name: "Categoría profunda",
    category: "technical",
    classification: "improvement",
    severity: "improvement",
    ecommerceTypes: ["category", "subcategory", "collection"],
    explanation:
      "Las categorías son puntos de entrada: si están lejos de la home, los productos que dependen de ellas quedan aún más lejos.",
    recommendation: "Acercarlas desde el menú principal o desde la home.",
    criterion: "Profundidad por encima del umbral derivado del sitio en la Fase 4.",
    requiresEvidence: "Profundidad de clics calculada por el crawler.",
    reusesRuleId: "deep-page",
  },
  {
    id: "ec-category-low-connectivity",
    name: "Categoría con baja conectividad interna",
    category: "technical",
    classification: "improvement",
    severity: "improvement",
    ecommerceTypes: ["category", "subcategory", "collection"],
    explanation:
      "Una categoría con un solo enlace entrante recibe muy poca relevancia interna para ser un punto de entrada de la tienda.",
    recommendation: "Enlazarla desde el menú, la home y contenidos relacionados del blog.",
    criterion: "Como máximo 1 página analizada enlaza a la categoría y el rastreo está resuelto.",
    requiresEvidence: "Grafo de enlaces internos de la Fase 4.",
  },
  {
    id: "ec-category-orphan",
    name: "Categoría potencialmente huérfana",
    category: "technical",
    classification: "problem",
    severity: "important",
    ecommerceTypes: ["category", "subcategory", "collection"],
    explanation:
      "Una categoría sin enlaces entrantes no es alcanzable navegando: los usuarios solo llegan desde buscadores y el rastreo depende del sitemap.",
    recommendation: "Incorporarla a la navegación principal o a un listado de categorías.",
    criterion: "Clasificación de huérfanas de la Fase 4, sin redefinirla.",
    requiresEvidence: "Grafo de enlaces internos de la Fase 4.",
    reusesRuleId: "orphan-page",
  },
  {
    id: "ec-category-indexability",
    name: "Categoría no indexable",
    category: "technical",
    classification: "problem",
    severity: "critical",
    ecommerceTypes: ["category", "subcategory", "collection"],
    explanation:
      "Una categoría con noindex o con respuesta distinta de 2xx no puede aparecer en resultados y corta la transmisión de relevancia hacia sus productos.",
    recommendation:
      "Confirmar si la exclusión es intencional; si no lo es, permitir la indexación y devolver HTTP 200.",
    criterion: "Meta robots con noindex o statusCode fuera del rango 2xx.",
    requiresEvidence: "robotsMeta y statusCode capturados por el crawler.",
    reusesRuleId: "noindex",
  },

  // ---------- VARIANTES ----------
  {
    id: "ec-variant-canonical-missing",
    name: "Variante sin canonical declarada",
    category: "technical",
    classification: "review",
    ecommerceTypes: ["product-variant"],
    explanation:
      "Sin canonical explícita, el buscador decide por su cuenta qué variante indexar. No existe una respuesta única: hay variantes que conviene indexar y otras que no.",
    recommendation:
      "Decidir con evidencia: si la variante tiene demanda propia, dejarla indexable con contenido diferenciado; si es casi idéntica al producto principal, canonicalizarla al principal.",
    criterion: "URL con parámetros de variante y sin canonical declarada.",
    requiresEvidence: "canonical y parámetros de la URL.",
  },
  {
    id: "ec-variant-duplicate-content",
    name: "Variante con contenido casi idéntico al producto principal",
    category: "content",
    classification: "review",
    ecommerceTypes: ["product-variant"],
    explanation:
      "Variantes con el mismo texto compiten entre sí. Consolidarlas o diferenciarlas depende de si cada variante tiene búsquedas propias.",
    recommendation:
      "Diferenciar el contenido de las variantes con demanda propia y consolidar el resto en el producto principal.",
    criterion:
      "Mismo contentHash o mismo title que otra URL del grupo de variantes de la MISMA auditoría.",
    requiresEvidence: "contentHash o title capturados en dos URLs del mismo grupo.",
    reusesRuleId: "duplicate-content",
  },

  // ---------- FACETAS / FILTROS ----------
  {
    id: "ec-faceted-indexable",
    name: "URL de filtro o faceta indexable",
    category: "technical",
    classification: "review",
    ecommerceTypes: ["faceted", "search"],
    explanation:
      "Las combinaciones de filtros pueden multiplicar URLs muy similares. No siempre corresponde bloquearlas: algunas facetas con demanda real conviene mantenerlas indexables.",
    recommendation:
      "Revisar caso por caso qué facetas tienen demanda de búsqueda y cuáles conviene consolidar con canonical hacia el listado base. Esta capa no modifica robots.txt.",
    criterion: "URL con parámetros de filtro, orden o búsqueda, indexable y sin canonical al listado base.",
    requiresEvidence: "Parámetros de URL, robotsMeta y canonical.",
  },
  {
    id: "ec-faceted-cluster",
    name: "Conjunto de URLs de faceta sobre el mismo listado",
    category: "technical",
    classification: "review",
    ecommerceTypes: ["faceted"],
    explanation:
      "Varias URLs con filtros sobre un mismo listado suelen indicar arquitectura de facetas rastreable, algo que conviene revisar antes de que crezca.",
    recommendation: "Definir una política explícita de facetas: qué se indexa, qué se canonicaliza y qué se enlaza.",
    criterion: "Dos o más URLs analizadas comparten la misma ruta base y difieren solo en parámetros.",
    requiresEvidence: "Al menos 2 URLs con la misma base en la auditoría.",
  },

  // ---------- PAGINACIÓN ----------
  {
    id: "ec-pagination-noindex",
    name: "Página de paginación no indexable",
    category: "technical",
    classification: "review",
    ecommerceTypes: ["pagination"],
    explanation:
      "Excluir la paginación puede dejar productos sin ruta de rastreo. La decisión depende de cómo se enlacen los productos del listado.",
    recommendation:
      "Si los productos solo son alcanzables por la paginación, mantenerla rastreable y enlazada.",
    criterion: "URL de paginación con noindex o respuesta fuera de 2xx.",
    requiresEvidence: "robotsMeta y statusCode capturados por el crawler.",
  },
  {
    id: "ec-pagination-canonical-to-first",
    name: "Paginación con canonical a la primera página",
    category: "technical",
    classification: "review",
    ecommerceTypes: ["pagination"],
    explanation:
      "Canonicalizar todas las páginas a la primera puede dejar sin rastrear los productos que solo aparecen en páginas posteriores.",
    recommendation:
      "Usar canonical propia en cada página del listado y asegurar enlaces internos a los productos.",
    criterion: "URL de paginación cuya canonical apunta a la ruta base del listado.",
    requiresEvidence: "canonical capturada por el crawler.",
  },

  // ---------- ARQUITECTURA ----------
  {
    id: "ec-hierarchy-inferred-only",
    name: "Jerarquía solo inferida por URL",
    category: "technical",
    classification: "review",
    ecommerceTypes: ["product", "subcategory"],
    explanation:
      "La relación categoría → producto se deduce del patrón de URL, pero ningún enlace interno la confirma: la navegación real no refleja la jerarquía.",
    recommendation:
      "Enlazar explícitamente el producto desde su categoría (y su breadcrumb) para que la jerarquía sea verificable.",
    criterion:
      "La URL permite inferir una categoría padre existente en la auditoría, pero esa categoría no enlaza a la página.",
    requiresEvidence: "Patrón de URL y enlaces internos capturados.",
  },
];

export function getEcommerceSignal(id: string) {
  return ECOMMERCE_SIGNALS.find((s) => s.id === id);
}

export const ECOMMERCE_SIGNAL_IDS = ECOMMERCE_SIGNALS.map((s) => s.id);

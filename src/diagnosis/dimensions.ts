/**
 * Catálogo del diagnóstico integral de negocio (MarCa Audit).
 * Constantes de solo lectura. El diagnóstico pertenece a la EMPRESA;
 * la auditoría SEO es solo una fuente de evidencia dentro de "web".
 */
import type { Industry } from "@/companies/model";
import { TOURISM_INDUSTRIES } from "@/companies/model";

export type DimensionId = "web" | "visibility" | "sales" | "brand" | "channels" | "opportunities";

export const DIMENSIONS: { id: DimensionId; title: string; summary: string }[] = [
  { id: "web", title: "Presencia digital y sitio web", summary: "Sitio, claridad de la oferta y SEO técnico." },
  { id: "visibility", title: "Visibilidad y reputación", summary: "Perfiles en buscadores y mapas, reseñas y canales." },
  { id: "sales", title: "Comercialización y ventas", summary: "Captación, respuesta, presupuestos, seguimiento y conversión." },
  { id: "brand", title: "Marca, comunicación y contenidos", summary: "Identidad, propuesta de valor y contenidos." },
  { id: "channels", title: "Canales y experiencia del cliente", summary: "WhatsApp, formularios, reservas o compra y fidelización." },
  { id: "opportunities", title: "Oportunidades y desarrollo comercial", summary: "Competencia, canales desaprovechados y oportunidades." },
];

/** Origen del dato. "integration" = requiere conexión/permisos; no se evalúa hasta conectarse. */
export type ControlSource = "detected" | "client" | "professional" | "integration";
export const SOURCE_LABELS: Record<ControlSource, string> = {
  detected: "Detectado por el sistema",
  client: "Informado por el cliente",
  professional: "Evaluación profesional",
  integration: "Integración futura (requiere conexión)",
};

export interface DiagnosisControl {
  id: string;
  dimension: DimensionId;
  title: string;
  guidance: string;
  source: ControlSource;
  /** Rubros donde aplica. Sin valor = todos los rubros. */
  industries?: Industry[];
}

const T = TOURISM_INDUSTRIES;

const ALL: Industry[] = [...TOURISM_INDUSTRIES, "restaurant", "real-estate", "ecommerce", "other"];
const only = (...xs: Industry[]): Industry[] => xs;
const except = (...xs: Industry[]): Industry[] => ALL.filter((i) => !xs.includes(i));
const R: Industry = "restaurant";
const E: Industry = "ecommerce";
const RE: Industry = "real-estate";

/**
 * Catálogo C1. Controles sin `industries` son universales. Los condicionales (WhatsApp, formularios,
 * redes, perfil local) admiten "No aplica" con justificación cuando el negocio no usa ese canal.
 */
export const CONTROLS: DiagnosisControl[] = [
  // 1. Presencia digital y sitio web
  { id: "web-seo-health", dimension: "web", source: "detected", title: "Salud técnica del sitio (auditoría SEO)", guidance: "Referencia técnica de la auditoría SEO asociada. Se muestra aparte: no suma a la madurez ni a la cobertura." },
  { id: "web-has-site", dimension: "web", source: "professional", title: "Tiene un canal web propio", guidance: "Sitio, tienda o página propia. «No aplica» con justificación si opera solo por redes o marketplaces." },
  { id: "web-offer-clarity", dimension: "web", source: "professional", title: "La oferta se entiende en la primera visita", guidance: "Qué se ofrece, a quién y dónde, sin tener que buscar." },
  { id: "web-mobile", dimension: "web", source: "professional", title: "El sitio se usa bien desde el celular", guidance: "Lectura, botones y recorrido principal probados en un teléfono." },
  { id: "web-contact-visible", dimension: "web", source: "professional", title: "Contacto y llamada a la acción visibles", guidance: "Cómo consultar, comprar o reservar se ve sin buscar." },
  { id: "web-ownership", dimension: "web", source: "client", title: "Control del sitio y del dominio", guidance: "El negocio tiene acceso al editor y al dominio a su nombre." },
  { id: "web-performance", dimension: "web", source: "integration", title: "Velocidad real (Core Web Vitals)", guidance: "Requiere conectar PageSpeed." },
  // 2. Visibilidad y reputación
  { id: "vis-gbp", dimension: "visibility", source: "professional", title: "Perfil en Google Maps / Business activo y completo", guidance: "Revisión pública: existe, horarios, fotos y categoría correctos. «No aplica» con justificación si no atiende al público ni tiene zona de servicio." },
  { id: "vis-reviews", dimension: "visibility", source: "professional", title: "Reseñas: volumen, calificación y respuestas", guidance: "Lectura pública de reseñas y respuestas. «No aplica» con justificación si no hay plataformas con reseñas." },
  { id: "vis-consistency", dimension: "visibility", source: "professional", title: "Datos coherentes entre canales", guidance: "Nombre, teléfono y ubicación iguales en sitio, mapas y redes." },
  { id: "vis-external-references", dimension: "visibility", source: "professional", title: "Menciones y referencias externas relevantes", guidance: "Directorios del rubro, cámaras o asociaciones, guías, blogs o medios locales, socios, premios o eventos, con datos coherentes con el sitio. No exige notas periodísticas. «No aplica» con justificación si el rubro no tiene ese ecosistema." },
  { id: "vis-ota", dimension: "visibility", source: "client", title: "Presencia en OTAs (Booking, Airbnb u otras) coherente con el sitio", guidance: "Fotos, precios y condiciones alineados con el canal propio.", industries: T },
  { id: "vis-marketplace", dimension: "visibility", source: "professional", title: "Publicaciones en marketplaces coherentes", guidance: "Mercado Libre u otros: datos, precios y marca alineados con el canal propio. «No aplica» con justificación si no vende en marketplaces.", industries: only(E) },
  { id: "vis-gbp-data", dimension: "visibility", source: "integration", title: "Métricas de Google Business", guidance: "Requiere conectar Google Business Profile." },
  // 3. Comercialización y ventas
  { id: "sales-response", dimension: "sales", source: "client", title: "Tiempo de respuesta a consultas", guidance: "Cuánto tarda en promedio en responder una consulta nueva." },
  { id: "sales-followup", dimension: "sales", source: "client", title: "Seguimiento de consultas no cerradas", guidance: "Se registra y se recontacta a quien no concretó." },
  { id: "sales-quotes", dimension: "sales", source: "client", title: "Presupuestos o tarifas claros y rápidos", guidance: "Se envían con formato propio, condiciones y vigencia.", industries: except(E, R) },
  { id: "sales-pricing-visible", dimension: "sales", source: "professional", title: "Precios o rangos visibles", guidance: "Carta, catálogo o tarifas con precios o rangos publicados.", industries: [...T, R, E] },
  { id: "sales-conversion", dimension: "sales", source: "client", title: "Se conoce la tasa de conversión", guidance: "Cuántas consultas terminan en venta o reserva." },
  { id: "sales-direct", dimension: "sales", source: "professional", title: "Estrategia de venta directa frente a intermediarios", guidance: "Hay incentivos para reservar directo y no solo por OTAs.", industries: T },
  // 4. Marca, comunicación y contenidos
  { id: "brand-identity", dimension: "brand", source: "professional", title: "Identidad visual consistente", guidance: "Logo, colores y tono coherentes en sitio, redes y materiales." },
  { id: "brand-value", dimension: "brand", source: "professional", title: "Propuesta de valor diferencial", guidance: "Queda claro por qué elegir este negocio frente a otros." },
  { id: "brand-content", dimension: "brand", source: "professional", title: "Contenidos útiles y actualizados", guidance: "Fotos, textos y publicaciones vigentes y propios." },
  { id: "brand-social", dimension: "brand", source: "client", title: "Redes sociales activas", guidance: "Frecuencia de publicación y respuesta. «No aplica» con justificación si no usa redes." },
  { id: "brand-proof", dimension: "brand", source: "professional", title: "Casos, testimonios o trabajos realizados visibles", guidance: "Portfolio, casos o testimonios verificables.", industries: only(RE, "other") },
  // 5. Canales y experiencia del cliente
  { id: "ch-primary-contact", dimension: "channels", source: "professional", title: "El canal de contacto principal funciona", guidance: "El canal que el negocio declara como principal (teléfono, WhatsApp, email o formulario), probado: el mensaje llega y se responde.", industries: except(...T) },
  { id: "ch-whatsapp", dimension: "channels", source: "professional", title: "WhatsApp y contacto directo funcionan", guidance: "Probado: el mensaje llega y se responde. «No aplica» con justificación si el negocio no usa WhatsApp.", industries: [...T, R, E] },
  { id: "ch-booking", dimension: "channels", source: "professional", title: "Recorrido de reserva sin fricciones", guidance: "Reserva probada hasta el final. «No aplica» con justificación si no toma reservas.", industries: [...T, R] },
  { id: "ch-checkout", dimension: "channels", source: "professional", title: "Recorrido de compra online sin fricciones", guidance: "Compra probada hasta el paso de pago, sin pagar.", industries: only(E) },
  { id: "ch-forms", dimension: "channels", source: "professional", title: "Formularios que llegan y se responden", guidance: "Consulta de prueba enviada y respondida. «No aplica» con justificación si no hay formularios.", industries: only(RE, "other") },
  { id: "ch-loyalty", dimension: "channels", source: "client", title: "Fidelización de clientes", guidance: "Contacto con clientes anteriores (base, promociones, recompra)." },
  // 6. Oportunidades y desarrollo comercial
  { id: "opp-competitors", dimension: "opportunities", source: "client", title: "Competidores identificados", guidance: "El negocio sabe con quién compite y en qué se diferencia." },
  { id: "opp-channels", dimension: "opportunities", source: "professional", title: "Canales desaprovechados", guidance: "Canales con potencial que hoy no se usan." },
  { id: "opp-seasonality", dimension: "opportunities", source: "client", title: "Estacionalidad y objetivos comerciales", guidance: "Temporadas, metas y capacidad ociosa conocidas.", industries: [...T, R] },
  { id: "opp-goals", dimension: "opportunities", source: "client", title: "Objetivos comerciales definidos", guidance: "Metas de venta o captación conocidas y medibles.", industries: except(...T, R) },
  { id: "opp-quick-wins", dimension: "opportunities", source: "professional", title: "Mejoras de bajo costo identificadas", guidance: "Lista de acciones rápidas con impacto comercial." },
  { id: "opp-keywords", dimension: "opportunities", source: "integration", title: "Análisis de demanda y competencia en buscadores", guidance: "Requiere una herramienta de datos externa." },
];

export function controlsFor(industry: Industry, dimension?: DimensionId): DiagnosisControl[] {
  return CONTROLS.filter(
    (c) => (!c.industries || c.industries.includes(industry)) && (!dimension || c.dimension === dimension),
  );
}

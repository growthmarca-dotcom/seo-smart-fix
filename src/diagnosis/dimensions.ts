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

export const CONTROLS: DiagnosisControl[] = [
  // 1. Web
  { id: "web-seo-health", dimension: "web", source: "detected", title: "Salud técnica del sitio (auditoría SEO)", guidance: "Se toma de la auditoría SEO asociada como un único indicador." },
  { id: "web-offer-clarity", dimension: "web", source: "professional", title: "La oferta se entiende en la primera visita", guidance: "Qué se vende, a quién y dónde, sin tener que buscar." },
  { id: "web-mobile", dimension: "web", source: "professional", title: "El sitio se usa bien desde el celular", guidance: "Lectura, botones y recorrido principal probados en un teléfono." },
  { id: "web-ownership", dimension: "web", source: "client", title: "Control del sitio y del dominio", guidance: "El negocio tiene acceso al editor y al dominio a su nombre." },
  { id: "web-performance", dimension: "web", source: "integration", title: "Velocidad real (Core Web Vitals)", guidance: "Requiere conectar PageSpeed." },
  // 2. Visibilidad
  { id: "vis-gbp", dimension: "visibility", source: "client", title: "Perfil de Google Business activo y completo", guidance: "Existe, está verificado y tiene horarios, fotos y categoría correctos." },
  { id: "vis-reviews", dimension: "visibility", source: "professional", title: "Reseñas: volumen, calificación y respuestas", guidance: "Se responden las reseñas, en especial las negativas." },
  { id: "vis-consistency", dimension: "visibility", source: "professional", title: "Datos coherentes entre canales", guidance: "Nombre, teléfono y ubicación iguales en sitio, mapas y redes." },
  { id: "vis-ota", dimension: "visibility", source: "client", title: "Presencia en OTAs coherente con el sitio", guidance: "Booking, Airbnb u otras: fotos, precios y condiciones alineados.", industries: T },
  { id: "vis-gbp-data", dimension: "visibility", source: "integration", title: "Métricas de Google Business", guidance: "Requiere conectar Google Business Profile." },
  // 3. Ventas
  { id: "sales-response", dimension: "sales", source: "client", title: "Tiempo de respuesta a consultas", guidance: "Cuánto tarda en promedio en responder una consulta nueva." },
  { id: "sales-followup", dimension: "sales", source: "client", title: "Seguimiento de consultas no cerradas", guidance: "Existe un registro y se recontacta a quien no compró o reservó." },
  { id: "sales-quotes", dimension: "sales", source: "client", title: "Presupuestos o tarifas claros y rápidos", guidance: "Se envían con formato propio, condiciones y vigencia." },
  { id: "sales-conversion", dimension: "sales", source: "client", title: "Se conoce la tasa de conversión", guidance: "Cuántas consultas terminan en venta o reserva." },
  { id: "sales-direct", dimension: "sales", source: "professional", title: "Estrategia de venta directa frente a intermediarios", guidance: "Hay incentivos para reservar directo y no solo por OTAs.", industries: T },
  // 4. Marca
  { id: "brand-identity", dimension: "brand", source: "professional", title: "Identidad visual consistente", guidance: "Logo, colores y tono coherentes en sitio, redes y materiales." },
  { id: "brand-value", dimension: "brand", source: "professional", title: "Propuesta de valor diferencial", guidance: "Queda claro por qué elegir este negocio frente a otros." },
  { id: "brand-content", dimension: "brand", source: "professional", title: "Contenidos útiles y actualizados", guidance: "Fotos, textos y publicaciones vigentes y propios." },
  { id: "brand-social", dimension: "brand", source: "client", title: "Redes sociales activas", guidance: "Frecuencia de publicación y respuesta a mensajes." },
  // 5. Canales
  { id: "ch-whatsapp", dimension: "channels", source: "professional", title: "WhatsApp y contacto directo funcionan", guidance: "Probado: el mensaje llega y se responde." },
  { id: "ch-booking", dimension: "channels", source: "professional", title: "Recorrido de reserva o compra sin fricciones", guidance: "Recorrido completo probado hasta el final." },
  { id: "ch-forms", dimension: "channels", source: "professional", title: "Formularios que llegan y se responden", guidance: "Se envió una consulta de prueba y se recibió respuesta." },
  { id: "ch-loyalty", dimension: "channels", source: "client", title: "Fidelización de clientes", guidance: "Se mantiene contacto con clientes anteriores (base, promociones, recompra)." },
  // 6. Oportunidades
  { id: "opp-competitors", dimension: "opportunities", source: "client", title: "Competidores identificados", guidance: "El negocio sabe con quién compite y en qué se diferencia." },
  { id: "opp-channels", dimension: "opportunities", source: "professional", title: "Canales desaprovechados", guidance: "Canales con potencial que hoy no se usan." },
  { id: "opp-seasonality", dimension: "opportunities", source: "client", title: "Estacionalidad y objetivos comerciales", guidance: "Temporadas, metas y capacidad ociosa conocidas." },
  { id: "opp-keywords", dimension: "opportunities", source: "integration", title: "Análisis de demanda y competencia en buscadores", guidance: "Requiere una herramienta de datos externa." },
];

export function controlsFor(industry: Industry, dimension?: DimensionId): DiagnosisControl[] {
  return CONTROLS.filter(
    (c) => (!c.industries || c.industries.includes(industry)) && (!dimension || c.dimension === dimension),
  );
}

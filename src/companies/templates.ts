/**
 * Plantillas de roadmap. Son constantes de solo lectura: `buildRoadmap` las
 * copia a una instancia nueva por empresa, por eso editar el roadmap de una
 * empresa nunca altera la plantilla ni a otras empresas.
 */
import type { TaskPriority } from "./model";

export interface TemplatePhase {
  key: string;
  title: string;
  tasks: { title: string; description: string; priority: TaskPriority; kind?: "seo-audit" }[];
}
export interface RoadmapTemplate {
  id: string;
  name: string;
  phases: TemplatePhase[];
}

export const TOURISM_TEMPLATE: RoadmapTemplate = {
  id: "tourism-lodging-v1",
  name: "Turismo / alojamientos",
  phases: [
    {
      key: "A",
      title: "A. Diagnóstico inicial y alcance",
      tasks: [
        { title: "Reunión inicial con el alojamiento", description: "Relevar objetivos comerciales, temporadas, tipo de huésped y canales actuales (web, OTAs, redes, teléfono).", priority: "high" },
        { title: "Definir alcance del trabajo", description: "Acordar qué se revisa y qué queda fuera; registrar responsables del lado del cliente.", priority: "high" },
        { title: "Relevar accesos disponibles", description: "Anotar qué accesos existen (editor del sitio, dominio, Google Business, motor de reservas). No guardar contraseñas aquí.", priority: "medium" },
      ],
    },
    {
      key: "B",
      title: "B. Presencia digital y sitio web",
      tasks: [
        { title: "Revisar sitio en celular y computadora", description: "Comprobar que el sitio carga, se lee bien y que la información básica (unidades, ubicación, servicios) está visible.", priority: "high" },
        { title: "Inventario de perfiles y listados", description: "Listar perfiles en buscadores, mapas, OTAs y redes; verificar que nombre, teléfono y ubicación coinciden.", priority: "medium" },
        { title: "Fotos y descripción de unidades", description: "Revisar si cada unidad tiene fotos actuales, capacidad, comodidades y descripción propia.", priority: "medium" },
      ],
    },
    {
      key: "C",
      title: "C. SEO técnico y páginas",
      tasks: [
        { title: "Auditoría SEO del sitio", description: "Asociar y revisar la auditoría SEO existente del sitio. Los hallazgos se consultan en la auditoría; no se copian aquí.", priority: "high", kind: "seo-audit" },
        { title: "Validar páginas con noindex, huérfanas o vacías", description: "Confirmar con el cliente qué páginas deben indexarse, cuáles son plantillas sin uso y cuáles necesitan enlaces internos.", priority: "medium" },
      ],
    },
    {
      key: "D",
      title: "D. Reservas, contacto y conversión comercial",
      tasks: [
        { title: "Probar el recorrido de reserva o consulta", description: "Recorrer el botón de reservar/consultar hasta el final y anotar fricciones o enlaces rotos.", priority: "high" },
        { title: "Completar la evaluación comercial del alojamiento", description: "Usar los 10 controles de la evaluación comercial de la auditoría asociada.", priority: "medium" },
        { title: "Revisar canales de contacto directo", description: "WhatsApp, teléfono, email y formulario: que funcionen y respondan en un tiempo razonable.", priority: "medium" },
      ],
    },
    {
      key: "E",
      title: "E. Contenido, confianza y reputación",
      tasks: [
        { title: "Revisar reseñas y respuestas", description: "Relevar calificación y volumen de reseñas en los canales principales y si se responden.", priority: "medium" },
        { title: "Políticas visibles", description: "Comprobar que check-in/check-out, cancelación, mascotas y formas de pago estén publicadas y claras.", priority: "medium" },
        { title: "Contenido del destino", description: "Evaluar si hay contenido útil sobre la zona (cómo llegar, actividades) que apoye la decisión del huésped.", priority: "low" },
      ],
    },
    {
      key: "F",
      title: "F. Medición y seguimiento",
      tasks: [
        { title: "Relevar herramientas de medición", description: "Anotar si existen analítica, Search Console o seguimiento de reservas. No se conectan desde esta app en esta etapa.", priority: "medium" },
        { title: "Definir indicadores a seguir", description: "Acordar qué se mide (consultas, reservas directas, visitas) y cada cuánto se revisa.", priority: "low" },
      ],
    },
    {
      key: "G",
      title: "G. Plan de acciones priorizadas e implementación",
      tasks: [
        { title: "Armar plan de acciones priorizadas", description: "Ordenar las mejoras por impacto y esfuerzo a partir de lo relevado en las fases anteriores.", priority: "high" },
        { title: "Presentar el plan al cliente", description: "Compartir informe y plan; registrar decisiones y aprobaciones.", priority: "medium" },
        { title: "Seguimiento de implementación", description: "Registrar qué acciones se ejecutan, quién las hace y con qué evidencia.", priority: "medium" },
      ],
    },
  ],
};

/**
 * Rubros sin plantilla específica: mismas fases, una tarea de definición por
 * fase. No se inventa un análisis automático para ellos.
 */
export const GENERIC_TEMPLATE: RoadmapTemplate = {
  id: "generic-v1",
  name: "General (sin plantilla específica)",
  phases: TOURISM_TEMPLATE.phases.map((p) => ({
    key: p.key,
    title: p.title,
    tasks:
      p.key === "C"
        ? p.tasks.slice(0, 1).filter((t) => !!t)
        : [{ title: "Definir tareas de esta fase", description: "Este rubro todavía no tiene plantilla específica. Agregá las tareas que correspondan.", priority: "medium" as TaskPriority }],
  })),
};

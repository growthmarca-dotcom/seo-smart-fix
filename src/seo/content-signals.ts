/**
 * FASE 5 — Definición explícita de las SEÑALES de contenido y oportunidades.
 *
 * Capa aditiva y declarativa: no reemplaza ni duplica las reglas del motor
 * (src/seo/rules.ts). Cada señal declara su clasificación
 * (problema / mejora / oportunidad), su categoría, su explicación y el criterio
 * exacto con el que se evalúa, para que ningún resultado tenga texto genérico.
 *
 * Estas señales NO participan del scoring: no tocan CATEGORY_WEIGHTS,
 * computeScore ni score.drivers.
 */
import type { Category, Severity } from "./types";

export type ContentClass = "problem" | "improvement" | "opportunity";

export const CONTENT_CLASS_LABELS: Record<ContentClass, string> = {
  problem: "Problema",
  improvement: "Mejora",
  opportunity: "Oportunidad",
};

export interface ContentSignalDef {
  id: string;
  name: string;
  category: Category;
  /** Clasificación por defecto (una señal puede endurecerse a problema con evidencia). */
  classification: ContentClass;
  /** Severidad por defecto; las oportunidades no llevan severidad. */
  severity?: Severity | undefined;
  /** Por qué importa. */
  explanation: string;
  /** Criterio exacto de evaluación (se muestra al usuario). */
  criterion: string;
  /** Datos mínimos necesarios; si no existen, la señal no se evalúa. */
  requiresEvidence: string;
}

export const CONTENT_SIGNALS: ContentSignalDef[] = [
  {
    id: "content-insufficient",
    name: "Contenido potencialmente insuficiente",
    category: "content",
    classification: "improvement",
    severity: "improvement",
    explanation:
      "No existe un mínimo oficial de palabras. Cuando una página cuyo tipo espera contenido propio tiene mucho menos texto que la referencia de su contexto, suele resolver peor la intención de búsqueda frente a resultados más completos.",
    criterion:
      "HTTP 200 y cantidad de palabras por debajo del umbral contextual del perfil de página (Fase 3). Contacto, institucional y páginas sin clasificar no se evalúan porque su umbral es nulo.",
    requiresEvidence: "wordCount y tipo de página con umbral contextual definido.",
  },
  {
    id: "content-structure-weak",
    name: "Estructura de contenido mejorable",
    category: "content",
    classification: "improvement",
    severity: "improvement",
    explanation:
      "Un texto extenso sin subtítulos es más difícil de escanear para las personas y ofrece menos señales de tema y subtemas al buscador.",
    criterion:
      "Página con H1 presente, contenido por encima del umbral contextual y sin ningún H2/H3 detectado. No se evalúa si falta el H1 (eso ya es un hallazgo On-Page).",
    requiresEvidence: "h1, h2, h3 y wordCount capturados por el crawler.",
  },
  {
    id: "content-duplicate-confirmed",
    name: "Contenido duplicado confirmado por el motor",
    category: "content",
    classification: "problem",
    severity: "important",
    explanation:
      "Contenido idéntico entre URLs de la misma auditoría hace que compitan entre sí y el buscador elija una sola versión.",
    criterion:
      "Coincidencia exacta de contentHash entre URLs de la MISMA auditoría, es decir el mismo hecho que ya detectó la regla duplicate-content. La capa de contenido solo lo agrupa e informa.",
    requiresEvidence: "contentHash presente en al menos dos páginas de la auditoría.",
  },
  {
    id: "content-similar-potential",
    name: "Contenido potencialmente similar",
    category: "content",
    classification: "improvement",
    severity: "improvement",
    explanation:
      "Páginas muy parecidas se diferencian mal entre sí: el buscador puede tratarlas como alternativas de lo mismo y repartir señales entre ambas.",
    criterion:
      "Solapamiento léxico (Jaccard sobre palabras significativas) del textSample disponible ≥ 0,60 entre dos URLs de la misma auditoría, con al menos 25 palabras significativas en cada muestra y sin coincidencia exacta de contentHash. No se afirma duplicación ni se calcula un porcentaje de similitud del contenido completo: el crawler solo guarda una muestra.",
    requiresEvidence: "textSample con suficiente contenido en ambas URLs.",
  },
  {
    id: "title-similar-potential",
    name: "Titles muy similares",
    category: "onpage",
    classification: "improvement",
    severity: "improvement",
    explanation:
      "Titles casi iguales no permiten distinguir las páginas en los resultados y suelen indicar que dos URLs apuntan a la misma búsqueda.",
    criterion:
      "Solapamiento léxico ≥ 0,70 entre titles distintos de la misma auditoría. Los titles idénticos quedan fuera: eso ya lo reporta la regla duplicate-title.",
    requiresEvidence: "title presente en ambas URLs.",
  },
  {
    id: "meta-similar-potential",
    name: "Meta descriptions muy similares",
    category: "onpage",
    classification: "improvement",
    severity: "improvement",
    explanation:
      "Descripciones casi iguales generan snippets intercambiables y reducen el CTR de cada resultado.",
    criterion:
      "Solapamiento léxico ≥ 0,70 entre meta descriptions distintas de la misma auditoría. Las idénticas ya las reporta duplicate-meta-description.",
    requiresEvidence: "metaDescription presente en ambas URLs.",
  },
  {
    id: "cannibalization-potential",
    name: "Canibalización potencial",
    category: "content",
    classification: "improvement",
    severity: "improvement",
    explanation:
      "Cuando varias URLs del mismo tipo apuntan al mismo tema, compiten entre sí: conviene diferenciarlas o consolidarlas antes de que el buscador elija por nosotros.",
    criterion:
      "Grupo de 2+ URLs del MISMO tipo de página con al menos dos señales internas coincidentes entre: title similar (≥0,60), H1 similar (≥0,60), contenido similar (≥0,60), slugs de URL emparentados o enlaces internos entre ellas. Nunca se declara canibalización confirmada: no se usa keyword research externo.",
    requiresEvidence: "title o H1 en las URLs comparadas, dentro de la misma auditoría.",
  },
  {
    id: "content-group-potential",
    name: "Grupo potencial de contenido",
    category: "content",
    classification: "opportunity",
    explanation:
      "Un conjunto de URLs emparentadas por estructura y vocabulario puede trabajarse como un tema: diferenciando intenciones y enlazándolas entre sí.",
    criterion:
      "3+ URLs de la misma auditoría que comparten el primer segmento de la ruta y muestran evidencia adicional (vocabulario común en title/H1 o enlaces internos entre ellas). Se presenta como grupo potencial, no como cluster SEO definitivo.",
    requiresEvidence: "rutas con segmento común y title/H1 o enlaces internos.",
  },
  {
    id: "content-thematic-integration",
    name: "Oportunidad de integración temática",
    category: "content",
    classification: "opportunity",
    explanation:
      "La página tiene contenido suficiente para su tipo, pero apenas se la menciona internamente: sumarla a contenidos relacionados mejora su descubrimiento y su contexto temático.",
    criterion:
      "Contenido igual o superior al umbral contextual, estado de conectividad 'linked' (Fase 4) y 1 sola página enlazándola. Las huérfanas y potencialmente huérfanas quedan excluidas para no duplicar el diagnóstico de arquitectura.",
    requiresEvidence: "grafo interno de Fase 4 con enlaces entrantes detectados.",
  },
  {
    id: "content-complementary",
    name: "Contenido complementario recomendable",
    category: "content",
    classification: "opportunity",
    explanation:
      "Una página con contenido correcto pero sin salidas hacia páginas relacionadas cierra el recorrido del usuario y deja el tema aislado.",
    criterion:
      "Contenido igual o superior al umbral contextual, contexto donde sí se espera enlazado saliente y 0 enlaces internos salientes resueltos hacia otras URLs analizadas.",
    requiresEvidence: "internalLinks capturados y grafo de Fase 4.",
  },
  {
    id: "content-differentiation",
    name: "Oportunidad de diferenciación",
    category: "content",
    classification: "opportunity",
    explanation:
      "Páginas muy parecidas dentro de un mismo grupo se benefician de ángulos distintos: usos, público, comparativas o preguntas frecuentes propias.",
    criterion:
      "La URL pertenece a un grupo de canibalización potencial de 2+ URLs. Es una oportunidad, no un problema: no reduce el score.",
    requiresEvidence: "grupo de canibalización potencial detectado en la auditoría.",
  },
];

export function getContentSignal(id: string) {
  return CONTENT_SIGNALS.find((s) => s.id === id);
}

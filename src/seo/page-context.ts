/**
 * FASE 3 — Contexto On-Page por tipo de página (capa derivada, aditiva).
 *
 * No clasifica de nuevo las páginas ni toca el crawler: reutiliza el
 * `pageType` que ya trae cada PageSnapshot (src/seo/html.ts → guessPageType,
 * o el conector de origen). Solo agrega:
 *  - un perfil de expectativas por tipo (qué se espera evaluar en esa página);
 *  - una confianza sobre la clasificación (alta / baja / desconocida);
 *  - qué reglas on-page se aplican y cuáles se omiten por contexto.
 *
 * "Institucional" no existe como PageType en el modelo: no se inventa un
 * sistema paralelo. Las páginas tipo "other" con rutas institucionales
 * (nosotros, about, empresa, faq...) se reconocen como contexto
 * institucional inferido, con confianza baja y criterios conservadores.
 */
import { RULES, rulesForPlatform, type SeoRule } from "./rules";
import type { PageSnapshot, PageType } from "./types";

export type ContextConfidence = "high" | "low" | "unknown";

/** Contexto institucional inferido a partir de la ruta (no cambia el pageType). */
const INSTITUTIONAL_PATH =
  /(nosotros|quienes-somos|quienes_somos|about|empresa|institucional|historia|equipo|team|faq|preguntas|ayuda|help|politica|terminos|privacidad|envios|cambios-y-devoluciones)/i;

export interface PageProfile {
  /** Nombre del contexto mostrado al usuario. */
  label: string;
  /** Qué se espera evaluar en este tipo de página. */
  expectations: string[];
  /**
   * Umbral de palabras a partir del cual el contenido se considera suficiente.
   * `null` = no evaluable por contexto (no se penaliza por cantidad de texto).
   */
  minWords: number | null;
  /** Se espera contenido descriptivo propio (producto, artículo, landing). */
  expectsDescriptiveContent: boolean;
  /** Se esperan imágenes propias del contenido. */
  expectsImages: boolean;
  /** Cantidad mínima razonable de enlaces internos salientes; null = no evaluable. */
  minInternalLinks: number | null;
  /** Nota de contexto mostrada en el detalle de la URL. */
  note: string;
}

/**
 * Perfiles por tipo de página existente en el modelo.
 * "institutional" es un contexto derivado de "other", no un PageType nuevo.
 */
export const PAGE_PROFILES: Record<PageType | "institutional", PageProfile> = {
  home: {
    label: "Home",
    expectations: [
      "Title relevante con marca y propuesta principal",
      "Meta description que resuma la oferta",
      "Un H1 con la propuesta de valor",
      "Enlaces a las secciones importantes del sitio",
      "Estructura clara de encabezados",
    ],
    minWords: 120,
    expectsDescriptiveContent: false,
    expectsImages: false,
    minInternalLinks: 5,
    note: "La home se evalúa como puerta de entrada: claridad, propuesta y enlazado a secciones clave.",
  },
  category: {
    label: "Categoría / listado",
    expectations: [
      "Title específico de la categoría",
      "Meta description propia",
      "H1 que nombre la categoría",
      "Enlaces a productos o subcategorías",
      "Contenido contextual breve cuando corresponda",
    ],
    minWords: 80,
    expectsDescriptiveContent: false,
    expectsImages: false,
    minInternalLinks: 4,
    note: "Un listado no necesita texto extenso, pero sí enlazar su inventario y diferenciarse de otras categorías.",
  },
  product: {
    label: "Producto",
    expectations: [
      "Title específico del producto",
      "Meta description propia",
      "H1 con el nombre del producto",
      "Descripción con información suficiente",
      "Imágenes con ALT descriptivo",
      "Enlaces a productos o categorías relacionadas",
    ],
    minWords: 120,
    expectsDescriptiveContent: true,
    expectsImages: true,
    minInternalLinks: 3,
    note: "La ficha de producto se evalúa por información comercial suficiente, imágenes y enlazado relacionado.",
  },
  article: {
    label: "Artículo / blog",
    expectations: [
      "Title descriptivo del tema",
      "Meta description propia",
      "Un H1 y jerarquía de H2/H3",
      "Contenido suficiente para resolver la intención",
      "Enlaces internos relacionados",
      "Imágenes con ALT",
    ],
    minWords: 300,
    expectsDescriptiveContent: true,
    expectsImages: false,
    minInternalLinks: 2,
    note: "El contenido editorial se evalúa con criterios más exigentes de extensión y estructura.",
  },
  landing: {
    label: "Landing",
    expectations: [
      "Title alineado a la intención de la campaña",
      "Meta description propia",
      "H1 con la propuesta concreta",
      "Contenido suficiente para su objetivo",
      "Enlaces o llamadas a la acción detectables",
    ],
    minWords: 120,
    expectsDescriptiveContent: true,
    expectsImages: false,
    minInternalLinks: 1,
    note: "La landing se evalúa por intención clara y por ofrecer un camino de conversión, no por extensión editorial.",
  },
  contact: {
    label: "Contacto",
    expectations: [
      "Title claro",
      "H1 identificable",
      "Datos de contacto esenciales (NAP)",
      "Indexabilidad correcta",
    ],
    minWords: null,
    expectsDescriptiveContent: false,
    expectsImages: false,
    minInternalLinks: null,
    note: "No se penaliza por tener poco texto: una página de contacto es breve por naturaleza.",
  },
  institutional: {
    label: "Institucional (inferido por la ruta)",
    expectations: [
      "Title claro",
      "Meta description cuando corresponda",
      "H1 identificable",
      "Información esencial y clara",
      "Indexabilidad correcta",
    ],
    minWords: null,
    expectsDescriptiveContent: false,
    expectsImages: false,
    minInternalLinks: null,
    note: "Páginas institucionales o de ayuda: se evalúan title, H1, claridad e indexabilidad, no la extensión.",
  },
  other: {
    label: "Sin clasificar",
    expectations: [
      "Title presente y único",
      "Meta description cuando corresponda",
      "H1 identificable",
      "Indexabilidad correcta",
    ],
    minWords: null,
    expectsDescriptiveContent: false,
    expectsImages: false,
    minInternalLinks: null,
    note: "No se pudo determinar la naturaleza de la página: solo se aplican reglas generales y seguras.",
  },
};

export interface PageContext {
  /** Tipo tal como está guardado en la página (nunca se reescribe). */
  pageType: PageType;
  /** Contexto efectivo usado por las reglas contextuales. */
  contextKey: PageType | "institutional";
  profile: PageProfile;
  confidence: ContextConfidence;
  confidenceLabel: string;
}

const CONFIDENCE_LABELS: Record<ContextConfidence, string> = {
  high: "Clasificación con evidencia en la URL",
  low: "Clasificación inferida, confianza baja",
  unknown: "Naturaleza de la página desconocida",
};

/** Resuelve el contexto de una página SIN modificar su pageType. */
export function resolvePageContext(page: Pick<PageSnapshot, "pageType" | "path" | "url">): PageContext {
  const pageType = page.pageType ?? "other";
  if (pageType !== "other") {
    return {
      pageType,
      contextKey: pageType,
      profile: PAGE_PROFILES[pageType],
      confidence: "high",
      confidenceLabel: CONFIDENCE_LABELS.high,
    };
  }
  const path = page.path || safePath(page.url);
  if (INSTITUTIONAL_PATH.test(path)) {
    return {
      pageType,
      contextKey: "institutional",
      profile: PAGE_PROFILES.institutional,
      confidence: "low",
      confidenceLabel: CONFIDENCE_LABELS.low,
    };
  }
  return {
    pageType,
    contextKey: "other",
    profile: PAGE_PROFILES.other,
    confidence: "unknown",
    confidenceLabel: CONFIDENCE_LABELS.unknown,
  };
}

function safePath(url: string) {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

/** Umbral contextual de palabras (null = no evaluable por contexto). */
export function minWordsFor(page: PageSnapshot) {
  return resolvePageContext(page).profile.minWords;
}

/** true si la regla declara restricciones de tipo de página y la página encaja. */
export function ruleMatchesPageType(rule: SeoRule, page: PageSnapshot) {
  const ctx = resolvePageContext(page);
  const keys: Array<PageType | "institutional"> = [ctx.pageType, ctx.contextKey];
  if (rule.excludedPageTypes?.some((t) => keys.includes(t))) return false;
  if (rule.pageTypes && !rule.pageTypes.some((t) => keys.includes(t))) return false;
  return true;
}

export interface RuleCoverage {
  applied: SeoRule[];
  /** Reglas omitidas porque su contexto no corresponde a este tipo de página. */
  skippedByContext: SeoRule[];
}

/**
 * Reglas evaluadas y omitidas por contexto para una página concreta.
 * Se calcula con las mismas funciones que usa el motor, así que la UI
 * no puede desincronizarse del comportamiento real.
 */
export function ruleCoverageFor(
  page: PageSnapshot,
  platformTags: string[] = [],
  disabledRules: string[] = [],
): RuleCoverage {
  const rules = rulesForPlatform(platformTags).filter((r) => !disabledRules.includes(r.id));
  const applied: SeoRule[] = [];
  const skippedByContext: SeoRule[] = [];
  for (const rule of rules) {
    if (!ruleMatchesPageType(rule, page)) {
      skippedByContext.push(rule);
      continue;
    }
    if (rule.appliesTo && !rule.appliesTo(page)) {
      skippedByContext.push(rule);
      continue;
    }
    applied.push(rule);
  }
  return { applied, skippedByContext };
}

/** Reglas que declaran contexto por tipo de página (para la pantalla de reglas). */
export function contextualRules() {
  return RULES.filter((r) => r.pageTypes || r.excludedPageTypes);
}

export const PAGE_CONTEXT_LABELS: Record<PageType | "institutional", string> = {
  home: PAGE_PROFILES.home.label,
  category: PAGE_PROFILES.category.label,
  product: PAGE_PROFILES.product.label,
  article: PAGE_PROFILES.article.label,
  landing: PAGE_PROFILES.landing.label,
  contact: PAGE_PROFILES.contact.label,
  institutional: PAGE_PROFILES.institutional.label,
  other: PAGE_PROFILES.other.label,
};

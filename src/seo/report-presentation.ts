/**
 * Capa de PRESENTACIÓN del informe (solo lectura).
 *
 * No ejecuta reglas, no rastrea y no recalcula el score. Toma los hallazgos,
 * diagnósticos, grafo de enlaces y oportunidades ya calculados y los prepara
 * para el informe profesional:
 *  - recomendaciones específicas por tipo de problema (con su base: hecho,
 *    inferencia o validación del propietario),
 *  - evidencia asociada a la URL (con aviso explícito si el motor no aporta datos),
 *  - clasificación de páginas sin enlaces entrantes coherente con link-graph,
 *  - agrupación de acciones por causa común (plantillas vacías),
 *  - oportunidades deduplicadas y filtradas por pertinencia.
 */
import type { Diagnostic } from "./diagnostics";
import { getRule } from "./diagnostics";
import type { ContentItem } from "./content-analysis";
import { buildLinkGraph, ORPHAN_STATE_LABELS, type OrphanState } from "./link-graph";
import { resolvePageContext } from "./page-context";
import type { Audit, PageSnapshot } from "./types";

export type RecommendationBasis = "hecho" | "inferencia" | "validacion";

export const RECOMMENDATION_BASIS_LABELS: Record<RecommendationBasis, string> = {
  hecho: "Hecho confirmado",
  inferencia: "Inferencia",
  validacion: "Requiere validación del propietario",
};

export interface ReportRecommendation {
  text: string;
  basis: RecommendationBasis;
}

const BOOKING_OR_CONTACT = /(reserv|booking|contact|consulta|turno)/i;

/** Páginas de reserva/contacto: excluidas de oportunidades genéricas. */
export function isBookingOrContact(page: Pick<PageSnapshot, "path" | "pageType">): boolean {
  return page.pageType === "contact" || BOOKING_OR_CONTACT.test(page.path ?? "");
}

function thinContentAdvice(page?: PageSnapshot): string {
  if (!page) return "Ampliar el contenido con información útil y específica de la página.";
  if (isBookingOrContact(page))
    return "Verificar que la página explique claramente cómo reservar o contactar (datos, condiciones y próximos pasos); no requiere texto extenso.";
  const ctx = resolvePageContext(page);
  switch (ctx.contextKey) {
    case "article":
      return "Si la publicación debe conservarse, desarrollar el tema con contenido propio (subtítulos, ejemplos, información local) o unificarla con otra publicación relacionada.";
    case "product":
      return "Ampliar la descripción con características, usos, materiales y preguntas frecuentes del producto.";
    case "category":
      return "Agregar un texto introductorio que describa el listado y ayude a elegir entre sus elementos.";
    case "home":
      return "Describir en la portada qué ofrece el sitio, para quién y cómo avanzar (servicios, ubicación, contacto o reserva).";
    case "landing":
      return "Explicar la propuesta de la página, sus beneficios y el próximo paso esperado.";
    default:
      return "Ampliar el contenido con información útil y específica del propósito real de la página.";
  }
}

/** Recomendación específica para el informe. null = usar la del motor. */
export function reportRecommendation(
  d: Diagnostic,
  page: PageSnapshot | undefined,
  isTemplate: boolean,
): ReportRecommendation | null {
  if (isTemplate)
    return {
      text: "Si esta página no se utilizará, eliminala o despublicala; si debe conservarse, retirala del sitemap cuando corresponda y evitá mantener una página indexable sin contenido útil.",
      basis: "validacion",
    };
  switch (d.ruleId) {
    case "noindex":
      return {
        text: "Si esta página debe aparecer en los resultados de Google, eliminá la directiva noindex y verificá que el rastreo esté permitido. Confirmá con el propietario si la exclusión es intencional antes de cambiarla.",
        basis: "validacion",
      };
    case "duplicate-title":
      return {
        text: "Redactar un title único para cada URL que describa su contenido real (tema, servicio o lugar). No reutilizar el texto de plantilla ni repetir el mismo title en otras páginas.",
        basis: "hecho",
      };
    case "duplicate-content":
      return {
        text: "Diferenciar el contenido de cada URL o consolidarlas en una sola versión (redirección o canonical hacia la preferida) si cubren el mismo tema.",
        basis: "hecho",
      };
    case "meta-description-missing":
      return {
        text: "Escribir una meta description propia de la página (entre 70 y 160 caracteres) que resuma su contenido y el beneficio para el visitante. No copiar el menú de navegación ni textos genéricos.",
        basis: "hecho",
      };
    case "duplicate-meta-description":
      return {
        text: "Escribir una meta description distinta para cada URL que resuma su contenido específico.",
        basis: "hecho",
      };
    case "title-length": {
      const long = /largo/i.test(d.detected);
      return {
        text: long
          ? "Reescribir el title con 60 caracteres o menos: dejar primero el tema principal y quitar palabras redundantes o el nombre repetido del sitio. No basta con recortarlo con puntos suspensivos."
          : "Ampliar el title para que describa con claridad el tema de la página (idealmente entre 30 y 60 caracteres).",
        basis: "inferencia",
      };
    }
    case "meta-description-length": {
      const short = /corta/i.test(d.detected);
      return {
        text: short
          ? "Ampliar la meta description hasta 70–160 caracteres agregando qué encuentra el visitante en la página y por qué visitarla."
          : "Reescribir la meta description en 160 caracteres o menos, priorizando el mensaje principal al comienzo. No basta con recortarla.",
        basis: "inferencia",
      };
    }
    case "thin-content":
      return { text: thinContentAdvice(page), basis: "inferencia" };
    case "image-filenames":
      return {
        text: "Renombrar las imágenes con nombres que describan su contenido real (qué muestra la foto y, si corresponde, el lugar), en minúsculas, con guiones y sin números de cámara. Hacerlo al subir imágenes nuevas o al actualizar las existentes.",
        basis: "inferencia",
      };
    case "orphan-page":
      return {
        text: "Si la página es relevante, enlazarla desde el menú, la portada o contenidos relacionados. Si no debe existir, retirarla del sitemap. Validar manualmente: el rastreador no ejecuta JavaScript.",
        basis: "inferencia",
      };
    default:
      return null;
  }
}

/** Clasificación de conectividad, igual a la de la pantalla de arquitectura. */
export function orphanStates(audit: Audit): Record<string, OrphanState> {
  const graph = buildLinkGraph(audit);
  const out: Record<string, OrphanState> = {};
  for (const m of graph.pages) out[m.pageId] = m.orphanState;
  return out;
}

export function orphanReportLabel(state: OrphanState | undefined): string {
  if (state === "potentially-orphan") return "Posible página huérfana";
  return state ? ORPHAN_STATE_LABELS[state] : "No evaluable";
}

export const SITEMAP_ONLY_EVIDENCE =
  "URL encontrada en el sitemap; no se encontraron enlaces internos hacia esta página durante el rastreo.";

/** Evidencia de un diagnóstico, siempre asociada a su URL y nunca vacía. */
export function reportEvidence(
  d: Diagnostic,
  audit: Audit,
  orphan?: Record<string, OrphanState>,
): string[] {
  const out: string[] = [];
  const page = audit.pages.find((p) => p.id === d.pageId);
  const pathOf = (u: string) => {
    try {
      return new URL(u).pathname || "/";
    } catch {
      return u;
    }
  };
  if (d.ruleId === "orphan-page") {
    const st = orphan?.[d.pageId];
    if (st === "potentially-orphan") out.push(SITEMAP_ONLY_EVIDENCE);
    else out.push(`${d.current}. Clasificación de arquitectura: ${orphanReportLabel(st)}.`);
    return out;
  }
  if (d.ruleId === "duplicate-title") {
    const others = (d.evidence ?? []).map(pathOf);
    out.push(`Title compartido: "${d.current}"`);
    if (others.length) out.push(`También lo usan: ${others.join(", ")}`);
    return out;
  }
  if (d.ruleId === "duplicate-content") {
    const others = (d.evidence ?? []).map(pathOf);
    out.push(
      `El texto principal es idéntico (misma huella de contenido) al de: ${others.join(", ") || "otras URLs"}`,
    );
    if (page) out.push(`Palabras en esta URL: ${page.wordCount}`);
    return out;
  }
  out.push(...(d.evidence ?? []));
  if (d.current && !out.some((e) => e.includes(d.current))) out.push(`Valor observado: ${d.current}`);
  const rule = getRule(d.ruleId);
  if (rule?.requiresEvidence) out.push(`Criterio: ${rule.requiresEvidence}`);
  if (out.length === 0)
    out.push("El motor no registró evidencia adicional para este hallazgo; requiere revisión manual.");
  return out;
}

export interface TemplateCluster {
  pageIds: string[];
  urls: string[];
  ruleIds: string[];
  ruleNames: string[];
}

/**
 * Publicaciones vacías o de plantilla: páginas con contenido insuficiente que
 * además comparten title o contenido con otras URLs. Solo para presentación.
 */
export function templateCluster(audit: Audit): TemplateCluster | null {
  const byPage = new Map<string, Set<string>>();
  for (const f of audit.findings) {
    if (f.severity === "ok") continue;
    const s = byPage.get(f.pageId) ?? new Set<string>();
    s.add(f.ruleId);
    byPage.set(f.pageId, s);
  }
  const ids = [...byPage.entries()]
    .filter(([, r]) => r.has("thin-content") && (r.has("duplicate-title") || r.has("duplicate-content")))
    .map(([id]) => id);
  if (ids.length < 2) return null;
  const ruleIds = new Set<string>();
  for (const id of ids) for (const r of byPage.get(id)!) ruleIds.add(r);
  const names = new Map<string, string>();
  for (const f of audit.findings) if (ruleIds.has(f.ruleId)) names.set(f.ruleId, f.ruleName);
  return {
    pageIds: ids,
    urls: ids.map((id) => audit.pages.find((p) => p.id === id)?.url ?? id),
    ruleIds: [...ruleIds],
    ruleNames: [...ruleIds].map((r) => names.get(r) ?? r),
  };
}

/** Reglas cuyo hallazgo es un valor compartido entre varias URLs. */
export const SHARED_VALUE_RULES = new Set(["duplicate-title", "duplicate-meta-description"]);

export const TEMPLATE_RECOMMENDATION_TEXT =
  "Si esta página no se utilizará, eliminala o despublicala; si debe conservarse, retirala del sitemap cuando corresponda y evitá mantener una página indexable sin contenido útil.";

export interface SharedValueCluster {
  value: string;
  items: Diagnostic[];
  allTemplate: boolean;
  recommendation: ReportRecommendation;
}

/**
 * Agrupa diagnósticos de valor compartido (title/meta description) por el
 * valor repetido: cada valor y su lista de URLs se muestran una sola vez.
 * Si todas las páginas del grupo son plantillas vacías, la única
 * recomendación es evaluar su retiro (no optimizarlas).
 */
export function sharedValueClusters(
  items: Diagnostic[],
  audit: Audit,
  template: Set<string>,
): SharedValueCluster[] {
  const map = new Map<string, Diagnostic[]>();
  for (const d of items) {
    const list = map.get(d.current) ?? [];
    list.push(d);
    map.set(d.current, list);
  }
  return [...map.entries()].map(([value, list]) => {
    const allTemplate = list.every((d) => template.has(d.pageId));
    const first = list[0]!;
    const page = audit.pages.find((p) => p.id === first.pageId);
    const recommendation = allTemplate
      ? { text: TEMPLATE_RECOMMENDATION_TEXT, basis: "validacion" as const }
      : (reportRecommendation(first, page, false) ?? {
          text: "Redactar un texto único y descriptivo para cada URL.",
          basis: "hecho" as const,
        });
    return { value, items: list, allTemplate, recommendation };
  });
}

export interface OpportunityGroup {
  key: string;
  signalName: string;
  recommendation: string;
  pages: Array<{ pageId: string; path: string }>;
}

/** Agrupa oportunidades con el mismo texto y excluye reserva/contacto. */
export function groupOpportunities(items: ContentItem[]): OpportunityGroup[] {
  const map = new Map<string, OpportunityGroup>();
  for (const o of items) {
    if (isBookingOrContact({ path: o.pagePath, pageType: o.pageType })) continue;
    const key = `${o.signalId}::${o.recommendation}`;
    const g = map.get(key) ?? {
      key,
      signalName: o.signalName,
      recommendation: o.recommendation,
      pages: [],
    };
    g.pages.push({ pageId: o.pageId, path: o.pagePath });
    map.set(key, g);
  }
  return [...map.values()];
}

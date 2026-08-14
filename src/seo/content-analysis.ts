/**
 * FASE 5 — Contenido y oportunidades (capa DERIVADA, solo lectura).
 *
 * No rastrea, no extrae contenido, no ejecuta reglas del motor y no toca el
 * scoring (ni score.total, ni categorías, ni score.drivers). Toma lo que ya
 * está guardado en UNA `Audit` (páginas, hallazgos, score) más las capas
 * derivadas existentes (contexto de Fase 3 y grafo de Fase 4) y produce
 * señales de contenido clasificadas como problema / mejora / oportunidad.
 *
 * AISLAMIENTO: todas las comparaciones (similitud, duplicación, canibalización,
 * grupos) se hacen exclusivamente entre páginas de la misma auditoría, porque
 * la única fuente de datos es la `Audit` recibida.
 */
import { buildLinkGraph, type LinkGraph, type PageLinkMetrics } from "./link-graph";
import { resolvePageContext } from "./page-profiles";
import { CONTENT_SIGNALS, getContentSignal, type ContentClass } from "./content-signals";
import type { Audit, Category, PageSnapshot, PageType, Severity } from "./types";

export * from "./content-signals";

export interface ContentItem {
  key: string;
  auditId: string;
  signalId: string;
  signalName: string;
  classification: ContentClass;
  category: Category;
  severity?: Severity | undefined;
  pageId: string;
  pageUrl: string;
  pagePath: string;
  pageType: PageType;
  contextLabel: string;
  evidence: string[];
  explanation: string;
  criterion: string;
  recommendation: string;
  /** Hallazgo existente (Fase 2.3) del que deriva o con el que se relaciona. */
  relatedFindingId?: string | undefined;
  /** Diagnóstico de arquitectura relacionado, cuando corresponde (Fase 4). */
  architectureNote?: string | undefined;
  /** URLs relacionadas dentro de la MISMA auditoría. */
  relatedUrls?: string[] | undefined;
}

export interface ContentPairGroup {
  auditId: string;
  key: string;
  signalId: string;
  title: string;
  pages: Array<{ pageId: string; path: string; url: string; pageType: PageType }>;
  /** Por qué se agruparon (señales internas coincidentes). */
  reasons: string[];
  confirmed: boolean;
}

export interface ContentAnalysis {
  auditId: string;
  items: ContentItem[];
  problems: ContentItem[];
  improvements: ContentItem[];
  opportunities: ContentItem[];
  duplicateGroups: ContentPairGroup[];
  similarGroups: ContentPairGroup[];
  cannibalizationGroups: ContentPairGroup[];
  contentGroups: ContentPairGroup[];
  stats: {
    pages: number;
    evaluated: number;
    insufficient: number;
    problems: number;
    improvements: number;
    opportunities: number;
    duplicateConfirmed: number;
    potentiallySimilar: number;
    cannibalization: number;
    contentGroups: number;
    similarityAvailable: number;
  };
}

const STOP = new Set(
  ("de la el los las un una y o en para con por a al del que su sus es son the of and to in for" +
    " comprar online tienda shop precio mejor")
    .split(/\s+/),
);

export function significantTokens(text?: string | null): string[] {
  if (!text) return [];
  return [
    ...new Set(
      text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2 && !STOP.has(t)),
    ),
  ];
}

/** Jaccard sobre palabras significativas. Determinista y explicable. */
export function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const inter = a.filter((t) => setB.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union ? Number((inter / union).toFixed(3)) : 0;
}

const SIM_TITLE = 0.7;
const SIM_META = 0.7;
const SIM_CONTENT = 0.6;
const CANNIBAL_SIM = 0.6;
const MIN_SAMPLE_TOKENS = 25;

function firstSegment(path: string) {
  return path.split("/").filter(Boolean)[0] ?? "";
}

function slugTokens(path: string) {
  return significantTokens(path.replace(/[/_-]/g, " "));
}

function findingIdFor(audit: Audit, pageId: string, ruleId: string) {
  return audit.findings.find((f) => f.pageId === pageId && f.ruleId === ruleId)?.id;
}

function itemBase(
  audit: Audit,
  page: PageSnapshot,
  signalId: string,
): Omit<ContentItem, "evidence" | "recommendation"> {
  const signal = getContentSignal(signalId)!;
  const ctx = resolvePageContext(page);
  return {
    key: `${audit.id}:${signalId}:${page.id}`,
    auditId: audit.id,
    signalId,
    signalName: signal.name,
    classification: signal.classification,
    category: signal.category,
    severity: signal.severity,
    pageId: page.id,
    pageUrl: page.url,
    pagePath: page.path,
    pageType: page.pageType,
    contextLabel: ctx.profile.label,
    explanation: signal.explanation,
    criterion: signal.criterion,
  };
}

export function analyzeContent(audit: Audit, graphInput?: LinkGraph): ContentAnalysis {
  const graph = graphInput ?? buildLinkGraph(audit);
  const pages = audit.pages.filter((p) => p.statusCode === 200);
  const items: ContentItem[] = [];

  const tokens = new Map<
    string,
    { title: string[]; h1: string[]; sample: string[]; slug: string[]; meta: string[] }
  >();
  for (const p of pages) {
    tokens.set(p.id, {
      title: significantTokens(p.title),
      h1: significantTokens(p.h1.join(" ")),
      sample: significantTokens(p.textSample),
      slug: slugTokens(p.path),
      meta: significantTokens(p.metaDescription),
    });
  }

  // ---------- Contenido potencialmente insuficiente (contexto de Fase 3) ----------
  let evaluated = 0;
  for (const p of pages) {
    const ctx = resolvePageContext(p);
    const min = ctx.profile.minWords;
    if (min === null) continue; // contacto / institucional / sin clasificar: no se evalúa
    evaluated++;
    if (p.wordCount >= min) continue;
    const severe = p.wordCount < min * 0.4 && ctx.profile.expectsDescriptiveContent;
    const base = itemBase(audit, p, "content-insufficient");
    items.push({
      ...base,
      classification: severe ? "problem" : "improvement",
      severity: severe ? "important" : "improvement",
      evidence: [
        `${p.wordCount} palabras detectadas`,
        `Referencia contextual para ${ctx.profile.label}: ${min} palabras`,
        p.h1.length ? `H1 presente: “${p.h1[0]}”` : "Sin H1 detectado",
        `Encabezados secundarios: ${p.h2.length} H2 / ${p.h3.length} H3`,
        `Confianza de clasificación: ${ctx.confidenceLabel}`,
      ],
      recommendation: ctx.profile.expectsDescriptiveContent
        ? "Ampliar con información propia y verificable del tipo de página (características, usos, materiales, preguntas frecuentes)."
        : "Sumar un bloque breve de contenido contextual propio que diferencie esta página de otras del mismo tipo.",
      relatedFindingId: findingIdFor(audit, p.id, "thin-content"),
    });
  }

  // ---------- Estructura de contenido mejorable ----------
  for (const p of pages) {
    const min = resolvePageContext(p).profile.minWords;
    if (min === null || p.wordCount < min) continue;
    if (!p.h1.length) continue; // falta de H1 = hallazgo On-Page existente
    if (p.h2.length || p.h3.length) continue;
    const base = itemBase(audit, p, "content-structure-weak");
    items.push({
      ...base,
      evidence: [
        `${p.wordCount} palabras sin ningún H2/H3 detectado`,
        `H1: “${p.h1[0]}”`,
      ],
      recommendation:
        "Dividir el texto en secciones con H2 (y H3 si hace falta) que nombren los subtemas reales de la página.",
    });
  }

  // ---------- Duplicación confirmada (mismo hecho que la regla existente) ----------
  const duplicateGroups: ContentPairGroup[] = [];
  const byHash = new Map<string, PageSnapshot[]>();
  for (const p of pages) {
    if (!p.contentHash || p.wordCount < 40) continue;
    const list = byHash.get(p.contentHash) ?? [];
    list.push(p);
    byHash.set(p.contentHash, list);
  }
  const duplicatedIds = new Set<string>();
  for (const [hash, group] of byHash) {
    if (group.length < 2) continue;
    group.forEach((p) => duplicatedIds.add(p.id));
    duplicateGroups.push({
      auditId: audit.id,
      key: `${audit.id}:dup:${hash}`,
      signalId: "content-duplicate-confirmed",
      title: `${group.length} URLs con contenido idéntico`,
      pages: group.map((p) => ({ pageId: p.id, path: p.path, url: p.url, pageType: p.pageType })),
      reasons: ["Coincidencia exacta de la huella de contenido (contentHash) dentro de esta auditoría"],
      confirmed: true,
    });
    for (const p of group) {
      const base = itemBase(audit, p, "content-duplicate-confirmed");
      items.push({
        ...base,
        evidence: [
          `Huella de contenido idéntica a ${group.length - 1} URL(s) de esta auditoría`,
          ...group.filter((o) => o.id !== p.id).map((o) => o.path),
        ],
        recommendation:
          "Diferenciar el texto de cada URL o consolidar con canonical hacia la versión preferida.",
        relatedFindingId: findingIdFor(audit, p.id, "duplicate-content"),
        relatedUrls: group.filter((o) => o.id !== p.id).map((o) => o.url),
      });
    }
  }

  // ---------- Pares potencialmente similares (contenido, title, meta) ----------
  const similarGroups: ContentPairGroup[] = [];
  const cannibalGroups: ContentPairGroup[] = [];
  const similarityAvailable = pages.filter(
    (p) => (tokens.get(p.id)?.sample.length ?? 0) >= MIN_SAMPLE_TOKENS,
  ).length;

  const pairSignals = new Map<string, { reasons: string[]; a: PageSnapshot; b: PageSnapshot }>();

  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const a = pages[i]!;
      const b = pages[j]!;
      const ta = tokens.get(a.id)!;
      const tb = tokens.get(b.id)!;
      const reasons: string[] = [];

      const contentSim =
        ta.sample.length >= MIN_SAMPLE_TOKENS && tb.sample.length >= MIN_SAMPLE_TOKENS
          ? jaccard(ta.sample, tb.sample)
          : null;
      const sameHash = Boolean(a.contentHash && a.contentHash === b.contentHash);

      if (contentSim !== null && contentSim >= SIM_CONTENT && !sameHash) {
        reasons.push(
          `Solapamiento léxico de la muestra de contenido: ${Math.round(contentSim * 100)}% (Jaccard sobre palabras significativas de textSample)`,
        );
        similarGroups.push({
          auditId: audit.id,
          key: `${audit.id}:sim:${a.id}:${b.id}`,
          signalId: "content-similar-potential",
          title: `Contenido potencialmente similar (${Math.round(contentSim * 100)}%)`,
          pages: [a, b].map((p) => ({ pageId: p.id, path: p.path, url: p.url, pageType: p.pageType })),
          reasons: [
            `Solapamiento léxico de la muestra guardada: ${Math.round(contentSim * 100)}%`,
            "La muestra no es el contenido completo: no se afirma duplicación",
          ],
          confirmed: false,
        });
        for (const p of [a, b]) {
          const other = p === a ? b : a;
          const base = itemBase(audit, p, "content-similar-potential");
          items.push({
            ...base,
            key: `${base.key}:${other.id}`,
            evidence: [
              `Muestra de contenido con ${Math.round(contentSim * 100)}% de palabras significativas en común con ${other.path}`,
              "Comparación limitada a la muestra de texto guardada por el crawler",
            ],
            recommendation:
              "Revisar ambas URLs: diferenciar el enfoque o consolidar si cubren exactamente lo mismo.",
            relatedUrls: [other.url],
          });
        }
      }

      const titleSim =
        a.title && b.title && a.title !== b.title ? jaccard(ta.title, tb.title) : null;
      if (titleSim !== null && titleSim >= SIM_TITLE) {
        similarGroups.push({
          auditId: audit.id,
          key: `${audit.id}:simtitle:${a.id}:${b.id}`,
          signalId: "title-similar-potential",
          title: `Titles muy similares (${Math.round(titleSim * 100)}%)`,
          pages: [a, b].map((p) => ({ pageId: p.id, path: p.path, url: p.url, pageType: p.pageType })),
          reasons: [`“${a.title}” vs “${b.title}”`],
          confirmed: false,
        });
        for (const p of [a, b]) {
          const other = p === a ? b : a;
          const base = itemBase(audit, p, "title-similar-potential");
          items.push({
            ...base,
            key: `${base.key}:${other.id}`,
            evidence: [`Este title: “${p.title}”`, `Title de ${other.path}: “${other.title}”`],
            recommendation:
              "Diferenciar el title con el atributo que distingue a esta página (modelo, uso, público, ubicación).",
            relatedUrls: [other.url],
          });
        }
      }

      const metaSim =
        a.metaDescription && b.metaDescription && a.metaDescription !== b.metaDescription
          ? jaccard(ta.meta, tb.meta)
          : null;
      if (metaSim !== null && metaSim >= SIM_META) {
        similarGroups.push({
          auditId: audit.id,
          key: `${audit.id}:simmeta:${a.id}:${b.id}`,
          signalId: "meta-similar-potential",
          title: `Meta descriptions muy similares (${Math.round(metaSim * 100)}%)`,
          pages: [a, b].map((p) => ({ pageId: p.id, path: p.path, url: p.url, pageType: p.pageType })),
          reasons: [`Solapamiento léxico: ${Math.round(metaSim * 100)}%`],
          confirmed: false,
        });
        for (const p of [a, b]) {
          const other = p === a ? b : a;
          const base = itemBase(audit, p, "meta-similar-potential");
          items.push({
            ...base,
            key: `${base.key}:${other.id}`,
            evidence: [
              `Esta description: “${p.metaDescription}”`,
              `Description de ${other.path}: “${other.metaDescription}”`,
            ],
            recommendation: "Escribir una description propia que resuma lo específico de esta URL.",
            relatedUrls: [other.url],
          });
        }
      }

      // ----- Canibalización potencial: 2+ señales internas coincidentes -----
      if (a.pageType === b.pageType && !sameHash) {
        if (titleSim !== null && titleSim >= CANNIBAL_SIM)
          reasons.push(`Titles similares (${Math.round(titleSim * 100)}%)`);
        const h1Sim = ta.h1.length && tb.h1.length ? jaccard(ta.h1, tb.h1) : 0;
        if (h1Sim >= CANNIBAL_SIM) reasons.push(`H1 similares (${Math.round(h1Sim * 100)}%)`);
        const slugSim = jaccard(ta.slug, tb.slug);
        if (slugSim >= 0.5) reasons.push(`Slugs de URL emparentados (${Math.round(slugSim * 100)}%)`);
        const linked =
          graph.edges.some((e) => e.sourcePageId === a.id && e.targetPageId === b.id) ||
          graph.edges.some((e) => e.sourcePageId === b.id && e.targetPageId === a.id);
        if (linked) reasons.push("Existen enlaces internos entre ambas URLs");
        if (reasons.length >= 2) {
          pairSignals.set(`${a.id}:${b.id}`, { reasons, a, b });
        }
      }
    }
  }

  // Agrupar pares de canibalización en componentes conexos.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x);
    if (!p || p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (x: string, y: string) => {
    parent.set(find(x), find(y));
  };
  for (const { a, b } of pairSignals.values()) {
    if (!parent.has(a.id)) parent.set(a.id, a.id);
    if (!parent.has(b.id)) parent.set(b.id, b.id);
    union(a.id, b.id);
  }
  const clusters = new Map<string, { ids: Set<string>; reasons: Set<string> }>();
  for (const { a, b, reasons } of pairSignals.values()) {
    const root = find(a.id);
    const c = clusters.get(root) ?? { ids: new Set<string>(), reasons: new Set<string>() };
    c.ids.add(a.id);
    c.ids.add(b.id);
    reasons.forEach((r) => c.reasons.add(`${a.path} ↔ ${b.path}: ${r}`));
    clusters.set(root, c);
  }
  const cannibalPageIds = new Set<string>();
  for (const [root, c] of clusters) {
    const group = [...c.ids].map((id) => pages.find((p) => p.id === id)!).filter(Boolean);
    if (group.length < 2) continue;
    group.forEach((p) => cannibalPageIds.add(p.id));
    cannibalGroups.push({
      auditId: audit.id,
      key: `${audit.id}:cannibal:${root}`,
      signalId: "cannibalization-potential",
      title: `Canibalización potencial entre ${group.length} URLs de tipo ${group[0]!.pageType}`,
      pages: group.map((p) => ({ pageId: p.id, path: p.path, url: p.url, pageType: p.pageType })),
      reasons: [...c.reasons],
      confirmed: false,
    });
    for (const p of group) {
      const base = itemBase(audit, p, "cannibalization-potential");
      items.push({
        ...base,
        evidence: [
          `Agrupada con ${group.length - 1} URL(s) del mismo tipo de página`,
          ...[...c.reasons].slice(0, 4),
          "Sin keyword research externo: la conclusión es potencial, no confirmada",
        ],
        recommendation:
          "Definir una intención distinta por URL (o consolidar en una sola) y ajustar title, H1 y enlazado interno en consecuencia.",
        relatedUrls: group.filter((o) => o.id !== p.id).map((o) => o.url),
      });
      const diff = itemBase(audit, p, "content-differentiation");
      items.push({
        ...diff,
        evidence: [`Pertenece a un grupo de canibalización potencial de ${group.length} URLs`],
        recommendation:
          "Sumar un ángulo propio (usos, comparativas, público, preguntas frecuentes) que distinga esta URL del resto del grupo.",
        relatedUrls: group.filter((o) => o.id !== p.id).map((o) => o.url),
      });
    }
  }

  // ---------- Grupos potenciales de contenido ----------
  const contentGroups: ContentPairGroup[] = [];
  const bySegment = new Map<string, PageSnapshot[]>();
  for (const p of pages) {
    const seg = firstSegment(p.path);
    if (!seg) continue;
    const list = bySegment.get(seg) ?? [];
    list.push(p);
    bySegment.set(seg, list);
  }
  for (const [seg, group] of bySegment) {
    if (group.length < 3) continue;
    const reasons = [`${group.length} URLs bajo /${seg}`];
    const vocab = new Map<string, number>();
    for (const p of group) {
      for (const t of [...(tokens.get(p.id)?.title ?? []), ...(tokens.get(p.id)?.h1 ?? [])]) {
        vocab.set(t, (vocab.get(t) ?? 0) + 1);
      }
    }
    const shared = [...vocab.entries()]
      .filter(([, n]) => n >= Math.max(2, Math.ceil(group.length / 2)))
      .map(([t]) => t);
    const internalEdges = graph.edges.filter(
      (e) =>
        e.targetPageId &&
        group.some((p) => p.id === e.sourcePageId) &&
        group.some((p) => p.id === e.targetPageId),
    ).length;
    if (shared.length) reasons.push(`Vocabulario común en title/H1: ${shared.slice(0, 6).join(", ")}`);
    if (internalEdges) reasons.push(`${internalEdges} enlaces internos entre las URLs del grupo`);
    if (!shared.length && !internalEdges) continue; // sin evidencia adicional, no se agrupa
    contentGroups.push({
      auditId: audit.id,
      key: `${audit.id}:group:${seg}`,
      signalId: "content-group-potential",
      title: `Grupo potencial de contenido: /${seg}`,
      pages: group.map((p) => ({ pageId: p.id, path: p.path, url: p.url, pageType: p.pageType })),
      reasons,
      confirmed: false,
    });
  }

  // ---------- Oportunidades relacionadas con arquitectura (Fase 4) ----------
  for (const p of pages) {
    const min = resolvePageContext(p).profile.minWords;
    const metrics: PageLinkMetrics | undefined = graph.byPageId[p.id];
    if (!metrics) continue;
    // Contextos sin umbral (contacto, institucional, sin clasificar) no generan
    // oportunidades de contenido: no hay evidencia de que su contenido "alcance".
    if (min === null || p.wordCount < min) continue;

    if (metrics.orphanState === "linked" && metrics.inboundPages <= 1) {
      const base = itemBase(audit, p, "content-thematic-integration");
      items.push({
        ...base,
        evidence: [
          `${p.wordCount} palabras (contenido suficiente para ${base.contextLabel})`,
          `${metrics.inboundPages} página analizada la enlaza (${metrics.inbound} enlaces entrantes)`,
          "Página con baja conectividad interna",
        ],
        recommendation:
          "Enlazarla desde contenidos y categorías del mismo tema con anchor descriptivo.",
        architectureNote:
          "Señal de arquitectura (Fase 4) usada como contexto: el diagnóstico estructural sigue en la vista de arquitectura.",
      });
    }

    if (!metrics.outboundOptional && metrics.outbound === 0) {
      const base = itemBase(audit, p, "content-complementary");
      items.push({
        ...base,
        evidence: [
          `${p.wordCount} palabras (contenido suficiente para ${base.contextLabel})`,
          "0 enlaces internos salientes hacia otras URLs analizadas",
        ],
        recommendation:
          "Agregar referencias a páginas relacionadas del mismo tema (productos, categorías o artículos complementarios).",
        architectureNote:
          "Complementa el análisis de arquitectura: aquí se evalúa el contenido, no la estructura del sitio.",
      });
    }
  }

  const problems = items.filter((i) => i.classification === "problem");
  const improvements = items.filter((i) => i.classification === "improvement");
  const opportunities = items.filter((i) => i.classification === "opportunity");

  return {
    auditId: audit.id,
    items,
    problems,
    improvements,
    opportunities,
    duplicateGroups,
    similarGroups,
    cannibalizationGroups: cannibalGroups,
    contentGroups,
    stats: {
      pages: audit.pages.length,
      evaluated,
      insufficient: items.filter((i) => i.signalId === "content-insufficient").length,
      problems: problems.length,
      improvements: improvements.length,
      opportunities: opportunities.length,
      duplicateConfirmed: duplicatedIds.size,
      potentiallySimilar: similarGroups.filter((g) => g.signalId === "content-similar-potential").length,
      cannibalization: cannibalPageIds.size,
      contentGroups: contentGroups.length,
      similarityAvailable,
    },
  };
}

export const CONTENT_SIGNAL_IDS = CONTENT_SIGNALS.map((s) => s.id);

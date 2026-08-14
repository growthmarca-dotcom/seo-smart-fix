/**
 * FASE 4 — Grafo de enlazado interno y arquitectura (capa DERIVADA, solo lectura).
 *
 * No rastrea, no extrae enlaces, no toca robots.txt, sitemap, profundidad ni
 * el scoring. Toma exclusivamente lo que el crawler ya guardó en la auditoría
 * (`page.internalLinks`, `page.depth`, `page.discoveredVia`, `coverage`) y
 * deriva de forma determinista un grafo interno y sus métricas.
 *
 * Todo queda atado al `auditId` porque el grafo se construye siempre a partir
 * de una `Audit` concreta: no existe estado compartido entre auditorías.
 */
import { resolvePageContext } from "./page-profiles";
import type { Audit, PageSnapshot, PageType } from "./types";

/** Relación interna detectada por el crawler: origen → destino. */
export interface LinkEdge {
  auditId: string;
  sourcePageId: string;
  sourceUrl: string;
  /** Presente solo si el destino es una página analizada de esta auditoría. */
  targetPageId?: string | undefined;
  /** URL normalizada del destino (misma normalización determinista para todos). */
  targetKey: string;
  targetUrl: string;
  anchor: string;
  sourceDepth: number;
  targetDepth?: number | undefined;
}

/** Clasificación explícita y determinista de conectividad entrante. */
export type OrphanState =
  | "linked"
  | "orphan"
  | "potentially-orphan"
  | "no-inbound-detected"
  | "not-applicable";

export const ORPHAN_STATE_LABELS: Record<OrphanState, string> = {
  linked: "Con enlaces internos entrantes",
  orphan: "Huérfana",
  "potentially-orphan": "Potencialmente huérfana",
  "no-inbound-detected": "Sin enlaces internos entrantes detectados",
  "not-applicable": "No evaluable",
};

export const ORPHAN_STATE_NOTES: Record<OrphanState, string> = {
  linked: "Al menos una página analizada de esta auditoría enlaza a esta URL.",
  orphan:
    "URL analizada (HTTP < 300), fuera de la raíz, sin ningún enlace interno entrante detectado y con rastreo completo: ninguna otra evidencia explica la ausencia de enlaces.",
  "potentially-orphan":
    "Sin enlaces internos entrantes detectados, pero fue descubierta por sitemap.xml: existe otra vía de descubrimiento, así que la conclusión es una inferencia, no un hecho.",
  "no-inbound-detected":
    "Sin enlaces entrantes detectados, pero el rastreo quedó incompleto (límite alcanzado o URLs pendientes/bloqueadas): los datos no alcanzan para clasificarla como huérfana.",
  "not-applicable":
    "No se evalúa: es la URL raíz/semilla, no respondió 200-299, o la auditoría tiene una sola página.",
};

/** Métricas de arquitectura de una página, derivadas del grafo. */
export interface PageLinkMetrics {
  auditId: string;
  pageId: string;
  url: string;
  path: string;
  pageType: PageType;
  contextLabel: string;
  depth: number;
  /** Enlaces internos entrantes detectados (relaciones únicas origen→destino). */
  inbound: number;
  /** Páginas únicas distintas que enlazan a esta URL. */
  inboundPages: number;
  /** Enlaces internos salientes hacia URLs de la auditoría (relaciones únicas). */
  outbound: number;
  /** Enlaces internos salientes a URLs internas no analizadas (fuera del límite, etc.). */
  outboundUnresolved: number;
  discoveredVia: string;
  fromSitemap: boolean;
  fromInternalLink: boolean;
  fromBoth: boolean;
  orphanState: OrphanState;
  /** Anchors entrantes disponibles (vacío si el crawler no capturó anchors). */
  inboundAnchors: string[];
  /** true cuando la profundidad supera el umbral derivado del propio sitio. */
  deep: boolean;
  /** Contexto donde no se espera enlazado saliente (contacto / institucional). */
  outboundOptional: boolean;
}

export interface DepthThreshold {
  /** Umbral aplicado (derivado del sitio, nunca un valor universal rígido). */
  value: number;
  max: number;
  /** Percentil 90 de la distribución de profundidad del sitio. */
  p90: number;
  criterion: string;
}

export interface LinkGraph {
  auditId: string;
  edges: LinkEdge[];
  pages: PageLinkMetrics[];
  byPageId: Record<string, PageLinkMetrics>;
  depthThreshold: DepthThreshold;
  /** El rastreo cubrió todo lo descubierto (sin pendientes, bloqueadas ni límite). */
  crawlComplete: boolean;
  hasAnchorData: boolean;
  stats: {
    pages: number;
    edges: number;
    avgInbound: number;
    avgOutbound: number;
    maxDepth: number;
    withoutInbound: number;
    orphans: number;
    potentialOrphans: number;
    undetermined: number;
    lowInbound: number;
    withoutOutbound: number;
    deepPages: number;
    /** Enlaces internos que apuntan a URLs internas no analizadas. */
    unresolved: number;
  };
}

/**
 * Normalización determinista SOLO para comparar destinos del grafo.
 * No reemplaza ni modifica la normalización del crawler: quita el fragmento,
 * unifica la barra final, respeta host y query tal como los guardó el crawler.
 */
export function graphKey(rawUrl: string, base?: string): string | null {
  try {
    const u = new URL(rawUrl, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    u.hostname = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.hostname}${path}${u.search}`;
  } catch {
    return null;
  }
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : ((s[mid - 1]! + s[mid]!) / 2);
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx]!;
}

const OUTBOUND_OPTIONAL = new Set(["contact", "institutional"]);

/**
 * Umbral de profundidad DERIVADO del propio sitio (no universal):
 * percentil 90 de la distribución, con piso 3 (nada por encima del tercer
 * nivel se marca en sitios planos) y techo en la profundidad máxima real.
 */
export function deriveDepthThreshold(depths: number[]): DepthThreshold {
  const max = depths.length ? Math.max(...depths) : 0;
  const p90 = percentile(depths, 90);
  const value = Math.max(3, Math.min(p90, max));
  return {
    value,
    max,
    p90,
    criterion:
      "Umbral derivado del propio sitio: percentil 90 de la profundidad de sus URLs, con mínimo 3 clics. Los sitios planos no generan hallazgos de profundidad.",
  };
}

/** Construye el grafo interno derivado de una auditoría concreta. */
export function buildLinkGraph(audit: Audit): LinkGraph {
  const pages = audit.pages;
  const keyToPage = new Map<string, PageSnapshot>();
  for (const p of pages) {
    const k = graphKey(p.url);
    if (k && !keyToPage.has(k)) keyToPage.set(k, p);
  }

  const edges: LinkEdge[] = [];
  const seen = new Set<string>();
  const inbound = new Map<string, LinkEdge[]>();
  const outboundCount = new Map<string, number>();
  const unresolvedCount = new Map<string, number>();

  for (const source of pages) {
    for (const link of source.internalLinks ?? []) {
      const key = graphKey(link.href, source.url);
      if (!key) continue;
      const sourceKey = graphKey(source.url);
      // Excluir externos: el destino debe pertenecer al host de la auditoría.
      const rootKey = graphKey(audit.rootUrl);
      const host = key.split("/")[0];
      const rootHost = rootKey?.split("/")[0];
      if (rootHost && host !== rootHost) continue;
      if (key === sourceKey) continue; // autoenlace / fragmento de la misma página
      const dedupe = `${source.id}→${key}`;
      if (seen.has(dedupe)) continue; // no duplicar relaciones idénticas
      seen.add(dedupe);

      const target = keyToPage.get(key);
      const edge: LinkEdge = {
        auditId: audit.id,
        sourcePageId: source.id,
        sourceUrl: source.url,
        targetPageId: target?.id,
        targetKey: key,
        targetUrl: target?.url ?? link.href,
        anchor: (link.anchor ?? "").trim(),
        sourceDepth: source.depth,
        targetDepth: target?.depth,
      };
      edges.push(edge);
      if (target) {
        const list = inbound.get(target.id);
        if (list) list.push(edge);
        else inbound.set(target.id, [edge]);
        outboundCount.set(source.id, (outboundCount.get(source.id) ?? 0) + 1);
      } else {
        unresolvedCount.set(source.id, (unresolvedCount.get(source.id) ?? 0) + 1);
      }
    }
  }

  const cov = audit.coverage;
  // El rastreo se considera completo solo si no quedaron URLs pendientes,
  // bloqueadas ni límites alcanzados, y si todos los enlaces internos
  // detectados apuntan a páginas efectivamente analizadas.
  const crawlComplete =
    edgesResolvable(unresolvedCount) &&
    (!cov || (!cov.limitReached && (cov.pending ?? 0) === 0 && (cov.blocked ?? 0) === 0));

  const depthThreshold = deriveDepthThreshold(pages.map((p) => p.depth));
  const inboundCounts = pages.map((p) => inbound.get(p.id)?.length ?? 0);
  const lowInboundCutoff = Math.max(1, Math.min(2, Math.round(median(inboundCounts) / 2)));

  const metrics: PageLinkMetrics[] = pages.map((p) => {
    const list = inbound.get(p.id) ?? [];
    const uniqueSources = new Set(list.map((e) => e.sourcePageId));
    const ctx = resolvePageContext(p);
    const fromSitemap = p.discoveredVia === "sitemap" || p.discoveredVia === "both";
    const fromInternalLink = p.discoveredVia === "internal-link" || p.discoveredVia === "both";
    return {
      auditId: audit.id,
      pageId: p.id,
      url: p.url,
      path: p.path,
      pageType: p.pageType,
      contextLabel: ctx.profile.label,
      depth: p.depth,
      inbound: list.length,
      inboundPages: uniqueSources.size,
      outbound: outboundCount.get(p.id) ?? 0,
      outboundUnresolved: unresolvedCount.get(p.id) ?? 0,
      discoveredVia: p.discoveredVia ?? "—",
      fromSitemap,
      fromInternalLink,
      fromBoth: p.discoveredVia === "both",
      orphanState: classifyOrphan({
        page: p,
        inbound: list.length,
        totalPages: pages.length,
        crawlComplete,
        fromSitemap,
      }),
      inboundAnchors: list.map((e) => e.anchor).filter((a) => a.length > 0),
      deep: p.depth > depthThreshold.value,
      outboundOptional: OUTBOUND_OPTIONAL.has(ctx.contextKey),
    };
  });

  const byPageId: Record<string, PageLinkMetrics> = {};
  for (const m of metrics) byPageId[m.pageId] = m;

  const hasAnchorData = edges.some((e) => e.anchor.length > 0);
  const withoutInbound = metrics.filter(
    (m) => m.inbound === 0 && m.orphanState !== "not-applicable",
  );

  return {
    auditId: audit.id,
    edges,
    pages: metrics,
    byPageId,
    depthThreshold,
    crawlComplete,
    hasAnchorData,
    stats: {
      pages: metrics.length,
      edges: edges.length,
      avgInbound: metrics.length
        ? Math.round((metrics.reduce((s, m) => s + m.inbound, 0) / metrics.length) * 10) / 10
        : 0,
      avgOutbound: metrics.length
        ? Math.round((metrics.reduce((s, m) => s + m.outbound, 0) / metrics.length) * 10) / 10
        : 0,
      maxDepth: depthThreshold.max,
      withoutInbound: withoutInbound.length,
      orphans: metrics.filter((m) => m.orphanState === "orphan").length,
      potentialOrphans: metrics.filter((m) => m.orphanState === "potentially-orphan").length,
      undetermined: metrics.filter((m) => m.orphanState === "no-inbound-detected").length,
      lowInbound: metrics.filter(
        (m) => m.inbound > 0 && m.inbound <= lowInboundCutoff && m.depth > 0,
      ).length,
      withoutOutbound: metrics.filter((m) => m.outbound === 0 && !m.outboundOptional).length,
      deepPages: metrics.filter((m) => m.deep).length,
      unresolved: [...unresolvedCount.values()].reduce((s, n) => s + n, 0),
    },
  };
}

function edgesResolvable(unresolved: Map<string, number>) {
  return [...unresolved.values()].reduce((s, n) => s + n, 0) === 0;
}

/**
 * Definición explícita de huérfana. Requiere que la URL pertenezca a la
 * auditoría, sea una URL analizada válida, no tenga enlaces entrantes y que
 * NINGUNA otra evidencia (sitemap, rastreo incompleto, raíz) explique el caso.
 */
function classifyOrphan(args: {
  page: PageSnapshot;
  inbound: number;
  totalPages: number;
  crawlComplete: boolean;
  fromSitemap: boolean;
}): OrphanState {
  const { page, inbound, totalPages, crawlComplete, fromSitemap } = args;
  if (totalPages < 2) return "not-applicable";
  if (page.depth === 0 || page.discoveredVia === "seed") return "not-applicable";
  if (page.statusCode < 200 || page.statusCode >= 300) return "not-applicable";
  if (inbound > 0) return "linked";
  if (!crawlComplete) return "no-inbound-detected";
  if (fromSitemap) return "potentially-orphan";
  return "orphan";
}

/** Anchors internos analizados. Vacío si el crawler no capturó anchor text. */
export interface AnchorAnalysis {
  available: boolean;
  total: number;
  empty: number;
  generic: Array<{ anchor: string; count: number }>;
  repeated: Array<{ anchor: string; targets: number; count: number }>;
  descriptive: number;
}

const GENERIC_ANCHOR =
  /^(ver m[aá]s|ver|click aqu[ií]|clic aqu[ií]|aqu[ií]|leer m[aá]s|m[aá]s info(rmaci[oó]n)?|link|enlace|aqu[ií] mismo|seguir leyendo|comprar)$/i;

export function analyzeAnchors(graph: LinkGraph): AnchorAnalysis {
  const edges = graph.edges;
  if (edges.length === 0) {
    return { available: false, total: 0, empty: 0, generic: [], repeated: [], descriptive: 0 };
  }
  const empty = edges.filter((e) => e.anchor.length === 0).length;
  const generic = new Map<string, number>();
  const byAnchor = new Map<string, Set<string>>();
  let descriptive = 0;
  for (const e of edges) {
    if (!e.anchor) continue;
    const key = e.anchor.toLowerCase();
    if (GENERIC_ANCHOR.test(e.anchor)) generic.set(key, (generic.get(key) ?? 0) + 1);
    else descriptive += 1;
    const set = byAnchor.get(key) ?? new Set<string>();
    set.add(e.targetKey);
    byAnchor.set(key, set);
  }
  const repeated = [...byAnchor.entries()]
    .filter(([, targets]) => targets.size > 1)
    .map(([anchor, targets]) => ({ anchor, targets: targets.size, count: targets.size }))
    .sort((a, b) => b.targets - a.targets)
    .slice(0, 10);
  return {
    available: graph.hasAnchorData || empty > 0,
    total: edges.length,
    empty,
    generic: [...generic.entries()]
      .map(([anchor, count]) => ({ anchor, count }))
      .sort((a, b) => b.count - a.count),
    repeated,
    descriptive,
  };
}

/** Grupo de páginas con el mismo patrón de arquitectura. */
export interface ArchitectureGroup {
  id: string;
  title: string;
  explanation: string;
  recommendation: string;
  /** Regla existente relacionada, si la hay (para "Ver regla"). */
  ruleId?: string | undefined;
  /** true cuando el grupo es una inferencia y no un hecho verificado. */
  inference: boolean;
  pages: PageLinkMetrics[];
}

/** Agrupa los patrones de arquitectura de una auditoría (solo con evidencia). */
export function architectureGroups(graph: LinkGraph): ArchitectureGroup[] {
  const groups: ArchitectureGroup[] = [];
  const push = (g: ArchitectureGroup) => {
    if (g.pages.length > 0) groups.push(g);
  };

  push({
    id: "orphan",
    title: "Páginas huérfanas",
    explanation:
      "Ninguna página analizada de esta auditoría enlaza a estas URLs y el rastreo se completó sin límites ni bloqueos, así que la ausencia de enlaces internos no se explica por falta de datos.",
    recommendation:
      "Enlazarlas desde su categoría, el menú o contenidos relacionados para que el rastreo pueda alcanzarlas por enlaces.",
    ruleId: "orphan-page",
    inference: false,
    pages: graph.pages.filter((p) => p.orphanState === "orphan"),
  });

  push({
    id: "potentially-orphan",
    title: "Páginas potencialmente huérfanas",
    explanation:
      "Sin enlaces internos entrantes detectados, pero descubiertas por sitemap.xml: dependen de esa vía de descubrimiento. Es una inferencia, no un hecho.",
    recommendation:
      "Revisar si deberían estar enlazadas desde alguna sección y agregar un enlace interno contextual.",
    ruleId: "orphan-page",
    inference: true,
    pages: graph.pages.filter((p) => p.orphanState === "potentially-orphan"),
  });

  push({
    id: "no-inbound-detected",
    title: "Sin enlaces internos entrantes detectados",
    explanation:
      "No se detectaron enlaces entrantes, pero el rastreo quedó incompleto (límite alcanzado, URLs pendientes o bloqueadas). Los datos no alcanzan para afirmar que sean huérfanas.",
    recommendation:
      "Ampliar el límite de rastreo y volver a auditar para confirmar si realmente no reciben enlaces internos.",
    inference: true,
    pages: graph.pages.filter((p) => p.orphanState === "no-inbound-detected"),
  });

  push({
    id: "low-inbound",
    title: "Baja conectividad interna",
    explanation:
      "Reciben muy pocos enlaces internos entrantes en comparación con el resto del sitio analizado.",
    recommendation:
      "Podrían beneficiarse de más enlaces internos desde páginas relacionadas del mismo tema.",
    inference: false,
    pages: graph.pages.filter((p) => p.inbound > 0 && p.inbound <= 1 && p.depth > 0),
  });

  push({
    id: "deep",
    title: `Páginas profundas (más de ${graph.depthThreshold.value} clics)`,
    explanation: `Profundidad calculada por el crawler. El umbral (${graph.depthThreshold.value}) se deriva del propio sitio: ${graph.depthThreshold.criterion}`,
    recommendation:
      "Acortar el camino enlazándolas desde una categoría principal, el menú o la home cuando corresponda.",
    ruleId: "deep-page",
    inference: false,
    pages: graph.pages.filter((p) => p.deep),
  });

  push({
    id: "no-outbound",
    title: "Páginas sin enlaces internos salientes",
    explanation:
      "No enlazan a ninguna otra URL analizada del sitio, por lo que cortan el recorrido del rastreo. Contacto e institucionales quedan excluidas por contexto.",
    recommendation:
      "Agregar enlaces contextuales a secciones relacionadas del sitio cuando existan.",
    ruleId: "internal-links-few",
    inference: false,
    pages: graph.pages.filter((p) => p.outbound === 0 && !p.outboundOptional),
  });

  return groups;
}

/** Distribución de páginas y conectividad por profundidad. */
export function depthDistribution(graph: LinkGraph) {
  const map = new Map<number, { depth: number; pages: number; inbound: number; outbound: number }>();
  for (const p of graph.pages) {
    const row = map.get(p.depth) ?? { depth: p.depth, pages: 0, inbound: 0, outbound: 0 };
    row.pages += 1;
    row.inbound += p.inbound;
    row.outbound += p.outbound;
    map.set(p.depth, row);
  }
  return [...map.values()].sort((a, b) => a.depth - b.depth);
}

/** Distribución de conectividad por tipo de página (contexto de Fase 3). */
export function typeDistribution(graph: LinkGraph) {
  const map = new Map<
    string,
    { label: string; pages: number; inbound: number; outbound: number; withoutInbound: number }
  >();
  for (const p of graph.pages) {
    const row =
      map.get(p.contextLabel) ??
      { label: p.contextLabel, pages: 0, inbound: 0, outbound: 0, withoutInbound: 0 };
    row.pages += 1;
    row.inbound += p.inbound;
    row.outbound += p.outbound;
    if (p.inbound === 0) row.withoutInbound += 1;
    map.set(p.contextLabel, row);
  }
  return [...map.values()].sort((a, b) => b.pages - a.pages);
}

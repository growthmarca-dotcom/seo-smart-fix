/**
 * FASE 4 — UI del grafo interno (solo lectura sobre src/seo/link-graph.ts).
 * No recalcula enlaces, profundidad ni score: muestra datos derivados.
 */
import { Link } from "@tanstack/react-router";
import {
  ORPHAN_STATE_LABELS,
  ORPHAN_STATE_NOTES,
  buildLinkGraph,
  type ArchitectureGroup,
  type LinkGraph,
  type PageLinkMetrics,
} from "@/seo/link-graph";
import type { Audit, PageSnapshot } from "@/seo/types";

export function OrphanBadge({ state }: { state: PageLinkMetrics["orphanState"] }) {
  const tone =
    state === "orphan"
      ? "border-critical/40 text-critical"
      : state === "potentially-orphan"
        ? "border-border text-foreground"
        : "border-border text-muted-foreground";
  return (
    <span
      title={ORPHAN_STATE_NOTES[state]}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {ORPHAN_STATE_LABELS[state]}
    </span>
  );
}

/** Tabla de URLs de un grupo de arquitectura. */
export function ArchitectureGroupCard({
  audit,
  group,
}: {
  audit: Audit;
  group: ArchitectureGroup;
}) {
  return (
    <article className="panel p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-sm font-semibold">
          {group.title} — {group.pages.length} URL{group.pages.length === 1 ? "" : "s"}
        </h3>
        {group.inference && (
          <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            Inferencia
          </span>
        )}
        {group.ruleId && (
          <Link
            to="/rules"
            search={{ rule: group.ruleId }}
            className="ml-auto text-xs text-muted-foreground underline"
          >
            Ver regla
          </Link>
        )}
      </header>
      <p className="mt-2 text-xs text-muted-foreground">{group.explanation}</p>
      <p className="mt-1 text-xs">
        <span className="font-medium">Recomendación:</span>{" "}
        <span className="text-muted-foreground">{group.recommendation}</span>
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">URL</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Prof.</th>
              <th className="px-3 py-2 font-medium">Origen</th>
              <th className="px-3 py-2 font-medium">Entrantes</th>
              <th className="px-3 py-2 font-medium">Salientes</th>
              <th className="px-3 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {group.pages.map((p) => (
              <tr key={p.pageId}>
                <td className="px-3 py-2">
                  <Link
                    to="/audits/$auditId/url/$pageId"
                    params={{ auditId: audit.id, pageId: p.pageId }}
                    className="font-mono text-[12px] underline"
                  >
                    {p.path || "/"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{p.contextLabel}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.depth}</td>
                <td className="px-3 py-2 text-muted-foreground">{discoveryLabel(p)}</td>
                <td className="px-3 py-2 font-semibold">{p.inbound}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.outbound}</td>
                <td className="px-3 py-2">
                  <OrphanBadge state={p.orphanState} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function discoveryLabel(p: Pick<PageLinkMetrics, "discoveredVia">) {
  switch (p.discoveredVia) {
    case "seed":
      return "URL raíz";
    case "sitemap":
      return "sitemap.xml";
    case "internal-link":
      return "Enlace interno";
    case "both":
      return "Sitemap + enlace";
    default:
      return "—";
  }
}

/** Panel de enlazado interno de una URL concreta (detalle de página). */
export function PageLinksPanel({ audit, page }: { audit: Audit; page: PageSnapshot }) {
  const graph: LinkGraph = buildLinkGraph(audit);
  const m = graph.byPageId[page.id];
  if (!m) return null;
  const inboundEdges = graph.edges.filter((e) => e.targetPageId === page.id).slice(0, 8);

  return (
    <section className="panel p-5">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-base font-semibold">Enlazado interno de esta URL</h2>
        <OrphanBadge state={m.orphanState} />
        <Link
          to="/audits/$auditId/architecture"
          params={{ auditId: audit.id }}
          className="ml-auto text-xs text-muted-foreground underline"
        >
          Ver arquitectura
        </Link>
      </header>
      <p className="mt-2 text-xs text-muted-foreground">{ORPHAN_STATE_NOTES[m.orphanState]}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Stat label="Enlaces entrantes" value={m.inbound} />
        <Stat label="Páginas que enlazan" value={m.inboundPages} />
        <Stat label="Enlaces salientes" value={m.outbound} />
        <Stat label="Profundidad" value={m.depth} />
      </dl>
      {m.outboundUnresolved > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {m.outboundUnresolved} enlace(s) saliente(s) apuntan a URLs internas que no se analizaron
          en esta auditoría.
        </p>
      )}
      {inboundEdges.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Enlaces entrantes detectados
          </h3>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {inboundEdges.map((e) => (
              <li key={`${e.sourcePageId}-${e.targetKey}`} className="truncate">
                · <span className="font-mono">{new URL(e.sourceUrl).pathname}</span> —{" "}
                {e.anchor ? `“${e.anchor}”` : "(sin anchor)"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-2">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-semibold">{value}</dd>
    </div>
  );
}

/**
 * FASE 4 — Vista "Arquitectura y enlazado interno".
 * Solo lee el grafo derivado (src/seo/link-graph.ts) de UNA auditoría:
 * no rastrea, no modifica profundidad, hallazgos ni score.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { DemoBadge, EmptyState, StatCard } from "@/components/seo-ui";
import { ArchitectureGroupCard, Stat, discoveryLabel, OrphanBadge } from "@/components/link-graph-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  analyzeAnchors,
  architectureGroups,
  buildLinkGraph,
  depthDistribution,
  typeDistribution,
} from "@/seo/link-graph";
import { useAppState } from "@/store/app-store";

export const Route = createFileRoute("/audits/$auditId/architecture")({
  head: () => ({
    meta: [
      { title: "Arquitectura y enlazado interno — SEO Fixer" },
      {
        name: "description",
        content:
          "Grafo interno derivado del rastreo: enlaces entrantes y salientes, profundidad, páginas huérfanas y conectividad por tipo de página.",
      },
      { property: "og:title", content: "Arquitectura y enlazado interno — SEO Fixer" },
      {
        property: "og:description",
        content: "Conectividad interna, profundidad y páginas potencialmente huérfanas por auditoría.",
      },
    ],
  }),
  component: Architecture,
});

function Architecture() {
  const { auditId } = Route.useParams();
  const audit = useAppState((s) => s.audits.find((a) => a.id === auditId));
  const [view, setView] = useState<"groups" | "depth" | "type" | "pages">("groups");
  const [query, setQuery] = useState("");

  const graph = useMemo(() => (audit ? buildLinkGraph(audit) : null), [audit]);
  const groups = useMemo(() => (graph ? architectureGroups(graph) : []), [graph]);
  const anchors = useMemo(() => (graph ? analyzeAnchors(graph) : null), [graph]);

  if (!audit || !graph) {
    return (
      <EmptyState
        title="Auditoría no encontrada"
        description="La auditoría solicitada no existe o fue eliminada."
      />
    );
  }

  const s = graph.stats;
  const pages = graph.pages.filter((p) =>
    query.trim() ? p.url.toLowerCase().includes(query.toLowerCase()) : true,
  );

  return (
    <>
      <PageHeader
        title="Arquitectura y enlazado interno"
        description={`Grafo derivado del rastreo de ${audit.name}: ${s.pages} URLs analizadas y ${s.edges} relaciones internas únicas. Solo enlaces internos detectados por el crawler; los externos quedan fuera.`}
      >
        <div className="flex items-center gap-2">
          {audit.isDemo && <DemoBadge />}
          <Link
            to="/audits/$auditId"
            params={{ auditId: audit.id }}
            className="text-xs text-muted-foreground underline"
          >
            Volver a resultados
          </Link>
        </div>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="URLs analizadas" value={s.pages} hint="Solo de esta auditoría" />
        <StatCard label="Relaciones internas" value={s.edges} hint="Origen → destino, sin duplicar" />
        <StatCard
          label="Enlaces entrantes (prom.)"
          value={s.avgInbound}
          hint={`Salientes prom.: ${s.avgOutbound}`}
        />
        <StatCard
          label="Profundidad máxima"
          value={s.maxDepth}
          hint={`Umbral derivado: ${graph.depthThreshold.value} clics`}
        />
      </div>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-base font-semibold">Resumen de conectividad</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {graph.crawlComplete
            ? "El rastreo cubrió todo lo descubierto: la ausencia de enlaces entrantes puede afirmarse sobre las URLs analizadas."
            : "El rastreo quedó incompleto (límite, pendientes o bloqueadas): las URLs sin enlaces entrantes no se declaran huérfanas."}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Sin entrantes" value={s.withoutInbound} />
          <Stat label="Huérfanas" value={s.orphans} />
          <Stat label="Potencialmente huérfanas" value={s.potentialOrphans} />
          <Stat label="Sin evidencia suficiente" value={s.undetermined} />
          <Stat label="Baja conectividad" value={s.lowInbound} />
          <Stat label="Sin salientes" value={s.withoutOutbound} />
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Umbral de profundidad: {graph.depthThreshold.criterion} (p90 = {graph.depthThreshold.p90}).
        </p>
      </section>

      {anchors?.available && (
        <section className="panel mt-4 p-5">
          <h2 className="font-display text-base font-semibold">Anchor text interno</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo se analizan los anchors que el crawler capturó. {anchors.total} enlaces internos,{" "}
            {anchors.descriptive} con texto descriptivo.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <Stat label="Anchors vacíos" value={anchors.empty} />
            <Stat label="Anchors genéricos" value={anchors.generic.length} />
            <Stat label="Anchors repetidos" value={anchors.repeated.length} />
            <Stat label="Descriptivos" value={anchors.descriptive} />
          </dl>
          {anchors.generic.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-xs text-muted-foreground">
              {anchors.generic.slice(0, 6).map((g) => (
                <li key={g.anchor}>
                  · “{g.anchor}” — {g.count} enlace(s) sin describir el destino
                </li>
              ))}
            </ul>
          )}
          {anchors.repeated.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {anchors.repeated.slice(0, 6).map((r) => (
                <li key={r.anchor}>
                  · “{r.anchor}” se usa para {r.targets} destinos distintos
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="panel mt-4 flex flex-wrap items-center gap-3 p-4">
        <Select value={view} onValueChange={(v) => setView(v as typeof view)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="groups">Problemas agrupados</SelectItem>
            <SelectItem value="depth">Vista por profundidad</SelectItem>
            <SelectItem value="type">Vista por tipo de página</SelectItem>
            <SelectItem value="pages">Vista por página</SelectItem>
          </SelectContent>
        </Select>
        {view === "pages" && (
          <Input
            className="max-w-xs"
            placeholder="Buscar URL…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>

      {view === "groups" && (
        <div className="mt-4 space-y-3">
          {groups.length === 0 ? (
            <p className="panel p-6 text-sm text-muted-foreground">
              No se detectaron patrones problemáticos de arquitectura con los datos de esta
              auditoría.
            </p>
          ) : (
            groups.map((g) => <ArchitectureGroupCard key={g.id} audit={audit} group={g} />)
          )}
        </div>
      )}

      {view === "depth" && (
        <section className="panel mt-4 p-4">
          <h2 className="font-display text-base font-semibold">Distribución por profundidad</h2>
          <div className="mt-3 space-y-2">
            {depthDistribution(graph).map((row) => (
              <div key={row.depth} className="flex items-center gap-3 text-xs">
                <span className="w-24 text-muted-foreground">{row.depth} clic(s)</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.round((row.pages / Math.max(1, s.pages)) * 100)}%` }}
                  />
                </div>
                <span className="w-40 text-right text-muted-foreground">
                  {row.pages} URL(s) · {row.inbound} entrantes · {row.outbound} salientes
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === "type" && (
        <section className="panel mt-4 p-4">
          <h2 className="font-display text-base font-semibold">Conectividad por tipo de página</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Tipo / contexto</th>
                  <th className="px-3 py-2 font-medium">URLs</th>
                  <th className="px-3 py-2 font-medium">Entrantes</th>
                  <th className="px-3 py-2 font-medium">Salientes</th>
                  <th className="px-3 py-2 font-medium">Sin entrantes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {typeDistribution(graph).map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-2 font-medium">{row.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.pages}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.inbound}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.outbound}</td>
                    <td className="px-3 py-2 font-semibold">{row.withoutInbound}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === "pages" && (
        <section className="panel mt-4 p-4">
          <h2 className="font-display text-base font-semibold">Enlazado interno por página</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">URL</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Prof.</th>
                  <th className="px-3 py-2 font-medium">Origen</th>
                  <th className="px-3 py-2 font-medium">Entrantes</th>
                  <th className="px-3 py-2 font-medium">Únicas</th>
                  <th className="px-3 py-2 font-medium">Salientes</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pages.map((p) => (
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
                    <td className="px-3 py-2 text-muted-foreground">{p.inboundPages}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.outbound}</td>
                    <td className="px-3 py-2">
                      <OrphanBadge state={p.orphanState} />
                    </td>
                  </tr>
                ))}
                {pages.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Ninguna URL coincide con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

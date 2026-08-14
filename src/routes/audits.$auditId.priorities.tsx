/**
 * FASE 6B — Vista "Prioridades SEO" de UNA auditoría.
 * Lee la capa derivada de correlación (GSC + diagnósticos + arquitectura + contenido).
 * No modifica hallazgos, reglas, arquitectura, contenido, importación GSC ni el score.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { DemoBadge, EmptyState, PAGE_TYPE_LABELS, StatCard } from "@/components/seo-ui";
import { OpportunityCard } from "@/components/priority-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rowsForAudit } from "@/seo/gsc/import";
import { buildSeoPriorities, queriesWithPages, CORRELATION_THRESHOLDS } from "@/seo/priority/correlate";
import {
  OPPORTUNITY_TYPE_LABELS,
  PRIORITY_CUTOFFS,
  PRIORITY_LABELS,
  PRIORITY_WEIGHTS,
  type OpportunityType,
  type PriorityLevel,
} from "@/seo/priority/types";
import { CATEGORY_LABELS } from "@/seo/rules";
import { useAppState, useGscConnection } from "@/store/app-store";
import type { Category, PageType } from "@/seo/types";

export const Route = createFileRoute("/audits/$auditId/priorities")({
  head: () => ({
    meta: [
      { title: "Prioridades SEO — SEO Fixer" },
      {
        name: "description",
        content:
          "Oportunidades SEO priorizadas cruzando datos reales de Search Console con los hallazgos del crawler, la arquitectura interna y el análisis de contenido.",
      },
      { property: "og:title", content: "Prioridades SEO — SEO Fixer" },
      {
        property: "og:description",
        content:
          "Priorización explicable de oportunidades SEO, independiente del SEO Score de la auditoría.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrioritiesView,
});

function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

function PrioritiesView() {
  const { auditId } = Route.useParams();
  const audit = useAppState((s) => s.audits.find((a) => a.id === auditId));
  const connection = useGscConnection(auditId);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<PriorityLevel | "all">("all");
  const [type, setType] = useState<OpportunityType | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [pageType, setPageType] = useState<PageType | "all">("all");

  const rows = useMemo(
    () =>
      connection && audit
        ? rowsForAudit(connection.rows, auditId, connection.property.siteUrl, connection.period)
        : [],
    [connection, audit, auditId],
  );

  const summary = useMemo(
    () =>
      audit && connection
        ? buildSeoPriorities({ audit, rows, connection })
        : null,
    [audit, connection, rows],
  );

  const queries = useMemo(() => (audit ? queriesWithPages(rows, audit) : []), [rows, audit]);

  if (!audit) {
    return (
      <EmptyState
        title="Auditoría no encontrada"
        description="La auditoría solicitada no existe o fue eliminada."
      />
    );
  }

  if (!connection || rows.length === 0 || !summary) {
    return (
      <>
        <PageHeader
          title="Prioridades SEO"
          description={`${audit.name} · correlación entre Search Console y la auditoría.`}
        />
        <EmptyState
          title="No conectado a Search Console"
          description="Esta correlación necesita datos de rendimiento importados para esta auditoría. Vinculá una propiedad real de Search Console o cargá los datos de demostración desde la vista de Search Console."
          action={
            <Button asChild size="sm">
              <Link to="/audits/$auditId/gsc" params={{ auditId }}>
                Ir a Search Console
              </Link>
            </Button>
          }
        />
      </>
    );
  }

  const filtered = summary.opportunities.filter((o) => {
    if (priority !== "all" && o.priority !== priority) return false;
    if (type !== "all" && o.type !== type) return false;
    if (category !== "all" && o.category !== category) return false;
    if (pageType !== "all" && o.pageType !== pageType) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        o.url.toLowerCase().includes(q) ||
        o.path.toLowerCase().includes(q) ||
        o.typeLabel.toLowerCase().includes(q) ||
        o.gsc.topQueries.some((tq) => tq.query.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Prioridades SEO"
        description={`${audit.name} · ${summary.property} · ${summary.period.startDate} → ${summary.period.endDate}`}
        actions={
          <div className="flex items-center gap-2">
            {audit.isDemo && <DemoBadge />}
            <Button asChild size="sm" variant="outline">
              <Link to="/audits/$auditId" params={{ auditId }}>
                Volver a la auditoría
              </Link>
            </Button>
          </div>
        }
      />

      {summary.source === "demo" && (
        <div className="panel mb-4 border-dashed p-3 text-xs text-muted-foreground">
          Datos GSC de demostración. No se mezclan con datos reales: si no existe una conexión real,
          el estado se mantiene en “No conectado”.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Prioridad alta" value={summary.counts.high} />
        <StatCard label="Prioridad media" value={summary.counts.medium} />
        <StatCard label="Prioridad baja" value={summary.counts.low} />
        <StatCard label="URLs cruzadas GSC ↔ auditoría" value={summary.matchedUrls} />
      </div>

      <section className="panel mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Modelo de priorización</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada oportunidad recibe cuatro factores en escala 0–4 con pesos explícitos:{" "}
          {Object.entries(PRIORITY_WEIGHTS)
            .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
            .join(" · ")}
          . El índice resultante (0–100) se traduce en{" "}
          {PRIORITY_LABELS.high} ≥ {PRIORITY_CUTOFFS.high}, {PRIORITY_LABELS.medium} ≥{" "}
          {PRIORITY_CUTOFFS.medium}, {PRIORITY_LABELS.low} por debajo. No son métricas de Google ni
          parte del SEO Score.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Umbrales aplicados: {CORRELATION_THRESHOLDS.minImpressions} impresiones para visibilidad
          significativa ({CORRELATION_THRESHOLDS.minImpressionsSoft} para señales más débiles), CTR
          bajo &lt; {pct(CORRELATION_THRESHOLDS.lowCtr)}, posición competitiva ≤{" "}
          {CORRELATION_THRESHOLDS.competitivePosition}, margen de posición{" "}
          {CORRELATION_THRESHOLDS.positionMarginMin}–{CORRELATION_THRESHOLDS.positionMarginMax},
          posición lejana &gt; {CORRELATION_THRESHOLDS.farPosition}, ≤{" "}
          {CORRELATION_THRESHOLDS.fewClicks} clics para “impresiones sin clics”, ≤{" "}
          {CORRELATION_THRESHOLDS.lowInbound} enlace interno entrante para baja conectividad y{" "}
          {CORRELATION_THRESHOLDS.minDaysForTrend} días con datos como mínimo para calcular
          tendencia.
        </p>
      </section>

      <div className="panel mt-4 flex flex-wrap items-center gap-2 p-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar URL o consulta…"
          className="h-9 w-full sm:w-64"
        />
        <Select value={priority} onValueChange={(v) => setPriority(v as PriorityLevel | "all")}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las prioridades</SelectItem>
            <SelectItem value="high">{PRIORITY_LABELS.high}</SelectItem>
            <SelectItem value="medium">{PRIORITY_LABELS.medium}</SelectItem>
            <SelectItem value="low">{PRIORITY_LABELS.low}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => setType(v as OpportunityType | "all")}>
          <SelectTrigger className="h-9 w-[260px]">
            <SelectValue placeholder="Tipo de oportunidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(OPPORTUNITY_TYPE_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => setCategory(v as Category | "all")}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={pageType} onValueChange={(v) => setPageType(v as PageType | "all")}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Tipo de página" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos de página</SelectItem>
            {Object.entries(PAGE_TYPE_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <EmptyState
            title="Sin oportunidades con estos filtros"
            description="La ausencia de datos GSC en una URL no genera una oportunidad: solo se muestran correlaciones con evidencia suficiente."
          />
        ) : (
          filtered.map((o) => <OpportunityCard key={o.id} opportunity={o} />)
        )}
      </section>

      <section className="panel mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Consultas y URL asociada</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Consultas de esta auditoría con la URL en la que aparecen. Sin keyword research externo.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Consulta</th>
                <th className="py-1 text-left font-medium">URL</th>
                <th className="py-1 text-right font-medium">Clics</th>
                <th className="py-1 text-right font-medium">Impresiones</th>
                <th className="py-1 text-right font-medium">CTR</th>
                <th className="py-1 text-right font-medium">Posición</th>
              </tr>
            </thead>
            <tbody>
              {queries.slice(0, 40).map((q) => (
                <tr key={`${q.query}|${q.page}`} className="border-t">
                  <td className="py-1 pr-2">{q.query}</td>
                  <td className="max-w-[280px] truncate py-1 pr-2 font-mono">
                    {q.pageId ? (
                      <Link
                        to="/audits/$auditId/url/$pageId"
                        params={{ auditId, pageId: q.pageId }}
                        className="hover:underline"
                      >
                        {q.page}
                      </Link>
                    ) : (
                      q.page || "—"
                    )}
                  </td>
                  <td className="py-1 text-right">{q.clicks}</td>
                  <td className="py-1 text-right">{q.impressions}</td>
                  <td className="py-1 text-right">{pct(q.ctr)}</td>
                  <td className="py-1 text-right">{q.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel mt-4 grid gap-4 p-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">
            URLs solo en GSC ({summary.gscOnlyUrls.length})
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Reciben impresiones pero el crawler no las analizó en esta auditoría. No es
            necesariamente un error.
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {summary.gscOnlyUrls.slice(0, 12).map((u) => (
              <li key={u} className="truncate">
                {u}
              </li>
            ))}
            {summary.gscOnlyUrls.length === 0 && (
              <li className="font-sans text-muted-foreground">Ninguna.</li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">
            URLs solo en la auditoría ({summary.auditOnlyUrls.length})
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Sin datos de rendimiento GSC en el período seleccionado. No se penaliza ni se crea una
            oportunidad automáticamente.
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {summary.auditOnlyUrls.slice(0, 12).map((u) => (
              <li key={u} className="truncate">
                {u}
              </li>
            ))}
            {summary.auditOnlyUrls.length === 0 && (
              <li className="font-sans text-muted-foreground">Ninguna.</li>
            )}
          </ul>
        </div>
      </section>
    </>
  );
}

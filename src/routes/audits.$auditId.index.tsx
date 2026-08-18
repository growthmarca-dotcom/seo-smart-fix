import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { DiagnosticGroupCard } from "@/components/diagnostic";
import { PageTypeSummary } from "@/components/page-context-ui";
import {
  CategoryBadge,
  DemoBadge,
  EmptyState,
  PAGE_TYPE_LABELS,
  ScoreRing,
  SeverityBadge,
  StatCard,
} from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABELS, kindLabel, SEVERITY_LABELS } from "@/seo/rules";
import { countBySeverity } from "@/seo/engine";
import { getConnector } from "@/seo/connectors";
import { groupDiagnostics } from "@/seo/diagnostics";
import { detectEcommerce } from "@/seo/ecommerce";
import { useAppState } from "@/store/app-store";
import {
  EXCLUSION_LABELS,
  LINK_STATUS_LABELS,
  ROBOTS_STATE_LABELS,
  SITEMAP_KIND_LABELS,
} from "@/seo/types";
import type { Audit, Category, PageType, Severity } from "@/seo/types";

export const Route = createFileRoute("/audits/$auditId/")({
  head: () => ({
    meta: [
      { title: "Resultados de la auditoría — SEO Fixer" },
      {
        name: "description",
        content: "Resultados por URL con severidad, categoría y hallazgos de cada página.",
      },
      { property: "og:title", content: "Resultados de la auditoría — SEO Fixer" },
      { property: "og:description", content: "Hallazgos priorizados URL por URL." },
    ],
  }),
  component: AuditResults,
});

type SortKey = "severity" | "issues" | "url" | "depth";

function AuditResults() {
  const { auditId } = Route.useParams();
  const audit = useAppState((s) => s.audits.find((a) => a.id === auditId));
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [pageType, setPageType] = useState<PageType | "all">("all");
  const [status, setStatus] = useState<"all" | "with-issues" | "clean">("all");
  const [sort, setSort] = useState<SortKey>("severity");

  const rows = useMemo(() => {
    if (!audit) return [];
    return audit.pages
      .map((page) => {
        const findings = audit.findings.filter(
          (f) =>
            f.pageId === page.id &&
            (severity === "all" || f.severity === severity) &&
            (category === "all" || f.category === category),
        );
        const counts = countBySeverity(findings);
        const worst: Severity = counts.critical
          ? "critical"
          : counts.important
            ? "important"
            : counts.improvement
              ? "improvement"
              : "ok";
        return { page, findings, counts, worst };
      })
      .filter((r) => {
        if (pageType !== "all" && r.page.pageType !== pageType) return false;
        if (status === "with-issues" && r.findings.length === 0) return false;
        if (status === "clean" && r.findings.length > 0) return false;
        if (severity !== "all" && r.findings.length === 0) return false;
        if (category !== "all" && r.findings.length === 0) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          return (
            r.page.url.toLowerCase().includes(q) ||
            (r.page.title ?? "").toLowerCase().includes(q) ||
            r.findings.some((f) => f.ruleName.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === "url") return a.page.url.localeCompare(b.page.url);
        if (sort === "depth") return a.page.depth - b.page.depth;
        if (sort === "issues") return b.findings.length - a.findings.length;
        const order: Record<Severity, number> = { critical: 0, important: 1, improvement: 2, ok: 3 };
        return order[a.worst] - order[b.worst] || b.findings.length - a.findings.length;
      });
  }, [audit, query, severity, category, pageType, status, sort]);

  const groups = useMemo(
    () => (audit ? groupDiagnostics(audit, rows.flatMap((r) => r.findings)) : []),
    [audit, rows],
  );

  // FASE 7A — detección e-commerce (solo lectura, para mostrar u ocultar la sección).
  const ecommerceDetection = useMemo(
    () =>
      audit
        ? detectEcommerce(audit)
        : { isEcommerce: false, confidence: 0 },
    [audit],
  );

  if (!audit) {
    return (
      <EmptyState
        title="Auditoría no encontrada"
        description="Puede que haya sido eliminada o que se haya limpiado el almacenamiento local."
        action={
          <Button asChild>
            <Link to="/audits/new">Nueva auditoría</Link>
          </Button>
        }
      />
    );
  }

  const counts = countBySeverity(audit.findings);

  return (
    <>
      <PageHeader
        title={audit.name}
        description={`${audit.rootUrl} · Conector: ${getConnector(audit.platform)?.name} · Límite de rastreo: ${audit.crawlLimit} URLs`}
        actions={
          <>
            {audit.isDemo && <DemoBadge />}
            <Button variant="outline" asChild>
              <Link to="/changes" search={{ auditId: audit.id }}>
                Ver cambios pendientes
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <div className="panel flex items-center gap-5 p-5">
          <ScoreRing score={audit.score?.total ?? 0} size={112} />
          <ul className="space-y-1.5 text-xs">
            {(audit.score?.categories ?? []).map((c) => (
              <li key={c.category} className="flex items-center gap-2">
                <span className="w-36 truncate text-muted-foreground">
                  {CATEGORY_LABELS[c.category]}
                </span>
                <span className="font-semibold">{c.score}</span>
                <span className="text-muted-foreground">
                  · peso {Math.round(c.weight * 100)}% · {c.findings} hallazgos
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="URLs analizadas"
            value={audit.pages.length}
            hint={
              audit.coverage
                ? `${audit.coverage.discovered} descubiertas`
                : "Sin reporte de cobertura"
            }
          />
          <StatCard label="Críticos" value={counts.critical} tone="critical" />
          <StatCard label="Importantes" value={counts.important} tone="important" />
          <StatCard
            label="Descubrimiento"
            value={audit.sitemapFound ? "Sitemap + crawl" : "Solo crawl"}
            hint={audit.robotsFound ? "robots.txt encontrado" : "sin robots.txt"}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ScoreExplanation audit={audit} />
        <CoveragePanel audit={audit} />
      </div>


      <div className="panel mt-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar URL, title o regla…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <FilterSelect
            label="Severidad"
            value={severity}
            onChange={(v) => setSeverity(v as Severity | "all")}
            options={[
              ["all", "Todas"],
              ...(Object.keys(SEVERITY_LABELS) as Severity[]).map(
                (s) => [s, SEVERITY_LABELS[s]] as [string, string],
              ),
            ]}
          />
          <FilterSelect
            label="Categoría"
            value={category}
            onChange={(v) => setCategory(v as Category | "all")}
            options={[
              ["all", "Todas"],
              ...(Object.keys(CATEGORY_LABELS) as Category[]).map(
                (c) => [c, CATEGORY_LABELS[c]] as [string, string],
              ),
            ]}
          />
          <FilterSelect
            label="Tipo de página"
            value={pageType}
            onChange={(v) => setPageType(v as PageType | "all")}
            options={[
              ["all", "Todos"],
              ...(Object.keys(PAGE_TYPE_LABELS) as PageType[]).map(
                (p) => [p, PAGE_TYPE_LABELS[p]] as [string, string],
              ),
            ]}
          />
          <FilterSelect
            label="Estado"
            value={status}
            onChange={(v) => setStatus(v as "all" | "with-issues" | "clean")}
            options={[
              ["all", "Todos"],
              ["with-issues", "Con problemas"],
              ["clean", "Sin problemas"],
            ]}
          />
          <Button
            variant="outline"
            onClick={() =>
              setSort((s) =>
                s === "severity" ? "issues" : s === "issues" ? "depth" : s === "depth" ? "url" : "severity",
              )
            }
          >
            <ArrowUpDown className="mr-1 size-4" />
            Orden:{" "}
            {{ severity: "Severidad", issues: "Cantidad", depth: "Profundidad", url: "URL" }[sort]}
          </Button>
        </div>
      </div>

      <div className="panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">URL</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">HTTP</th>
              <th className="px-4 py-3 font-medium">Profundidad</th>
              <th className="px-4 py-3 font-medium">Severidad máx.</th>
              <th className="px-4 py-3 font-medium">Hallazgos</th>
              <th className="px-4 py-3 font-medium">Principales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ page, findings, worst }) => (
              <tr key={page.id} className="align-top hover:bg-muted/40">
                <td className="max-w-72 px-4 py-3">
                  <Link
                    to="/audits/$auditId/url/$pageId"
                    params={{ auditId: audit.id, pageId: page.id }}
                    className="block truncate font-medium hover:text-primary"
                  >
                    {page.path}
                  </Link>
                  <span className="block truncate text-xs text-muted-foreground">
                    {page.title ?? "(sin title)"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{PAGE_TYPE_LABELS[page.pageType]}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      page.statusCode >= 400
                        ? "font-semibold text-critical"
                        : page.statusCode >= 300
                          ? "font-semibold text-important-foreground"
                          : "text-muted-foreground"
                    }
                  >
                    {page.statusCode}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{page.depth}</td>
                <td className="px-4 py-3">
                  <SeverityBadge severity={worst} />
                </td>
                <td className="px-4 py-3 font-semibold">{findings.length}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {findings.slice(0, 3).map((f) => (
                      <CategoryBadge key={f.id} category={f.category} />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Ninguna URL coincide con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <ExternalLink className="size-3" /> Abrí una URL para ver cada hallazgo con Actual vs
        Sugerido.
      </p>

      <PageTypeSummary audit={audit} />

      <section className="panel mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-display text-base font-semibold">Arquitectura y enlazado interno</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Enlaces internos entrantes y salientes, profundidad, conectividad y páginas
            potencialmente huérfanas de esta auditoría.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/audits/$auditId/architecture" params={{ auditId: audit.id }}>
            Ver arquitectura
          </Link>
        </Button>
      </section>

      <section className="panel mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-display text-base font-semibold">Contenido y oportunidades</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Contenido potencialmente insuficiente por tipo de página, duplicación y similitud,
            canibalización potencial, grupos potenciales de contenido y oportunidades. No modifica el
            SEO Score.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/audits/$auditId/content" params={{ auditId: audit.id }}>
            Ver contenido y oportunidades
          </Link>
        </Button>
      </section>


      {ecommerceDetection.isEcommerce ? (
        <section className="panel mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="font-display text-base font-semibold">SEO E-commerce</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Estructura de tienda detectada (confianza {ecommerceDetection.confidence}/100):
              productos, categorías, variantes, facetas, paginación y datos estructurados
              Product/Offer. Capa descriptiva: no modifica el SEO Score.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/audits/$auditId/ecommerce" params={{ auditId: audit.id }}>
              Ver SEO E-commerce
            </Link>
          </Button>
        </section>
      ) : null}

      <section className="panel mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-display text-base font-semibold">Google Search Console</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Rendimiento orgánico real (clics, impresiones, CTR, posición) asociado a esta auditoría,
            con oportunidades derivadas. Datos complementarios: no modifican el SEO Score.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/audits/$auditId/gsc" params={{ auditId: audit.id }}>
            Ver Search Console
          </Link>
        </Button>
      </section>

      <section className="panel mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-display text-base font-semibold">Prioridades SEO</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Correlación entre el rendimiento real de Search Console, los diagnósticos del crawler, la
            arquitectura interna y el análisis de contenido, con priorización explicable. Independiente
            del SEO Score.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/audits/$auditId/priorities" params={{ auditId: audit.id }}>
            Ver prioridades SEO
          </Link>
        </Button>
      </section>

      <section className="panel mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Problemas agrupados por regla</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Mismo problema, varias URLs. Solo hallazgos de esta auditoría.
        </p>
        <div className="mt-3 space-y-2">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay hallazgos agrupables con los filtros aplicados.
            </p>
          ) : (
            groups.map((g) => <DiagnosticGroupCard key={g.ruleId} group={g} />)
          )}
        </div>
      </section>
    </>
  );
}

function ScoreExplanation({ audit }: { audit: Audit }) {
  const score = audit.score;
  if (!score) return null;
  const drivers = score.drivers ?? [];
  return (
    <section className="panel p-5">
      <h2 className="font-display text-base font-semibold">
        Salud SEO: por qué obtuviste este resultado
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{score.method}</p>
      {score.kinds && score.kinds.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          {score.kinds.map((k) => (
            <li key={k.kind} className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
              <span className="block truncate text-[11px] text-muted-foreground">
                {kindLabel(k.kind)}
              </span>
              <span className="font-display text-base font-semibold">{k.score}</span>
              <span className="ml-1 text-[11px] text-muted-foreground">· {k.findings}</span>
            </li>
          ))}
        </ul>
      )}
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Prioridades de optimización
      </h3>
      {drivers.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No hay hallazgos que estén restando puntos en las páginas analizadas.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {drivers.map((d) => (
            <li
              key={d.ruleId}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
            >
              <SeverityBadge severity={d.severity} />
              <span className="font-medium">{d.ruleName}</span>
              <span className="text-xs text-muted-foreground">
                {CATEGORY_LABELS[d.category]} · {kindLabel(d.kind)} · {d.occurrences} URL(s)
              </span>
              <span className="ml-auto text-xs font-semibold text-primary">
                +{d.points.toFixed(1)} pts al resolverlo
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CoveragePanel({ audit }: { audit: Audit }) {
  const c = audit.coverage;
  if (!c) {
    return (
      <section className="panel p-5">
        <h2 className="font-display text-base font-semibold">Cobertura del rastreo</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta auditoría se generó sin reporte de cobertura (análisis de una sola URL o versión
          anterior del crawler).
        </p>
      </section>
    );
  }
  const notAnalyzed = c.excluded ?? [];
  return (
    <section className="panel p-5">
      <h2 className="font-display text-base font-semibold">Cobertura del rastreo</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Metric label="Descubiertas" value={c.discovered} />
        <Metric label="Analizadas" value={c.analyzed} />
        <Metric label="Bloqueadas por robots" value={c.blocked ?? 0} />
        <Metric label="Excluidas" value={notAnalyzed.length} />
        <Metric label="Con error" value={(c.errors ?? []).length} />
        <Metric label="Pendientes" value={c.pending ?? 0} />
        <Metric label="Redirecciones" value={c.redirects.length} />
        <Metric label="Límite" value={`${c.limit}${c.limitReached ? " (alcanzado)" : ""}`} />
        <Metric
          label="Cobertura"
          value={`${(c.coveragePct ?? (c.discovered ? Math.round((c.analyzed / c.discovered) * 1000) / 10 : 0)).toString().replace(".", ",")}%`}
        />
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Origen del descubrimiento: {c.urlsFromSitemap} solo sitemap · {c.urlsFromLinks} solo enlaces
        internos · {c.urlsFromBoth} en ambos.{" "}
        {c.respectRobots
          ? c.robotsTxtFound
            ? `robots.txt aplicado (${c.robotsRulesApplied} reglas Disallow).`
            : "robots.txt habilitado pero no encontrado."
          : "robots.txt no se está respetando por configuración."}
      </p>
      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-muted-foreground">robots.txt</dt>
          <dd>
            {c.robots ? ROBOTS_STATE_LABELS[c.robots.state] : c.robotsTxtFound ? "Encontrado" : "No encontrado"}
            {c.robots?.userAgentGroup ? ` · grupo User-agent: ${c.robots.userAgentGroup}` : ""}
            {c.robots ? ` · ${c.robots.disallow.length} Disallow / ${c.robots.allow.length} Allow` : ""}
            {c.robots?.parseWarnings.length ? ` · ${c.robots.parseWarnings.length} línea(s) no interpretada(s)` : ""}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-muted-foreground">Sitemaps</dt>
          <dd>
            {c.sitemapDocs && c.sitemapDocs.length > 0 ? (
              <ul className="space-y-0.5">
                {c.sitemapDocs.slice(0, 6).map((d) => (
                  <li key={d.url} className="truncate">
                    <span className="font-medium">{SITEMAP_KIND_LABELS[d.kind]}</span>{" "}
                    <span className="font-mono text-[11px]">{d.url}</span>
                    {d.kind === "sitemap" || d.kind === "child" || d.kind === "index"
                      ? ` · ${d.urlCount} URLs`
                      : d.detail
                        ? ` · ${d.detail}`
                        : d.status
                          ? ` · HTTP ${d.status}`
                          : ""}
                  </li>
                ))}
              </ul>
            ) : (
              audit.sitemapFound
                ? "Sitemap detectado (auditoría sin detalle por documento)."
                : "No se encontró sitemap accesible en las rutas habituales."
            )}
          </dd>
        </div>
        {c.linkChecksUsed !== undefined && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted-foreground">Enlaces</dt>
            <dd>
              {c.linkChecksUsed} verificación(es) extra de {c.linkCheckBudget ?? 0} disponibles
              {c.linkChecks && c.linkChecks.length > 0
                ? ` · ${summarizeLinkChecks(c.linkChecks)}`
                : ""}
            </dd>
          </div>
        )}
        {c.normalizations && c.normalizations.length > 0 && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted-foreground">Normalizadas</dt>
            <dd>
              {c.normalizations.length} URL(s) ajustada(s):{" "}
              {[...new Set(c.normalizations.flatMap((n) => n.reasons))].slice(0, 4).join(", ")}
            </dd>
          </div>
        )}
      </dl>
      {notAnalyzed.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Descubiertas pero no analizadas
          </h3>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
            {notAnalyzed.slice(0, 40).map((e, i) => (
              <li key={`${e.url}-${i}`} className="flex items-start justify-between gap-2">
                <span className="truncate font-mono text-[11px]">{e.url}</span>
                <span className="shrink-0 text-muted-foreground">
                  {EXCLUSION_LABELS[e.reason]}
                  {e.detail ? ` · ${e.detail}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {notAnalyzed.length > 40 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              y {notAnalyzed.length - 40} más…
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Resume los estados verificados sin afirmar roturas que no lo son. */
function summarizeLinkChecks(checks: NonNullable<Audit["coverage"]>["linkChecks"]) {
  const counts = new Map<string, number>();
  for (const c of checks ?? []) counts.set(c.statusClass, (counts.get(c.statusClass) ?? 0) + 1);
  return [...counts.entries()]
    .map(([k, n]) => `${n} ${LINK_STATUS_LABELS[k as keyof typeof LINK_STATUS_LABELS]}`)
    .join(" · ");
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-display text-lg font-semibold">{value}</dd>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

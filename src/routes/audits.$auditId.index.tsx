import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
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
import { CATEGORY_LABELS, SEVERITY_LABELS } from "@/seo/rules";
import { countBySeverity } from "@/seo/engine";
import { getConnector } from "@/seo/connectors";
import { useAppState } from "@/store/app-store";
import type { Category, PageType, Severity } from "@/seo/types";

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
              <Link to="/changes">Ver cambios pendientes</Link>
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
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="URLs analizadas" value={audit.pages.length} />
          <StatCard label="Críticos" value={counts.critical} tone="critical" />
          <StatCard label="Importantes" value={counts.important} tone="important" />
          <StatCard
            label="Descubrimiento"
            value={audit.sitemapFound ? "Sitemap + crawl" : "Solo crawl"}
            hint={audit.robotsFound ? "robots.txt encontrado" : "sin robots.txt"}
          />
        </div>
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
    </>
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

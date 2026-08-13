import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, FileSearch, Lightbulb, TriangleAlert } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/app-shell";
import { DemoBadge, ScoreRing, SeverityBadge, StatCard, EmptyState } from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/seo/rules";
import { countBySeverity } from "@/seo/engine";
import { useAppState } from "@/store/app-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard SEO — SEO Fixer" },
      {
        name: "description",
        content:
          "Score SEO, problemas críticos y oportunidades de todas tus auditorías en un solo panel.",
      },
      { property: "og:title", content: "Dashboard SEO — SEO Fixer" },
      {
        property: "og:description",
        content: "Auditoría y optimización SEO automática para webs y tiendas online.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const audits = useAppState((s) => s.audits);
  const changes = useAppState((s) => s.changes);
  const latest = audits[0];
  const findings = latest?.findings ?? [];
  const counts = countBySeverity(findings);
  const analyzed = audits.reduce((sum, a) => sum + a.pages.length, 0);

  const trend = [...audits]
    .reverse()
    .map((a, i) => ({ name: `#${i + 1}`, score: a.score?.total ?? 0, label: a.name }));

  if (!latest) {
    return (
      <>
        <PageHeader title="Dashboard" description="Todavía no hay auditorías." />
        <EmptyState
          title="Empezá tu primera auditoría"
          description="Ingresá una URL raíz y SEO Fixer descubrirá el sitemap, rastreará URLs internas y analizará cada página."
          action={
            <Button asChild>
              <Link to="/audits/new">Nueva auditoría</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Estado general de tus auditorías SEO y próximas acciones recomendadas."
        actions={
          <Button asChild>
            <Link to="/audits/new">
              Nueva auditoría <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center">
          <ScoreRing score={latest.score?.total ?? 0} />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              SEO Score ponderado
            </p>
            <p className="mt-1 truncate font-display text-lg font-semibold">{latest.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              El score resume categorías ponderadas. No garantiza posiciones: es una guía de
              prioridades.
            </p>
            {latest.isDemo && (
              <div className="mt-2">
                <DemoBadge />
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <StatCard
            label="URLs analizadas"
            value={analyzed}
            hint={`${audits.length} auditoría(s)`}
            icon={<FileSearch className="size-4 text-muted-foreground" />}
          />
          <StatCard
            label="Problemas críticos"
            value={counts.critical}
            tone="critical"
            hint="Afectan rastreo o indexación"
            icon={<TriangleAlert className="size-4 text-critical" />}
          />
          <StatCard
            label="Importantes"
            value={counts.important}
            tone="important"
            hint="Impacto directo en visibilidad"
            icon={<AlertTriangle className="size-4 text-important-foreground" />}
          />
          <StatCard
            label="Oportunidades"
            value={changes.filter((c) => c.status === "pending").length}
            hint="Sugerencias pendientes de revisión"
            icon={<Lightbulb className="size-4 text-accent-foreground" />}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <h2 className="font-display text-base font-semibold">Evolución del score</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Comparativa entre auditorías, de la más antigua a la más reciente.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.length > 1 ? trend : [...trend, ...trend]}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-base font-semibold">Score por categoría</h2>
          <ul className="mt-4 space-y-3">
            {(latest.score?.categories ?? []).map((c) => (
              <li key={c.category}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{CATEGORY_LABELS[c.category]}</span>
                  <span className="text-muted-foreground">
                    {c.score} · peso {Math.round(c.weight * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${c.score}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Auditorías recientes</h2>
            <Link to="/audits" className="text-xs font-medium text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {audits.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    to="/audits/$auditId"
                    params={{ auditId: a.id }}
                    className="block truncate text-sm font-medium hover:text-primary"
                  >
                    {a.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.rootUrl} · {a.pages.length} URLs · {a.findings.length} hallazgos
                  </p>
                </div>
                <span className="font-display text-lg font-bold">{a.score?.total ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Prioridades ahora</h2>
          <ul className="space-y-3">
            {findings.slice(0, 6).map((f) => (
              <li key={f.id} className="flex items-start gap-3">
                <SeverityBadge severity={f.severity} />
                <div className="min-w-0">
                  <Link
                    to="/audits/$auditId/url/$pageId"
                    params={{ auditId: latest.id, pageId: f.pageId }}
                    className="block text-sm font-medium hover:text-primary"
                  >
                    {f.ruleName}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{f.pageUrl}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

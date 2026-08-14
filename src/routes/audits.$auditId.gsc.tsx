/**
 * FASE 6A — Vista "Google Search Console" de UNA auditoría.
 * Solo lectura + capa derivada: no modifica hallazgos, reglas ni score.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { DemoBadge, EmptyState, StatCard } from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { gscImportFn, gscListPropertiesFn } from "@/lib/gsc.functions";
import { buildDemoGscConnection } from "@/seo/gsc/demo";
import {
  matchUrls,
  metricsByPage,
  metricsByQuery,
  resolvePeriod,
  rowsForAudit,
  summarize,
} from "@/seo/gsc/import";
import { buildGscSignals } from "@/seo/gsc/opportunities";
import {
  GSC_MATCH_LABELS,
  GSC_PERIOD_LABELS,
  GSC_STATUS_LABELS,
  type GscConnectionStatus,
  type GscPeriodId,
  type GscRow,
} from "@/seo/gsc/types";
import { propertyType } from "@/seo/gsc/normalize";
import { actions, useAudit, useGscConnection } from "@/store/app-store";

export const Route = createFileRoute("/audits/$auditId/gsc")({
  head: () => ({
    meta: [
      { title: "Google Search Console — SEO Fixer" },
      {
        name: "description",
        content:
          "Rendimiento orgánico real por URL y consulta, importado desde Google Search Console y asociado a una auditoría.",
      },
      { property: "og:title", content: "Google Search Console — SEO Fixer" },
      {
        property: "og:description",
        content: "Clics, impresiones, CTR y posición media cruzados con los hallazgos del crawler.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GscView;
});

type SortKey = "impressions" | "clicks" | "ctr" | "position";

function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

function GscView() {
  const { auditId } = Route.useParams();
  const audit = useAudit(auditId);
  const connection = useGscConnection(auditId);
  const [periodId, setPeriodId] = useState<Exclude<GscPeriodId, "custom">>("28d");
  const [busy, setBusy] = useState(false);
  const [properties, setProperties] = useState<Array<{ siteUrl: string; permissionLevel?: string }>>([]);
  const [configError, setConfigError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("impressions");

  const period = connection?.period ?? resolvePeriod(periodId);
  const rows = useMemo(
    () =>
      connection
        ? rowsForAudit(connection.rows, auditId, connection.property.siteUrl, period)
        : [],
    [connection, auditId, period],
  );

  const summary = useMemo(() => summarize(rows), [rows]);
  const pages = useMemo(
    () => (audit ? metricsByPage(rows, audit.pages) : []),
    [rows, audit],
  );
  const queries = useMemo(() => {
    const list = metricsByQuery(rows);
    return [...list].sort((a, b) =>
      sort === "position" ? a.position - b.position : b[sort] - a[sort],
    );
  }, [rows, sort]);
  const matches = useMemo(() => (audit ? matchUrls(rows, audit.pages) : []), [rows, audit]);
  const signals = useMemo(() => (audit ? buildGscSignals(audit, rows) : []), [audit, rows]);

  if (!audit) {
    return <EmptyState title="Auditoría no encontrada" description="Volvé al listado de auditorías." />;
  }

  const status: GscConnectionStatus = busy
    ? "importing"
    : (connection?.status ?? "disconnected");

  async function loadProperties() {
    setBusy(true);
    setConfigError(null);
    try {
      const res = await gscListPropertiesFn();
      if (!res.ok) {
        setConfigError(res.error);
        setProperties([]);
      } else {
        setProperties(res.sites);
        if (res.sites.length === 0) setConfigError("La cuenta conectada no tiene propiedades verificadas.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function connectProperty(siteUrl: string) {
    setBusy(true);
    const p = resolvePeriod(periodId);
    try {
      const res = await gscImportFn({
        data: { siteUrl, startDate: p.startDate, endDate: p.endDate, rowLimit: 5000 },
      });
      if (!res.ok) {
        actions.setGscConnection({
          auditId,
          property: { siteUrl, type: propertyType(siteUrl) },
          source: "live",
          status: "error",
          period: p,
          connectedAt: new Date().toISOString(),
          error: res.error,
          rows: [],
        });
        toast.error(res.error);
        return;
      }
      const importedAt = new Date().toISOString();
      const mapped: GscRow[] = res.rows.map((r) => {
        const [date, query, page, device, country] = r.keys ?? [];
        return {
          auditId,
          property: res.property,
          date: date ?? p.endDate,
          query,
          page,
          device,
          country,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
          importedAt,
        };
      });
      actions.setGscConnection({
        auditId,
        property: { siteUrl: res.property, type: propertyType(res.property) },
        source: "live",
        status: mapped.length === 0 ? "no-data" : "connected",
        period: p,
        connectedAt: importedAt,
        lastSyncAt: importedAt,
        rows: mapped,
      });
      toast.success(`${mapped.length} registros importados (${GSC_PERIOD_LABELS[periodId]}).`);
    } finally {
      setBusy(false);
    }
  }

  function loadDemo() {
    actions.setGscConnection(buildDemoGscConnection(audit!, periodId));
    toast.info("Datos demo de Search Console cargados (identificados como demo).");
  }

  return (
    <>
      <PageHeader
        title="Google Search Console"
        description="Rendimiento orgánico real asociado exclusivamente a esta auditoría. Los datos son complementarios: no modifican el SEO Score."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/audits/$auditId" params={{ auditId }}>
              Volver a la auditoría
            </Link>
          </Button>
        }
      />

      <section className="panel p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold">
            {busy && <Loader2 className="size-3 animate-spin" />}
            {GSC_STATUS_LABELS[status]}
          </span>
          {connection?.source === "demo" && <DemoBadge />}
          {connection && (
            <span className="text-xs text-muted-foreground">
              {connection.property.siteUrl} ·{" "}
              {connection.property.type === "domain" ? "Propiedad de dominio" : "Prefijo de URL"}
            </span>
          )}
          {connection?.lastSyncAt && (
            <span className="text-xs text-muted-foreground">
              Última sincronización: {new Date(connection.lastSyncAt).toLocaleString("es-AR")}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Período
            </span>
            <Select
              value={periodId}
              onValueChange={(v) => setPeriodId(v as Exclude<GscPeriodId, "custom">)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">{GSC_PERIOD_LABELS["7d"]}</SelectItem>
                <SelectItem value="28d">{GSC_PERIOD_LABELS["28d"]}</SelectItem>
                <SelectItem value="3m">{GSC_PERIOD_LABELS["3m"]}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={loadProperties} disabled={busy}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Buscar propiedades
          </Button>
          {audit.isDemo && (
            <Button size="sm" variant="secondary" onClick={loadDemo} disabled={busy}>
              Cargar datos demo
            </Button>
          )}
          {connection && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => actions.removeGscConnection(auditId)}
              disabled={busy}
            >
              Desvincular
            </Button>
          )}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Período mostrado: {period.startDate} → {period.endDate}
        </p>

        {configError && (
          <div className="mt-3 flex gap-2 rounded-lg border border-important/40 bg-important-soft p-3 text-xs">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">No se pudo conectar con Search Console</p>
              <p className="mt-1">{configError}</p>
              <p className="mt-1 text-muted-foreground">
                La autenticación usa OAuth oficial de Google mediante el conector de la plataforma.
                La app no almacena contraseñas ni tokens de Google. Falta vincular la conexión OAuth
                del proyecto para obtener datos reales.
              </p>
            </div>
          </div>
        )}

        {properties.length > 0 && (
          <ul className="mt-3 space-y-2">
            {properties.map((p) => (
              <li
                key={p.siteUrl}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs"
              >
                <span>
                  <span className="font-medium">{p.siteUrl}</span>{" "}
                  <span className="text-muted-foreground">
                    ({propertyType(p.siteUrl) === "domain" ? "dominio" : "prefijo de URL"}
                    {p.permissionLevel ? ` · ${p.permissionLevel}` : ""})
                  </span>
                </span>
                <Button size="sm" onClick={() => connectProperty(p.siteUrl)} disabled={busy}>
                  Asociar a esta auditoría
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!connection ? (
        <div className="mt-4">
          <EmptyState
            title="Sin conexión de Search Console"
            description="Esta auditoría no tiene ninguna propiedad asociada. Buscá propiedades verificadas de la cuenta conectada o, si es la auditoría demo, cargá los datos demo identificados como tales."
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Sin datos para el período"
            description="Search Console no devolvió registros para esta propiedad y período. No se generan filas artificiales."
          />
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Clics" value={summary.clicks} />
            <StatCard label="Impresiones" value={summary.impressions} />
            <StatCard label="CTR medio" value={pct(summary.ctr)} />
            <StatCard label="Posición media" value={summary.position.toFixed(1)} />
            <StatCard label="Consultas" value={summary.queries} />
            <StatCard label="Páginas" value={summary.pages} />
          </div>

          <section className="panel mt-4 p-5">
            <h2 className="font-display text-base font-semibold">Rendimiento por URL</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2">URL</th>
                    <th className="py-2">Clics</th>
                    <th className="py-2">Impr.</th>
                    <th className="py-2">CTR</th>
                    <th className="py-2">Pos.</th>
                    <th className="py-2">Consultas</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.page} className="border-t border-border">
                      <td className="max-w-[320px] truncate py-2 font-mono">{p.page}</td>
                      <td className="py-2">{p.clicks}</td>
                      <td className="py-2">{p.impressions}</td>
                      <td className="py-2">{pct(p.ctr)}</td>
                      <td className="py-2">{p.position.toFixed(1)}</td>
                      <td className="py-2">{p.queries}</td>
                      <td className="py-2">
                        {p.pageId ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link
                              to="/audits/$auditId/url/$pageId"
                              params={{ auditId, pageId: p.pageId }}
                            >
                              Ver diagnóstico
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">Sin página en la auditoría</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel mt-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold">Consultas</h2>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="impressions">Ordenar por impresiones</SelectItem>
                  <SelectItem value="clicks">Ordenar por clics</SelectItem>
                  <SelectItem value="ctr">Ordenar por CTR</SelectItem>
                  <SelectItem value="position">Ordenar por posición</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2">Consulta</th>
                    <th className="py-2">Clics</th>
                    <th className="py-2">Impr.</th>
                    <th className="py-2">CTR</th>
                    <th className="py-2">Pos.</th>
                    <th className="py-2">Páginas</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.slice(0, 100).map((q) => (
                    <tr key={q.query} className="border-t border-border">
                      <td className="py-2">{q.query}</td>
                      <td className="py-2">{q.clicks}</td>
                      <td className="py-2">{q.impressions}</td>
                      <td className="py-2">{pct(q.ctr)}</td>
                      <td className="py-2">{q.position.toFixed(1)}</td>
                      <td className="py-2">{q.pages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel mt-4 p-5">
            <h2 className="font-display text-base font-semibold">Oportunidades y señales para revisar</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Capa derivada de GSC + crawler. No afirma causalidad y no modifica el SEO Score.
            </p>
            <div className="mt-3 space-y-2">
              {signals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No se detectaron señales con los datos del período.
                </p>
              ) : (
                signals.slice(0, 40).map((s, i) => (
                  <article key={`${s.id}-${s.page}-${i}`} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold">
                        {s.classification}
                      </span>
                      <h3 className="font-display text-sm font-semibold">{s.name}</h3>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{s.page}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {s.evidence.map((e) => (
                        <li
                          key={e}
                          className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {e}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs">{s.explanation}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.recommendation}</p>
                    {s.pageId && (
                      <Button asChild size="sm" variant="outline" className="mt-2">
                        <Link
                          to="/audits/$auditId/url/$pageId"
                          params={{ auditId, pageId: s.pageId }}
                        >
                          Ver diagnóstico de la URL
                        </Link>
                      </Button>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel mt-4 p-5">
            <h2 className="font-display text-base font-semibold">Correspondencia GSC ↔ crawler</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Una URL sin datos GSC no implica un problema: puede simplemente no tener impresiones.
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {(["both", "gsc-only", "audit-only"] as const).map((state) => {
                const list = matches.filter((m) => m.state === state);
                return (
                  <div key={state} className="rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold">{GSC_MATCH_LABELS[state]}</p>
                    <p className="mt-1 font-display text-xl font-semibold">{list.length}</p>
                    <ul className="mt-2 space-y-1">
                      {list.slice(0, 8).map((m) => (
                        <li key={m.url} className="truncate font-mono text-[11px] text-muted-foreground">
                          {m.url}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </>
  );
}

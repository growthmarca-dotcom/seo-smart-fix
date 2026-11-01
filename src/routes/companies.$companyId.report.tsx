import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/seo-ui";
import { useAppState, useCompany, useRoadmap } from "@/store/app-store";
import { companyIdentityRows, executiveSummary, fmtReportDate, linkedAuditSummaries } from "@/companies/company-report";
import { scoreLabel } from "@/seo/engine";

export const Route = createFileRoute("/companies/$companyId/report")({
  head: () => ({
    meta: [
      { title: "Informe de seguimiento y roadmap — MarCa Growth" },
      { name: "description", content: "Informe imprimible de avance del roadmap y auditorías SEO de la empresa." },
      { property: "og:title", content: "Informe de seguimiento y roadmap — MarCa Growth" },
      { property: "og:description", content: "Avance, próximos pasos y auditorías SEO asociadas." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompanyReport,
});

function CompanyReport() {
  const { companyId } = Route.useParams();
  const company = useCompany(companyId);
  const roadmap = useRoadmap(companyId);
  const audits = useAppState((s) => s.audits);
  const issuedAt = useMemo(() => new Date().toISOString(), []);
  const today = issuedAt.slice(0, 10);

  if (!company)
    return <EmptyState title="Empresa no encontrada" description="No existe una empresa con ese identificador en este navegador." />;

  const summary = executiveSummary(roadmap, today);
  const linked = linkedAuditSummaries(company, audits);

  return (
    <div className="report mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" asChild>
          <Link to="/companies/$companyId" params={{ companyId }}><ArrowLeft className="size-4" /> Volver a la empresa</Link>
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">En el diálogo de impresión elegí “Guardar como PDF”.</span>
          <Button onClick={() => window.print()}><Printer className="size-4" /> Imprimir / Guardar PDF</Button>
        </div>
      </div>

      <article className="space-y-8 rounded-xl border border-border bg-card p-8 text-card-foreground print:border-0 print:p-0">
        <header className="border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">MarCa Growth</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Informe de Seguimiento y Roadmap</h1>
          <p className="mt-1 text-lg font-medium">{company.tradeName}</p>
          <p className="text-sm text-muted-foreground">Fecha de emisión: {fmtReportDate(issuedAt)}</p>
        </header>

        <Section title="1. Identificación de la empresa">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {companyIdentityRows(company).map(([k, v]) => <Meta key={k} label={k} value={v} />)}
          </dl>
        </Section>

        <Section title="2. Resumen ejecutivo">
          {!summary.hasRoadmap ? (
            <p className="text-sm text-muted-foreground">Esta empresa todavía no tiene un roadmap de trabajo.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="break-inside-avoid">
                <p>
                  Avance del roadmap: <strong>{summary.percent}%</strong> · {summary.done} de {summary.applicable} tareas aplicables completadas.
                </p>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${summary.percent}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Las tareas que no aplican no se cuentan en el avance.</p>
              </div>
              <dl className="grid grid-cols-5 gap-2 break-inside-avoid">
                {summary.breakdown.map(([k, v]) => (
                  <div key={k} className="rounded-md border border-border p-2 text-center">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="text-lg font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="break-inside-avoid">
                <span className="font-semibold">Próxima acción sugerida: </span>
                {summary.nextAction ? `${summary.nextAction.title}${summary.nextAction.phase ? ` (${summary.nextAction.phase})` : ""}` : "No hay tareas pendientes ni en curso."}
              </p>
              {summary.overdue.length > 0 && (
                <div className="break-inside-avoid rounded-md border border-important/40 bg-important-soft p-3">
                  <p className="font-semibold">Tareas con fecha objetivo vencida ({summary.overdue.length})</p>
                  <ul className="ml-5 list-disc">
                    {summary.overdue.map((t) => <li key={t.title + t.dueDate}>{t.title} — vencía el {fmtReportDate(`${t.dueDate}T12:00:00`)}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title="3. Auditorías SEO asociadas">
          {linked.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Esta empresa aún no cuenta con auditorías SEO vinculadas. El diagnóstico técnico del sitio puede asociarse desde la ficha de la empresa.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {linked.map((a) => (
                <li key={a.id} className="break-inside-avoid rounded-lg border border-border p-3">
                  <p className="font-semibold">{a.name}{a.isDemo ? " (datos de demostración)" : ""}</p>
                  <p className="break-all text-muted-foreground">{a.rootUrl} · {a.date}</p>
                  <p className="mt-1">
                    Salud SEO: {a.score !== undefined ? <strong>{a.score}/100 ({scoreLabel(a.score)})</strong> : "No disponible"} ·{" "}
                    {a.critical} críticos · {a.important} importantes · {a.improvement} mejoras
                  </p>
                  <Link to="/audits/$auditId/report" params={{ auditId: a.id }} className="text-primary underline print:hidden">Ver informe SEO completo</Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all font-medium">{value}</dd>
    </div>
  );
}

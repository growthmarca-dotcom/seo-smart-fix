import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/seo-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INDUSTRY_LABELS } from "@/companies/model";
import { SOURCE_LABELS, type ControlSource } from "@/diagnosis/dimensions";
import { CONTROL_STATUS_LABELS } from "@/diagnosis/model";
import { buildDiagnosisPreview, type PreviewControl } from "@/diagnosis/preview";
import { SUFFICIENCY } from "@/diagnosis/weights";
import { useAppState, useCompany } from "@/store/app-store";

export const Route = createFileRoute("/companies/$companyId_/diagnosis")({
  head: () => ({
    meta: [
      { title: "Diagnóstico integral (vista previa) — MarCa Audit" },
      { name: "description", content: "Vista previa de solo lectura del diagnóstico integral de negocio de la empresa." },
      { property: "og:title", content: "Diagnóstico integral (vista previa) — MarCa Audit" },
      { property: "og:description", content: "Madurez y cobertura por dimensión, sin guardar cambios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DiagnosisPreviewPage,
});

const fmt = (iso: string) => (iso ? new Date(iso).toLocaleDateString("es-AR") : "Sin fecha");
const pct = (n: number) => `${Math.round(n * 100)} %`;

function statusText(c: PreviewControl) {
  if (c.status === "integration") return "Integración futura (no cuenta)";
  if (c.status === "seo-reference") return "Referencia técnica (no suma)";
  return CONTROL_STATUS_LABELS[c.status];
}

function DiagnosisPreviewPage() {
  const { companyId } = Route.useParams();
  const company = useCompany(companyId);
  const audits = useAppState((s) => s.audits);
  const reviews = useAppState((s) => s.commercialReviews);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const preview = useMemo(
    () => (company ? buildDiagnosisPreview(company, audits, reviews, selected) : undefined),
    [company, audits, reviews, selected],
  );

  if (!company || !preview)
    return (
      <EmptyState
        title="Empresa no encontrada"
        description="Puede que se haya eliminado o que esté guardada en otro navegador."
        action={<Button asChild><Link to="/companies">Ver empresas</Link></Button>}
      />
    );

  const { index, seo, review } = preview;
  const titles = Object.fromEntries(preview.dimensions.flatMap((d) => d.controls.map((c) => [c.id, c.title])));
  const titled = (r: string) => r.replace(/\b[a-z]+(?:-[a-z]+)+\b/g, (id) => (titles[id] ? `«${titles[id]}»` : id));
  const auditName = (id: string) => preview.linkedAudits.find((a) => a.id === id);
  const reviewOptions = review?.current ? [review.current, ...review.others] : [];

  return (
    <>
      <PageHeader
        title={`Diagnóstico integral — ${company.tradeName}`}
        description={`Rubro: ${INDUSTRY_LABELS[company.industry]}. Se calcula con los datos existentes; nada se guarda.`}
        actions={<Button asChild variant="outline"><Link to="/companies/$companyId" params={{ companyId }}><ArrowLeft className="h-4 w-4" />Volver a la ficha</Link></Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="secondary">Vista previa · pesos propuestos</Badge>
        <Badge variant="outline">Solo lectura</Badge>
      </div>

      <section className="panel mb-4 space-y-2 p-4 text-sm">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-lg font-semibold">
            {index.status === "complete" ? `Índice global: ${index.value}` : "Diagnóstico parcial"}
          </h2>
          <span className="text-muted-foreground">
            Cobertura total {pct(index.totalCoverage)} (mínimo propuesto {pct(SUFFICIENCY.minTotalCoverage)})
          </span>
        </div>
        {index.status === "partial" && (
          <>
            <p className="text-muted-foreground">No se muestra índice global: la información disponible no alcanza para un resultado integral.</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {index.reasons.map((r) => <li key={r}>{titled(r)}</li>)}
            </ul>
          </>
        )}
      </section>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="panel space-y-1 p-4 text-sm">
          <h2 className="font-display font-semibold">Referencia técnica SEO (no suma al índice)</h2>
          {seo ? (
            <p>
              Score SEO <strong>{seo.score}</strong> · {seo.auditName}{seo.isDemo && !/demo/i.test(seo.auditName) ? " (demo)" : ""}, {fmt(seo.date)} ·{" "}
              <Link to="/audits/$auditId/report" params={{ auditId: seo.auditId }} className="underline">Ver informe SEO</Link>
            </p>
          ) : (
            <p className="text-muted-foreground">Sin auditoría SEO vinculada con puntaje.</p>
          )}
        </section>

        <section className="panel space-y-2 p-4 text-sm">
          <h2 className="font-display font-semibold">Evaluación comercial turística</h2>
          {!preview.tourism ? (
            <p className="text-muted-foreground">No corresponde a este rubro: los controles empiezan sin evaluar.</p>
          ) : !review?.current ? (
            <p className="text-muted-foreground">Sin evaluación comercial con controles evaluados en las auditorías vinculadas.</p>
          ) : (
            <>
              <p>
                Fuente: {auditName(review.current.auditId)?.name ?? review.current.auditId}
                {auditName(review.current.auditId)?.isDemo && !/demo/i.test(auditName(review.current.auditId)!.name) ? " (demo)" : ""}
, auditoría del {fmt(review.current.auditDate)}, editada el {fmt(review.current.reviewUpdatedAt)} ·{" "}
                {review.reason === "latest" ? "regla: la más reciente con datos" : "elegida para comparar (no se guarda)"}
              </p>
              {reviewOptions.length > 1 && (
                <label className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Comparar con:</span>
                  <select
                    className="h-8 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2"
                    value={review.current.auditId}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label="Evaluación usada como fuente"
                  >
                    {reviewOptions.map((o) => (
                      <option key={o.auditId} value={o.auditId}>{auditName(o.auditId)?.name ?? o.auditId} · {fmt(o.auditDate)}</option>
                    ))}
                  </select>
                </label>
              )}
              {review.others.length > 0 && (
                <p className="text-muted-foreground">Otras evaluaciones conservadas: {review.others.map((o) => fmt(o.auditDate)).join(", ")}.</p>
              )}
              <Link to="/audits/$auditId/commercial" params={{ auditId: review.current.auditId }} className="underline">Editar en la evaluación comercial de esa auditoría</Link>
            </>
          )}
        </section>
      </div>

      <div className="space-y-4">
        {preview.dimensions.map((d) => (
          <section key={d.id} className="panel p-4 text-sm">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display font-semibold">{d.title}</h3>
              <span className="text-muted-foreground">
                {d.result.evaluated === 0
                  ? `Sin datos suficientes · 0 de ${d.result.applicable} controles evaluados`
                  : `Madurez ${d.result.maturity} · Cobertura ${d.result.evaluated}/${d.result.applicable}`}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {d.controls.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div>{c.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {SOURCE_LABELS[c.source]}
                      {c.origin === "tourism" ? " · tomado de la evaluación turística" : ""}
                      {c.unjustifiedNotApplicable ? " · «No aplica» sin justificación: se considera sin evaluar" : ""}
                    </div>
                    {c.notes && <div className="mt-0.5 whitespace-pre-wrap text-xs">{c.notes}</div>}
                  </div>
                  <Badge variant="outline">{statusText(c)}</Badge>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="panel mt-4 space-y-2 p-4 text-sm">
        <h2 className="font-display font-semibold">Qué falta para un diagnóstico completo</h2>
        {(Object.keys(preview.missingBySource) as ControlSource[]).map((s) => (
          <div key={s}>
            <div className="font-medium">{SOURCE_LABELS[s]}</div>
            <p className="text-muted-foreground">{preview.missingBySource[s]!.join(" · ")}</p>
          </div>
        ))}
        <p className="pt-2 text-xs text-muted-foreground">Editar controles, crear hallazgos o tareas e imprimir estarán disponibles cuando se apruebe el guardado.</p>
      </section>
    </>
  );
}

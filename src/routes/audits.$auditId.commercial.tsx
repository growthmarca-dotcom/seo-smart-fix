import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { DemoBadge, EmptyState } from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { actions, useAudit, useCommercialReview } from "@/store/app-store";
import {
  COMMERCIAL_STATUS_LABELS,
  isValidEvidenceUrl,
  reviewRows,
  reviewSummary,
  type CommercialStatus,
} from "@/seo/tourism/commercial-review";

export const Route = createFileRoute("/audits/$auditId/commercial")({
  head: () => ({
    meta: [
      { title: "Evaluación comercial del alojamiento — SEO Fixer" },
      { name: "description", content: "Evaluación manual de la propuesta comercial de un alojamiento turístico, separada del SEO automático." },
      { property: "og:title", content: "Evaluación comercial del alojamiento — SEO Fixer" },
      { property: "og:description", content: "Controles comerciales con estado y evidencia, sin alterar el SEO Score." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommercialPage,
});

const STATUSES: CommercialStatus[] = ["verified", "needs-review", "not-applicable"];

function CommercialPage() {
  const { auditId } = Route.useParams();
  const audit = useAudit(auditId);
  const review = useCommercialReview(auditId);
  if (!audit) return <EmptyState title="Auditoría no encontrada" description="No existe una auditoría con ese identificador." />;
  const rows = reviewRows(review);
  const sum = reviewSummary(review);
  return (
    <div>
      <PageHeader
        title="Evaluación comercial del alojamiento"
        description={`${audit.rootUrl} · Evaluación asistida y manual. No forma parte de los hallazgos SEO automáticos ni modifica la puntuación.`}
        actions={
          <>
            {audit.isDemo && <DemoBadge />}
            <Button variant="outline" asChild>
              <Link to="/audits/$auditId" params={{ auditId }}>Volver a la auditoría</Link>
            </Button>
          </>
        }
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Verificados: {sum.verified} · Requieren revisión: {sum.needsReview} · No aplica: {sum.notApplicable} · Sin evaluar: {sum.unevaluated}. Los cambios se guardan automáticamente.
      </p>
      <div className="space-y-3">
        {rows.map((r) => (
          <section key={r.id} className="panel p-4" aria-label={r.title}>
            <h2 className="font-display text-base font-semibold">{r.title}</h2>
            <p className="text-xs text-muted-foreground">{r.guidance}</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Estado: ${r.title}`}>
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={r.status === s ? "default" : "outline"}
                  aria-pressed={r.status === s}
                  onClick={() => actions.setCommercialControl(auditId, r.id, { status: r.status === s ? null : s })}
                >
                  {COMMERCIAL_STATUS_LABELS[s]}
                </Button>
              ))}
              {!r.status && <span className="self-center text-xs text-muted-foreground">Sin evaluar</span>}
            </div>
            <Textarea
              className="mt-2"
              placeholder="Notas (qué se revisó, cómo y en qué fecha)"
              aria-label={`Notas: ${r.title}`}
              value={r.notes}
              onChange={(e) => actions.setCommercialControl(auditId, r.id, { notes: e.target.value })}
            />
            <label className="mt-2 block text-xs font-medium" htmlFor={`ev-${r.id}`}>
              URL de evidencia
            </label>
            <Input
              id={`ev-${r.id}`}
              type="url"
              inputMode="url"
              className="mt-1"
              placeholder="https://… (captura en Drive, página revisada, ficha en OTA)"
              value={r.evidenceUrl}
              aria-invalid={!!r.evidenceUrl.trim() && !isValidEvidenceUrl(r.evidenceUrl)}
              onChange={(e) => actions.setCommercialControl(auditId, r.id, { evidenceUrl: e.target.value })}
            />
            {r.evidenceUrl.trim() && !isValidEvidenceUrl(r.evidenceUrl) && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                Formato no válido: la URL debe empezar con http:// o https://. No se mostrará en el informe.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

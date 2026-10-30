import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { DemoBadge, EmptyState } from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { actions, useAudit, useCommercialReview, useGscConnection } from "@/store/app-store";
import {
  appendSuggestionToNotes,
  EVIDENCE_LEVEL_LABELS,
  generateCommercialSuggestions,
  type CommercialSuggestion,
} from "@/seo/tourism/commercial-suggestions";
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

function SuggestionBox({ s, currentUrl, onCopy, onUseUrl, onDismiss }: {
  s: CommercialSuggestion;
  currentUrl: string;
  onCopy: () => void;
  onUseUrl: (u: string) => void;
  onDismiss: () => void;
}) {
  const [confirmUrl, setConfirmUrl] = useState(false);
  const tone = s.evidenceLevel === "full" ? "border-primary" : s.evidenceLevel === "partial" ? "border-accent" : "border-border";
  return (
    <div className={`mt-3 rounded-md border border-dashed ${tone} bg-muted/40 p-3 text-sm`} aria-label="Sugerencia">
      <p className="text-xs font-semibold">Sugerencia · {EVIDENCE_LEVEL_LABELS[s.evidenceLevel]}</p>
      {s.suggestedNote ? <p className="mt-1">{s.suggestedNote}</p> : <p className="mt-1 text-muted-foreground">No hay datos del rastreo para proponer una observación.</p>}
      <p className="mt-1 text-xs text-muted-foreground">Limitación: {s.limitation}</p>
      {s.evidenceUrl && <p className="mt-1 text-xs break-all">URL propuesta: {s.evidenceUrl}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {s.suggestedNote && <Button size="sm" variant="outline" onClick={onCopy}>Copiar a notas</Button>}
        {s.evidenceUrl && !confirmUrl && (
          <Button size="sm" variant="outline" onClick={() => setConfirmUrl(true)}>Usar como URL de evidencia</Button>
        )}
        {s.evidenceUrl && confirmUrl && (
          <>
            <span className="self-center text-xs">{currentUrl.trim() ? "Reemplaza la URL actual. ¿Confirmar?" : "¿Confirmar?"}</span>
            <Button size="sm" onClick={() => { onUseUrl(s.evidenceUrl!); setConfirmUrl(false); }}>Confirmar</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmUrl(false)}>Cancelar</Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={onDismiss}>Descartar</Button>
      </div>
    </div>
  );
}

function CommercialPage() {
  const { auditId } = Route.useParams();
  const audit = useAudit(auditId);
  const review = useCommercialReview(auditId);
  const gsc = useGscConnection(auditId);
  // Sugerencias asociadas a la auditoría que las generó: si cambia auditId, no se muestran.
  const [suggestionState, setSuggestionState] = useState<{ auditId: string; items: Record<string, CommercialSuggestion> } | null>(null);
  const [dismissedState, setDismissedState] = useState<{ auditId: string; ids: Set<string> }>({ auditId, ids: new Set() });
  const suggestions = suggestionState && suggestionState.auditId === auditId ? suggestionState.items : null;
  const dismissed = dismissedState.auditId === auditId ? dismissedState.ids : new Set<string>();
  const setSuggestions = (items: Record<string, CommercialSuggestion>) => setSuggestionState({ auditId, items });
  const setDismissed = (fn: (d: Set<string>) => Set<string>) => setDismissedState({ auditId, ids: fn(dismissed) });
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => { setSuggestions(generateCommercialSuggestions(audit, gsc)); setDismissed(() => new Set()); }}>
          Sugerir observaciones desde la auditoría
        </Button>
        {suggestions && (
          <span className="text-xs text-muted-foreground">
            Sugerencias basadas solo en el rastreo de esta auditoría. No se guardan ni cambian estados hasta que las aceptes.
          </span>
        )}
      </div>
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
            {suggestions && suggestions[r.id] && !dismissed.has(r.id) && (
              <SuggestionBox
                s={suggestions[r.id]!}
                currentUrl={r.evidenceUrl}
                onCopy={() => actions.setCommercialControl(auditId, r.id, { notes: appendSuggestionToNotes(r.notes, suggestions[r.id]!.suggestedNote) })}
                onUseUrl={(u) => actions.setCommercialControl(auditId, r.id, { evidenceUrl: u })}
                onDismiss={() => setDismissed((d) => new Set(d).add(r.id))}
              />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

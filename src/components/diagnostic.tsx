/**
 * Presentación del diagnóstico SEO. Solo lee datos derivados (src/seo/diagnostics.ts):
 * no ejecuta reglas ni recalcula scores.
 */
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, ExternalLink, ScrollText } from "lucide-react";
import { CategoryBadge, PriorityBadge, PAGE_TYPE_LABELS, SeverityBadge } from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KIND_LABELS } from "@/seo/rules";
import { actions, useAppState } from "@/store/app-store";
import type { Diagnostic, DiagnosticGroup } from "@/seo/diagnostics";

function ReviewedButton({ diagnostic }: { diagnostic: Diagnostic }) {
  const reviewed = useAppState((s) =>
    (s.reviewed ?? []).includes(`${diagnostic.auditId}:${diagnostic.findingId}`),
  );
  return (
    <Button
      size="sm"
      variant={reviewed ? "secondary" : "outline"}
      onClick={() => actions.toggleReviewed(diagnostic.auditId, diagnostic.findingId)}
    >
      {reviewed ? (
        <CheckCircle2 className="mr-1 size-3.5" />
      ) : (
        <Circle className="mr-1 size-3.5" />
      )}
      {reviewed ? "Revisado" : "Marcar revisado"}
    </Button>
  );
}

export function DiagnosticBody({ diagnostic }: { diagnostic: Diagnostic }) {
  const d = diagnostic;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={d.severity} />
        <PriorityBadge label={d.priorityLabel} />
        <CategoryBadge category={d.category} />
        <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {KIND_LABELS[d.kind]}
        </span>
        {d.field && <span className="font-mono text-[11px] text-muted-foreground">{d.field}</span>}
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Prioridad: </span>
        {d.priorityExplanation}
      </p>

      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Auditoría / sitio</dt>
          <dd className="font-medium">
            {d.auditName}
            {d.isDemo ? " (demo)" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">URL afectada</dt>
          <dd className="break-all font-medium">{d.pageUrl}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tipo de página</dt>
          <dd className="font-medium">
            {d.pageType ? PAGE_TYPE_LABELS[d.pageType] : "No determinado"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">URLs afectadas por esta regla</dt>
          <dd className="font-medium">{d.occurrences}</dd>
        </div>
      </dl>

      <section className="rounded-lg border border-border bg-muted/40 p-3">
        <h4 className="text-[11px] font-semibold uppercase text-muted-foreground">
          Qué detectamos
        </h4>
        <p className="mt-1 text-sm">{d.detected}</p>
        {d.current && (
          <p className="mt-2 break-words text-xs text-muted-foreground">
            Valor actual: <span className="font-medium text-foreground">{d.current}</span>
          </p>
        )}
      </section>

      {d.why && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase text-muted-foreground">
            Por qué importa
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">{d.why}</p>
        </section>
      )}

      {d.recommendation ? (
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <h4 className="text-[11px] font-semibold uppercase text-primary">Qué recomendamos</h4>
          <p className="mt-1 break-words text-sm">{d.recommendation}</p>
        </section>
      ) : (
        <p className="text-xs text-muted-foreground">
          Esta regla detecta el problema pero no genera un valor sugerido automático; requiere
          revisión manual.
        </p>
      )}

      {pickEvidence(d).length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase text-muted-foreground">Evidencia</h4>
          <EvidenceList items={pickEvidence(d)} max={12} className="mt-1" />
        </section>
      )}

      <p className="text-xs">
        <span className="text-muted-foreground">Impacto estimado: </span>
        {typeof d.estimatedPoints === "number" ? (
          <span className="font-semibold">
            +{d.estimatedPoints.toLocaleString("es-AR")} puntos de score al resolver la regla
            completa
          </span>
        ) : (
          <span className="text-muted-foreground">
            no calculado por el sistema para esta regla
          </span>
        )}
      </p>

      {d.pending && (
        <p className="rounded-lg border border-important/40 bg-important/10 p-2 text-xs">
          {d.pendingReason}
        </p>
      )}
    </div>
  );
}

export function DiagnosticActions({
  diagnostic,
  extra,
}: {
  diagnostic: Diagnostic;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" asChild>
        <Link
          to="/audits/$auditId/url/$pageId"
          params={{ auditId: diagnostic.auditId, pageId: diagnostic.pageId }}
        >
          <ExternalLink className="mr-1 size-3.5" /> Ver URL
        </Link>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <Link to="/rules" search={{ rule: diagnostic.ruleId }}>
          <ScrollText className="mr-1 size-3.5" /> Ver regla
        </Link>
      </Button>
      <ReviewedButton diagnostic={diagnostic} />
      {extra}
    </div>
  );
}

export function DiagnosticDialog({
  diagnostic,
  open,
  onOpenChange,
  extraActions,
}: {
  diagnostic: Diagnostic | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  extraActions?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {diagnostic && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">{diagnostic.ruleName}</DialogTitle>
              <DialogDescription>
                {diagnostic.auditName} · {diagnostic.pagePath}
              </DialogDescription>
            </DialogHeader>
            <DiagnosticBody diagnostic={diagnostic} />
            <DiagnosticActions diagnostic={diagnostic} extra={extraActions} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Problema agrupado: una regla, N URLs afectadas dentro de la MISMA auditoría. */
export function DiagnosticGroupCard({ group }: { group: DiagnosticGroup }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Diagnostic | null>(null);

  return (
    <article className="rounded-lg border border-border p-3">
      <header className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={group.severity} />
        <PriorityBadge label={group.priorityLabel} />
        <CategoryBadge category={group.category} />
        <h4 className="text-sm font-semibold">{group.ruleName}</h4>
        <span className="text-xs text-muted-foreground">
          {group.items.length} URL{group.items.length === 1 ? "" : "s"} afectada
          {group.items.length === 1 ? "" : "s"}
        </span>
        {typeof group.estimatedPoints === "number" && (
          <span className="text-xs text-muted-foreground">
            · impacto estimado +{group.estimatedPoints.toLocaleString("es-AR")} pts
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Ocultar URLs" : "Ver URLs"}
        </Button>
      </header>
      {group.why && <p className="mt-1 text-xs text-muted-foreground">{group.why}</p>}

      {open && (
        <ul className="mt-3 divide-y divide-border text-xs">
          {group.items.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center gap-2 py-2">
              <SeverityBadge severity={item.severity} />
              <Link
                to="/audits/$auditId/url/$pageId"
                params={{ auditId: item.auditId, pageId: item.pageId }}
                className="truncate font-medium hover:text-primary"
              >
                {item.pagePath}
              </Link>
              <span className="text-muted-foreground">
                {item.pageType ? PAGE_TYPE_LABELS[item.pageType] : "—"}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => setDetail(item)}
              >
                Diagnóstico
              </Button>
            </li>
          ))}
        </ul>
      )}

      <DiagnosticDialog
        diagnostic={detail}
        open={Boolean(detail)}
        onOpenChange={(v) => !v && setDetail(null)}
      />
    </article>
  );
}

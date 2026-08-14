/**
 * FASE 5 — Componentes de presentación para "Contenido y oportunidades".
 * Solo UI: no calculan señales ni tocan el score.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CategoryBadge, PAGE_TYPE_LABELS, SeverityBadge } from "@/components/seo-ui";
import { DiagnosticDialog } from "@/components/diagnostic";
import { buildDiagnosticById, type Diagnostic } from "@/seo/diagnostics";
import { CONTENT_CLASS_LABELS, type ContentClass, type ContentItem, type ContentPairGroup } from "@/seo/content-analysis";
import type { Audit } from "@/seo/types";
import { cn } from "@/lib/utils";

const CLASS_CLASSES: Record<ContentClass, string> = {
  problem: "bg-critical-soft text-critical border-critical/30",
  improvement: "bg-important-soft text-important-foreground border-important/40",
  opportunity: "bg-improvement-soft text-improvement border-improvement/30",
};

export function ContentClassBadge({ value }: { value: ContentClass }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        CLASS_CLASSES[value],
      )}
    >
      {CONTENT_CLASS_LABELS[value]}
    </span>
  );
}

export function ContentItemCard({ audit, item }: { audit: Audit; item: ContentItem }) {
  const [open, setOpen] = useState(false);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);

  return (
    <article className="rounded-lg border border-border p-3">
      <header className="flex flex-wrap items-center gap-2">
        <ContentClassBadge value={item.classification} />
        {item.severity && <SeverityBadge severity={item.severity} />}
        <CategoryBadge category={item.category} />
        <h4 className="text-sm font-semibold">{item.signalName}</h4>
        <span className="text-xs text-muted-foreground">
          {PAGE_TYPE_LABELS[item.pageType]} · {item.contextLabel}
        </span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen((v) => !v)}>
          {open ? "Ocultar detalle" : "Ver detalle"}
        </Button>
      </header>

      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <Link
          to="/audits/$auditId/url/$pageId"
          params={{ auditId: item.auditId, pageId: item.pageId }}
          className="truncate font-medium hover:text-primary"
        >
          {item.pagePath}
        </Link>
        <span className="text-muted-foreground">{item.pageUrl}</span>
      </div>

      {open && (
        <div className="mt-3 space-y-2 text-xs">
          <p className="text-muted-foreground">{item.explanation}</p>
          <div>
            <span className="font-semibold">Evidencia</span>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {item.evidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
          <p>
            <span className="font-semibold">Recomendación: </span>
            <span className="text-muted-foreground">{item.recommendation}</span>
          </p>
          <p className="text-muted-foreground">
            <span className="font-semibold">Criterio: </span>
            {item.criterion}
          </p>
          {item.architectureNote && (
            <p className="text-muted-foreground">
              <span className="font-semibold">Relación con arquitectura: </span>
              {item.architectureNote}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {item.relatedFindingId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDiagnostic(buildDiagnosticById(audit, item.relatedFindingId!))}
              >
                Ver diagnóstico del hallazgo
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link
                to="/audits/$auditId/url/$pageId"
                params={{ auditId: item.auditId, pageId: item.pageId }}
              >
                Ver URL
              </Link>
            </Button>
          </div>
        </div>
      )}

      <DiagnosticDialog
        diagnostic={diagnostic}
        open={Boolean(diagnostic)}
        onOpenChange={(v) => !v && setDiagnostic(null)}
      />
    </article>
  );
}

export function ContentGroupCard({ group }: { group: ContentPairGroup }) {
  return (
    <article className="rounded-lg border border-border p-3">
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">{group.title}</h4>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            group.confirmed
              ? "border-critical/30 bg-critical-soft text-critical"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          {group.confirmed ? "Confirmado por la regla existente" : "Potencial"}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{group.pages.length} URLs</span>
      </header>
      <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
        {group.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      <ul className="mt-2 divide-y divide-border text-xs">
        {group.pages.map((p) => (
          <li key={p.pageId} className="flex flex-wrap items-center gap-2 py-1.5">
            <Link
              to="/audits/$auditId/url/$pageId"
              params={{ auditId: group.auditId, pageId: p.pageId }}
              className="truncate font-medium hover:text-primary"
            >
              {p.path}
            </Link>
            <span className="text-muted-foreground">{PAGE_TYPE_LABELS[p.pageType]}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

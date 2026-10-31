import { evidenceToStrings } from "@/seo/evidence";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { CategoryBadge, EmptyState, PAGE_TYPE_LABELS, SeverityBadge } from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getConnector } from "@/seo/connectors";
import { buildDiagnostic } from "@/seo/diagnostics";
import { KIND_HINTS, kindLabel } from "@/seo/rules";
import { DiagnosticDialog } from "@/components/diagnostic";
import { PageContextPanel } from "@/components/page-context-ui";
import { PageLinksPanel } from "@/components/link-graph-ui";
import { actions, useAppState } from "@/store/app-store";
import type { Audit, ChangeProposal, Finding, PageSnapshot, PlatformId } from "@/seo/types";

export const Route = createFileRoute("/audits/$auditId/url/$pageId")({
  head: () => ({
    meta: [
      { title: "Detalle de URL — SEO Fixer" },
      {
        name: "description",
        content: "Todos los hallazgos de una URL con comparación Actual vs Sugerido y aprobación.",
      },
      { property: "og:title", content: "Detalle de URL — SEO Fixer" },
      { property: "og:description", content: "Actual vs Sugerido, con aprobación de cambios." },
    ],
  }),
  component: UrlDetail,
});

function UrlDetail() {
  const { auditId, pageId } = Route.useParams();
  const audit = useAppState((s) => s.audits.find((a) => a.id === auditId));
  const changes = useAppState((s) =>
    s.changes.filter((c) => c.pageId === pageId && c.auditId === auditId),
  );
  const page = audit?.pages.find((p) => p.id === pageId);
  const findings = (audit?.findings ?? []).filter((f) => f.pageId === pageId);

  if (!audit || !page) {
    return (
      <EmptyState
        title="URL no encontrada"
        description="La auditoría o la URL no existen en este navegador."
        action={
          <Button asChild>
            <Link to="/audits">Volver a auditorías</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <Link
        to="/audits/$auditId"
        params={{ auditId }}
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Volver a los resultados
      </Link>

      <PageHeader
        title={page.path}
        description={`${page.url} · ${PAGE_TYPE_LABELS[page.pageType]} · HTTP ${page.statusCode} · profundidad ${page.depth}`}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="panel h-fit p-5">
          <h2 className="font-display text-base font-semibold">Datos de la página</h2>
          <dl className="mt-3 space-y-3 text-xs">
            <Row label="Title" value={page.title ?? "—"} />
            <Row label="Meta description" value={page.metaDescription ?? "—"} />
            <Row label="H1" value={page.h1.join(" | ") || "—"} />
            <Row label="H2" value={String(page.h2.length)} />
            <Row label="Palabras" value={String(page.wordCount)} />
            <Row
              label="Indexabilidad"
              value={
                /noindex/i.test(page.robotsMeta ?? "")
                  ? "No indexable (noindex)"
                  : page.statusCode >= 400
                    ? `No indexable (HTTP ${page.statusCode})`
                    : page.statusCode >= 300
                      ? `Redirección (HTTP ${page.statusCode})`
                      : page.canonical && page.canonical !== page.url
                        ? "Indexable, canonical apunta a otra URL"
                        : "Indexable"
              }
            />
            <Row label="Canonical" value={page.canonical ?? "—"} />
            <Row label="Meta robots" value={page.robotsMeta ?? "(por defecto)"} />
            <Row label="Schema" value={page.schemaTypes.join(", ") || "—"} />
            <Row
              label="Imágenes"
              value={`${page.images.length} (${page.images.filter((i) => !i.alt).length} sin ALT)`}
            />
            <Row label="Enlaces internos" value={String(page.internalLinks.length)} />
            <Row label="Viewport móvil" value={page.hasViewport ? "Sí" : "No"} />
            <Row label="Peso HTML" value={`${page.htmlSizeKb ?? 0} KB`} />
            <Row
              label="Origen de descubrimiento"
              value={
                page.discoveredVia === "seed"
                  ? "URL raíz / puntual"
                  : page.discoveredVia === "sitemap"
                    ? "sitemap.xml"
                    : page.discoveredVia === "internal-link"
                      ? "Enlace interno"
                      : page.discoveredVia === "both"
                        ? "Sitemap + enlace interno"
                        : "—"
              }
            />
          </dl>
          <ImageList page={page} />
        </aside>

        <div className="space-y-4">
          <PageContextPanel audit={audit} page={page} findings={findings} />
          <PageLinksPanel audit={audit} page={page} />
          {findings.length === 0 && (
            <div className="panel p-6 text-sm text-muted-foreground">
              Sin hallazgos para esta URL con las reglas activas.
            </div>
          )}
          {findings.map((f) => (
            <FindingCard
              key={f.id}
              audit={audit}
              finding={f}
              change={changes.find((c) => c.findingId === f.id)}
              platform={audit.platform}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words">{value}</dd>
    </div>
  );
}

function ImageList({ page }: { page: PageSnapshot }) {
  if (page.images.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Imágenes
      </h3>
      <ul className="mt-2 space-y-1.5 text-xs">
        {page.images.map((img) => (
          <li key={img.src} className="flex items-start justify-between gap-2">
            <span className="truncate font-mono text-[11px]">{img.fileName ?? img.src}</span>
            <span className={img.alt ? "text-okay" : "text-critical"}>
              {img.alt ? "ALT ok" : "sin ALT"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FindingCard({
  audit,
  finding,
  change,
  platform,
}: {
  audit: Audit;
  finding: Finding;
  change?: ChangeProposal | undefined;
  platform: PlatformId;
}) {
  const [editing, setEditing] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const diagnostic = buildDiagnostic(audit, finding);
  const [draft, setDraft] = useState(change?.editedValue ?? change?.suggestedValue ?? "");
  const connector = getConnector(platform);
  const writable = change?.writable ?? false;

  return (
    <article className="panel p-5">
      <header className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        <CategoryBadge category={finding.category} />
        <span
          className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          title={finding.kind ? KIND_HINTS[finding.kind] : undefined}
        >
          {kindLabel(finding.kind)}
        </span>
        <h3 className="font-display text-base font-semibold">{finding.ruleName}</h3>
        <span className="ml-auto text-xs text-muted-foreground">Impacto {finding.impact}/10</span>
        <Button size="sm" variant="outline" onClick={() => setShowDiagnostic(true)}>
          Ver diagnóstico
        </Button>
      </header>

      <DiagnosticDialog
        diagnostic={diagnostic}
        open={showDiagnostic}
        onOpenChange={setShowDiagnostic}
      />

      <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
        {finding.pageUrl}
      </p>
      <p className="mt-3 text-sm font-medium">{finding.problem}</p>
      <p className="mt-1 text-xs text-muted-foreground">{finding.explanation}</p>
      {finding.evidence && finding.evidence.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
          <EvidenceList items={finding.evidence} max={10} />
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Actual
          </p>
          <p className="mt-1 break-words text-sm">{finding.current}</p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Sugerido</p>
          {editing && change ? (
            <Textarea
              className="mt-1 text-sm"
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : (
            <p className="mt-1 break-words text-sm">
              {change?.editedValue ?? finding.suggestion ?? "Revisión manual recomendada."}
            </p>
          )}
        </div>
      </div>

      {change && (
        <footer className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
            Estado: {STATUS_LABELS[change.status]}
          </span>
          {change.history && change.history.length > 1 && (
            <span className="text-[11px] text-muted-foreground">
              {change.history.length} cambios de estado registrados
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">
            {writable
              ? `${connector?.name} puede escribir este campo`
              : "Este conector no permite escribir el campo: se exporta como instrucción"}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {editing ? (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    actions.editChange(change.id, draft);
                    setEditing(false);
                    toast.success("Sugerencia editada");
                  }}
                >
                  Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1 size-3.5" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    actions.setChangeStatus(change.id, "rejected");
                    toast("Cambio rechazado");
                  }}
                >
                  <X className="mr-1 size-3.5" /> Rechazar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    actions.setChangeStatus(change.id, "approved");
                    toast.success("Cambio aprobado");
                  }}
                >
                  <Check className="mr-1 size-3.5" /> Aprobar
                </Button>
              </>
            )}
          </div>
        </footer>
      )}
    </article>
  );
}

export const STATUS_LABELS: Record<ChangeProposal["status"], string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  applied: "Aplicado",
};

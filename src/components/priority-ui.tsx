/**
 * FASE 6B — Componentes de la capa de Prioridades SEO.
 * Solo presentación: no calcula prioridades ni modifica hallazgos/score.
 */
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryBadge, SeverityBadge } from "@/components/seo-ui";
import { PRIORITY_DOTS, PRIORITY_LABELS, type SeoOpportunity } from "@/seo/priority/types";
import { actions, useAppState } from "@/store/app-store";

export function PriorityBadge({ level }: { level: SeoOpportunity["priority"] }) {
  const cls =
    level === "high"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : level === "medium"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  return (
    <Badge variant="outline" className={cls}>
      {PRIORITY_DOTS[level]} {PRIORITY_LABELS[level]}
    </Badge>
  );
}

function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

export function OpportunityCard({ opportunity: o }: { opportunity: SeoOpportunity }) {
  const reviewedKey = `${o.auditId}:${o.id}`;
  const reviewed = useAppState((s) => (s.reviewed ?? []).includes(reviewedKey));
  const change = useAppState((s) =>
    s.changes.find(
      (c) =>
        c.auditId === o.auditId &&
        o.diagnostics.some((d) => d.findingId === c.findingId) &&
        c.status === "pending",
    ),
  );

  return (
    <article className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge level={o.priority} />
            <Badge variant="secondary">{o.typeLabel}</Badge>
            <CategoryBadge category={o.category} />
            {o.gsc.source === "demo" && (
              <Badge variant="outline" className="border-dashed">
                Datos GSC de demostración
              </Badge>
            )}
            {o.matchState === "gsc-only" && (
              <Badge variant="outline">Solo en GSC (no analizada por el crawler)</Badge>
            )}
          </div>
          <p className="mt-2 truncate font-mono text-sm font-medium">{o.path}</p>
          <p className="truncate text-xs text-muted-foreground">{o.url}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div className="font-display text-lg font-semibold text-foreground">
            {o.gsc.metrics.impressions.toLocaleString("es-AR")}
          </div>
          impresiones · {o.gsc.metrics.clicks} clics
          <div>
            CTR {pct(o.gsc.metrics.ctr)} · pos. {o.gsc.metrics.position.toFixed(1)}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm">{o.explanation}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {o.evidence.map((e) => (
          <Badge key={e} variant="outline" className="font-normal">
            {e}
          </Badge>
        ))}
      </div>

      {o.diagnostics.length > 0 && (
        <div className="mt-3 rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium">Diagnósticos relacionados (sin modificar)</p>
          <ul className="mt-2 space-y-1">
            {o.diagnostics.slice(0, 4).map((d) => (
              <li key={d.findingId} className="flex flex-wrap items-center gap-2 text-xs">
                <SeverityBadge severity={d.severity} />
                <span className="font-medium">{d.ruleName}</span>
                <span className="text-muted-foreground">({d.ruleId})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {o.gsc.topQueries.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Consulta</th>
                <th className="py-1 text-right font-medium">Clics</th>
                <th className="py-1 text-right font-medium">Impresiones</th>
                <th className="py-1 text-right font-medium">CTR</th>
                <th className="py-1 text-right font-medium">Posición</th>
              </tr>
            </thead>
            <tbody>
              {o.gsc.topQueries.map((q) => (
                <tr key={q.query} className="border-t">
                  <td className="py-1 pr-2">{q.query}</td>
                  <td className="py-1 text-right">{q.clicks}</td>
                  <td className="py-1 text-right">{q.impressions}</td>
                  <td className="py-1 text-right">{pct(q.ctr)}</td>
                  <td className="py-1 text-right">{q.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-sm">
        <span className="font-medium">Recomendación: </span>
        {o.recommendation}
      </p>

      <details className="mt-3 rounded-md border p-3">
        <summary className="cursor-pointer text-xs font-medium">
          ¿Por qué está priorizada así?
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">{o.priorityExplanation}</p>
        <ul className="mt-2 space-y-1">
          {o.factors.map((f) => (
            <li key={f.id} className="text-xs">
              <span className="font-medium">
                {f.label}: {f.value}/{f.max}
              </span>{" "}
              <span className="text-muted-foreground">
                (peso {Math.round(f.weight * 100)}%) — {f.reason}
              </span>
            </li>
          ))}
        </ul>
        {o.gsc.trend ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Tendencia de impresiones: {o.gsc.trend.firstHalfImpressions} →{" "}
            {o.gsc.trend.secondHalfImpressions}. {o.gsc.trend.note}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Sin datos suficientes para calcular tendencia en el período importado.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          La priorización es independiente del SEO Score: no modifica el total, las categorías ni
          los drivers.
        </p>
      </details>

      <div className="mt-3 flex flex-wrap gap-2">
        {o.pageId ? (
          <Button asChild size="sm" variant="outline">
            <Link
              to="/audits/$auditId/url/$pageId"
              params={{ auditId: o.auditId, pageId: o.pageId }}
            >
              Ver URL
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <a href={o.url} target="_blank" rel="noreferrer">
              Abrir URL <ExternalLink className="ml-1 size-3" />
            </a>
          </Button>
        )}
        {o.pageId && o.diagnostics.length > 0 && (
          <Button asChild size="sm" variant="outline">
            <Link
              to="/audits/$auditId/url/$pageId"
              params={{ auditId: o.auditId, pageId: o.pageId }}
              hash="diagnostico"
            >
              Ver diagnóstico
            </Link>
          </Button>
        )}
        {o.ruleIds.length > 0 && (
          <Button asChild size="sm" variant="outline">
            <Link to="/rules">
              Ver regla
            </Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to="/audits/$auditId/gsc" params={{ auditId: o.auditId }}>
            Ver datos GSC
          </Link>
        </Button>
        {change && (
          <>
            <Button
              size="sm"
              onClick={() => actions.setChangeStatus(change.id, "approved")}
            >
              Aprobar cambio
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => actions.setChangeStatus(change.id, "rejected")}
            >
              Rechazar
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant={reviewed ? "secondary" : "ghost"}
          onClick={() => actions.toggleReviewed(o.auditId, o.id)}
        >
          {reviewed ? "Revisada ✓" : "Marcar revisada"}
        </Button>
      </div>
    </article>
  );
}

/**
 * FASE 3 — UI del contexto On-Page por tipo de página.
 * Solo lee datos derivados (src/seo/page-context.ts): no ejecuta reglas ni
 * recalcula el score. Muestra por qué a una página se le aplicaron ciertas
 * reglas y cuáles se omitieron por su contexto.
 */
import { useMemo, useState } from "react";
import { PAGE_TYPE_LABELS } from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import { getConnector } from "@/seo/connectors";
import { resolvePageContext, ruleCoverageFor } from "@/seo/page-context";
import { useAppState } from "@/store/app-store";
import type { Audit, Finding, PageSnapshot, PageType } from "@/seo/types";

const OPPORTUNITY_KINDS = new Set(["opportunity", "heuristic"]);

function tagsFor(audit: Audit) {
  return getConnector(audit.platform)?.ruleTags ?? [];
}

/** Panel de contexto de una URL: tipo, confianza, expectativas y reglas aplicadas. */
export function PageContextPanel({
  audit,
  page,
  findings,
}: {
  audit: Audit;
  page: PageSnapshot;
  findings: Finding[];
}) {
  const disabled = useAppState((s) => s.settings.disabledRules);
  const [showSkipped, setShowSkipped] = useState(false);
  const ctx = resolvePageContext(page);
  const coverage = useMemo(
    () => ruleCoverageFor(page, tagsFor(audit), disabled),
    [page, audit, disabled],
  );

  const onPageApplied = coverage.applied.filter((r) => r.category === "onpage" || r.category === "content");
  const skippedByType = coverage.skippedByContext.filter((r) => r.pageTypes || r.excludedPageTypes);
  const problems = findings.filter((f) => f.severity === "critical" || f.severity === "important");
  const opportunities = findings.filter(
    (f) => !problems.includes(f) && OPPORTUNITY_KINDS.has(f.kind),
  );

  return (
    <section className="panel p-5">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-base font-semibold">Contexto de la página</h2>
        <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {PAGE_TYPE_LABELS[ctx.pageType]}
        </span>
        {ctx.contextKey !== ctx.pageType && (
          <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {ctx.profile.label}
          </span>
        )}
      </header>

      <p className="mt-2 text-sm text-muted-foreground">
        Esta página fue clasificada como <strong className="text-foreground">{ctx.profile.label}</strong>{" "}
        y por eso se aplicaron las reglas on-page de ese contexto. {ctx.profile.note}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Confianza: {ctx.confidenceLabel}.</p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <ContextStat label="Reglas aplicadas" value={coverage.applied.length} />
        <ContextStat label="On-page / contenido" value={onPageApplied.length} />
        <ContextStat label="Problemas" value={problems.length} />
        <ContextStat label="Oportunidades" value={opportunities.length} />
      </dl>

      <div className="mt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Qué se espera de este tipo de página
        </h3>
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {ctx.profile.expectations.map((e) => (
            <li key={e}>· {e}</li>
          ))}
        </ul>
      </div>

      {ctx.profile.minWords === null && (
        <p className="mt-3 rounded-lg border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
          Por contexto, esta página no se penaliza por cantidad de palabras.
        </p>
      )}

      {skippedByType.length > 0 && (
        <div className="mt-4">
          <Button size="sm" variant="ghost" onClick={() => setShowSkipped((v) => !v)}>
            {showSkipped ? "Ocultar" : "Ver"} {skippedByType.length} regla
            {skippedByType.length === 1 ? "" : "s"} omitida
            {skippedByType.length === 1 ? "" : "s"} por contexto
          </Button>
          {showSkipped && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {skippedByType.map((r) => (
                <li key={r.id}>
                  · <span className="font-medium text-foreground">{r.name}</span> — no corresponde a
                  una página de tipo {ctx.profile.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function ContextStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-2">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-semibold">{value}</dd>
    </div>
  );
}

/** Resumen contextual por tipo de página de una auditoría. */
export function PageTypeSummary({ audit }: { audit: Audit }) {
  const disabled = useAppState((s) => s.settings.disabledRules);
  const rows = useMemo(() => {
    const tags = tagsFor(audit);
    const byType = new Map<PageType, PageSnapshot[]>();
    for (const p of audit.pages) {
      const list = byType.get(p.pageType);
      if (list) list.push(p);
      else byType.set(p.pageType, [p]);
    }
    return [...byType.entries()].map(([type, pages]) => {
      const ids = new Set(pages.map((p) => p.id));
      const findings = audit.findings.filter((f) => ids.has(f.pageId));
      const applied = new Set<string>();
      const skipped = new Set<string>();
      for (const p of pages) {
        const cov = ruleCoverageFor(p, tags, disabled);
        cov.applied.forEach((r) => applied.add(r.id));
        cov.skippedByContext
          .filter((r) => r.pageTypes || r.excludedPageTypes)
          .forEach((r) => skipped.add(r.id));
      }
      for (const id of applied) skipped.delete(id);
      const problems = findings.filter(
        (f) => f.severity === "critical" || f.severity === "important",
      );
      return {
        type,
        label: resolvePageContext(pages[0]!).profile.label,
        pages: pages.length,
        applied: applied.size,
        problems: problems.length,
        opportunities: findings.filter((f) => !problems.includes(f) && OPPORTUNITY_KINDS.has(f.kind))
          .length,
        skipped: skipped.size,
      };
    });
  }, [audit, disabled]);

  if (rows.length === 0) return null;

  return (
    <section className="panel mt-4 p-4">
      <h2 className="font-display text-base font-semibold">Resumen contextual por tipo de página</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Las reglas on-page se evalúan según la naturaleza de cada URL. Solo datos de esta auditoría.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Tipo de página</th>
              <th className="px-3 py-2 font-medium">URLs</th>
              <th className="px-3 py-2 font-medium">Reglas aplicadas</th>
              <th className="px-3 py-2 font-medium">Problemas</th>
              <th className="px-3 py-2 font-medium">Oportunidades</th>
              <th className="px-3 py-2 font-medium">Omitidas por contexto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.type}>
                <td className="px-3 py-2 font-medium">
                  {PAGE_TYPE_LABELS[r.type]}
                  {r.label !== PAGE_TYPE_LABELS[r.type] && (
                    <span className="block text-[11px] text-muted-foreground">{r.label}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.pages}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.applied}</td>
                <td className="px-3 py-2 font-semibold">{r.problems}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.opportunities}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.skipped}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { CategoryBadge, SeverityBadge } from "@/components/seo-ui";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_LABELS, KIND_HINTS, KIND_LABELS, RULES } from "@/seo/rules";
import { PAGE_CONTEXT_LABELS } from "@/seo/page-context";
import { actions, useAppState } from "@/store/app-store";

export const Route = createFileRoute("/rules")({
  validateSearch: (search: Record<string, unknown>): { rule?: string | undefined } =>
    typeof search["rule"] === "string" ? { rule: search["rule"] } : {},
  head: () => ({
    meta: [
      { title: "Reglas SEO — SEO Fixer" },
      {
        name: "description",
        content:
          "Catálogo de reglas universales y específicas por plataforma, con severidad, impacto y explicación.",
      },
      { property: "og:title", content: "Reglas SEO — SEO Fixer" },
      { property: "og:description", content: "Reglas universales y por plataforma, configurables." },
    ],
  }),
  component: Rules,
});

function Rules() {
  const { rule } = Route.useSearch();
  const disabled = useAppState((s) => s.settings.disabledRules);
  const [query, setQuery] = useState(rule ?? "");

  const rows = RULES.filter((r) =>
    query.trim()
      ? `${r.name} ${r.id} ${CATEGORY_LABELS[r.category]} ${KIND_LABELS[r.kind]} ${r.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase())
      : true,
  );

  return (
    <>
      <PageHeader
        title="Reglas SEO"
        description="Cada regla declara categoría, naturaleza (técnico, indexación, on-page, oportunidad o recomendación heurística), severidad base, impacto estimado y por qué importa. Las heurísticas son buenas prácticas del sector, no reglas de Google."
      />

      <div className="panel mb-4 p-4">
        <Input
          className="max-w-sm"
          placeholder="Buscar regla, categoría o plataforma…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <article key={r.id} className="panel p-4">
            <header className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={r.severity} />
              <CategoryBadge category={r.category} />
              <span
                className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                title={KIND_HINTS[r.kind]}
              >
                {KIND_LABELS[r.kind]}
              </span>
              <h3 className="font-display text-sm font-semibold">{r.name}</h3>
              <span className="font-mono text-[11px] text-muted-foreground">{r.id}</span>
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Impacto {r.impact}/10</span>
                <Switch
                  checked={!disabled.includes(r.id)}
                  onCheckedChange={() => actions.toggleRule(r.id)}
                  aria-label="Activar regla"
                />
              </div>
            </header>
            <p className="mt-2 text-xs text-muted-foreground">{r.explanation}</p>
            {(r.pageTypes || r.excludedPageTypes) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {r.pageTypes && (
                  <>
                    Se evalúa solo en:{" "}
                    <span className="font-medium text-foreground">
                      {r.pageTypes.map((t) => PAGE_CONTEXT_LABELS[t]).join(", ")}
                    </span>
                    .{" "}
                  </>
                )}
                {r.excludedPageTypes && (
                  <>
                    No se evalúa en:{" "}
                    <span className="font-medium text-foreground">
                      {r.excludedPageTypes.map((t) => PAGE_CONTEXT_LABELS[t]).join(", ")}
                    </span>
                    .
                  </>
                )}
                {r.requiresEvidence ? ` Evidencia necesaria: ${r.requiresEvidence}` : ""}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

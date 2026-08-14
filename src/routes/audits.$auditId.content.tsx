/**
 * FASE 5 — Vista "Contenido y oportunidades".
 * Solo lee la capa derivada (src/seo/content-analysis.ts) de UNA auditoría:
 * no rastrea, no ejecuta reglas y no modifica hallazgos ni score.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { DemoBadge, EmptyState, PAGE_TYPE_LABELS, StatCard } from "@/components/seo-ui";
import { Stat } from "@/components/link-graph-ui";
import { ContentGroupCard, ContentItemCard } from "@/components/content-ui";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analyzeContent, CONTENT_CLASS_LABELS, type ContentClass } from "@/seo/content-analysis";
import { CATEGORY_LABELS, SEVERITY_LABELS } from "@/seo/rules";
import { useAppState } from "@/store/app-store";
import type { Category, PageType, Severity } from "@/seo/types";

export const Route = createFileRoute("/audits/$auditId/content")({
  head: () => ({
    meta: [
      { title: "Contenido y oportunidades — SEO Fixer" },
      {
        name: "description",
        content:
          "Análisis de contenido por tipo de página: contenido potencialmente insuficiente, similitud, canibalización potencial y oportunidades derivadas del enlazado interno.",
      },
      { property: "og:title", content: "Contenido y oportunidades — SEO Fixer" },
      {
        property: "og:description",
        content: "Problemas, mejoras y oportunidades de contenido de una auditoría, sin alterar el score.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContentView,
});

function ContentView() {
  const { auditId } = Route.useParams();
  const audit = useAppState((s) => s.audits.find((a) => a.id === auditId));
  const [query, setQuery] = useState("");
  const [klass, setKlass] = useState<ContentClass | "all">("all");
  const [pageType, setPageType] = useState<PageType | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [severity, setSeverity] = useState<Severity | "all">("all");

  const analysis = useMemo(() => (audit ? analyzeContent(audit) : null), [audit]);

  if (!audit || !analysis) {
    return (
      <EmptyState
        title="Auditoría no encontrada"
        description="La auditoría solicitada no existe o fue eliminada."
      />
    );
  }

  const items = analysis.items.filter((i) => {
    if (klass !== "all" && i.classification !== klass) return false;
    if (pageType !== "all" && i.pageType !== pageType) return false;
    if (category !== "all" && i.category !== category) return false;
    if (severity !== "all" && i.severity !== severity) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        i.pageUrl.toLowerCase().includes(q) ||
        i.pagePath.toLowerCase().includes(q) ||
        i.signalName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const s = analysis.stats;

  return (
    <>
      <PageHeader
        title="Contenido y oportunidades"
        description={`Capa derivada de ${audit.name}: analiza el contenido ya rastreado según el tipo de página y el enlazado interno. Las oportunidades no modifican el SEO Score.`}
        actions={
          <div className="flex items-center gap-2">
            {audit.isDemo && <DemoBadge />}
            <Link
              to="/audits/$auditId"
              params={{ auditId: audit.id }}
              className="text-xs text-muted-foreground underline"
            >
              Volver a resultados
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Problemas de contenido" value={s.problems} tone="critical" />
        <StatCard label="Mejoras" value={s.improvements} tone="important" />
        <StatCard label="Oportunidades" value={s.opportunities} hint="No afectan el score" />
        <StatCard
          label="URLs con umbral evaluable"
          value={s.evaluated}
          hint={`${s.pages} URLs en la auditoría`}
        />
      </div>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-base font-semibold">Resumen de señales</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Contacto, institucionales y páginas sin clasificar no se evalúan por cantidad de texto: su
          umbral contextual es nulo (Fase 3). La similitud se calcula solo con la muestra de texto que
          guardó el crawler ({s.similarityAvailable} URLs con muestra suficiente) y nunca se afirma
          duplicación sin coincidencia exacta de huella de contenido.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Contenido potencialmente insuficiente" value={s.insufficient} />
          <Stat label="Duplicado confirmado" value={s.duplicateConfirmed} />
          <Stat label="Pares potencialmente similares" value={s.potentiallySimilar} />
          <Stat label="URLs en canibalización potencial" value={s.cannibalization} />
          <Stat label="Grupos potenciales de contenido" value={s.contentGroups} />
        </dl>
      </section>

      {analysis.duplicateGroups.length > 0 && (
        <section className="panel mt-4 p-5">
          <h2 className="font-display text-base font-semibold">Duplicación y similitud</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Se distingue entre duplicado confirmado por la regla existente y contenido potencialmente
            similar.
          </p>
          <div className="mt-3 space-y-3">
            {analysis.duplicateGroups.map((g) => (
              <ContentGroupCard key={g.key} group={g} />
            ))}
            {analysis.similarGroups.map((g) => (
              <ContentGroupCard key={g.key} group={g} />
            ))}
          </div>
        </section>
      )}

      {analysis.duplicateGroups.length === 0 && analysis.similarGroups.length > 0 && (
        <section className="panel mt-4 p-5">
          <h2 className="font-display text-base font-semibold">Similitud potencial</h2>
          <div className="mt-3 space-y-3">
            {analysis.similarGroups.map((g) => (
              <ContentGroupCard key={g.key} group={g} />
            ))}
          </div>
        </section>
      )}

      {analysis.cannibalizationGroups.length > 0 && (
        <section className="panel mt-4 p-5">
          <h2 className="font-display text-base font-semibold">Canibalización potencial</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Grupos formados con señales internas (title, H1, contenido, slugs y enlaces internos) del
            mismo tipo de página. Sin keyword research externo no se declara canibalización confirmada.
          </p>
          <div className="mt-3 space-y-3">
            {analysis.cannibalizationGroups.map((g) => (
              <ContentGroupCard key={g.key} group={g} />
            ))}
          </div>
        </section>
      )}

      {analysis.contentGroups.length > 0 && (
        <section className="panel mt-4 p-5">
          <h2 className="font-display text-base font-semibold">Grupos potenciales de contenido</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Agrupación por señales internas verificables. No constituye un cluster SEO definitivo.
          </p>
          <div className="mt-3 space-y-3">
            {analysis.contentGroups.map((g) => (
              <ContentGroupCard key={g.key} group={g} />
            ))}
          </div>
        </section>
      )}

      <section className="panel mt-4 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Input
              placeholder="Buscar URL o señal…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <FilterSelect
            label="Clasificación"
            value={klass}
            onChange={(v) => setKlass(v as ContentClass | "all")}
            options={[
              ["all", "Todas"],
              ...(Object.keys(CONTENT_CLASS_LABELS) as ContentClass[]).map(
                (c) => [c, CONTENT_CLASS_LABELS[c]] as [string, string],
              ),
            ]}
          />
          <FilterSelect
            label="Tipo de página"
            value={pageType}
            onChange={(v) => setPageType(v as PageType | "all")}
            options={[
              ["all", "Todos"],
              ...(Object.keys(PAGE_TYPE_LABELS) as PageType[]).map(
                (p) => [p, PAGE_TYPE_LABELS[p]] as [string, string],
              ),
            ]}
          />
          <FilterSelect
            label="Categoría"
            value={category}
            onChange={(v) => setCategory(v as Category | "all")}
            options={[
              ["all", "Todas"],
              ...(Object.keys(CATEGORY_LABELS) as Category[]).map(
                (c) => [c, CATEGORY_LABELS[c]] as [string, string],
              ),
            ]}
          />
          <FilterSelect
            label="Severidad"
            value={severity}
            onChange={(v) => setSeverity(v as Severity | "all")}
            options={[
              ["all", "Todas"],
              ...(Object.keys(SEVERITY_LABELS) as Severity[]).map(
                (v) => [v, SEVERITY_LABELS[v]] as [string, string],
              ),
            ]}
          />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {items.length} resultado{items.length === 1 ? "" : "s"} de {analysis.items.length}.
        </p>

        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <ContentItemCard key={item.key} audit={audit} item={item} />
          ))}
          {items.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No hay señales de contenido con los filtros seleccionados.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

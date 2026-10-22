import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/seo-ui";
import { useAppState } from "@/store/app-store";
import { groupDiagnostics, type DiagnosticGroup } from "@/seo/diagnostics";
import { analyzeContent } from "@/seo/content-analysis";
import { CATEGORY_LABELS, SEVERITY_LABELS } from "@/seo/rules";
import { countBySeverity, scoreLabel } from "@/seo/engine";
import { getConnector } from "@/seo/connectors";
import {
  RECOMMENDATION_BASIS_LABELS,
  SHARED_VALUE_RULES,
  groupOpportunities,
  orphanStates,
  reportEvidence,
  reportRecommendation,
  sharedValueClusters,
  templateCluster,
  type RecommendationBasis,
} from "@/seo/report-presentation";
import type { OrphanState } from "@/seo/link-graph";
import { EXCLUSION_LABELS, ROBOTS_POLICY_LABELS, ROBOTS_STATE_LABELS, type Audit, type ExclusionReason } from "@/seo/types";

export const Route = createFileRoute("/audits/$auditId/report")({
  head: () => ({
    meta: [
      { title: "Informe de auditoría SEO — MarCa Growth" },
      {
        name: "description",
        content: "Informe profesional imprimible con resumen, hallazgos priorizados y plan de acción.",
      },
      { property: "og:title", content: "Informe de auditoría SEO — MarCa Growth" },
      {
        property: "og:description",
        content: "Resumen ejecutivo, hallazgos con evidencia y plan de acción por prioridad.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditReport,
});

const MAX_URLS_PER_GROUP = 5;
const PRIORITY_TITLES: Record<string, string> = {
  alta: "Prioridad alta",
  media: "Prioridad media",
  baja: "Prioridad baja",
};

function fmtDate(iso?: string) {
  if (!iso) return "No disponible";
  try {
    return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return "No disponible";
  }
}

function AuditReport() {
  const { auditId } = Route.useParams();
  const audit = useAppState((s) => s.audits.find((a) => a.id === auditId));

  if (!audit) {
    return (
      <EmptyState
        title="Auditoría no encontrada"
        description="No existe una auditoría con ese identificador en este navegador."
      />
    );
  }
  return <ReportBody audit={audit} />;
}

function ReportBody({ audit }: { audit: Audit }) {
  const groups = useMemo(
    () => groupDiagnostics(audit, audit.findings.filter((f) => f.severity !== "ok")),
    [audit],
  );
  const content = useMemo(() => {
    try {
      return analyzeContent(audit);
    } catch {
      return null;
    }
  }, [audit]);
  const orphan = useMemo(() => orphanStates(audit), [audit]);
  const tpl = useMemo(() => templateCluster(audit), [audit]);
  const tplSet = useMemo(() => new Set(tpl?.pageIds ?? []), [tpl]);
  const oppGroups = useMemo(() => (content ? groupOpportunities(content.opportunities) : []), [content]);
  const counts = countBySeverity(audit.findings);
  const cov = audit.coverage;
  const score = audit.score;
  const byPriority = (["alta", "media", "baja"] as const).map((p) => ({
    p,
    items: groups.filter((g) => g.priorityLabel === p),
  }));

  return (
    <div className="report mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" asChild>
          <Link to="/audits/$auditId" params={{ auditId: audit.id }}>
            <ArrowLeft className="size-4" /> Volver a la auditoría
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            En el diálogo de impresión elegí “Guardar como PDF”.
          </span>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir / Guardar PDF
          </Button>
        </div>
      </div>

      <article className="space-y-8 rounded-xl border border-border bg-card p-8 text-card-foreground print:border-0 print:p-0">
        {/* Portada */}
        <header className="border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">MarCa Growth</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Informe de auditoría SEO</h1>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <Meta label="Sitio auditado" value={audit.rootUrl} />
            <Meta label="Fecha del análisis" value={fmtDate(audit.finishedAt ?? audit.createdAt)} />
            <Meta label="Método de obtención" value={getConnector(audit.platform)?.name ?? audit.platform} />
            <Meta label="Páginas analizadas" value={String(audit.pages.length)} />
          </dl>
          {audit.isDemo && (
            <p className="mt-4 rounded-md border border-important/40 bg-important-soft p-3 text-sm font-medium">
              Auditoría de DEMOSTRACIÓN: los datos corresponden a un sitio ficticio y no representan un
              sitio real.
            </p>
          )}
        </header>

        {/* Resumen ejecutivo */}
        <Section title="1. Resumen ejecutivo">
          <p className="text-sm leading-relaxed">
            Se analizaron <strong>{audit.pages.length}</strong> páginas de {audit.rootUrl}
            {cov ? ` (de ${cov.discovered} descubiertas)` : ""}. Se detectaron{" "}
            <strong>{counts.critical}</strong> hallazgos críticos, <strong>{counts.important}</strong>{" "}
            importantes y <strong>{counts.improvement}</strong> mejoras, agrupados en{" "}
            <strong>{groups.length}</strong> tipos de problema.
            {score ? ` La salud SEO general es ${score.total}/100 (${scoreLabel(score.total)}).` : ""}
          </p>
          {byPriority[0]!.items.length > 0 && (
            <div className="mt-3 text-sm">
              <p className="font-semibold">Temas de prioridad alta:</p>
              <ul className="ml-5 list-disc">
                {byPriority[0]!.items.slice(0, 5).map((g) => (
                  <li key={g.ruleId}>
                    {g.ruleName} ({g.items.length} {g.items.length === 1 ? "URL" : "URLs"})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Puntuación */}
        <Section title="2. Puntuación">
          {score ? (
            <>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-5xl font-bold text-primary">{score.total}</span>
                <span className="text-sm text-muted-foreground">/ 100 · {scoreLabel(score.total)}</span>
              </div>
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-1.5">Categoría</th>
                    <th className="py-1.5 text-right">Puntaje</th>
                    <th className="py-1.5 text-right">Hallazgos</th>
                  </tr>
                </thead>
                <tbody>
                  {score.categories.map((c) => (
                    <tr key={c.category} className="border-b border-border/60">
                      <td className="py-1.5">{CATEGORY_LABELS[c.category] ?? c.category}</td>
                      <td className="py-1.5 text-right font-medium">{c.score}</td>
                      <td className="py-1.5 text-right">{c.findings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">
                El puntaje es un indicador ponderado de salud técnica y de contenido; no garantiza
                posiciones en buscadores.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Puntuación no disponible para esta auditoría.</p>
          )}
        </Section>

        {/* Cobertura */}
        <Section title="3. Cobertura del rastreo">
          {cov ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <Meta label="URLs descubiertas" value={String(cov.discovered)} />
              <Meta label="URLs analizadas" value={String(cov.analyzed)} />
              <Meta label="Cobertura" value={cov.coveragePct != null ? `${cov.coveragePct}%` : "No disponible"} />
              <Meta label="Límite configurado" value={`${cov.limit} URLs${cov.limitReached ? " (alcanzado)" : ""}`} />
              <Meta label="robots.txt" value={cov.robotsTxtFound ? "Encontrado" : "No encontrado"} />
              <Meta label="Sitemaps" value={cov.sitemapsFound.length ? String(cov.sitemapsFound.length) : "No encontrado"} />
              {cov.blocked != null && <Meta label="Bloqueadas por robots" value={String(cov.blocked)} />}
              {cov.pending != null && <Meta label="Pendientes por límite" value={String(cov.pending)} />}
            </dl>
          ) : null}
          {cov && <RobotsAndExclusions cov={cov} respect={audit.respectRobots} />}
          {!cov && (
            <p className="text-sm text-muted-foreground">
              Detalle de cobertura no disponible. Páginas analizadas: {audit.pages.length}.
            </p>
          )}
        </Section>

        {/* Hallazgos */}
        <Section title="4. Hallazgos priorizados">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No se registraron hallazgos.</p>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <FindingGroup key={g.ruleId} g={g} audit={audit} orphan={orphan} template={tplSet} />
              ))}
            </div>
          )}
        </Section>

        {/* Oportunidades */}
        <Section title="5. Oportunidades">
          {oppGroups.length > 0 ? (
            <ul className="space-y-3 text-sm">
              {oppGroups.map((o) => (
                <li key={o.key} className="break-inside-avoid">
                  <span className="font-medium">{o.signalName}</span>{" "}
                  <span className="text-muted-foreground">
                    ({o.pages.length} {o.pages.length === 1 ? "página" : "páginas"})
                  </span>
                  <p>{o.recommendation}</p>
                  <p className="break-all text-xs text-muted-foreground">
                    {o.pages.map((p) => p.path || "/").join(", ")}
                  </p>
                </li>
              ))}
              <li className="text-xs text-muted-foreground">
                Las páginas de reserva y contacto se excluyen de las oportunidades genéricas de contenido.
              </li>
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No se identificaron oportunidades de contenido con los datos disponibles.
            </p>
          )}
        </Section>

        {/* Plan de acción */}
        <Section title="6. Plan de acción">
          {tpl && (
            <div className="mb-4 break-inside-avoid rounded-lg border border-border p-3">
              <h3 className="font-semibold">Acción principal: publicaciones vacías o de plantilla</h3>
              <p className="text-sm">
                {tpl.pageIds.length} URLs tienen contenido insuficiente y comparten title o contenido con
                otras páginas, lo que indica una causa común (plantillas sin completar). Decidir con el
                propietario si se eliminan/despublican o se completan con contenido propio.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Problemas asociados: {tpl.ruleNames.join(", ")}. Los hallazgos individuales se mantienen en
                la sección 4.
              </p>
              <ul className="ml-5 list-disc break-all text-xs text-muted-foreground">
                {tpl.urls.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          )}
          {byPriority.map(({ p, items }) =>
            items.length === 0 ? null : (
              <div key={p} className="mb-4 break-inside-avoid">
                <h3 className="font-semibold">{PRIORITY_TITLES[p]}</h3>
                <ol className="ml-5 list-decimal text-sm">
                  {items.map((g) => (
                    <li key={g.ruleId}>
                      <span className="font-medium">{g.ruleName}</span>{" "}
                      <span className="text-muted-foreground">
                        ({g.items.length} {g.items.length === 1 ? "URL" : "URLs"}
                        {tpl && g.items.some((d) => tplSet.has(d.pageId)) &&
                        ["thin-content", "duplicate-title", "duplicate-content"].includes(g.ruleId)
                          ? `; ${g.items.filter((d) => tplSet.has(d.pageId)).length} se resuelven con la acción principal`
                          : ""}
                        )
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ),
          )}
          {groups.length === 0 && <p className="text-sm text-muted-foreground">Sin acciones pendientes.</p>}
        </Section>

        {/* Metodología */}
        <Section title="7. Metodología y limitaciones">
          <ul className="ml-5 list-disc space-y-1 text-sm">
            <li>
              Se rastreó el sitio a partir de robots.txt, sitemap.xml y enlaces internos, hasta el límite de{" "}
              {audit.crawlLimit} URLs{audit.respectRobots ? ", respetando robots.txt" : ""}.
            </li>
            <li>Cada página se evaluó con reglas SEO técnicas, on-page y de contenido.</li>
            <li>
              El rastreador no ejecuta JavaScript: el contenido o los enlaces generados en el navegador
              pueden no haberse detectado.
            </li>
            <li>No se midieron Core Web Vitals reales (velocidad de carga de campo).</li>
            <li>
              Algunos hallazgos son heurísticos (por ejemplo, similitud de contenido o páginas en
              construcción) y requieren validación en contexto antes de actuar.
            </li>
            <li>Las URLs no analizadas por el límite o bloqueadas no están incluidas en el diagnóstico.</li>
            <li>
              Los hallazgos de indexación (noindex) se basan en la meta robots y el encabezado X-Robots-Tag
              de páginas efectivamente descargadas; las bloqueadas por robots.txt no se marcan como noindex.
            </li>
            <li>
              Las páginas sin enlaces entrantes se calculan sobre los enlaces HTML visibles sin JavaScript.
              Las descubiertas solo por el sitemap se informan como «Posible página huérfana» y requieren
              validación manual.
            </li>
            <li>
              Las recomendaciones indican si se basan en un hecho confirmado, en una inferencia o si
              requieren validación del propietario del sitio.
            </li>
          </ul>
        </Section>

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          Informe generado por MarCa Growth · {fmtDate(new Date().toISOString())}
        </footer>
      </article>
    </div>
  );
}

function FindingGroup({
  g,
  audit,
  orphan,
  template,
}: {
  g: DiagnosticGroup;
  audit: Audit;
  orphan: Record<string, OrphanState>;
  template: Set<string>;
}) {
  const first = g.items[0]!;
  const clusters = SHARED_VALUE_RULES.has(g.ruleId) ? sharedValueClusters(g.items, audit, template) : null;
  const isOrphanRule = g.ruleId === "orphan-page";
  const allPotential = isOrphanRule && g.items.every((d) => orphan[d.pageId] === "potentially-orphan");
  const title = allPotential ? "Posible página huérfana" : g.ruleName;
  const recs = g.items.map((d) => {
    const page = audit.pages.find((p) => p.id === d.pageId);
    return reportRecommendation(d, page, template.has(d.pageId) && TEMPLATE_RULES.has(d.ruleId));
  });
  const distinctRecs = [
    ...new Map(
      recs
        .map((r, i) => r ?? (g.items[i]!.recommendation ? { text: g.items[i]!.recommendation!, basis: null } : null))
        .filter((r): r is { text: string; basis: RecommendationBasis | null } => r !== null)
        .map((r) => [r.text, r]),
    ).values(),
  ];
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
          {PRIORITY_TITLES[g.priorityLabel] ?? g.priorityLabel}
        </span>
        <span className="rounded bg-muted px-2 py-0.5">{SEVERITY_LABELS[g.severity] ?? g.severity}</span>
        <span className="text-muted-foreground">{CATEGORY_LABELS[g.category] ?? g.category}</span>
        {g.estimatedPoints != null && g.estimatedPoints > 0 && (
          <span className="text-muted-foreground">· Impacto estimado: {g.estimatedPoints} pts</span>
        )}
        {(g.kind === "heuristic" || allPotential) && (
          <span className="text-muted-foreground">· Inferencia: requiere validación</span>
        )}
      </div>
      <h3 className="mt-2 font-semibold">{title}</h3>
      <p className="mt-1 text-sm">{allPotential ? "No se detectaron enlaces internos hacia estas URLs; solo se descubrieron por el sitemap." : first.detected}</p>
      {g.why && <p className="mt-1 text-sm text-muted-foreground">{g.why}</p>}
      {!clusters && distinctRecs.length > 0 && (
        <div className="mt-2 text-sm">
          <span className="font-medium">Recomendación: </span>
          {distinctRecs.map((r, i) => (
            <p key={i} className={i ? "mt-1" : "inline"}>
              {r.text}
              {r.basis && (
                <span className="text-xs text-muted-foreground"> ({RECOMMENDATION_BASIS_LABELS[r.basis]})</span>
              )}
            </p>
          ))}
        </div>
      )}
      {clusters ? (
        <div className="mt-2 space-y-3 text-sm">
          {clusters.map((c, ci) => (
            <div key={ci} className="rounded-md border border-border/60 p-3">
              <p>
                <span className="font-medium">Texto compartido: </span>"{c.value}"
              </p>
              <p className="mt-1">
                <span className="font-medium">Recomendación: </span>
                {c.recommendation.text}{" "}
                <span className="text-xs text-muted-foreground">
                  ({RECOMMENDATION_BASIS_LABELS[c.recommendation.basis]})
                </span>
              </p>
              <p className="mt-1 font-medium">URLs afectadas ({c.items.length}):</p>
              <ul className="ml-5 list-disc">
                {c.items.map((d) => (
                  <li key={d.key} className="break-all font-mono text-xs">{d.pageUrl}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
      <div className="mt-2 text-sm">
        <p className="font-medium">Evidencia por URL ({g.items.length}):</p>
        <ul className="mt-1 space-y-1.5">
          {g.items.map((d) => (
            <li key={d.key} className="break-inside-avoid">
              <span className="break-all font-mono text-xs">{d.pageUrl}</span>
              <ul className="ml-5 list-disc break-words text-muted-foreground">
                {reportEvidence(d, audit, orphan).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      )}
    </div>
  );
}

/** Reglas cuya causa común es una publicación vacía o de plantilla. */
const TEMPLATE_RULES = new Set(["thin-content", "duplicate-title", "duplicate-content"]);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all font-medium">{value}</dd>
    </div>
  );
}

function RobotsAndExclusions({
  cov,
  respect,
}: {
  cov: NonNullable<Audit["coverage"]>;
  respect: boolean | undefined;
}) {
  const robots = cov.robots;
  const policyText = robots?.policy
    ? ROBOTS_POLICY_LABELS[robots.policy]
    : respect
      ? "Se solicitó respetar robots.txt (detalle de política no registrado en esta auditoría)"
      : "No se respetó robots.txt en esta auditoría";
  const byReason = new Map<ExclusionReason, typeof cov.excluded>();
  for (const e of cov.excluded ?? []) {
    const list = byReason.get(e.reason) ?? [];
    list.push(e);
    byReason.set(e.reason, list);
  }
  return (
    <div className="mt-4 space-y-3 text-sm">
      <div className="break-inside-avoid">
        <h3 className="font-semibold">robots.txt</h3>
        <p>{policyText}.</p>
        {robots && (
          <p className="text-xs text-muted-foreground">
            Estado: {ROBOTS_STATE_LABELS[robots.state]}
            {robots.userAgentGroup ? ` · Grupo aplicado: User-agent ${robots.userAgentGroup}` : ""}
            {robots.disallow.length ? ` · Disallow: ${robots.disallow.slice(0, 6).join(", ")}` : ""}
          </p>
        )}
      </div>
      <div className="break-inside-avoid">
        <h3 className="font-semibold">URLs no analizadas</h3>
        {byReason.size === 0 ? (
          <p className="text-muted-foreground">Todas las URLs descubiertas fueron analizadas.</p>
        ) : (
          <ul className="space-y-2">
            {[...byReason.entries()].map(([reason, list]) => (
              <li key={reason}>
                <span className="font-medium">{EXCLUSION_LABELS[reason] ?? reason}</span>{" "}
                <span className="text-muted-foreground">({list.length})</span>
                {(reason === "robots-disallow" || reason === "robots-unverified") && (
                  <p className="text-xs text-muted-foreground">
                    No se descargaron: su indexación (noindex) no fue verificada. Bloquear el rastreo
                    no equivale a noindex.
                  </p>
                )}
                <ul className="ml-4 list-disc text-xs">
                  {list.slice(0, 10).map((e) => (
                    <li key={e.url} className="break-all">
                      {e.url}
                      {e.detail ? ` — ${e.detail}` : ""}
                    </li>
                  ))}
                  {list.length > 10 && <li>y {list.length - 10} más.</li>}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

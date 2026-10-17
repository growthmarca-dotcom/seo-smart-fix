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
                <FindingGroup key={g.ruleId} g={g} />
              ))}
            </div>
          )}
        </Section>

        {/* Oportunidades */}
        <Section title="5. Oportunidades">
          {content && content.opportunities.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {content.opportunities.slice(0, 12).map((o) => (
                <li key={o.key} className="break-inside-avoid">
                  <span className="font-medium">{o.signalName}</span> —{" "}
                  <span className="break-all text-muted-foreground">{o.pagePath}</span>
                  <p>{o.recommendation}</p>
                </li>
              ))}
              {content.opportunities.length > 12 && (
                <li className="text-xs text-muted-foreground">
                  y {content.opportunities.length - 12} oportunidades más en la aplicación.
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No se identificaron oportunidades de contenido con los datos disponibles.
            </p>
          )}
        </Section>

        {/* Plan de acción */}
        <Section title="6. Plan de acción">
          {byPriority.map(({ p, items }) =>
            items.length === 0 ? null : (
              <div key={p} className="mb-4 break-inside-avoid">
                <h3 className="font-semibold">{PRIORITY_TITLES[p]}</h3>
                <ol className="ml-5 list-decimal text-sm">
                  {items.map((g) => (
                    <li key={g.ruleId}>
                      <span className="font-medium">{g.ruleName}</span>{" "}
                      <span className="text-muted-foreground">
                        ({g.items.length} {g.items.length === 1 ? "URL" : "URLs"})
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
              de páginas efectivamente descargadas. Las páginas sin enlaces entrantes se calculan sobre los
              enlaces HTML visibles sin JavaScript y requieren validación manual.
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

function FindingGroup({ g }: { g: DiagnosticGroup }) {
  const first = g.items[0]!;
  const evidence = g.items.flatMap((d) => d.evidence ?? []).slice(0, 4);
  return (
    <div className="break-inside-avoid rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
          {PRIORITY_TITLES[g.priorityLabel] ?? g.priorityLabel}
        </span>
        <span className="rounded bg-muted px-2 py-0.5">{SEVERITY_LABELS[g.severity] ?? g.severity}</span>
        <span className="text-muted-foreground">{CATEGORY_LABELS[g.category] ?? g.category}</span>
        {g.estimatedPoints != null && g.estimatedPoints > 0 && (
          <span className="text-muted-foreground">· Impacto estimado: {g.estimatedPoints} pts</span>
        )}
        {g.kind === "heuristic" && <span className="text-muted-foreground">· Requiere validación</span>}
      </div>
      <h3 className="mt-2 font-semibold">{g.ruleName}</h3>
      <p className="mt-1 text-sm">{first.detected}</p>
      {g.why && <p className="mt-1 text-sm text-muted-foreground">{g.why}</p>}
      {evidence.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-medium">Evidencia:</p>
          <ul className="ml-5 list-disc break-all text-muted-foreground">
            {evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {first.recommendation && (
        <p className="mt-2 text-sm">
          <span className="font-medium">Sugerencia: </span>
          {first.recommendation}
        </p>
      )}
      <div className="mt-2 text-xs">
        <p className="font-medium">URLs afectadas ({g.items.length}):</p>
        <ul className="break-all text-muted-foreground">
          {g.items.slice(0, MAX_URLS_PER_GROUP).map((d) => (
            <li key={d.key}>{d.pageUrl}</li>
          ))}
          {g.items.length > MAX_URLS_PER_GROUP && <li>y {g.items.length - MAX_URLS_PER_GROUP} más.</li>}
        </ul>
      </div>
    </div>
  );
}

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

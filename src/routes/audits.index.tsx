import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { DemoBadge, EmptyState } from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import { countBySeverity } from "@/seo/engine";
import { getConnector } from "@/seo/connectors";
import { actions, useAppState } from "@/store/app-store";

export const Route = createFileRoute("/audits/")({
  head: () => ({
    meta: [
      { title: "Auditorías — SEO Fixer" },
      {
        name: "description",
        content: "Listado de auditorías SEO con score, URLs analizadas y problemas detectados.",
      },
      { property: "og:title", content: "Auditorías — SEO Fixer" },
      { property: "og:description", content: "Score, URLs analizadas y problemas por auditoría." },
    ],
  }),
  component: AuditsList,
});

function AuditsList() {
  const audits = useAppState((s) => s.audits);

  return (
    <>
      <PageHeader
        title="Auditorías"
        description="Todas las auditorías ejecutadas, con su score y volumen de hallazgos."
        actions={
          <Button asChild>
            <Link to="/audits/new">Nueva auditoría</Link>
          </Button>
        }
      />

      {audits.length === 0 ? (
        <EmptyState
          title="Sin auditorías"
          description="Creá una auditoría para ver resultados por URL."
          action={
            <Button asChild>
              <Link to="/audits/new">Nueva auditoría</Link>
            </Button>
          }
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Auditoría</th>
                <th className="px-4 py-3 font-medium">Conector</th>
                <th className="px-4 py-3 font-medium">URLs</th>
                <th className="px-4 py-3 font-medium">Críticos</th>
                <th className="px-4 py-3 font-medium">Importantes</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {audits.map((a) => {
                const counts = countBySeverity(a.findings);
                return (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link
                        to="/audits/$auditId"
                        params={{ auditId: a.id }}
                        className="font-medium hover:text-primary"
                      >
                        {a.name}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{a.rootUrl}</span>
                        {a.isDemo && <DemoBadge />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {getConnector(a.platform)?.name}
                    </td>
                    <td className="px-4 py-3">{a.pages.length}</td>
                    <td className="px-4 py-3 font-semibold text-critical">{counts.critical}</td>
                    <td className="px-4 py-3 font-semibold text-important-foreground">
                      {counts.important}
                    </td>
                    <td className="px-4 py-3 font-display text-base font-bold">
                      {a.score?.total ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar auditoría"
                        onClick={() => actions.deleteAudit(a.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

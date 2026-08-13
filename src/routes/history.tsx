import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/store/app-store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Historial de cambios — SEO Fixer" },
      {
        name: "description",
        content: "Registro de auditorías ejecutadas y de cambios aprobados, rechazados o aplicados.",
      },
      { property: "og:title", content: "Historial de cambios — SEO Fixer" },
      { property: "og:description", content: "Trazabilidad completa de auditorías y cambios." },
    ],
  }),
  component: History,
});

function History() {
  const history = useAppState((s) => s.history);
  const audits = useAppState((s) => s.audits);

  return (
    <>
      <PageHeader
        title="Historial"
        description="Trazabilidad de auditorías y del ciclo de vida de cada cambio propuesto."
      />

      {history.length === 0 ? (
        <EmptyState
          title="Sin actividad"
          description="Cuando ejecutes auditorías y apruebes cambios, quedarán registrados acá."
          action={
            <Button asChild>
              <Link to="/audits/new">Nueva auditoría</Link>
            </Button>
          }
        />
      ) : (
        <ol className="panel divide-y divide-border">
          {history.map((h) => {
            const audit = audits.find((a) => a.id === h.auditId);
            return (
              <li key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="w-40 shrink-0 text-xs text-muted-foreground">
                  {new Date(h.at).toLocaleString("es-AR")}
                </span>
                <span className="font-medium">{h.action}</span>
                <span className="truncate text-xs text-muted-foreground">{h.detail}</span>
                {audit && (
                  <Link
                    to="/audits/$auditId"
                    params={{ auditId: audit.id }}
                    className="ml-auto text-xs font-medium text-primary hover:underline"
                  >
                    Ver auditoría
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

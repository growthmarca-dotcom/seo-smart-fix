import { Link } from "@tanstack/react-router";
import { StatCard } from "@/components/seo-ui";
import { todayISO } from "@/components/roadmap-view";
import { overdueTasks, roadmapProgress } from "@/companies/model";
import { useAppState } from "@/store/app-store";

/** Resumen de Empresas + Roadmap para el panel principal. */
export function CompaniesOverview() {
  const companies = useAppState((s) => s.companies);
  const roadmaps = useAppState((s) => s.roadmaps);
  const today = todayISO();
  const rows = companies.map((c) => {
    const r = roadmaps.find((x) => x.companyId === c.id);
    return { c, p: roadmapProgress(r), overdue: overdueTasks(r, today) };
  });
  const active = rows.filter((x) => x.p.applicable > 0 && x.p.done < x.p.applicable).length;
  const overdue = rows.reduce((n, x) => n + x.overdue.length, 0);
  const blocked = rows.reduce((n, x) => n + x.p.blocked, 0);
  const next = rows.filter((x) => x.p.nextAction).slice(0, 5);

  return (
    <section className="mb-6 space-y-4" aria-label="Empresas y roadmaps">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Empresas" value={companies.length} hint="Guardadas en este navegador" />
        <StatCard label="Roadmaps activos" value={active} />
        <StatCard label="Tareas vencidas" value={overdue} tone={overdue ? "critical" : "default"} />
        <StatCard label="Tareas bloqueadas" value={blocked} tone={blocked ? "important" : "default"} />
      </div>
      <div className="panel p-4 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display font-semibold">Próximas acciones</h2>
          <Link to="/companies" className="text-xs text-primary hover:underline">Ver empresas</Link>
        </div>
        {next.length === 0 ? (
          <p className="text-muted-foreground">
            {companies.length === 0 ? "Todavía no hay empresas registradas." : "No hay tareas pendientes o en curso."}
          </p>
        ) : (
          <ul className="space-y-1">
            {next.map(({ c, p, overdue: od }) => (
              <li key={c.id}>
                <Link to="/companies/$companyId" params={{ companyId: c.id }} className="font-medium hover:underline">{c.tradeName}</Link>
                <span className="text-muted-foreground"> · {p.nextAction?.task.title} · {p.percent}%</span>
                {od.length > 0 && <span className="text-critical"> · {od.length} vencida(s)</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

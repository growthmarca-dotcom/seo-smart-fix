import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/components/roadmap-view";
import {
  COMPANY_STATUS_LABELS,
  INDUSTRY_LABELS,
  overdueTasks,
  roadmapProgress,
  type CompanyStatus,
  type Industry,
} from "@/companies/model";
import { useAppState } from "@/store/app-store";

export const Route = createFileRoute("/companies/")({
  head: () => ({
    meta: [
      { title: "Empresas — MarCa Audit" },
      { name: "description", content: "Empresas registradas con su roadmap de trabajo, progreso y tareas vencidas." },
      { property: "og:title", content: "Empresas — MarCa Audit" },
      { property: "og:description", content: "Fichas de empresas y seguimiento del roadmap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompaniesList,
});

const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function CompaniesList() {
  const companies = useAppState((s) => s.companies);
  const roadmaps = useAppState((s) => s.roadmaps);
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState<"" | Industry>("");
  const [status, setStatus] = useState<"" | CompanyStatus>("");
  const today = todayISO();

  const term = q.trim().toLowerCase();
  const rows = companies.filter(
    (c) =>
      (!industry || c.industry === industry) &&
      (!status || c.status === status) &&
      (!term || [c.tradeName, c.legalName, c.website, c.location, c.contactName].some((v) => v?.toLowerCase().includes(term))),
  );

  return (
    <>
      <PageHeader
        title="Empresas"
        description="Cada empresa tiene su ficha y su roadmap de trabajo. Los datos quedan guardados en este navegador."
        actions={<Button asChild><Link to="/companies/new">Nueva empresa</Link></Button>}
      />
      {companies.length === 0 ? (
        <EmptyState
          title="Sin empresas registradas"
          description="Registrá una empresa para generar su roadmap inicial."
          action={<Button asChild><Link to="/companies/new">Nueva empresa</Link></Button>}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="Buscar por nombre, sitio o localidad" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar empresas" />
            <select className={selectCls} value={industry} onChange={(e) => setIndustry(e.target.value as Industry | "")} aria-label="Filtrar por rubro">
              <option value="">Todos los rubros</option>
              {Object.entries(INDUSTRY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as CompanyStatus | "")} aria-label="Filtrar por estado">
              <option value="">Todos los estados</option>
              {Object.entries(COMPANY_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Rubro</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Progreso</th>
                  <th className="px-4 py-3 font-medium">Vencidas</th>
                  <th className="px-4 py-3 font-medium">Auditorías</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const r = roadmaps.find((x) => x.companyId === c.id);
                  const p = roadmapProgress(r);
                  const od = overdueTasks(r, today).length;
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <Link to="/companies/$companyId" params={{ companyId: c.id }} className="font-medium hover:underline">{c.tradeName}</Link>
                        {c.website && <div className="text-xs text-muted-foreground">{c.website}</div>}
                      </td>
                      <td className="px-4 py-3">{INDUSTRY_LABELS[c.industry]}</td>
                      <td className="px-4 py-3">{COMPANY_STATUS_LABELS[c.status]}</td>
                      <td className="px-4 py-3">{p.percent}%</td>
                      <td className={od ? "px-4 py-3 font-semibold text-critical" : "px-4 py-3"}>{od}</td>
                      <td className="px-4 py-3">{c.auditIds.length}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Ninguna empresa coincide con los filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

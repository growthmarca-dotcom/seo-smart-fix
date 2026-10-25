import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/seo-ui";
import { RoadmapView } from "@/components/roadmap-view";
import { Button } from "@/components/ui/button";
import { COMPANY_STATUS_LABELS, INDUSTRY_LABELS } from "@/companies/model";
import { companyActions, useAppState, useCompany, useRoadmap } from "@/store/app-store";

export const Route = createFileRoute("/companies/$companyId")({
  head: () => ({
    meta: [
      { title: "Ficha de empresa — MarCa Audit" },
      { name: "description", content: "Datos de la empresa, auditorías asociadas y roadmap de seguimiento." },
      { property: "og:title", content: "Ficha de empresa — MarCa Audit" },
      { property: "og:description", content: "Ficha y roadmap de una empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompanyDetail,
});

function CompanyDetail() {
  const { companyId } = Route.useParams();
  const company = useCompany(companyId);
  const roadmap = useRoadmap(companyId);
  const audits = useAppState((s) => s.audits);
  const navigate = useNavigate();
  const [pick, setPick] = useState("");

  if (!company)
    return (
      <EmptyState
        title="Empresa no encontrada"
        description="Puede que se haya eliminado o que esté guardada en otro navegador."
        action={<Button asChild><Link to="/companies">Ver empresas</Link></Button>}
      />
    );

  const auditNames = Object.fromEntries(audits.map((a) => [a.id, `${a.name}${a.isDemo ? " (demo)" : ""}`]));
  const linked = audits.filter((a) => company.auditIds.includes(a.id));
  const available = audits.filter((a) => !company.auditIds.includes(a.id));
  const info: [string, string | undefined][] = [
    ["Rubro", INDUSTRY_LABELS[company.industry]],
    ["Estado", COMPANY_STATUS_LABELS[company.status]],
    ["Razón social", company.legalName],
    ["Sitio web", company.website],
    ["Localidad", company.location],
    ["Contacto", company.contactName],
    ["Email", company.email],
    ["Teléfono", company.phone],
  ];

  return (
    <>
      <PageHeader
        title={company.tradeName}
        description="Ficha de la empresa y roadmap de trabajo. Datos guardados en este navegador."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/companies/$companyId/edit" params={{ companyId }}>Editar</Link></Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm("¿Eliminar la empresa y su roadmap? Las auditorías SEO se conservan.")) {
                  companyActions.remove(companyId);
                  navigate({ to: "/companies" });
                }
              }}
            >
              Eliminar
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 text-sm lg:col-span-2">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {info.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                <dd>{v ?? "No informado"}</dd>
              </div>
            ))}
          </dl>
          {company.notes && <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{company.notes}</p>}
        </div>
        <div className="panel space-y-3 p-4 text-sm">
          <h2 className="font-display font-semibold">Auditorías SEO asociadas</h2>
          {linked.length === 0 ? <p className="text-muted-foreground">Ninguna todavía.</p> : (
            <ul className="space-y-1">
              {linked.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <Link to="/audits/$auditId" params={{ auditId: a.id }} className="truncate hover:underline">{auditNames[a.id]}</Link>
                  <Button size="sm" variant="ghost" onClick={() => companyActions.unlinkAudit(companyId, a.id)}>Quitar</Button>
                </li>
              ))}
            </ul>
          )}
          {available.length > 0 && (
            <div className="flex gap-2">
              <select className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Auditoría a asociar">
                <option value="">Elegir auditoría…</option>
                {available.map((a) => <option key={a.id} value={a.id}>{auditNames[a.id]} · {a.rootUrl}</option>)}
              </select>
              <Button size="sm" disabled={!pick} onClick={() => { companyActions.linkAudit(companyId, pick); setPick(""); }}>Asociar</Button>
            </div>
          )}
          <Button asChild size="sm" variant="outline"><Link to="/audits/new">Nueva auditoría</Link></Button>
        </div>
      </div>
      <div className="mt-6">
        {roadmap ? <RoadmapView roadmap={roadmap} auditNames={auditNames} /> : <p className="text-sm text-muted-foreground">Esta empresa no tiene roadmap.</p>}
      </div>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/seo-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_LABELS, type EffectiveStatus } from "@/proposals/model";
import { EMPTY_FILTERS, allProposalRows, filterProposalRows, type ProposalFilters } from "@/proposals/ui/all-proposals";
import { useAppState } from "@/store/app-store";

export const Route = createFileRoute("/proposals/")({
  head: () => ({
    meta: [
      { title: "Propuestas comerciales — MarCa Growth" },
      { name: "description", content: "Listado general de propuestas comerciales de todas las empresas." },
      { property: "og:title", content: "Propuestas comerciales — MarCa Growth" },
      { property: "og:description", content: "Consultá, editá y previsualizá todas las propuestas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProposalsPage,
});

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function ProposalsPage() {
  const proposals = useAppState((s) => s.proposals);
  const companies = useAppState((s) => s.companies);
  const [f, setF] = useState<ProposalFilters>(EMPTY_FILTERS);
  const all = allProposalRows(proposals, companies, new Date().toISOString());
  const rows = filterProposalRows(all, f);
  const filtered = f.companyId || f.status || f.query;

  return (
    <>
      <PageHeader
        title="Propuestas comerciales"
        description="Todas las propuestas de MarCa Growth. Para crear una nueva, entrá en la ficha de la empresa."
      />
      {all.length === 0 ? (
        <EmptyState
          title="Todavía no hay propuestas"
          description="Las propuestas se crean desde la ficha de cada empresa."
          action={<Button asChild><Link to="/companies">Ver empresas</Link></Button>}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input className="h-9 w-full sm:w-64" placeholder="Buscar empresa o referencia" aria-label="Buscar" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} />
            <select className={sel} aria-label="Empresa" value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>
              <option value="">Todas las empresas</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName}</option>)}
            </select>
            <select className={sel} aria-label="Estado" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as EffectiveStatus | "" })}>
              <option value="">Todos los estados</option>
              {(Object.keys(STATUS_LABELS) as EffectiveStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <Button variant="outline" size="sm" disabled={!filtered} onClick={() => setF(EMPTY_FILTERS)}>Limpiar filtros</Button>
            <span className="ml-auto text-xs text-muted-foreground">{rows.length} de {all.length}</span>
          </div>
          {rows.length === 0 ? (
            <p className="panel p-4 text-sm text-muted-foreground">Ninguna propuesta coincide con los filtros.</p>
          ) : (
            <ul className="panel divide-y divide-border text-sm">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium">
                      {r.companyName
                        ? <Link to="/companies/$companyId" params={{ companyId: r.companyId }} className="hover:underline">{r.companyName}</Link>
                        : <span className="text-muted-foreground">Empresa no encontrada</span>}
                      {" · "}Versión {r.version} · {r.reference || "Sin referencia"}
                    </p>
                    <p className="text-xs text-muted-foreground">Creada: {r.createdAt} · Validez: {r.validUntil ?? "Sin fecha"}</p>
                    <p className="text-xs">{r.totals.length ? r.totals.map((t) => t.label).join(" · ") : "Sin conceptos todavía"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.statusLabel}</Badge>
                    <Button size="sm" asChild><Link to="/proposals/$proposalId" params={{ proposalId: r.id }}>Editar</Link></Button>
                    <Button size="sm" variant="outline" asChild><Link to="/proposals/$proposalId/preview" params={{ proposalId: r.id }}>Vista previa</Link></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

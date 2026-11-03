import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/seo-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WORK_AREAS } from "@/proposals/work-areas";
import { catalogActions, useServiceCatalog } from "@/store/app-store";
import { CatalogItemDialog } from "@/proposals/ui/catalog-item-dialog";
import { COST_TYPE_LABELS, MODALITY_LABELS, emptyForm, filterCatalog, formFromItem, formatCents, type CatalogForm, type StatusFilter } from "@/proposals/ui/catalog-form";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Catálogo de servicios — MarCa Audit" },
      { name: "description", content: "Servicios de MarCa Growth usados como referencia para armar propuestas." },
      { property: "og:title", content: "Catálogo de servicios — MarCa Audit" },
      { property: "og:description", content: "Alta, edición y archivo de servicios de MarCa Growth." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CatalogPage,
});

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const areaName = (id?: string) => WORK_AREAS.find((a) => a.id === id)?.name ?? "Sin área";

function CatalogPage() {
  const items = useServiceCatalog();
  const [status, setStatus] = useState<StatusFilter>("active");
  const [area, setArea] = useState("");
  const [form, setForm] = useState<CatalogForm>(emptyForm);
  const [open, setOpen] = useState(false);
  const list = useMemo(() => filterCatalog(items, status, area), [items, status, area]);

  const edit = (f: CatalogForm) => { setForm(f); setOpen(true); };
  const archive = (id: string, archived: boolean) => {
    const r = catalogActions.setArchived(id, archived);
    if (r.ok) toast.success(archived ? "Servicio archivado" : "Servicio reactivado");
    else toast.error(r.error);
  };

  return (
    <>
      <PageHeader
        title="Catálogo de servicios"
        description="Referencia para armar propuestas. Al agregar un servicio a una propuesta se copia: los cambios posteriores no alteran propuestas existentes. Los servicios no se borran, se archivan."
        actions={<Button onClick={() => edit(emptyForm())}>Nuevo servicio</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="Estado" className={sel} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="active">Activos</option>
          <option value="archived">Archivados</option>
          <option value="all">Todos</option>
        </select>
        <select aria-label="Área de trabajo" className={sel} value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">Todas las áreas</option>
          {WORK_AREAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value="none">Sin área</option>
        </select>
      </div>
      {list.length === 0 ? (
        <EmptyState title={items.length === 0 ? "Todavía no hay servicios" : "Ningún servicio coincide con el filtro"} description="Creá un servicio para usarlo luego en propuestas." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((c) => (
            <li key={c.id} className="panel space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display font-semibold">{c.name}</h2>
                  <p className="text-xs text-muted-foreground">{areaName(c.workAreaId)}</p>
                </div>
                {c.archived && <Badge variant="secondary">Archivado</Badge>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{MODALITY_LABELS[c.modality]}</Badge>
                <Badge variant="outline">{COST_TYPE_LABELS[c.costType]}</Badge>
                {c.costType === "external-license" && <Badge variant="outline">{c.billedBy === "marca" ? "Factura MarCa" : "Pago directo del cliente"}</Badge>}
              </div>
              {needsScopeReview(c) && <Badge variant="secondary">Revisar: descripción y alcance guardados juntos</Badge>}
              {c.description && <p className="whitespace-pre-wrap">{c.description}</p>}
              {c.scope && <p className="whitespace-pre-wrap text-muted-foreground"><span className="font-medium text-foreground">Alcance: </span>{c.scope}</p>}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Precio sugerido</dt>
                <dd>{c.unitPriceCents === undefined ? "No informado" : `${c.currency} ${formatCents(c.unitPriceCents)}${c.modality === "recurring" ? " / mes" : ""}`}</dd>
                {c.modality === "recurring" && <><dt className="text-muted-foreground">Duración sugerida</dt><dd>{c.months ? `${c.months} meses` : "Se define en cada propuesta"}</dd></>}
                <dt className="text-muted-foreground">Plazo</dt><dd>{c.term || "No informado"}</dd>
                <dt className="text-muted-foreground">Entregables</dt><dd className="whitespace-pre-wrap">{c.deliverables || "No informado"}</dd>
              </dl>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => edit(formFromItem(c))}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => archive(c.id, !c.archived)}>{c.archived ? "Desarchivar" : "Archivar"}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <CatalogItemDialog initial={form} open={open} onOpenChange={setOpen} />
    </>
  );
}

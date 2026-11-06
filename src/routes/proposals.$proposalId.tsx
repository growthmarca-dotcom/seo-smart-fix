import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { STATUS_LABELS, displayTotals, effectiveStatus, type Discount, type ProposalItem, type ProposalTexts } from "@/proposals/model";
import { COST_TYPE_LABELS } from "@/proposals/ui/catalog-form";
import { ProposalItemDialog } from "@/proposals/ui/proposal-item-dialog";
import { DiscountDialog } from "@/proposals/ui/discount-dialog";
import { TotalsBreakdown } from "@/proposals/ui/totals-breakdown";
import { displayItems, itemRow, proposalReference } from "@/proposals/ui/proposal-view";
import { proposalActions, useCompany, useCompanyAssessments, useProposal, useServiceCatalog } from "@/store/app-store";

export const Route = createFileRoute("/proposals/$proposalId")({
  head: () => ({
    meta: [
      { title: "Propuesta comercial — MarCa Audit" },
      { name: "description", content: "Editor y visor de propuestas comerciales de MarCa Growth." },
      { property: "og:title", content: "Propuesta comercial — MarCa Audit" },
      { property: "og:description", content: "Conceptos, descuentos, IVA y desglose por moneda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProposalPage,
});

const newId = () => crypto.randomUUID();
const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const res = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : (r as { error: string }).error);

function ProposalPage() {
  const { proposalId } = Route.useParams();
  const p = useProposal(proposalId);
  const company = useCompany(p?.companyId ?? "");
  const assessments = useCompanyAssessments(p?.companyId ?? "");
  const catalog = useServiceCatalog();
  const navigate = useNavigate();
  const [itemOpen, setItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProposalItem>();
  const [discOpen, setDiscOpen] = useState(false);
  const [editDisc, setEditDisc] = useState<Discount>();
  const [catId, setCatId] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [texts, setTexts] = useState<ProposalTexts>({});
  const [vat, setVat] = useState("");

  useEffect(() => {
    if (!p) return;
    setTexts({ reference: proposalReference(p).text, context: p.context ?? "", clientNotes: p.clientNotes ?? "", internalNotes: p.internalNotes ?? "" });
    setVat(p.vatPercent === undefined ? "" : String(p.vatPercent));
  }, [p?.id, p?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <PageHeader title="Propuesta no encontrada" description="No existe una propuesta con ese identificador." />;

  const now = new Date().toISOString();
  const status = effectiveStatus(p, now);
  const draft = p.status === "draft";
  const items = displayItems(p);
  const discounts = p.frozen?.discounts ?? p.discounts;
  const totals = displayTotals(p);
  const ref = proposalReference(p);
  const assessment = assessments.find((a) => a.id === p.assessmentId);
  const activeCatalog = catalog.filter((c) => !c.archived);

  const act = (r: { ok: boolean; error?: string }, msg?: string) => {
    const e = res(r);
    if (e) toast.error(e); else if (msg) toast.success(msg);
    return e;
  };
  const saveText = (k: keyof ProposalTexts) => {
    const v = texts[k] ?? "";
    const cur = k === "reference" ? (p.reference ?? (ref.legacy ? p.notes : "")) : (p[k] ?? "");
    if (v === cur) return;
    act(proposalActions.setTexts(p.id, { [k]: v }));
  };
  const saveVat = () => {
    const t = vat.trim().replace(",", ".");
    const v = t === "" ? undefined : Number(t);
    if (v === p.vatPercent) return;
    if (v !== undefined && Number.isNaN(v)) return toast.error("IVA inválido.");
    act(proposalActions.setVatPercent(p.id, v));
  };
  const goVersion = () => {
    const r = proposalActions.newVersion(p.id);
    if (act(r, "Nueva versión creada como borrador.") === undefined && r.ok) void navigate({ to: "/proposals/$proposalId", params: { proposalId: r.id } });
  };

  const txt = (k: keyof ProposalTexts, label: string, hint: string, rows = 2) => (
    <div>
      <Label htmlFor={`t-${k}`}>{label}</Label>
      <Textarea id={`t-${k}`} rows={rows} disabled={!draft} value={texts[k] ?? ""} onChange={(e) => setTexts((s) => ({ ...s, [k]: e.target.value }))} onBlur={() => saveText(k)} />
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <>
      <PageHeader
        title={`Propuesta v${p.version}${ref.text ? ` · ${ref.text}` : ""}`}
        description={company ? `Empresa: ${company.name}` : "Empresa no encontrada"}
        actions={
          <div className="flex flex-wrap gap-2">
            {company && <Button variant="outline" asChild><Link to="/companies/$companyId" params={{ companyId: company.id }}>Volver a la empresa</Link></Button>}
            <Button variant="outline" asChild><Link to="/proposals/$proposalId/preview" params={{ proposalId: p.id }}>Vista previa del cliente</Link></Button>
            {draft && <Button onClick={() => setConfirmSend(true)}>Enviar</Button>}
            {status === "sent" && <><Button onClick={() => act(proposalActions.accept(p.id), "Propuesta aceptada.")}>Aceptar</Button>
              <Button variant="outline" onClick={() => act(proposalActions.reject(p.id), "Propuesta rechazada.")}>Rechazar</Button></>}
            {!draft && <Button variant="secondary" onClick={goVersion}>Nueva versión</Button>}
          </div>
        }
      />

      <section className="panel mb-4 grid gap-2 p-4 text-sm sm:grid-cols-3">
        <div>Estado: <Badge variant="outline">{STATUS_LABELS[status]}</Badge></div>
        <div>Creada: {p.createdAt.slice(0, 10)}</div>
        <div>Enviada: {p.sentAt?.slice(0, 10) ?? "—"}</div>
        <div className="flex items-center gap-2">Válida hasta:
          {draft ? <Input type="date" className="h-8 w-40" value={p.validUntil ?? ""} onChange={(e) => act(proposalActions.setValidUntil(p.id, e.target.value || undefined))} />
            : <span>{p.validUntil ?? "Sin fecha"}</span>}
        </div>
        <div>Evaluación: {assessment ? <Link className="text-primary hover:underline" to="/companies/$companyId/diagnosis" params={{ companyId: p.companyId }}>{assessment.title}</Link> : "Sin vincular"}</div>
        <div>Versión anterior: {p.previousVersionId ? <Link className="text-primary hover:underline" to="/proposals/$proposalId" params={{ proposalId: p.previousVersionId }}>ver</Link> : "—"}</div>
        {status === "expired" && <p className="sm:col-span-3 text-destructive">Vencida: no puede aceptarse ni rechazarse. Creá una nueva versión para continuar.</p>}
        {!draft && <p className="sm:col-span-3 text-muted-foreground">Solo lectura: se muestran los datos congelados al enviar.</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="panel space-y-3 p-4">
            <h2 className="font-display font-semibold">Textos</h2>
            <div>
              <Label htmlFor="t-reference">Referencia comercial</Label>
              <Input id="t-reference" disabled={!draft} value={texts.reference ?? ""} onChange={(e) => setTexts((s) => ({ ...s, reference: e.target.value }))} onBlur={() => saveText("reference")} />
              {ref.legacy && p.reference === undefined && <p className="mt-1 text-xs text-muted-foreground">Referencia heredada de una versión anterior del sistema.</p>}
            </div>
            {txt("context", "Contexto y objetivo", "Visible para el cliente.")}
            {txt("clientNotes", "Observaciones y condiciones para el cliente", "Visible para el cliente.")}
            {txt("internalNotes", "Notas internas de MarCa", "Nunca se muestran al cliente.")}
          </section>

          <section className="panel space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-semibold">Conceptos</h2>
              {draft && (
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label="Servicio del catálogo" className={sel} value={catId} onChange={(e) => setCatId(e.target.value)}>
                    <option value="">Elegir del catálogo…</option>
                    {activeCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Button size="sm" variant="outline" disabled={!catId} onClick={() => { if (!act(proposalActions.addFromCatalog(p.id, catId), "Servicio agregado.")) setCatId(""); }}>Agregar</Button>
                  <Button size="sm" onClick={() => { setEditItem(undefined); setItemOpen(true); }}>Concepto personalizado</Button>
                </div>
              )}
            </div>
            {items.length === 0 ? <p className="text-sm text-muted-foreground">Sin conceptos todavía.</p> : (
              <ul className="divide-y divide-border text-sm">
                {items.map((it) => {
                  const r = itemRow(it);
                  return (
                    <li key={it.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="font-medium">{it.name}</p>
                        <p className="text-xs text-muted-foreground">{COST_TYPE_LABELS[it.costType]}{it.costType === "external-license" ? ` · ${it.billedBy === "client" ? "paga el cliente" : it.billedBy === "marca" ? "factura MarCa" : "sin definir"}` : ""} · {it.currency} · Cant. {it.quantity}</p>
                        <p className="text-xs">{r.amount}{it.modality === "recurring" ? ` · ${r.months} · Período: ${r.period}` : ""}</p>
                        {r.missing.length > 0 && <Badge variant="outline" className="mt-1">Completar: {r.missing.join(" y ")}</Badge>}
                      </div>
                      {draft && <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditItem(it); setItemOpen(true); }}>Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => act(proposalActions.removeItem(p.id, it.id))}>Quitar</Button>
                      </div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-semibold">Descuentos e IVA</h2>
              {draft && <Button size="sm" variant="outline" onClick={() => { setEditDisc(undefined); setDiscOpen(true); }}>Nuevo descuento</Button>}
            </div>
            {discounts.length === 0 ? <p className="text-muted-foreground">Sin descuentos.</p> : (
              <ul className="divide-y divide-border">
                {discounts.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-1">
                    <span>{d.label} · {d.kind === "percent" ? `${d.value}%` : `${d.currency} ${(d.value / 100).toLocaleString("es-AR")}${d.modality !== "one-off" ? " por mes en recurrentes" : ""}`}</span>
                    {draft && <span className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditDisc(d); setDiscOpen(true); }}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => act(proposalActions.removeDiscount(p.id, d.id))}>Quitar</Button>
                    </span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="vat">IVA (%)</Label>
              <Input id="vat" className="h-8 w-28" disabled={!draft} placeholder="Sin IVA" value={vat} onChange={(e) => setVat(e.target.value)} onBlur={saveVat} />
              <span className="text-xs text-muted-foreground">Vacío = sin IVA.</span>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <section className="panel space-y-2 p-4">
            <h2 className="font-display font-semibold">Desglose</h2>
            <TotalsBreakdown totals={totals} items={items} />
          </section>
        </aside>
      </div>

      <ProposalItemDialog open={itemOpen} onOpenChange={setItemOpen} item={editItem} newId={newId} onSave={(it) => res(proposalActions.upsertItem(p.id, it))} />
      <DiscountDialog open={discOpen} onOpenChange={setDiscOpen} discount={editDisc} newId={newId} onSave={(d) => res(proposalActions.upsertDiscount(p.id, d))} />
      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar la propuesta?</AlertDialogTitle>
            <AlertDialogDescription>Se congelarán conceptos, descuentos, IVA y totales. Para cambiarla después habrá que crear una nueva versión.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => act(proposalActions.send(p.id), "Propuesta enviada y congelada.")}>Enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

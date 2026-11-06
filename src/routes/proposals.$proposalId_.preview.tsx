import { createFileRoute, Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODALITY_LABELS } from "@/proposals/ui/catalog-form";
import { clientView } from "@/proposals/ui/proposal-view";
import { useCompany, useProposal } from "@/store/app-store";

export const Route = createFileRoute("/proposals/$proposalId_/preview")({
  head: () => ({
    meta: [
      { title: "Vista previa de propuesta — MarCa Growth" },
      { name: "description", content: "Presentación de la propuesta comercial tal como la recibe el cliente." },
      { property: "og:title", content: "Vista previa de propuesta — MarCa Growth" },
      { property: "og:description", content: "Alcance, entregables, plazos e inversión de la propuesta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PreviewPage,
});

const Row = ({ l, v, strong }: { l: string; v?: string | undefined; strong?: boolean }) =>
  v ? <div className={`flex justify-between gap-3 ${strong ? "font-semibold" : ""}`}><span>{l}</span><span className="tabular-nums">{v}</span></div> : null;

function PreviewPage() {
  const { proposalId } = Route.useParams();
  const p = useProposal(proposalId);
  const company = useCompany(p?.companyId ?? "");
  if (!p) return <p className="p-6">Propuesta no encontrada.</p>;
  const v = clientView(p);
  const billed = v.lines.filter((l) => !l.direct);
  const direct = v.lines.filter((l) => l.direct);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="outline" asChild><Link to="/proposals/$proposalId" params={{ proposalId: p.id }}>Volver al editor</Link></Button>
        <Button onClick={() => window.print()}><Printer className="size-4" /> Imprimir / Guardar PDF</Button>
      </div>
      <article className="space-y-6 rounded-xl border border-border bg-card p-8 text-card-foreground print:border-0 print:p-0">
        <header className="border-b border-border pb-4">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-primary">MarCa Growth</p>
          <h1 className="mt-1 text-2xl font-bold">Propuesta comercial{v.reference ? ` · ${v.reference}` : ""}</h1>
          <p className="text-sm text-muted-foreground">Para {company?.tradeName ?? "—"} · Versión {v.version} · Válida hasta {v.validUntil ?? "sin fecha"}</p>
        </header>
        {v.context && <section><h2 className="font-display font-semibold">Contexto y objetivo</h2><p className="whitespace-pre-line text-sm">{v.context}</p></section>}
        <section className="space-y-3">
          <h2 className="font-display font-semibold">Trabajos propuestos</h2>
          {billed.length === 0 && <p className="text-sm text-muted-foreground">Sin conceptos.</p>}
          {billed.map((l, i) => (
            <div key={i} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{l.name} <span className="text-xs text-muted-foreground">· {MODALITY_LABELS[l.modality]}{l.modality === "recurring" ? ` · ${l.months}` : ""}</span></p>
              {l.description && <p>{l.description}</p>}
              {l.scope && <p><span className="font-medium">Alcance:</span> {l.scope}</p>}
              {l.deliverables && <p><span className="font-medium">Entregables:</span> {l.deliverables}</p>}
              {l.term && <p><span className="font-medium">Plazo estimado:</span> {l.term}</p>}
              <p className="mt-1 tabular-nums">{l.amount}</p>
            </div>
          ))}
        </section>
        <section className="space-y-3">
          <h2 className="font-display font-semibold">Inversión</h2>
          {v.blocks.map((b) => (
            <div key={`${b.currency}-${b.modality}`} className="space-y-1 rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{b.currency} · {b.modality === "recurring" ? "Servicios mensuales" : "Trabajos puntuales"}</p>
              {b.fees === undefined ? <p className="text-muted-foreground">Importe a confirmar: hay conceptos sin precio informado.</p> : <>
                <Row l={`Honorarios${b.modality === "recurring" ? " / mes" : ""}`} v={b.fees} />
                <Row l="Licencias y gastos" v={b.externalBilled} />
                <Row l="Descuentos aplicados" v={b.discountTotal ? `− ${b.discountTotal}` : undefined} />
                <Row l={`IVA ${b.vatPercent ?? ""}%`} v={b.vat} />
                <Row strong l={`Total${b.modality === "recurring" ? " mensual" : ""}`} v={b.total} />
                {b.modality === "recurring" && (b.periodTotal ? <Row strong l={`Total del período${b.periodMonths ? ` (hasta ${b.periodMonths} meses)` : ""}`} v={b.periodTotal} />
                  : <p className="text-muted-foreground">Total del período a confirmar: falta informar duración o precio.</p>)}
              </>}
              <Row l="Inversión directa estimada (la paga el cliente)" v={b.direct} />
            </div>
          ))}
          {v.blocks.length > 1 && <p className="text-xs text-muted-foreground">Cada moneda y modalidad se presenta por separado.</p>}
        </section>
        {direct.length > 0 && (
          <section className="space-y-1 text-sm">
            <h2 className="font-display font-semibold">Inversión directa del cliente</h2>
            <p className="text-xs text-muted-foreground">Se paga directamente a cada plataforma o proveedor; no forma parte de lo facturado por MarCa Growth.</p>
            {direct.map((l, i) => <Row key={i} l={l.name} v={l.amount} />)}
          </section>
        )}
        {v.clientNotes && <section><h2 className="font-display font-semibold">Condiciones y observaciones</h2><p className="whitespace-pre-line text-sm">{v.clientNotes}</p></section>}
      </article>
    </div>
  );
}

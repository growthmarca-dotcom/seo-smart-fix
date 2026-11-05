import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BilledBy, CostType, Modality, ProposalItem } from "../model";
import { COST_TYPE_LABELS, MODALITY_LABELS, formatCents, parsePriceToCents } from "./catalog-form";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

interface Form {
  name: string; description: string; scope: string; deliverables: string; term: string;
  modality: Modality; costType: CostType; billedBy: "" | BilledBy; currency: string;
  quantity: string; price: string; months: string; collaboratorName: string; provider: string; platform: string;
}

const toForm = (it?: ProposalItem): Form => ({
  name: it?.name ?? "", description: it?.description ?? "", scope: it?.scope ?? "", deliverables: it?.deliverables ?? "", term: it?.term ?? "",
  modality: it?.modality ?? "one-off", costType: it?.costType ?? "own-fee", billedBy: it?.billedBy ?? "", currency: it?.currency ?? "ARS",
  quantity: String(it?.quantity ?? 1), price: it?.unitPriceCents === undefined ? "" : formatCents(it.unitPriceCents),
  months: it?.months === undefined ? "" : String(it.months), collaboratorName: it?.collaboratorName ?? "", provider: it?.provider ?? "", platform: it?.platform ?? "",
});

const opt = (s: string) => (s.trim() ? s.trim() : undefined);

/** Edita una línea de la propuesta. Nunca toca el catálogo: la línea ya es una copia por valor. */
export function ProposalItemDialog({ open, onOpenChange, item, newId, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; item?: ProposalItem | undefined; newId: () => string;
  onSave: (it: ProposalItem) => string | undefined;
}) {
  const [f, setF] = useState<Form>(toForm(item));
  const [error, setError] = useState<string>();
  useEffect(() => { if (open) { setF(toForm(item)); setError(undefined); } }, [open, item]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = () => {
    const price = parsePriceToCents(f.price);
    if (price === "invalid") return setError("Precio inválido. Usá el formato 150.000 o 150.000,50, o dejalo vacío.");
    const quantity = Number(f.quantity.replace(",", "."));
    let months: number | undefined;
    if (f.modality === "recurring" && f.months.trim()) months = Number(f.months);
    const it: ProposalItem = {
      ...(item ?? {}),
      id: item?.id ?? newId(),
      name: f.name.trim(), description: opt(f.description), scope: f.scope.trim(), deliverables: f.deliverables.trim(), term: f.term.trim(),
      modality: f.modality, months, costType: f.costType,
      billedBy: f.costType === "ad-spend" ? "client" : f.costType === "external-license" ? (f.billedBy || undefined) : undefined,
      currency: f.currency.trim().toUpperCase(), quantity, unitPriceCents: price,
      collaboratorName: f.costType === "collaborator" ? opt(f.collaboratorName) : undefined,
      provider: f.costType === "external-license" ? opt(f.provider) : undefined,
      platform: f.costType === "ad-spend" ? opt(f.platform) : undefined,
    };
    const err = onSave(it);
    if (err) setError(err); else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{item ? "Editar concepto" : "Concepto personalizado"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor="i-name">Nombre</Label><Input id="i-name" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label htmlFor="i-desc">Descripción</Label><Textarea id="i-desc" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label htmlFor="i-scope">Alcance</Label><Textarea id="i-scope" rows={2} value={f.scope} onChange={(e) => set("scope", e.target.value)} /></div>
          <div><Label htmlFor="i-deliv">Entregables</Label><Input id="i-deliv" value={f.deliverables} onChange={(e) => set("deliverables", e.target.value)} /></div>
          <div><Label htmlFor="i-term">Plazo estimado</Label><Input id="i-term" value={f.term} onChange={(e) => set("term", e.target.value)} /></div>
          <div><Label htmlFor="i-mod">Modalidad</Label>
            <select id="i-mod" className={sel} value={f.modality} onChange={(e) => set("modality", e.target.value as Modality)}>
              {Object.entries(MODALITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div><Label htmlFor="i-cost">Tipo de costo</Label>
            <select id="i-cost" className={sel} value={f.costType} onChange={(e) => set("costType", e.target.value as CostType)}>
              {Object.entries(COST_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          {f.costType === "external-license" && (
            <div><Label htmlFor="i-billed">¿Quién lo factura?</Label>
              <select id="i-billed" className={sel} value={f.billedBy} onChange={(e) => set("billedBy", e.target.value as "" | BilledBy)}>
                <option value="">Elegir…</option><option value="marca">Lo factura MarCa</option><option value="client">Lo paga el cliente al proveedor</option>
              </select></div>)}
          {f.costType === "external-license" && <div><Label htmlFor="i-prov">Proveedor</Label><Input id="i-prov" value={f.provider} onChange={(e) => set("provider", e.target.value)} /></div>}
          {f.costType === "ad-spend" && <div><Label htmlFor="i-plat">Plataforma</Label><Input id="i-plat" value={f.platform} onChange={(e) => set("platform", e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">Paga el cliente directamente a la plataforma.</p></div>}
          {f.costType === "collaborator" && <div><Label htmlFor="i-collab">Colaborador (interno)</Label><Input id="i-collab" value={f.collaboratorName} onChange={(e) => set("collaboratorName", e.target.value)} /></div>}
          <div><Label htmlFor="i-cur">Moneda</Label><Input id="i-cur" maxLength={3} value={f.currency} onChange={(e) => set("currency", e.target.value)} /></div>
          <div><Label htmlFor="i-qty">Cantidad</Label><Input id="i-qty" inputMode="decimal" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} /></div>
          <div><Label htmlFor="i-price">Precio unitario{f.modality === "recurring" ? " mensual" : ""} (opcional)</Label><Input id="i-price" placeholder="No informado" value={f.price} onChange={(e) => set("price", e.target.value)} /></div>
          {f.modality === "recurring" && <div><Label htmlFor="i-months">Duración en meses (opcional)</Label><Input id="i-months" inputMode="numeric" placeholder="No informado" value={f.months} onChange={(e) => set("months", e.target.value)} /></div>}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Guardar concepto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

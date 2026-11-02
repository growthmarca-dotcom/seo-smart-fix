import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WORK_AREAS } from "@/proposals/work-areas";
import type { CostType, Modality } from "@/proposals/model";
import { catalogActions } from "@/store/app-store";
import { COST_TYPE_LABELS, MODALITY_LABELS, formToInput, type CatalogForm } from "./catalog-form";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function CatalogItemDialog({ initial, open, onOpenChange }: { initial: CatalogForm; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string>();
  useEffect(() => { if (open) { setF(initial); setError(undefined); } }, [open, initial]);
  const set = <K extends keyof CatalogForm>(k: K, v: CatalogForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = () => {
    const r = formToInput(f);
    if (!r.ok) return setError(r.error);
    const res = catalogActions.upsert(r.value);
    if (!res.ok) return setError(res.error); // el borrador del formulario se conserva
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{f.id ? "Editar servicio" : "Nuevo servicio"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor="c-name">Nombre</Label><Input id="c-name" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label htmlFor="c-scope">Descripción y alcance</Label><Textarea id="c-scope" rows={3} value={f.scope} onChange={(e) => set("scope", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label htmlFor="c-del">Entregables</Label><Textarea id="c-del" rows={2} value={f.deliverables} onChange={(e) => set("deliverables", e.target.value)} /></div>
          <div><Label htmlFor="c-term">Plazo estimado</Label><Input id="c-term" placeholder="Ej.: 3 semanas" value={f.term} onChange={(e) => set("term", e.target.value)} /></div>
          <div><Label htmlFor="c-area">Área de trabajo</Label>
            <select id="c-area" className={sel} value={f.workAreaId} onChange={(e) => set("workAreaId", e.target.value)}>
              <option value="">Sin área</option>
              {WORK_AREAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div><Label htmlFor="c-mod">Modalidad</Label>
            <select id="c-mod" className={sel} value={f.modality} onChange={(e) => set("modality", e.target.value as Modality)}>
              {Object.entries(MODALITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><Label htmlFor="c-cost">Tipo de costo</Label>
            <select id="c-cost" className={sel} value={f.costType} onChange={(e) => set("costType", e.target.value as CostType)}>
              {Object.entries(COST_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {f.costType === "external-license" && (
            <>
              <div><Label htmlFor="c-billed">¿Quién lo paga?</Label>
                <select id="c-billed" className={sel} value={f.billedBy} onChange={(e) => set("billedBy", e.target.value as CatalogForm["billedBy"])}>
                  <option value="">Elegir…</option>
                  <option value="marca">Lo factura MarCa (entra en el total)</option>
                  <option value="client">Lo paga el cliente al proveedor (informativo)</option>
                </select>
              </div>
              <div><Label htmlFor="c-prov">Proveedor</Label><Input id="c-prov" value={f.provider} onChange={(e) => set("provider", e.target.value)} /></div>
            </>
          )}
          {f.costType === "collaborator" && (
            <div><Label htmlFor="c-collab">Colaborador</Label><Input id="c-collab" value={f.collaboratorName} onChange={(e) => set("collaboratorName", e.target.value)} /></div>
          )}
          {f.costType === "ad-spend" && (
            <div><Label htmlFor="c-plat">Plataforma</Label><Input id="c-plat" placeholder="Meta, Google, TikTok…" value={f.platform} onChange={(e) => set("platform", e.target.value)} /></div>
          )}
          <div><Label htmlFor="c-cur">Moneda</Label><Input id="c-cur" maxLength={3} value={f.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></div>
          <div><Label htmlFor="c-price">{f.modality === "recurring" ? "Precio sugerido mensual (opcional)" : "Precio sugerido (opcional)"}</Label>
            <Input id="c-price" inputMode="decimal" placeholder="Vacío = No informado" value={f.price} onChange={(e) => set("price", e.target.value)} />
          </div>
          {f.modality === "recurring" && (
            <div><Label htmlFor="c-months">Duración sugerida en meses (opcional)</Label>
              <Input id="c-months" inputMode="numeric" value={f.months} onChange={(e) => set("months", e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Es solo una referencia: cada propuesta define sus meses.</p>
            </div>
          )}
        </div>
        {f.costType === "ad-spend" && <p className="text-xs text-muted-foreground">La inversión publicitaria la paga el cliente directamente a la plataforma y nunca entra en lo facturado por MarCa.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Guardar servicio</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

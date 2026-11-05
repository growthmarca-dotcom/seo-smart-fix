import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Discount, DiscountTarget, Modality } from "../model";
import { formatCents, parsePriceToCents } from "./catalog-form";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function DiscountDialog({ open, onOpenChange, discount, newId, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; discount?: Discount | undefined; newId: () => string;
  onSave: (d: Discount) => string | undefined;
}) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<Discount["kind"]>("percent");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [targets, setTargets] = useState<DiscountTarget[]>(["own-fee", "collaborator"]);
  const [modality, setModality] = useState<Modality | "both">("both");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setLabel(discount?.label ?? ""); setKind(discount?.kind ?? "percent");
    setValue(discount ? (discount.kind === "amount" ? formatCents(discount.value) : String(discount.value)) : "");
    setCurrency(discount?.currency ?? "ARS"); setTargets(discount?.appliesTo ?? ["own-fee", "collaborator"]);
    setModality(discount?.modality ?? "both"); setError(undefined);
  }, [open, discount]);

  const toggle = (t: DiscountTarget) => setTargets((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  const save = () => {
    let v: number;
    if (kind === "amount") {
      const c = parsePriceToCents(value);
      if (c === undefined || c === "invalid") return setError("Monto inválido.");
      v = c;
    } else v = Number(value.replace(",", "."));
    const d: Discount = { id: discount?.id ?? newId(), label: label.trim(), kind, value: v, appliesTo: targets, modality,
      ...(kind === "amount" ? { currency: currency.trim().toUpperCase() } : {}) };
    const err = onSave(d);
    if (err) setError(err); else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{discount ? "Editar descuento" : "Nuevo descuento"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="d-label">Nombre</Label><Input id="d-label" placeholder="Comercial, pronto pago…" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="d-kind">Tipo</Label>
              <select id="d-kind" className={sel} value={kind} onChange={(e) => setKind(e.target.value as Discount["kind"])}>
                <option value="percent">Porcentaje</option><option value="amount">Monto fijo</option>
              </select></div>
            <div><Label htmlFor="d-value">{kind === "percent" ? "Porcentaje" : "Monto"}</Label><Input id="d-value" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          </div>
          {kind === "amount" && <div><Label htmlFor="d-cur">Moneda</Label><Input id="d-cur" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">En servicios recurrentes el monto fijo se aplica por mes.</p></div>}
          <fieldset className="space-y-1 text-sm"><legend className="font-medium">Se aplica a</legend>
            <label className="flex items-center gap-2"><input type="checkbox" checked={targets.includes("own-fee")} onChange={() => toggle("own-fee")} /> Honorarios propios</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={targets.includes("collaborator")} onChange={() => toggle("collaborator")} /> Honorarios de colaboradores</label>
          </fieldset>
          <div><Label htmlFor="d-mod">Modalidad</Label>
            <select id="d-mod" className={sel} value={modality} onChange={(e) => setModality(e.target.value as Modality | "both")}>
              <option value="both">Puntual y recurrente</option><option value="one-off">Solo puntual</option><option value="recurring">Solo recurrente (por mes)</option>
            </select></div>
          <p className="text-xs text-muted-foreground">Todos los descuentos se calculan sobre la misma base original y nunca superan los honorarios.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Guardar descuento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { proposalActions, useCompanyAssessments, useCompanyProposals } from "@/store/app-store";
import { proposalRows } from "./company-proposals";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function CompanyProposalsSection({ companyId }: { companyId: string }) {
  const proposals = useCompanyProposals(companyId);
  const assessments = useCompanyAssessments(companyId);
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [error, setError] = useState<string>();
  const rows = proposalRows(proposals, companyId, new Date().toISOString());

  const openDialog = () => { setReference(""); setAssessmentId(""); setValidUntil(""); setError(undefined); setOpen(true); };
  const create = () => {
    // Solo se ofrecen evaluaciones de esta empresa; la acción vuelve a verificarlo.
    const r = proposalActions.create({
      companyId,
      assessmentId: assessmentId || undefined,
      validUntil: validUntil || undefined,
      notes: reference.trim(),
    });
    if (!r.ok) return setError(r.error);
    setOpen(false);
    toast.success("Propuesta guardada como borrador. El editor de propuestas todavía no está disponible.");
  };

  return (
    <section className="panel mt-6 space-y-3 p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-semibold">Propuestas comerciales de MarCa Growth</h2>
        <Button size="sm" onClick={openDialog}>Nueva propuesta</Button>
      </div>
      {rows.length === 0 ? <p className="text-muted-foreground">Esta empresa todavía no tiene propuestas.</p> : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="font-medium">Versión {r.version}{r.reference ? ` · ${r.reference}` : ""}</p>
                <p className="text-xs text-muted-foreground">
                  {r.dateLabel}: {r.date} · Validez: {r.validUntil ?? "Sin fecha"}
                </p>
                <p className="text-xs">{r.totals.length ? r.totals.join(" · ") : "Sin conceptos todavía"}</p>
              </div>
              <Badge variant="outline">{r.statusLabel}</Badge>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">El detalle y la edición de cada propuesta llegarán en la próxima etapa.</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva propuesta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="p-ref">Referencia comercial (opcional)</Label><Input id="p-ref" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <div><Label htmlFor="p-assess">Evaluación integral vinculada (opcional)</Label>
              <select id="p-assess" className={sel} value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
                <option value="">Sin vincular</option>
                {assessments.map((a) => <option key={a.id} value={a.id}>{a.title} · {a.assessmentDate}</option>)}
              </select>
            </div>
            <div><Label htmlFor="p-valid">Válida hasta (opcional)</Label><Input id="p-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Se guarda como borrador.</p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create}>Crear borrador</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

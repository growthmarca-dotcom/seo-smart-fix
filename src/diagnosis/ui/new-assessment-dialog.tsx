import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { assessmentActions } from "@/store/app-store";

export interface TourismSourceOption {
  auditId: string;
  label: string;
}

export function NewAssessmentDialog({
  open,
  onOpenChange,
  companyId,
  tourismSources,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  /** Evaluaciones turísticas con datos, la más reciente primero. Vacío si no corresponde. */
  tourismSources: TourismSourceOption[];
  onCreated: (id: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [preload, setPreload] = useState(tourismSources.length > 0);
  const [source, setSource] = useState(tourismSources[0]?.auditId ?? "");
  const [error, setError] = useState<string>();

  const submit = () => {
    const r = assessmentActions.create(
      companyId,
      { title: title.trim() || undefined, assessmentDate: date },
      preload && source ? { tourismFromAuditId: source } : {},
    );
    if (!r.ok) return setError(r.error || "No se pudo crear la evaluación.");
    setError(undefined);
    onOpenChange(false);
    onCreated(r.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva evaluación integral</DialogTitle>
          <DialogDescription>Se crea una evaluación nueva. Las anteriores se conservan sin cambios.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span>Título</span>
            <Input value={title} placeholder={`Evaluación integral ${date}`} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span>Fecha de la evaluación</span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {tourismSources.length > 0 && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <label className="flex items-start gap-2">
                <Checkbox checked={preload} onCheckedChange={(v) => setPreload(v === true)} className="mt-0.5" />
                <span>Precargar datos de la evaluación comercial turística</span>
              </label>
              {preload && tourismSources.length > 1 && (
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  aria-label="Evaluación turística de origen"
                >
                  {tourismSources.map((s) => <option key={s.auditId} value={s.auditId}>{s.label}</option>)}
                </select>
              )}
              <p className="text-xs text-muted-foreground">
                Se copian los 8 controles equivalentes como valores iniciales. La evaluación comercial turística original no se modifica ni se elimina.
              </p>
            </div>
          )}
          {error && <p className="font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Crear evaluación</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

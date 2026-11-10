import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCOPE_EXCLUSION_LABELS, SCOPE_EXCLUSION_REASONS, type ScopeExclusionReason } from "../types";

/** Motivo SIEMPRE vacío al abrir: la persona debe elegirlo expresamente. */
export function ScopeExclusionDialog(props: {
  open: boolean;
  urls: string[];
  fromPreset: boolean;
  onCancel: () => void;
  onConfirm: (reason: ScopeExclusionReason, note: string) => void;
}) {
  const [reason, setReason] = useState<ScopeExclusionReason | "">("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (props.open) {
      setReason("");
      setNote("");
    }
  }, [props.open]);

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir {props.urls.length === 1 ? "1 URL" : `${props.urls.length} URLs`} del alcance</DialogTitle>
          <DialogDescription>
            {props.fromPreset
              ? "La sugerencia surge de un preset orientativo. La exclusión solo se aplica si la confirmás vos."
              : "La exclusión es una decisión editorial. No borra la página ni modifica la auditoría original."}
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-32 overflow-auto rounded border bg-muted/40 p-2 text-xs">
          {props.urls.map((u) => (
            <li key={u} className="truncate">{u}</li>
          ))}
        </ul>
        <div className="space-y-2">
          <Label htmlFor="scope-reason">Motivo (obligatorio)</Label>
          <Select value={reason} onValueChange={(v) => setReason(v as ScopeExclusionReason)}>
            <SelectTrigger id="scope-reason" aria-label="Motivo de exclusión">
              <SelectValue placeholder="Elegí un motivo" />
            </SelectTrigger>
            <SelectContent>
              {SCOPE_EXCLUSION_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{SCOPE_EXCLUSION_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="scope-note">Nota (opcional)</Label>
          <Textarea id="scope-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={props.onCancel}>Cancelar</Button>
          <Button disabled={!reason} onClick={() => reason && props.onConfirm(reason, note)}>
            Confirmar exclusión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

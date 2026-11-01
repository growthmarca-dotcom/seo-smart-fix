import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SOURCE_LABELS, type DiagnosisControl } from "@/diagnosis/dimensions";
import { CONTROL_STATUS_LABELS, type AssessmentControlState, type ControlStatus } from "@/diagnosis/model";
import { assessmentActions } from "@/store/app-store";

/** Los cuatro estados visibles de MarCa Audit ("no-data" queda solo para el motor). */
export const VISIBLE_STATUSES: ControlStatus[] = ["meets", "needs-improvement", "unevaluated", "not-applicable"];

export const NA_JUSTIFICATION_REQUIRED = "«No aplica» requiere una justificación escrita.";
export const INVALID_URL = "La URL de evidencia debe empezar con http:// o https://.";

export type ControlPatch = Partial<Pick<AssessmentControlState, "status" | "notes" | "evidenceUrl">>;
export type SaveDecision = { ok: true; patch: ControlPatch } | { ok: false; error: string };

/** Cambio de estado. «No aplica» se envía junto con la justificación en una sola llamada. */
export function decideStatusChange(next: ControlStatus, draftNotes: string): SaveDecision {
  if (!VISIBLE_STATUSES.includes(next)) return { ok: false, error: "Estado no válido." };
  if (next === "not-applicable") {
    if (!draftNotes.trim()) return { ok: false, error: NA_JUSTIFICATION_REQUIRED };
    return { ok: true, patch: { status: next, notes: draftNotes } };
  }
  return { ok: true, patch: { status: next } };
}

/** Guardado de notas: si el control está en «No aplica», no se permite dejarlas vacías. */
export function decideNotesSave(currentStatus: ControlStatus, draftNotes: string): SaveDecision {
  if (currentStatus === "not-applicable" && !draftNotes.trim()) return { ok: false, error: NA_JUSTIFICATION_REQUIRED };
  return { ok: true, patch: { notes: draftNotes } };
}

export function decideEvidenceSave(draftUrl: string): SaveDecision {
  const v = draftUrl.trim();
  if (v && !/^https?:\/\/\S+$/i.test(v)) return { ok: false, error: INVALID_URL };
  return { ok: true, patch: { evidenceUrl: v } };
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

export function ControlRow({
  assessmentId,
  control,
  state,
  critical,
}: {
  assessmentId: string;
  control: DiagnosisControl;
  state: AssessmentControlState | undefined;
  critical: boolean;
}) {
  const status: ControlStatus = state?.status ?? "unevaluated";
  // Borradores locales: nunca se descartan ante un error.
  const [notes, setNotes] = useState(state?.notes ?? "");
  const [url, setUrl] = useState(state?.evidenceUrl ?? "");
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  const apply = (d: SaveDecision) => {
    if (!d.ok) return setSave({ kind: "error", message: d.error });
    setSave({ kind: "saving" });
    const r = assessmentActions.updateControl(assessmentId, control.id, d.patch);
    setSave(r.ok ? { kind: "saved" } : { kind: "error", message: r.error || "No se pudo guardar." });
  };

  const notesDirty = notes !== (state?.notes ?? "");
  const urlDirty = url.trim() !== (state?.evidenceUrl ?? "");
  const naSelected = status === "not-applicable";

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{control.title}</div>
          <div className="text-xs text-muted-foreground">{control.guidance}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {critical && <Badge variant="destructive">Control crítico</Badge>}
            <Badge variant="outline">{SOURCE_LABELS[control.source]}</Badge>
            {state?.sourceKind === "tourism-import" && <Badge variant="secondary">Tomado de evaluación turística</Badge>}
          </div>
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={status === "no-data" ? "unevaluated" : status}
          aria-label={`Estado de ${control.title}`}
          onChange={(e) => apply(decideStatusChange(e.target.value as ControlStatus, notes))}
        >
          {VISIBLE_STATUSES.map((s) => (
            <option key={s} value={s}>{CONTROL_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className={naSelected ? "font-medium text-destructive" : "text-muted-foreground"}>
            {naSelected ? "Justificación (obligatoria para «No aplica»)" : "Notas / justificación"}
          </span>
          <Textarea
            rows={2}
            value={notes}
            aria-label={`Notas de ${control.title}`}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notesDirty && apply(decideNotesSave(status, notes))}
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">URL de evidencia (opcional)</span>
          <Input
            type="url"
            value={url}
            placeholder="https://"
            aria-label={`URL de evidencia de ${control.title}`}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => urlDirty && apply(decideEvidenceSave(url))}
          />
        </label>
      </div>
      <div className="text-xs" aria-live="polite">
        {save.kind === "saving" && <span className="text-muted-foreground">Guardando…</span>}
        {save.kind === "saved" && <span className="text-muted-foreground">Guardado</span>}
        {save.kind === "error" && <span className="font-medium text-destructive">Error: {save.message} Tu borrador se conserva.</span>}
      </div>
    </li>
  );
}

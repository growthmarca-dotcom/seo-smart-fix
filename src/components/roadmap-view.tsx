import { useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  roadmapProgress,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Roadmap,
  type RoadmapTask,
  type TaskPriority,
  type TaskStatus,
} from "@/companies/model";
import { companyActions } from "@/store/app-store";

export const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_TONE: Record<TaskStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  "in-progress": "bg-primary/15 text-primary",
  blocked: "bg-critical/15 text-critical",
  done: "bg-okay/15 text-okay",
  "not-applicable": "bg-muted text-muted-foreground line-through",
};

export function StatusPill({ status }: { status: TaskStatus }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[status])}>
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

const selectCls = "h-8 rounded-md border border-input bg-background px-2 text-sm";

function TaskCard({ companyId, task, auditNames }: { companyId: string; task: RoadmapTask; auditNames: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(task.notes);
  const [evUrl, setEvUrl] = useState("");
  const [evNote, setEvNote] = useState("");
  const overdue = !!task.dueDate && task.dueDate < todayISO() && task.status !== "done" && task.status !== "not-applicable";
  const upd = (patch: Parameters<typeof companyActions.updateTask>[2]) => companyActions.updateTask(companyId, task.id, patch);

  return (
    <li className="rounded-md border border-border p-3" data-testid="task">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <button type="button" className="text-left font-medium hover:underline" onClick={() => setOpen((v) => !v)}>
            {task.title}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusPill status={task.status} />
            <span>Prioridad {TASK_PRIORITY_LABELS[task.priority].toLowerCase()}</span>
            {task.owner && <span>· {task.owner}</span>}
            {task.dueDate && <span className={cn(overdue && "font-semibold text-critical")}>· Vence {task.dueDate}{overdue && " (vencida)"}</span>}
            {task.evidence.length > 0 && <span>· {task.evidence.length} evidencia(s)</span>}
          </div>
        </div>
        <select
          aria-label={`Estado de ${task.title}`}
          className={selectCls}
          value={task.status}
          onChange={(e) => upd({ status: e.target.value as TaskStatus })}
        >
          {Object.entries(TASK_STATUS_LABELS).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <div className="flex">
          <Button size="icon" variant="ghost" aria-label="Subir" onClick={() => companyActions.moveTask(companyId, task.id, -1)}><ArrowUp className="size-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Bajar" onClick={() => companyActions.moveTask(companyId, task.id, 1)}><ArrowDown className="size-4" /></Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3 text-sm">
          {task.description && <p className="text-muted-foreground">{task.description}</p>}
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="space-y-1 text-xs">Responsable
              <Input defaultValue={task.owner ?? ""} onBlur={(e) => upd({ owner: e.target.value })} />
            </label>
            <label className="space-y-1 text-xs">Vencimiento
              <Input type="date" value={task.dueDate ?? ""} onChange={(e) => upd({ dueDate: e.target.value })} />
            </label>
            <label className="space-y-1 text-xs">Prioridad
              <select className={cn(selectCls, "w-full")} value={task.priority} onChange={(e) => upd({ priority: e.target.value as TaskPriority })}>
                {Object.entries(TASK_PRIORITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-xs">Notas
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== task.notes && upd({ notes })} />
          </label>

          {task.kind === "seo-audit" && (
            <p className="text-xs text-muted-foreground">
              Auditorías vinculadas: {task.linkedAuditIds?.length ? task.linkedAuditIds.map((a) => auditNames[a] ?? a).join(", ") : "ninguna"}. Vincular una auditoría no marca la tarea como completada.
            </p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidencias</p>
            {task.evidence.length === 0 ? <p className="text-xs text-muted-foreground">Sin evidencias registradas.</p> : (
              <ul className="space-y-1 text-xs">
                {task.evidence.map((ev) => (
                  <li key={ev.id}>
                    <span className="text-muted-foreground">{ev.at.slice(0, 10)} · </span>
                    {ev.note}
                    {ev.url && <> · <a className="text-primary underline" href={ev.url} target="_blank" rel="noreferrer">{ev.url}</a></>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Input className="h-8 min-w-40 flex-1" placeholder="Qué se hizo o comprobó" value={evNote} onChange={(e) => setEvNote(e.target.value)} aria-label="Nota de evidencia" />
              <Input className="h-8 min-w-40 flex-1" placeholder="Enlace (opcional)" value={evUrl} onChange={(e) => setEvUrl(e.target.value)} aria-label="Enlace de evidencia" />
              <Button size="sm" variant="outline" onClick={() => { companyActions.addEvidence(companyId, task.id, { url: evUrl, note: evNote }); setEvNote(""); setEvUrl(""); }}>
                Agregar evidencia
              </Button>
            </div>
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Historial ({task.log.length})</summary>
            <ul className="mt-1 space-y-0.5">
              {task.log.map((l, i) => <li key={i}>{l.at.slice(0, 16).replace("T", " ")} · {l.detail}</li>)}
            </ul>
          </details>
        </div>
      )}
    </li>
  );
}

export function RoadmapView({ roadmap, auditNames }: { roadmap: Roadmap; auditNames: Record<string, string> }) {
  const p = roadmapProgress(roadmap);
  const [newTask, setNewTask] = useState<Record<string, string>>({});
  const [newPhase, setNewPhase] = useState("");
  const cid = roadmap.companyId;

  return (
    <section className="space-y-4">
      <div className="panel p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Progreso del roadmap</span>
          <span data-testid="progress">{p.percent}% · {p.done} de {p.applicable} tareas aplicables</span>
        </div>
        <Progress value={p.percent} className="mt-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {p.inProgress} en curso · {p.blocked} bloqueadas · {p.pending} pendientes · {p.notApplicable} no aplican (no cuentan en el progreso).
          {p.nextAction && <> Próxima acción sugerida: <strong>{p.nextAction.task.title}</strong>.</>}
        </p>
      </div>

      {roadmap.phases.map((ph) => (
        <div key={ph.id} className="panel p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-display font-semibold">{ph.title}</h3>
            <div className="flex">
              <Button size="icon" variant="ghost" aria-label="Subir fase" onClick={() => companyActions.movePhase(cid, ph.id, -1)}><ArrowUp className="size-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Bajar fase" onClick={() => companyActions.movePhase(cid, ph.id, 1)}><ArrowDown className="size-4" /></Button>
            </div>
          </div>
          <ul className="space-y-2">
            {ph.tasks.map((t) => <TaskCard key={t.id} companyId={cid} task={t} auditNames={auditNames} />)}
          </ul>
          <div className="mt-3 flex gap-2">
            <Input className="h-8" placeholder="Nueva tarea" value={newTask[ph.id] ?? ""} onChange={(e) => setNewTask((s) => ({ ...s, [ph.id]: e.target.value }))} />
            <Button size="sm" variant="outline" onClick={() => { companyActions.addTask(cid, ph.id, { title: newTask[ph.id] ?? "" }); setNewTask((s) => ({ ...s, [ph.id]: "" })); }}>
              <Plus className="mr-1 size-4" />Agregar
            </Button>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Input className="h-8" placeholder="Nueva fase" value={newPhase} onChange={(e) => setNewPhase(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => { companyActions.addPhase(cid, newPhase); setNewPhase(""); }}>Agregar fase</Button>
      </div>
    </section>
  );
}

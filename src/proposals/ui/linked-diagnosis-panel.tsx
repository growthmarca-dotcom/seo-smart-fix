import { Badge } from "@/components/ui/badge";
import { DATA_ORIGIN_LABELS, type SynthesisItem } from "@/diagnosis/synthesis";
import type { LinkedDiagnosis } from "./linked-diagnosis";

const pct = (n: number) => `${Math.round(n * 100)} %`;

function Row({ x, areas }: { x: SynthesisItem; areas?: string[] | undefined }) {
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{x.title}</span>
        {x.critical && <Badge variant="destructive">Control crítico</Badge>}
        <Badge variant="outline">{DATA_ORIGIN_LABELS[x.origin]}</Badge>
      </div>
      <div className="text-xs text-muted-foreground">{x.dimensionTitle}</div>
      {areas && <p className="text-xs">Áreas sugeridas: {areas.length ? areas.join(" · ") : "Servicio a definir por MarCa"}</p>}
      {x.notes && <p className="mt-0.5 whitespace-pre-wrap text-xs">Nota: {x.notes}</p>}
      {x.evidenceUrl && <a href={x.evidenceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Ver evidencia</a>}
    </li>
  );
}

/** Panel de solo consulta: nunca modifica la evaluación ni la propuesta. */
export function LinkedDiagnosisPanel({ data }: { data: LinkedDiagnosis }) {
  const { assessment: a, synthesis: s } = data;
  return (
    <details className="panel p-4 text-sm" open>
      <summary className="cursor-pointer font-display font-semibold">Diagnóstico vinculado: {a.title}</summary>
      <div className="mt-2 space-y-3">
        <p className="text-muted-foreground">
          Fecha: {a.assessmentDate} · Cobertura {pct(s.index.totalCoverage)} ·{" "}
          {s.partial ? "Síntesis parcial (sin índice global)" : `Diagnóstico completo · Índice global ${s.index.value}`}
        </p>
        <p className="text-xs text-muted-foreground">Solo consulta. Los servicios se eligen manualmente.</p>
        <div>
          <h3 className="font-semibold">Prioridades de mejora ({s.priorities.length})</h3>
          {s.priorities.length === 0 ? <p className="text-muted-foreground">Ningún control marcado como «Requiere mejora».</p> : (
            <ol className="divide-y divide-border">{s.priorities.map((x) => <Row key={x.controlId} x={x} areas={x.suggestedAreas} />)}</ol>
          )}
        </div>
        <div>
          <h3 className="font-semibold">Fortalezas ({s.strengths.length})</h3>
          {s.strengths.length === 0 ? <p className="text-muted-foreground">Ningún control marcado como «Cumple».</p> : (
            <ul className="divide-y divide-border">{s.strengths.map((x) => <Row key={x.controlId} x={x} />)}</ul>
          )}
        </div>
      </div>
    </details>
  );
}

import { Badge } from "@/components/ui/badge";
import type { Company } from "@/companies/model";
import type { CompanyAssessment } from "@/diagnosis/model";
import { DATA_ORIGIN_LABELS, LIMIT_LABELS, buildSynthesis, type SynthesisItem } from "@/diagnosis/synthesis";

const pct = (n: number) => `${Math.round(n * 100)} %`;

function Item({ x, extra }: { x: SynthesisItem; extra?: string }) {
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{x.title}</span>
        {x.critical && <Badge variant="destructive">Control crítico</Badge>}
        <Badge variant="outline">{DATA_ORIGIN_LABELS[x.origin]}</Badge>
      </div>
      <div className="text-xs text-muted-foreground">{x.dimensionTitle}</div>
      {x.notes && <p className="mt-0.5 whitespace-pre-wrap text-xs">{x.notes}</p>}
      {x.evidenceUrl && (
        <a href={x.evidenceUrl} target="_blank" rel="noreferrer" className="text-xs underline">Ver evidencia</a>
      )}
      {extra && <p className="mt-0.5 text-xs text-muted-foreground">Servicio MarCa Growth: {extra}</p>}
    </li>
  );
}

/** Síntesis de solo lectura de la evaluación activa. Se calcula al vuelo; no guarda nada. */
export function SynthesisView({ company, assessment }: { company: Company; assessment: CompanyAssessment }) {
  const s = buildSynthesis(company, assessment);
  return (
    <div className="space-y-4 text-sm">
      <section className="panel space-y-1 p-4">
        <h2 className="font-display text-lg font-semibold">{s.partial ? "Síntesis parcial" : `Síntesis · Índice global ${s.index.value}`}</h2>
        <p className="text-muted-foreground">
          Cobertura total {pct(s.index.totalCoverage)}. Basada solo en los controles evaluados de «{assessment.title}». No incluye estimaciones económicas ni resultados no medidos.
        </p>
        {s.partial && <p className="text-muted-foreground">No se muestra índice global: los motivos se detallan en el resumen de arriba.</p>}
      </section>

      <section className="panel p-4">
        <h3 className="font-display font-semibold">Fortalezas ({s.strengths.length})</h3>
        {s.strengths.length === 0 ? <p className="text-muted-foreground">Ningún control marcado como «Cumple» todavía.</p> : (
          <ul className="divide-y divide-border">{s.strengths.map((x) => <Item key={x.controlId} x={x} />)}</ul>
        )}
      </section>

      <section className="panel p-4">
        <h3 className="font-display font-semibold">Prioridades de mejora ({s.priorities.length})</h3>
        <p className="text-xs text-muted-foreground">Orden: controles críticos primero, luego relevancia propuesta de la dimensión.</p>
        {s.priorities.length === 0 ? <p className="text-muted-foreground">Ningún control marcado como «Requiere mejora».</p> : (
          <ol className="divide-y divide-border">{s.priorities.map((x) => <Item key={x.controlId} x={x} extra={x.service} />)}</ol>
        )}
      </section>

      <section className="panel p-4">
        <h3 className="font-display font-semibold">Límites del diagnóstico ({s.limits.length})</h3>
        <p className="text-xs text-muted-foreground">Estos controles no generan conclusiones ni recomendaciones.</p>
        <ul className="divide-y divide-border">
          {s.limits.map((l) => (
            <li key={l.controlId} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span>{l.title} <span className="text-xs text-muted-foreground">· {l.dimensionTitle}</span>{l.justification && <span className="block text-xs">Justificación: {l.justification}</span>}</span>
              <Badge variant="outline">{LIMIT_LABELS[l.kind]}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

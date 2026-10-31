import type { EvidenceItem } from "@/seo/evidence";
import { toEvidenceDisplay } from "@/seo/evidence-display";

/** Lista reutilizable de evidencia (estructurada o histórica en texto). */
export function EvidenceList({
  items,
  max = 12,
  className = "",
}: {
  items: readonly EvidenceItem[];
  max?: number;
  className?: string;
}) {
  if (items.length === 0) return null;
  const shown = items.slice(0, max);
  return (
    <ul className={`space-y-1 text-xs text-muted-foreground ${className}`}>
      {shown.map((item, i) => {
        const d = toEvidenceDisplay(item);
        return (
          <li key={i} className="break-words" data-kind={d.kind}>
            {d.label && <span className="font-medium text-foreground">{d.label}</span>}
            {d.label && (d.value || d.count !== undefined || d.expected || d.url) && ": "}
            {d.value && <span>{d.value}</span>}
            {d.count !== undefined && (
              <span className="ml-1 rounded bg-muted px-1 font-mono text-foreground">{d.count}</span>
            )}
            {d.expected && <span className="ml-1">(esperado: {d.expected})</span>}
            {d.url && (
              <>
                {(d.value || d.count !== undefined || d.expected) && " · "}
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-primary underline-offset-2 hover:underline"
                >
                  {d.url}
                </a>
              </>
            )}
            {d.snippet && (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted p-1.5 font-mono text-[11px] text-foreground">
                {d.snippet}
              </pre>
            )}
          </li>
        );
      })}
      {items.length > max && <li>… y {items.length - max} más</li>}
    </ul>
  );
}

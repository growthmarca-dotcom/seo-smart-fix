/** Suggestion Engine: convierte hallazgos en propuestas de cambio editables. */
import { getConnector } from "./connectors";
import type { ChangeProposal, Finding, PlatformId } from "./types";

export function proposalFromFinding(
  finding: Finding,
  auditId: string,
  platform: PlatformId,
): ChangeProposal | null {
  if (!finding.suggestion || !finding.field) return null;
  const connector = getConnector(platform);
  const writable = Boolean(
    connector?.capabilities.some((c) => c.field === finding.field && c.write),
  );
  const now = new Date().toISOString();
  return {
    id: `${auditId}:${finding.id}`,
    auditId,
    findingId: finding.id,
    pageId: finding.pageId,
    pageUrl: finding.pageUrl,
    field: finding.field,
    category: finding.category,
    severity: finding.severity,
    currentValue: finding.current,
    suggestedValue: finding.suggestion,
    status: "pending",
    writable,
    createdAt: now,
    updatedAt: now,
  };
}

/** Texto exportable con las instrucciones de los cambios aprobados. */
export function exportChanges(changes: ChangeProposal[]) {
  return changes
    .map(
      (c, i) =>
        `${i + 1}. ${c.pageUrl}\n   Campo: ${c.field}\n   Actual: ${c.currentValue}\n   Sugerido: ${
          c.editedValue ?? c.suggestedValue
        }\n`,
    )
    .join("\n");
}

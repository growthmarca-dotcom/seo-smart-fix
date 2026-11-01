/**
 * Diagnóstico integral por empresa. Lógica pura: el store solo llama a estas funciones.
 * Un control sin registro = "unevaluated" (sin evaluar), nunca cero.
 */
export type ControlStatus = "unevaluated" | "meets" | "needs-improvement" | "not-applicable";
export const CONTROL_STATUS_LABELS: Record<ControlStatus, string> = {
  unevaluated: "Sin evaluar",
  meets: "Cumple",
  "needs-improvement": "Requiere mejora",
  "not-applicable": "No aplica",
};

export interface ControlState {
  status: ControlStatus;
  notes: string;
  evidenceUrl?: string | undefined;
  updatedAt: string;
}

export interface CompanyDiagnosis {
  companyId: string;
  controls: Record<string, ControlState>;
  updatedAt: string;
}

const STATUSES = new Set<ControlStatus>(["unevaluated", "meets", "needs-improvement", "not-applicable"]);

export function emptyDiagnosis(companyId: string, at: string): CompanyDiagnosis {
  return { companyId, controls: {}, updatedAt: at };
}

export function setControl(
  d: CompanyDiagnosis,
  controlId: string,
  patch: Partial<Pick<ControlState, "status" | "notes" | "evidenceUrl">>,
  at: string,
): CompanyDiagnosis {
  if (patch.status && !STATUSES.has(patch.status)) return d;
  const prev = d.controls[controlId] ?? { status: "unevaluated" as const, notes: "", updatedAt: at };
  const next: ControlState = { ...prev, ...patch, updatedAt: at };
  if (patch.evidenceUrl !== undefined) next.evidenceUrl = patch.evidenceUrl.trim() || undefined;
  return { ...d, controls: { ...d.controls, [controlId]: next }, updatedAt: at };
}

/** Normaliza datos guardados. Estados previos sin diagnósticos → []. Descarta empresas inexistentes. */
export function migrateDiagnoses(loaded: unknown, companyIds: string[]): CompanyDiagnosis[] {
  const known = new Set(companyIds);
  const seen = new Set<string>();
  if (!Array.isArray(loaded)) return [];
  return loaded
    .filter((d): d is CompanyDiagnosis => !!d && typeof d === "object" && typeof (d as CompanyDiagnosis).companyId === "string")
    .filter((d) => known.has(d.companyId) && !seen.has(d.companyId) && (seen.add(d.companyId), true))
    .map((d) => ({
      companyId: d.companyId,
      updatedAt: d.updatedAt ?? new Date(0).toISOString(),
      controls: Object.fromEntries(
        Object.entries(d.controls && typeof d.controls === "object" ? d.controls : {})
          .filter(([, c]) => c && STATUSES.has(c.status))
          .map(([id, c]) => [id, { status: c.status, notes: c.notes ?? "", evidenceUrl: c.evidenceUrl, updatedAt: c.updatedAt ?? "" }]),
      ),
    }));
}

/**
 * Listado global de propuestas (solo lectura). Reutiliza `effectiveStatus` y
 * `displayTotals` de P2; no recalcula importes ni vencimientos.
 */
import { STATUS_LABELS, displayTotals, effectiveStatus, type EffectiveStatus, type Proposal } from "../model";
import { formatCents } from "./catalog-form";
import { proposalReference } from "./proposal-view";

export interface GlobalProposalRow {
  id: string;
  companyId: string;
  companyName?: string | undefined;
  version: number;
  reference: string;
  createdAt: string;
  validUntil?: string | undefined;
  status: EffectiveStatus;
  statusLabel: string;
  /** Una línea por moneda y modalidad; nunca se suman monedas distintas. */
  totals: { currency: string; modality: "one-off" | "recurring"; label: string }[];
}

export function allProposalRows(
  proposals: Proposal[],
  companies: { id: string; tradeName: string }[],
  nowIso: string,
): GlobalProposalRow[] {
  const names = new Map(companies.map((c) => [c.id, c.tradeName]));
  return [...proposals]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => {
      const status = effectiveStatus(p, nowIso);
      return {
        id: p.id,
        companyId: p.companyId,
        companyName: names.get(p.companyId),
        version: p.version,
        reference: proposalReference(p).text,
        createdAt: p.createdAt.slice(0, 10),
        validUntil: p.validUntil,
        status,
        statusLabel: STATUS_LABELS[status],
        totals: displayTotals(p).blocks.map((b) => ({
          currency: b.currency,
          modality: b.modality,
          label: b.incomplete
            ? `${b.currency} incompleto (faltan precios)`
            : `${b.currency} ${formatCents(b.billedTotalWithVat)}${b.modality === "recurring" ? " / mes" : ""}`,
        })),
      };
    });
}

export interface ProposalFilters {
  companyId: string; // "" = todas
  status: EffectiveStatus | ""; // "" = todos
  query: string;
}

export const EMPTY_FILTERS: ProposalFilters = { companyId: "", status: "", query: "" };

export function filterProposalRows(rows: GlobalProposalRow[], f: ProposalFilters): GlobalProposalRow[] {
  const q = f.query.trim().toLocaleLowerCase("es-AR");
  return rows.filter(
    (r) =>
      (!f.companyId || r.companyId === f.companyId) &&
      (!f.status || r.status === f.status) &&
      (!q ||
        (r.companyName ?? "").toLocaleLowerCase("es-AR").includes(q) ||
        r.reference.toLocaleLowerCase("es-AR").includes(q)),
  );
}

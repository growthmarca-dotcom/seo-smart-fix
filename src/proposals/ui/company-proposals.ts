/**
 * P4.2 — Utilidades PURAS para listar propuestas en la ficha de empresa.
 * No calcula nada nuevo: usa `effectiveStatus` y `displayTotals` de P2.
 */
import { STATUS_LABELS, displayTotals, effectiveStatus, type Proposal } from "../model";
import { formatCents } from "./catalog-form";
import { proposalReference } from "./proposal-view";

export interface ProposalRow {
  id: string;
  version: number;
  statusLabel: string;
  dateLabel: string;
  date: string;
  validUntil?: string | undefined;
  reference: string;
  /** Una línea por moneda y modalidad; nunca se suman monedas distintas. */
  totals: string[];
}

export function proposalRows(proposals: Proposal[], companyId: string, nowIso: string): ProposalRow[] {
  return proposals
    .filter((p) => p.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => {
      const sent = p.sentAt !== undefined;
      return {
        id: p.id,
        version: p.version,
        statusLabel: STATUS_LABELS[effectiveStatus(p, nowIso)],
        dateLabel: sent ? "Enviada" : "Creada",
        date: (sent ? p.sentAt! : p.createdAt).slice(0, 10),
        validUntil: p.validUntil,
        reference: proposalReference(p).text,
        totals: displayTotals(p).blocks.map((b) => {
          const mod = b.modality === "recurring" ? " / mes" : "";
          const amount = b.incomplete ? "incompleto (faltan precios)" : `${formatCents(b.billedTotalWithVat)}${mod}`;
          return `${b.currency} ${amount}`;
        }),
      };
    });
}

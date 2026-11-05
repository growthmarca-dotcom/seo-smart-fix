/**
 * P4.3 — Utilidades PURAS de presentación de propuestas.
 * No calcula importes: solo lee `computeItemAmounts`/`displayTotals` de P2.
 */
import { computeItemAmounts, displayTotals, type Proposal, type ProposalItem, type TotalsBlock } from "../model";
import { formatCents } from "./catalog-form";

export const NOT_INFORMED = "No informado";

/** Referencia: campo nuevo; si falta, se lee la heredada en `notes` (sin reescribir nada). */
export function proposalReference(p: Pick<Proposal, "reference" | "notes">): { text: string; legacy: boolean } {
  if (p.reference !== undefined) return { text: p.reference, legacy: false };
  return { text: p.notes ?? "", legacy: (p.notes ?? "").trim() !== "" };
}

export const money = (currency: string, cents: number | undefined) =>
  cents === undefined ? NOT_INFORMED : `${currency} ${formatCents(cents)}`;

/** Ítems a mostrar: copia congelada si existe. */
export const displayItems = (p: Proposal): ProposalItem[] => p.frozen?.items ?? p.items;

export interface ItemRow {
  id: string;
  name: string;
  currency: string;
  amount: string;
  months: string;
  period?: string | undefined;
  missing: string[];
}

export function itemRow(it: ProposalItem): ItemRow {
  const a = computeItemAmounts(it);
  const missing: string[] = [];
  if (it.unitPriceCents === undefined) missing.push("precio");
  if (it.modality === "recurring" && it.months === undefined) missing.push("meses");
  return {
    id: it.id,
    name: it.name,
    currency: it.currency,
    amount: money(it.currency, a.amountCents) + (it.modality === "recurring" && a.amountCents !== undefined ? " / mes" : ""),
    months: it.modality === "recurring" ? (it.months === undefined ? NOT_INFORMED : `${it.months} meses`) : "—",
    period: it.modality === "recurring" ? money(it.currency, a.periodCents) : undefined,
    missing,
  };
}

/** Nombres de conceptos a completar en un bloque (precio o meses). */
export function missingNames(b: TotalsBlock, items: ProposalItem[]): string[] {
  const ids = new Set([...b.missingPriceItemIds, ...(b.period?.missingMonthsItemIds ?? [])]);
  return items.filter((i) => ids.has(i.id)).map((i) => i.name);
}

// ---------------------------------------------------------------- vista del cliente

export interface ClientLine {
  name: string;
  description?: string | undefined;
  scope: string;
  deliverables: string;
  term: string;
  modality: ProposalItem["modality"];
  months: string;
  /** Pago directo del cliente (publicidad o gasto no facturado por MarCa). */
  direct: boolean;
  amount: string;
}

export interface ClientBlock {
  currency: string;
  modality: TotalsBlock["modality"];
  incomplete: boolean;
  /** Honorarios en un solo renglón (propios + colaboradores + coordinación), neto de descuentos. */
  fees?: string | undefined;
  externalBilled?: string | undefined;
  discountTotal?: string | undefined;
  vatPercent?: number | undefined;
  vat?: string | undefined;
  total?: string | undefined;
  periodTotal?: string | undefined;
  periodMonths?: number | undefined;
  direct?: string | undefined;
}

export interface ClientView {
  reference: string;
  version: number;
  context?: string | undefined;
  clientNotes?: string | undefined;
  validUntil?: string | undefined;
  lines: ClientLine[];
  blocks: ClientBlock[];
}

/** Vista del cliente: sin notas internas, sin nombres de colaboradores, sin desglose por tipo de costo interno. */
export function clientView(p: Proposal): ClientView {
  const items = displayItems(p);
  const totals = displayTotals(p);
  return {
    reference: proposalReference(p).text,
    version: p.version,
    context: p.context?.trim() || undefined,
    clientNotes: p.clientNotes?.trim() || undefined,
    validUntil: p.validUntil,
    lines: items.map((it) => {
      const r = itemRow(it);
      return {
        name: it.name,
        description: it.description,
        scope: it.scope,
        deliverables: it.deliverables,
        term: it.term,
        modality: it.modality,
        months: r.months,
        direct: it.costType === "ad-spend" || (it.costType === "external-license" && it.billedBy === "client"),
        amount: r.amount,
      };
    }),
    blocks: totals.blocks.map((b) => {
      const c = b.currency;
      if (b.incomplete) return { currency: c, modality: b.modality, incomplete: true };
      const fees = b.ownFeeNet + b.collaboratorNet + b.subtotals.coordination;
      const per = b.period;
      return {
        currency: c,
        modality: b.modality,
        incomplete: per ? per.incomplete : false,
        fees: money(c, fees),
        externalBilled: b.subtotals.externalBilled ? money(c, b.subtotals.externalBilled) : undefined,
        discountTotal: b.discountTotal ? money(c, b.discountTotal) : undefined,
        vatPercent: b.vatPercent,
        vat: b.vatPercent !== undefined ? money(c, b.vatCents) : undefined,
        total: money(c, b.billedTotalWithVat),
        periodTotal: per && !per.incomplete ? money(c, per.billedTotalWithVat) : undefined,
        periodMonths: per?.months,
        direct: b.direct.total ? money(c, b.direct.total) : undefined,
      };
    }),
  };
}

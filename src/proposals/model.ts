/**
 * P2 — Propuestas modulares de MarCa Growth. Modelo y cálculo PUROS: no persisten nada,
 * no leen almacenamiento y nunca influyen en el diagnóstico (cobertura, madurez, índice).
 *
 * Reglas comerciales confirmadas:
 * - Varias monedas: un bloque por moneda y modalidad; nunca hay total combinado ni conversión.
 * - Puntual y mensual siempre separados.
 * - Varios descuentos, todos sobre la MISMA base original (propios + colaboradores), con tope
 *   conjunto; nunca negativos. Coordinación, licencias, gastos y publicidad no reciben descuento.
 * - IVA: único porcentaje opcional por propuesta. Vacío = sin IVA. Sin valor por defecto.
 * - Publicidad: siempre pago directo del cliente → informativa, fuera del total y del IVA.
 * - Licencias/gastos: `billedBy` obligatorio: "marca" (total + IVA) o "client" (informativo).
 * - Precio faltante = bloque "incompleto"; nunca cuenta como 0 en silencio.
 * - Enviada = congelada. Vencida se calcula por fecha de validez y no puede aceptarse.
 * - Nueva versión = borrador vinculado; la original no cambia. Nada se borra.
 * Importes en centavos (enteros).
 */

export type Modality = "one-off" | "recurring";
export type CostType = "own-fee" | "collaborator" | "coordination" | "external-license" | "ad-spend";
export type BilledBy = "marca" | "client";
export type DiscountTarget = "own-fee" | "collaborator";
export type StoredStatus = "draft" | "sent" | "accepted" | "rejected";
export type EffectiveStatus = StoredStatus | "expired";

export const STATUS_LABELS: Record<EffectiveStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
};

export interface ProposalItem {
  id: string;
  name: string;
  scope: string;
  deliverables: string;
  term: string;
  modality: Modality;
  months?: number | undefined;
  costType: CostType;
  /** Obligatorio para licencias/gastos. Ignorado en publicidad (siempre cliente). */
  billedBy?: BilledBy | undefined;
  /** Código ISO de 3 letras (ARS, USD, EUR…). */
  currency: string;
  quantity: number;
  /** Centavos. Vacío = "No informado". */
  unitPriceCents?: number | undefined;
  platform?: string | undefined;
  provider?: string | undefined;
  collaboratorName?: string | undefined;
  sourceItemId?: string | undefined;
  linkedControlIds?: string[] | undefined;
}

export interface Discount {
  id: string;
  label: string;
  kind: "percent" | "amount";
  /** Porcentaje (0–100) o centavos según `kind`. */
  value: number;
  /** Obligatoria si kind = "amount". */
  currency?: string | undefined;
  appliesTo: DiscountTarget[];
  modality: Modality | "both";
}

export interface Proposal {
  id: string;
  companyId: string;
  assessmentId?: string | undefined;
  version: number;
  previousVersionId?: string | undefined;
  status: StoredStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string | undefined;
  decidedAt?: string | undefined;
  /** Fecha ISO (YYYY-MM-DD). Sin fecha = nunca vence. */
  validUntil?: string | undefined;
  /** Único campo de IVA. Vacío = sin IVA. */
  vatPercent?: number | undefined;
  notes: string;
  items: ProposalItem[];
  discounts: Discount[];
  /** Copia congelada al enviar. */
  frozen?: { at: string; items: ProposalItem[]; discounts: Discount[]; vatPercent?: number | undefined; totals: ProposalTotals } | undefined;
}

export interface Ctx {
  now: () => string;
  newId: () => string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

// ---------------------------------------------------------------- validación

const CURRENCY_RE = /^[A-Z]{3}$/;

export function validateVatPercent(v: number | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100) return "El IVA debe ser un porcentaje entre 0 y 100, o quedar vacío.";
  return undefined;
}

export function validateItem(it: ProposalItem): string | undefined {
  if (!it.name.trim()) return "El ítem necesita un nombre.";
  if (!CURRENCY_RE.test(it.currency)) return "Moneda inválida (usar código de 3 letras, por ejemplo ARS o USD).";
  if (!Number.isFinite(it.quantity) || it.quantity <= 0) return "La cantidad debe ser mayor que 0.";
  if (it.unitPriceCents !== undefined && (!Number.isInteger(it.unitPriceCents) || it.unitPriceCents < 0)) return "Precio inválido.";
  if (it.months !== undefined && (!Number.isInteger(it.months) || it.months <= 0)) return "Los meses deben ser un número entero mayor que 0.";
  if (it.costType === "external-license" && it.billedBy !== "marca" && it.billedBy !== "client")
    return "Indicá si la licencia o gasto lo factura MarCa o lo paga el cliente directamente al proveedor.";
  return undefined;
}

export function validateDiscount(d: Discount): string | undefined {
  if (!d.label.trim()) return "El descuento necesita un nombre.";
  if (d.appliesTo.length === 0) return "El descuento debe aplicarse a honorarios propios y/o de colaboradores.";
  if (d.appliesTo.some((t) => t !== "own-fee" && t !== "collaborator")) return "Solo se descuentan honorarios propios y de colaboradores.";
  if (!Number.isFinite(d.value) || d.value < 0) return "Valor de descuento inválido.";
  if (d.kind === "percent" && d.value > 100) return "El porcentaje no puede superar 100.";
  if (d.kind === "amount") {
    if (!Number.isInteger(d.value)) return "El monto debe estar en centavos enteros.";
    if (!d.currency || !CURRENCY_RE.test(d.currency)) return "El descuento por monto necesita su moneda.";
  }
  return undefined;
}

// ---------------------------------------------------------------- cálculo

export interface DiscountLine {
  id: string;
  label: string;
  amountCents: number;
}

export interface TotalsBlock {
  currency: string;
  modality: Modality;
  /** true si alguna línea facturable o informativa no tiene precio. */
  incomplete: boolean;
  missingPriceItemIds: string[];
  subtotals: { ownFee: number; collaborator: number; coordination: number; externalBilled: number };
  discountBase: number;
  discounts: DiscountLine[];
  discountTotal: number;
  /** true si la suma de descuentos se recortó para no superar la base. */
  discountCapped: boolean;
  ownFeeNet: number;
  collaboratorNet: number;
  /** Total facturado por MarCa, sin IVA. */
  billedTotal: number;
  vatPercent?: number | undefined;
  vatCents: number;
  billedTotalWithVat: number;
  /** Pagos directos del cliente: informativos, fuera del total y del IVA. */
  direct: { adSpendByPlatform: Record<string, number>; externalByProvider: Record<string, number>; total: number };
  /**
   * Solo en bloques mensuales: total del período contratado (los importes de arriba son MENSUALES).
   * Se calcula mes a mes: cada ítem cuenta solo durante sus propios meses; los descuentos
   * (porcentuales o por monto mensual) y el tope se aplican en cada mes. Sin meses o sin precio en
   * algún ítem → incompleto y sin totales (nunca se asume una duración ni cero).
   */
  period?: PeriodTotals | undefined;
}

export interface PeriodTotals {
  incomplete: boolean;
  missingMonthsItemIds: string[];
  missingPriceItemIds: string[];
  /** Mayor duración entre los ítems (meses), si todos la informan. */
  months?: number | undefined;
  subtotals?: TotalsBlock["subtotals"] | undefined;
  discountBase?: number | undefined;
  discounts?: DiscountLine[] | undefined;
  discountTotal?: number | undefined;
  ownFeeNet?: number | undefined;
  collaboratorNet?: number | undefined;
  billedTotal?: number | undefined;
  vatCents?: number | undefined;
  billedTotalWithVat?: number | undefined;
  direct?: TotalsBlock["direct"] | undefined;
}

export interface ItemAmounts {
  /** Puntual: importe total. Mensual: importe por mes. Vacío = no informado. */
  amountCents?: number | undefined;
  months?: number | undefined;
  /** Solo mensual: importe × meses. Vacío si falta precio o meses. */
  periodCents?: number | undefined;
}

/** Importes de un ítem sin alterar el importe original. */
export function computeItemAmounts(it: ProposalItem): ItemAmounts {
  const amountCents = it.unitPriceCents === undefined ? undefined : Math.round(it.quantity * it.unitPriceCents);
  if (it.modality !== "recurring") return { amountCents };
  const months = it.months;
  return { amountCents, months, periodCents: amountCents !== undefined && months !== undefined ? amountCents * months : undefined };
}

export interface ProposalTotals {
  blocks: TotalsBlock[];
  /** Más de una moneda: nunca hay total único. */
  multiCurrency: boolean;
}

const lineCents = (it: ProposalItem) => Math.round(it.quantity * (it.unitPriceCents ?? 0));
const modalityMatches = (d: Discount, m: Modality) => d.modality === "both" || d.modality === m;

export function computeTotals(p: Pick<Proposal, "items" | "discounts" | "vatPercent">): ProposalTotals {
  const keys: { currency: string; modality: Modality }[] = [];
  for (const it of p.items)
    if (!keys.some((k) => k.currency === it.currency && k.modality === it.modality)) keys.push({ currency: it.currency, modality: it.modality });
  keys.sort((a, b) => a.currency.localeCompare(b.currency) || (a.modality === b.modality ? 0 : a.modality === "one-off" ? -1 : 1));

  const blocks = keys.map(({ currency, modality }) => computeBlock(p, currency, modality));
  return { blocks, multiCurrency: new Set(keys.map((k) => k.currency)).size > 1 };
}

function computeCore(p: Pick<Proposal, "discounts" | "vatPercent">, items: ProposalItem[], currency: string, modality: Modality): TotalsBlock {
  const missing = items.filter((i) => i.unitPriceCents === undefined).map((i) => i.id);
  const sub = { ownFee: 0, collaborator: 0, coordination: 0, externalBilled: 0 };
  const direct = { adSpendByPlatform: {} as Record<string, number>, externalByProvider: {} as Record<string, number>, total: 0 };

  for (const it of items) {
    const c = lineCents(it);
    if (it.costType === "own-fee") sub.ownFee += c;
    else if (it.costType === "collaborator") sub.collaborator += c;
    else if (it.costType === "coordination") sub.coordination += c;
    else if (it.costType === "ad-spend") {
      const k = it.platform?.trim() || "Sin plataforma";
      direct.adSpendByPlatform[k] = (direct.adSpendByPlatform[k] ?? 0) + c;
      direct.total += c;
    } else if (it.billedBy === "marca") sub.externalBilled += c;
    else {
      const k = it.provider?.trim() || "Sin proveedor";
      direct.externalByProvider[k] = (direct.externalByProvider[k] ?? 0) + c;
      direct.total += c;
    }
  }

  const base: Record<DiscountTarget, number> = { "own-fee": sub.ownFee, collaborator: sub.collaborator };
  // Asignación de cada descuento por tipo, todos sobre la base ORIGINAL (no acumulativos).
  const applicable = p.discounts.filter((d) => modalityMatches(d, modality) && (d.kind === "percent" || d.currency === currency));
  const alloc = applicable.map((d) => {
    const targets = [...new Set(d.appliesTo)];
    const dBase = targets.reduce((s, t) => s + base[t], 0);
    const raw = d.kind === "percent" ? Math.round((dBase * d.value) / 100) : Math.min(d.value, dBase);
    const per: Record<DiscountTarget, number> = { "own-fee": 0, collaborator: 0 };
    let rest = raw;
    targets.forEach((t, i) => {
      const share = i === targets.length - 1 ? rest : dBase === 0 ? 0 : Math.round((raw * base[t]) / dBase);
      per[t] = share;
      rest -= share;
    });
    return { d, per };
  });

  // Tope conjunto por tipo: el exceso se recorta del último descuento hacia atrás.
  let capped = false;
  for (const t of ["own-fee", "collaborator"] as DiscountTarget[]) {
    let excess = alloc.reduce((s, a) => s + a.per[t], 0) - base[t];
    for (let i = alloc.length - 1; i >= 0 && excess > 0; i--) {
      const cut = Math.min(alloc[i]!.per[t], excess);
      alloc[i]!.per[t] -= cut;
      excess -= cut;
      if (cut > 0) capped = true;
    }
  }

  const discounts = alloc.map(({ d, per }) => ({ id: d.id, label: d.label, amountCents: per["own-fee"] + per.collaborator }));
  const discOwn = alloc.reduce((s, a) => s + a.per["own-fee"], 0);
  const discCol = alloc.reduce((s, a) => s + a.per.collaborator, 0);
  const ownFeeNet = sub.ownFee - discOwn;
  const collaboratorNet = sub.collaborator - discCol;
  const billedTotal = ownFeeNet + collaboratorNet + sub.coordination + sub.externalBilled;
  const vatCents = p.vatPercent === undefined ? 0 : Math.round((billedTotal * p.vatPercent) / 100);

  return {
    currency,
    modality,
    incomplete: missing.length > 0,
    missingPriceItemIds: missing,
    subtotals: sub,
    discountBase: sub.ownFee + sub.collaborator,
    discounts,
    discountTotal: discOwn + discCol,
    discountCapped: capped,
    ownFeeNet,
    collaboratorNet,
    billedTotal,
    vatPercent: p.vatPercent,
    vatCents,
    billedTotalWithVat: billedTotal + vatCents,
    direct,
  };
}

function computeBlock(p: Pick<Proposal, "items" | "discounts" | "vatPercent">, currency: string, modality: Modality): TotalsBlock {
  const items = p.items.filter((i) => i.currency === currency && i.modality === modality);
  const block = computeCore(p, items, currency, modality);
  if (modality === "recurring") block.period = computePeriod(p, items, currency);
  return block;
}

function computePeriod(p: Pick<Proposal, "items" | "discounts" | "vatPercent">, items: ProposalItem[], currency: string): PeriodTotals {
  const missingMonthsItemIds = items.filter((i) => i.months === undefined).map((i) => i.id);
  const missingPriceItemIds = items.filter((i) => i.unitPriceCents === undefined).map((i) => i.id);
  if (missingMonthsItemIds.length || missingPriceItemIds.length) return { incomplete: true, missingMonthsItemIds, missingPriceItemIds };
  const months = Math.max(...items.map((i) => i.months!));
  const acc: PeriodTotals = {
    incomplete: false, missingMonthsItemIds, missingPriceItemIds, months,
    subtotals: { ownFee: 0, collaborator: 0, coordination: 0, externalBilled: 0 },
    discountBase: 0, discounts: [], discountTotal: 0, ownFeeNet: 0, collaboratorNet: 0,
    billedTotal: 0, vatCents: 0, billedTotalWithVat: 0,
    direct: { adSpendByPlatform: {}, externalByProvider: {}, total: 0 },
  };
  const add = (r: Record<string, number>, s: Record<string, number>) => { for (const k in s) r[k] = (r[k] ?? 0) + s[k]!; };
  for (let m = 1; m <= months; m++) {
    const b = computeCore(p, items.filter((i) => i.months! >= m), currency, "recurring");
    add(acc.subtotals!, b.subtotals);
    for (const d of b.discounts) {
      const cur = acc.discounts!.find((x) => x.id === d.id);
      if (cur) cur.amountCents += d.amountCents;
      else acc.discounts!.push({ ...d });
    }
    acc.discountBase! += b.discountBase;
    acc.discountTotal! += b.discountTotal;
    acc.ownFeeNet! += b.ownFeeNet;
    acc.collaboratorNet! += b.collaboratorNet;
    acc.billedTotal! += b.billedTotal;
    acc.vatCents! += b.vatCents;
    acc.billedTotalWithVat! += b.billedTotalWithVat;
    add(acc.direct!.adSpendByPlatform, b.direct.adSpendByPlatform);
    add(acc.direct!.externalByProvider, b.direct.externalByProvider);
    acc.direct!.total += b.direct.total;
  }
  return acc;
}

// ---------------------------------------------------------------- estados

/** "Vencida" se calcula al mostrar: enviada + fecha de validez anterior a hoy. No reescribe nada. */
export function effectiveStatus(p: Pick<Proposal, "status" | "validUntil">, nowIso: string): EffectiveStatus {
  if (p.status === "sent" && p.validUntil && nowIso.slice(0, 10) > p.validUntil.slice(0, 10)) return "expired";
  return p.status;
}

/** Totales a mostrar: los congelados si la propuesta ya se envió. */
export function displayTotals(p: Proposal): ProposalTotals {
  return p.frozen ? p.frozen.totals : computeTotals(p);
}

export interface ProposalInput {
  companyId: string;
  assessmentId?: string | undefined;
  validUntil?: string | undefined;
  notes?: string | undefined;
}

export function createProposal(input: ProposalInput, ctx: Ctx): Proposal {
  const at = ctx.now();
  return {
    id: ctx.newId(),
    companyId: input.companyId,
    assessmentId: input.assessmentId,
    version: 1,
    status: "draft",
    createdAt: at,
    updatedAt: at,
    validUntil: input.validUntil,
    vatPercent: undefined,
    notes: input.notes ?? "",
    items: [],
    discounts: [],
  };
}

const NOT_EDITABLE = "Solo se puede editar un borrador. Para cambiar una propuesta enviada, creá una nueva versión.";

function editDraft(p: Proposal, at: string, patch: Partial<Proposal>): Result<Proposal> {
  if (p.status !== "draft") return fail(NOT_EDITABLE);
  return ok({ ...p, ...patch, updatedAt: at });
}

export function upsertItem(p: Proposal, item: ProposalItem, at: string): Result<Proposal> {
  const err = validateItem(item);
  if (err) return fail(err);
  const clean: ProposalItem = item.costType === "ad-spend" ? { ...item, billedBy: "client" } : item;
  const exists = p.items.some((i) => i.id === item.id);
  return editDraft(p, at, { items: exists ? p.items.map((i) => (i.id === item.id ? clean : i)) : [...p.items, clean] });
}

/** Quita un ítem de un BORRADOR (las propuestas nunca se borran). */
export function removeItem(p: Proposal, itemId: string, at: string): Result<Proposal> {
  return editDraft(p, at, { items: p.items.filter((i) => i.id !== itemId) });
}

export function upsertDiscount(p: Proposal, d: Discount, at: string): Result<Proposal> {
  const err = validateDiscount(d);
  if (err) return fail(err);
  const exists = p.discounts.some((x) => x.id === d.id);
  return editDraft(p, at, { discounts: exists ? p.discounts.map((x) => (x.id === d.id ? d : x)) : [...p.discounts, d] });
}

export function removeDiscount(p: Proposal, id: string, at: string): Result<Proposal> {
  return editDraft(p, at, { discounts: p.discounts.filter((x) => x.id !== id) });
}

/** `undefined` = sin IVA. */
export function setVatPercent(p: Proposal, v: number | undefined, at: string): Result<Proposal> {
  const err = validateVatPercent(v);
  if (err) return fail(err);
  return editDraft(p, at, { vatPercent: v });
}

export function setValidUntil(p: Proposal, v: string | undefined, at: string): Result<Proposal> {
  return editDraft(p, at, { validUntil: v });
}

export function sendProposal(p: Proposal, at: string): Result<Proposal> {
  if (p.status !== "draft") return fail("Solo se puede enviar un borrador.");
  if (p.items.length === 0) return fail("La propuesta necesita al menos un ítem.");
  for (const it of p.items) {
    const e = validateItem(it);
    if (e) return fail(e);
  }
  const vatErr = validateVatPercent(p.vatPercent);
  if (vatErr) return fail(vatErr);
  const items = structuredClone(p.items);
  const discounts = structuredClone(p.discounts);
  const totals = computeTotals({ items, discounts, vatPercent: p.vatPercent });
  return ok({ ...p, status: "sent", sentAt: at, updatedAt: at, frozen: { at, items, discounts, vatPercent: p.vatPercent, totals } });
}

export function acceptProposal(p: Proposal, at: string): Result<Proposal> {
  const s = effectiveStatus(p, at);
  if (s === "expired") return fail("La propuesta está vencida y no puede aceptarse. Creá una nueva versión, revisá precios y condiciones, y enviala nuevamente.");
  if (s !== "sent") return fail("Solo se puede aceptar una propuesta enviada.");
  return ok({ ...p, status: "accepted", decidedAt: at, updatedAt: at });
}

export function rejectProposal(p: Proposal, at: string): Result<Proposal> {
  const s = effectiveStatus(p, at);
  if (s !== "sent" && s !== "expired") return fail("Solo se puede rechazar una propuesta enviada.");
  return ok({ ...p, status: "rejected", decidedAt: at, updatedAt: at });
}

/** Nueva versión: borrador vinculado a la anterior (enviada, rechazada o vencida). La original no se modifica. */
export function newVersion(p: Proposal, ctx: Ctx): Result<Proposal> {
  const at = ctx.now();
  const s = effectiveStatus(p, at);
  if (s !== "sent" && s !== "rejected" && s !== "expired") return fail("Solo se crea una nueva versión desde una propuesta enviada, rechazada o vencida.");
  const src = p.frozen ?? { items: p.items, discounts: p.discounts, vatPercent: p.vatPercent };
  return ok({
    id: ctx.newId(),
    companyId: p.companyId,
    assessmentId: p.assessmentId,
    version: p.version + 1,
    previousVersionId: p.id,
    status: "draft",
    createdAt: at,
    updatedAt: at,
    validUntil: undefined,
    vatPercent: src.vatPercent,
    notes: p.notes,
    items: structuredClone(src.items),
    discounts: structuredClone(src.discounts),
  });
}

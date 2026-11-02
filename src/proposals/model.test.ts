import { describe, expect, it } from "vitest";
import {
  acceptProposal,
  computeItemAmounts,
  computeTotals,
  createProposal,
  effectiveStatus,
  newVersion,
  rejectProposal,
  sendProposal,
  setVatPercent,
  upsertDiscount,
  upsertItem,
  type Ctx,
  type Discount,
  type Proposal,
  type ProposalItem,
  type Result,
} from "./model";

const AT = "2026-11-01T12:00:00.000Z";
let n = 0;
const ctx: Ctx = { now: () => AT, newId: () => `id-${++n}` };
const val = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

const item = (o: Partial<ProposalItem>): ProposalItem => ({
  id: `it-${++n}`, name: "Ítem", scope: "", deliverables: "", term: "", modality: "one-off",
  costType: "own-fee", currency: "ARS", quantity: 1, unitPriceCents: 100_000, ...o,
});
const disc = (o: Partial<Discount>): Discount => ({
  id: `d-${++n}`, label: "Desc", kind: "percent", value: 10, appliesTo: ["own-fee", "collaborator"], modality: "both", ...o,
});
const build = (items: ProposalItem[], discounts: Discount[] = [], vat?: number): Proposal => {
  let p = createProposal({ companyId: "c1" }, ctx);
  for (const i of items) p = val(upsertItem(p, i, AT));
  for (const d of discounts) p = val(upsertDiscount(p, d, AT));
  if (vat !== undefined) p = val(setVatPercent(p, vat, AT));
  return p;
};
const block = (p: Proposal, currency = "ARS", modality = "one-off") =>
  computeTotals(p).blocks.find((b) => b.currency === currency && b.modality === modality)!;

describe("monedas y modalidades", () => {
  it("dos monedas → dos bloques, sin total combinado", () => {
    const t = computeTotals(build([item({ currency: "ARS" }), item({ currency: "USD", unitPriceCents: 5_000 })]));
    expect(t.blocks.map((b) => b.currency)).toEqual(["ARS", "USD"]);
    expect(t.multiCurrency).toBe(true);
    expect(t.blocks[1]!.billedTotal).toBe(5_000);
  });
  it("puntual y mensual en bloques separados", () => {
    const p = build([item({}), item({ modality: "recurring", unitPriceCents: 30_000 })]);
    expect(block(p).billedTotal).toBe(100_000);
    expect(block(p, "ARS", "recurring").billedTotal).toBe(30_000);
  });
});

describe("descuentos", () => {
  it("varios descuentos sobre la misma base original, no acumulativos", () => {
    const p = build([item({ unitPriceCents: 1_000_000 })], [disc({ value: 10 }), disc({ value: 5 })]);
    const b = block(p);
    expect(b.discounts.map((d) => d.amountCents)).toEqual([100_000, 50_000]);
    expect(b.billedTotal).toBe(850_000);
  });
  it("tope conjunto: nunca supera la base ni queda negativo; recorta del último", () => {
    const p = build([item({ unitPriceCents: 100_000 })], [disc({ value: 80 }), disc({ kind: "amount", value: 50_000, currency: "ARS" })]);
    const b = block(p);
    expect(b.discountTotal).toBe(100_000);
    expect(b.discounts.map((d) => d.amountCents)).toEqual([80_000, 20_000]);
    expect(b.discountCapped).toBe(true);
    expect(b.ownFeeNet).toBe(0);
  });
  it("coordinación, licencias y publicidad no reciben descuento", () => {
    const p = build(
      [
        item({ costType: "coordination", unitPriceCents: 50_000 }),
        item({ costType: "external-license", billedBy: "marca", unitPriceCents: 20_000 }),
        item({ costType: "ad-spend", platform: "Meta", unitPriceCents: 300_000 }),
      ],
      [disc({ value: 50 })],
    );
    const b = block(p);
    expect(b.discountTotal).toBe(0);
    expect(b.billedTotal).toBe(70_000);
  });
  it("monto en otra moneda no afecta; descuento mensual no toca lo puntual", () => {
    const p = build(
      [item({}), item({ modality: "recurring", unitPriceCents: 40_000 })],
      [disc({ kind: "amount", value: 10_000, currency: "USD" }), disc({ value: 50, modality: "recurring" })],
    );
    expect(block(p).discountTotal).toBe(0);
    expect(block(p, "ARS", "recurring").discountTotal).toBe(20_000);
  });
  it("reparto entre propios y colaboradores suma el total", () => {
    const p = build([item({ unitPriceCents: 70_001 }), item({ costType: "collaborator", unitPriceCents: 30_000 })], [disc({ value: 33 })]);
    const b = block(p);
    expect(b.subtotals.ownFee - b.ownFeeNet + (b.subtotals.collaborator - b.collaboratorNet)).toBe(b.discountTotal);
  });
  it("descuento sobre tipo inexistente (solo colaboradores) no genera negativos", () => {
    const b = block(build([item({})], [disc({ appliesTo: ["collaborator"], kind: "amount", value: 999, currency: "ARS" })]));
    expect(b.discountTotal).toBe(0);
    expect(b.collaboratorNet).toBe(0);
  });
  it("rechaza descuentos sobre coordinación", () => {
    const p = build([item({})]);
    expect(upsertDiscount(p, disc({ appliesTo: ["coordination" as never] }), AT).ok).toBe(false);
  });
});

describe("IVA opcional", () => {
  it("vacío por defecto → sin IVA", () => {
    const p = build([item({})]);
    expect(p.vatPercent).toBeUndefined();
    expect(block(p).vatCents).toBe(0);
    expect(sendProposal(p, AT).ok).toBe(true);
  });
  it("10,5 % sobre la base ya descontada", () => {
    const b = block(build([item({ unitPriceCents: 1_000_000 })], [disc({ value: 10 })], 10.5));
    expect(b.billedTotal).toBe(900_000);
    expect(b.vatCents).toBe(94_500);
    expect(b.billedTotalWithVat).toBe(994_500);
  });
  it("valor inválido no se guarda", () => {
    const p = build([item({})]);
    expect(setVatPercent(p, -1, AT).ok).toBe(false);
    expect(setVatPercent(p, 101, AT).ok).toBe(false);
    expect(val(setVatPercent(val(setVatPercent(p, 21, AT)), undefined, AT)).vatPercent).toBeUndefined();
  });
});

describe("pagos directos del cliente", () => {
  it("publicidad siempre informativa, fuera del total y del IVA", () => {
    const p = build([item({}), item({ costType: "ad-spend", platform: "Google", unitPriceCents: 500_000, billedBy: "marca" })], [], 21);
    const b = block(p);
    expect(b.billedTotal).toBe(100_000);
    expect(b.vatCents).toBe(21_000);
    expect(b.direct.adSpendByPlatform).toEqual({ Google: 500_000 });
    expect(p.items[1]!.billedBy).toBe("client");
  });
  it("licencia facturada por MarCa entra en total e IVA; pagada por el cliente queda fuera", () => {
    const p = build(
      [
        item({ costType: "external-license", billedBy: "marca", unitPriceCents: 10_000 }),
        item({ costType: "external-license", billedBy: "client", provider: "Hosting X", unitPriceCents: 8_000 }),
      ],
      [],
      10,
    );
    const b = block(p);
    expect(b.billedTotal).toBe(10_000);
    expect(b.vatCents).toBe(1_000);
    expect(b.direct.externalByProvider).toEqual({ "Hosting X": 8_000 });
  });
  it("licencia sin elegir quién paga no se guarda", () => {
    const p = build([]);
    expect(upsertItem(p, item({ costType: "external-license" }), AT).ok).toBe(false);
  });
});

describe("precio faltante", () => {
  it("marca el bloque incompleto, sin contarlo como cero en silencio", () => {
    const it1 = item({ unitPriceCents: undefined });
    const b = block(build([item({}), it1]));
    expect(b.incomplete).toBe(true);
    expect(b.missingPriceItemIds).toEqual([it1.id]);
  });
});

describe("estados, congelación y versiones", () => {
  it("enviada queda congelada y no se edita", () => {
    const sent = val(sendProposal(build([item({})]), AT));
    expect(sent.frozen!.totals.blocks[0]!.billedTotal).toBe(100_000);
    expect(upsertItem(sent, item({}), AT).ok).toBe(false);
    expect(setVatPercent(sent, 21, AT).ok).toBe(false);
  });
  it("vencida se calcula por fecha y no puede aceptarse", () => {
    const sent = val(sendProposal({ ...build([item({})]), validUntil: "2026-11-10" }, AT));
    expect(effectiveStatus(sent, "2026-11-10T23:00:00Z")).toBe("sent");
    expect(effectiveStatus(sent, "2026-11-11T00:00:00Z")).toBe("expired");
    expect(sent.status).toBe("sent");
    expect(acceptProposal(sent, "2026-11-11T00:00:00Z").ok).toBe(false);
    expect(val(acceptProposal(sent, "2026-11-05T00:00:00Z")).status).toBe("accepted");
  });
  it("sin fecha de validez nunca vence", () => {
    const sent = val(sendProposal(build([item({})]), AT));
    expect(effectiveStatus(sent, "2030-01-01T00:00:00Z")).toBe("sent");
  });
  it("nueva versión desde vencida: borrador vinculado, original intacta", () => {
    const sent = val(sendProposal({ ...build([item({})]), validUntil: "2026-11-02" }, AT));
    const snapshot = structuredClone(sent);
    const later: Ctx = { now: () => "2026-12-01T00:00:00Z", newId: ctx.newId };
    const v2 = val(newVersion(sent, later));
    expect(v2).toMatchObject({ status: "draft", version: 2, previousVersionId: sent.id });
    val(upsertItem(v2, item({ unitPriceCents: 1 }), AT));
    expect(sent).toEqual(snapshot);
  });
  it("no se crea versión desde un borrador ni se acepta un rechazo", () => {
    const draft = build([item({})]);
    expect(newVersion(draft, ctx).ok).toBe(false);
    const rejected = val(rejectProposal(val(sendProposal(draft, AT)), AT));
    expect(acceptProposal(rejected, AT).ok).toBe(false);
  });
  it("envío requiere al menos un ítem", () => {
    expect(sendProposal(build([]), AT).ok).toBe(false);
  });
});

describe("servicios recurrentes: mensual y período", () => {
  const rec = (o: Partial<ProposalItem>) => item({ modality: "recurring", ...o });
  it("ítem: mensual × meses; sin meses o sin precio → período no informado", () => {
    expect(computeItemAmounts(rec({ quantity: 2, unitPriceCents: 10_000, months: 6 }))).toEqual({ amountCents: 20_000, months: 6, periodCents: 120_000 });
    expect(computeItemAmounts(rec({ months: undefined })).periodCents).toBeUndefined();
    const noPrice = computeItemAmounts(rec({ unitPriceCents: undefined, months: 3 }));
    expect(noPrice.amountCents).toBeUndefined();
    expect(noPrice.periodCents).toBeUndefined();
    expect(computeItemAmounts(item({})).periodCents).toBeUndefined();
  });
  it("duraciones distintas: el período suma cada ítem con sus meses; mensual intacto", () => {
    const p = build([rec({ unitPriceCents: 10_000, months: 6 }), rec({ unitPriceCents: 5_000, months: 3 })]);
    const b = block(p, "ARS", "recurring");
    expect(b.billedTotal).toBe(15_000);
    expect(b.period).toMatchObject({ incomplete: false, months: 6, billedTotal: 75_000 });
  });
  it("sin meses → período incompleto sin totales, nunca cero", () => {
    const a = rec({ months: undefined });
    const b = block(build([a, rec({ months: 3 })]), "ARS", "recurring");
    expect(b.period!.incomplete).toBe(true);
    expect(b.period!.missingMonthsItemIds).toEqual([a.id]);
    expect(b.period!.billedTotal).toBeUndefined();
    expect(b.billedTotal).toBe(200_000);
  });
  it("sin precio → mensual y período incompletos", () => {
    const b = block(build([rec({ unitPriceCents: undefined, months: 3 })]), "ARS", "recurring");
    expect(b.incomplete).toBe(true);
    expect(b.period!.incomplete).toBe(true);
    expect(b.period!.billedTotal).toBeUndefined();
  });
  it("descuento fijo mensual se multiplica por los meses con base; porcentual coherente", () => {
    const p = build(
      [rec({ unitPriceCents: 10_000, months: 6 }), rec({ unitPriceCents: 5_000, months: 3 })],
      [disc({ kind: "amount", value: 12_000, currency: "ARS", modality: "recurring" })],
    );
    const b = block(p, "ARS", "recurring");
    expect(b.discountTotal).toBe(12_000);
    // meses 1-3: base 15.000 → 12.000; meses 4-6: base 10.000 → tope 10.000
    expect(b.period!.discountTotal).toBe(66_000);
    expect(b.period!.billedTotal).toBe(9_000);
    const pct = block(build([rec({ unitPriceCents: 10_000, months: 4 })], [disc({ value: 10 })], 21), "ARS", "recurring");
    expect(pct.billedTotal).toBe(9_000);
    expect(pct.period).toMatchObject({ discountTotal: 4_000, billedTotal: 36_000, vatCents: 7_560 });
  });
  it("publicidad mensual queda informativa también en el período", () => {
    const b = block(build([rec({ costType: "ad-spend", platform: "Meta", unitPriceCents: 1_000, months: 2 })]), "ARS", "recurring");
    expect(b.period!.billedTotal).toBe(0);
    expect(b.period!.direct!.adSpendByPlatform).toEqual({ Meta: 2_000 });
  });
  it("puntual no tiene período y queda separado", () => {
    const p = build([item({}), rec({ unitPriceCents: 1_000, months: 2 })]);
    expect(block(p).period).toBeUndefined();
    expect(block(p).billedTotal).toBe(100_000);
  });
  it("el período queda congelado al enviar y la nueva versión conserva meses", () => {
    const sent = val(sendProposal(build([rec({ unitPriceCents: 1_000, months: 2 })]), AT));
    expect(sent.frozen!.totals.blocks[0]!.period!.billedTotal).toBe(2_000);
    expect(val(newVersion(sent, ctx)).items[0]!.months).toBe(2);
  });
});

describe("vencidas: ni aceptar ni rechazar", () => {
  it("rechazo bloqueado, original intacta, nueva versión copia ítems/descuentos/IVA sin fecha", () => {
    const sent = val(sendProposal({ ...build([item({})], [disc({})], 21), validUntil: "2026-11-02" }, AT));
    const snap = structuredClone(sent);
    const late = "2026-11-20T00:00:00Z";
    expect(rejectProposal(sent, late).ok).toBe(false);
    expect(acceptProposal(sent, late).ok).toBe(false);
    expect(sent).toEqual(snap);
    const v2 = val(newVersion(sent, { now: () => late, newId: ctx.newId }));
    expect(v2.validUntil).toBeUndefined();
    expect(v2.vatPercent).toBe(21);
    expect(v2.items).toEqual(sent.frozen!.items);
    expect(v2.discounts).toEqual(sent.frozen!.discounts);
  });
});

import { describe, expect, it } from "vitest";
import { acceptProposal, createProposal, newVersion, sendProposal, setTexts, upsertItem, type Ctx, type Proposal, type ProposalItem, type Result } from "../model";
import { isProposalShape } from "../catalog";
import { clientView, itemRow, proposalReference, NOT_INFORMED } from "./proposal-view";

const AT = "2026-11-01T12:00:00.000Z";
let n = 0;
const ctx: Ctx = { now: () => AT, newId: () => `id-${++n}` };
const val = <T,>(r: Result<T>): T => { if (!r.ok) throw new Error(r.error); return r.value; };
const item = (o: Partial<ProposalItem>): ProposalItem => ({
  id: `it-${++n}`, name: "Ítem", scope: "", deliverables: "", term: "", modality: "one-off",
  costType: "own-fee", currency: "ARS", quantity: 1, unitPriceCents: 100_000, ...o,
});
const build = (items: ProposalItem[]): Proposal => {
  let p = createProposal({ companyId: "c1", reference: "Ref" }, ctx);
  for (const i of items) p = val(upsertItem(p, i, AT));
  return p;
};

describe("P4.3 textos y referencia", () => {
  it("referencia heredada en notes se sigue leyendo sin reescribir", () => {
    const legacy = { ...createProposal({ companyId: "c1", notes: "Vieja ref" }, ctx) };
    expect(proposalReference(legacy)).toEqual({ text: "Vieja ref", legacy: true });
    expect(legacy.notes).toBe("Vieja ref");
    expect(isProposalShape(legacy)).toBe(true);
  });
  it("setTexts solo en borrador", () => {
    const p = build([item({})]);
    const t = val(setTexts(p, { internalNotes: "x", clientNotes: "y" }, AT));
    expect(t.internalNotes).toBe("x");
    const sent = val(sendProposal(t, AT));
    expect(setTexts(sent, { clientNotes: "z" }, AT).ok).toBe(false);
  });
  it("forma con texto no string se rechaza", () => {
    expect(isProposalShape({ ...build([]), internalNotes: 3 })).toBe(false);
  });
});

describe("P4.3 nueva versión desde aceptada", () => {
  it("crea borrador v+1 vinculado, copia textos, validez vacía y original intacta", () => {
    const p = val(setTexts({ ...build([item({ modality: "recurring", months: 6 })]), validUntil: "2026-12-31" }, { context: "c", internalNotes: "i" }, AT));
    const acc = val(acceptProposal(val(sendProposal(p, AT)), AT));
    const snap = structuredClone(acc);
    const v2 = val(newVersion(acc, ctx));
    expect(v2.status).toBe("draft");
    expect(v2.version).toBe(2);
    expect(v2.previousVersionId).toBe(acc.id);
    expect(v2.validUntil).toBeUndefined();
    expect(v2.context).toBe("c");
    expect(v2.items[0]!.months).toBe(6);
    expect(acc).toEqual(snap);
  });
  it("no se crea versión desde un borrador", () => {
    expect(newVersion(build([]), ctx).ok).toBe(false);
  });
});

describe("P4.3 presentación", () => {
  it("precio y meses faltantes muestran No informado", () => {
    const r = itemRow(item({ modality: "recurring", unitPriceCents: undefined, months: undefined }));
    expect(r.amount).toBe(NOT_INFORMED);
    expect(r.months).toBe(NOT_INFORMED);
    expect(r.missing).toEqual(["precio", "meses"]);
  });
  it("vista del cliente no expone notas internas ni colaboradores y une honorarios", () => {
    let p = build([
      item({ costType: "own-fee", unitPriceCents: 100_000 }),
      item({ costType: "collaborator", collaboratorName: "Juan Secreto", unitPriceCents: 50_000 }),
      item({ costType: "ad-spend", unitPriceCents: 30_000, platform: "Meta" }),
    ]);
    p = val(setTexts(p, { internalNotes: "margen interno" }, AT));
    const v = clientView(p);
    const json = JSON.stringify(v);
    expect(json).not.toContain("margen interno");
    expect(json).not.toContain("Juan Secreto");
    const b = v.blocks[0]!;
    expect(b.fees).toBe(`ARS ${"1.500,00"}`.replace("1.500,00", b.fees!.slice(4)));
    expect(b.fees).not.toBe(NOT_INFORMED);
    expect(b.direct).toBeDefined();
    expect(v.lines.find((l) => l.direct)?.name).toBe("Ítem");
  });
  it("monedas distintas quedan en bloques separados", () => {
    const v = clientView(build([item({ currency: "ARS" }), item({ currency: "USD" })]));
    expect(v.blocks.map((b) => b.currency).sort()).toEqual(["ARS", "USD"]);
  });
  it("bloque con precio faltante queda incompleto sin total", () => {
    const v = clientView(build([item({ unitPriceCents: undefined })]));
    expect(v.blocks[0]!.incomplete).toBe(true);
    expect(v.blocks[0]!.total).toBeUndefined();
  });
});

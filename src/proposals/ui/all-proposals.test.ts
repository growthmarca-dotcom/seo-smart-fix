import { describe, expect, it } from "vitest";
import { createProposal, type Proposal, type ProposalItem } from "../model";
import { EMPTY_FILTERS, allProposalRows, filterProposalRows } from "./all-proposals";

let n = 0;
const at = (now: string) => ({ now: () => now, newId: () => `p${++n}` });
const companies = [{ id: "A", tradeName: "Viae Travel" }, { id: "B", tradeName: "Outdoor Patagonia" }];
const NOW = "2026-11-08T00:00:00.000Z";

const item = (over: Partial<ProposalItem>): ProposalItem => ({
  id: `i${++n}`, name: "Servicio", scope: "", deliverables: "", term: "", modality: "one-off",
  costType: "own-fee", currency: "ARS", quantity: 1, unitPriceCents: 100000, ...over,
} as ProposalItem);

const a = createProposal({ companyId: "A", notes: "Plan SEO" }, at("2026-11-01T10:00:00.000Z"));
const b: Proposal = {
  ...createProposal({ companyId: "B", validUntil: "2026-10-01" }, at("2026-11-03T10:00:00.000Z")),
  status: "sent", sentAt: "2026-09-01T00:00:00.000Z",
};
const orphan = createProposal({ companyId: "Z" }, at("2026-10-01T10:00:00.000Z"));

describe("listado global de propuestas", () => {
  const rows = allProposalRows([a, b, orphan], companies, NOW);

  it("ordena de más reciente a más antigua y asocia la empresa", () => {
    expect(rows.map((r) => r.id)).toEqual([b.id, a.id, orphan.id]);
    expect(rows[0]!.companyName).toBe("Outdoor Patagonia");
    expect(rows[1]!.companyName).toBe("Viae Travel");
    expect(rows[2]!.companyName).toBeUndefined();
  });

  it("muestra el estado efectivo: enviada con validez pasada es Vencida", () => {
    expect(rows[0]!.status).toBe("expired");
    expect(rows[0]!.statusLabel).toBe("Vencida");
    expect(rows[1]!.statusLabel).toBe("Borrador");
  });

  it("separa importes por moneda y modalidad", () => {
    const p = { ...a, items: [item({ currency: "ARS" }), item({ currency: "USD", modality: "recurring", months: 3 })] } as Proposal;
    const t = allProposalRows([p], companies, NOW)[0]!.totals;
    expect(t.map((x) => `${x.currency}:${x.modality}`).sort()).toEqual(["ARS:one-off", "USD:recurring"]);
    expect(t.find((x) => x.modality === "recurring")!.label).toContain("/ mes");
  });

  it("filtra por empresa, estado y búsqueda; limpiar devuelve todo", () => {
    expect(filterProposalRows(rows, { ...EMPTY_FILTERS, companyId: "A" }).map((r) => r.id)).toEqual([a.id]);
    expect(filterProposalRows(rows, { ...EMPTY_FILTERS, status: "expired" }).map((r) => r.id)).toEqual([b.id]);
    expect(filterProposalRows(rows, { ...EMPTY_FILTERS, query: "patagonia" }).map((r) => r.id)).toEqual([b.id]);
    expect(filterProposalRows(rows, { ...EMPTY_FILTERS, query: "plan seo" }).map((r) => r.id)).toEqual([a.id]);
    expect(filterProposalRows(rows, EMPTY_FILTERS)).toHaveLength(3);
  });

  it("no modifica las propuestas de entrada", () => {
    const before = JSON.stringify([a, b]);
    allProposalRows([a, b], companies, NOW);
    expect(JSON.stringify([a, b])).toBe(before);
  });
});

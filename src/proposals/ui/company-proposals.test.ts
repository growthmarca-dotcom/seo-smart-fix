import { describe, expect, it } from "vitest";
import { catalogToProposalItem, needsScopeReview, type CatalogItem } from "../catalog";
import { createProposal } from "../model";
import { formFromItem, formToInput } from "./catalog-form";
import { proposalRows } from "./company-proposals";

const legacy: CatalogItem = {
  id: "s1", name: "SEO local", scope: "Presentación + tareas combinadas", deliverables: "Informe", term: "3 semanas",
  modality: "one-off", costType: "own-fee", currency: "ARS", quantity: 1, archived: false, createdAt: "t", updatedAt: "t",
};
let n = 0;
const ctx = { now: () => "2026-11-01T10:00:00.000Z", newId: () => `p${++n}` };

describe("P4.2 descripción y alcance", () => {
  it("un registro anterior conserva todo su texto en alcance y queda para revisión", () => {
    expect(needsScopeReview(legacy)).toBe(true);
    const f = formFromItem(legacy);
    expect(f.scope).toBe("Presentación + tareas combinadas");
    expect(f.description).toBe("");
    expect(f.needsReview).toBe(true);
  });
  it("ambos campos pueden quedar vacíos y se guardan separados", () => {
    const r = formToInput({ ...formFromItem(legacy), description: "Comercial", scope: "" });
    expect(r.ok && r.value.description).toBe("Comercial");
    expect(r.ok && r.value.scope).toBe("");
  });
  it("la descripción se copia por valor a la propuesta", () => {
    const c = { ...legacy, description: "Comercial" };
    const it = catalogToProposalItem(c, "i1");
    c.description = "cambiada";
    expect(it.description).toBe("Comercial");
  });
});

describe("P4.2 propuestas en la ficha", () => {
  it("solo lista propuestas de la empresa seleccionada", () => {
    const a = createProposal({ companyId: "A", notes: "Ref A" }, ctx);
    const b = createProposal({ companyId: "B" }, ctx);
    const rows = proposalRows([a, b], "A", "2026-11-02T00:00:00.000Z");
    expect(rows.map((r) => r.id)).toEqual([a.id]);
    expect(rows[0]!.statusLabel).toBe("Borrador");
  });
  it("usa el estado efectivo: enviada vencida se muestra Vencida", () => {
    const p = { ...createProposal({ companyId: "A", validUntil: "2026-10-01" }, ctx), status: "sent" as const, sentAt: "2026-09-01T00:00:00.000Z" };
    expect(proposalRows([p], "A", "2026-11-02T00:00:00.000Z")[0]!.statusLabel).toBe("Vencida");
  });
});

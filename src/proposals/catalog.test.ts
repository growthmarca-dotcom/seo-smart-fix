import { describe, expect, it } from "vitest";
import { catalogToProposalItem, isProposalShape, p3IntegrityError, validateCatalogItem, type CatalogItem } from "./catalog";

const base: CatalogItem = {
  id: "s1", name: "Licencia CRM", scope: "", deliverables: "", term: "", modality: "recurring",
  costType: "external-license", billedBy: "client", currency: "USD", quantity: 1,
  archived: false, createdAt: "t", updatedAt: "t",
};

describe("catálogo P3", () => {
  it("copia por valor con vínculo al origen", () => {
    const item = catalogToProposalItem(base, "i1");
    expect(item).toMatchObject({ id: "i1", sourceItemId: "s1", billedBy: "client", currency: "USD" });
    expect(item.unitPriceCents).toBeUndefined();
  });
  it("licencia sin modalidad de facturación es inválida", () => {
    expect(validateCatalogItem({ ...base, billedBy: undefined })).toMatch(/factura MarCa/);
    expect(validateCatalogItem(base)).toBeUndefined();
  });
  it("detecta formas inválidas sin corregirlas", () => {
    expect(isProposalShape({ id: "p", companyId: "c", status: "sent", version: 1, items: [], discounts: [] })).toBe(true);
    expect(isProposalShape({ id: "p", companyId: "c", status: "expired", version: 1, items: [], discounts: [] })).toBe(false);
    expect(p3IntegrityError(undefined, undefined)).toBeUndefined();
    expect(p3IntegrityError([{}], [])).toBeTruthy();
  });
});

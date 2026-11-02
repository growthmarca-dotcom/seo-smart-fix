import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../catalog";
import { emptyForm, filterCatalog, formToInput, parsePriceToCents } from "./catalog-form";

const item = (o: Partial<CatalogItem>): CatalogItem => ({
  id: "x", name: "S", scope: "", deliverables: "", term: "", modality: "one-off", costType: "own-fee",
  currency: "ARS", quantity: 1, archived: false, createdAt: "t", updatedAt: "t", ...o,
});

describe("formulario de catálogo P4.1", () => {
  it("precio vacío queda No informado, nunca 0", () => {
    expect(parsePriceToCents("")).toBeUndefined();
    const r = formToInput({ ...emptyForm(), name: "SEO" });
    expect(r.ok && r.value.unitPriceCents).toBeUndefined();
  });
  it("interpreta precios es-AR en centavos", () => {
    expect(parsePriceToCents("150.000")).toBe(15_000_000);
    expect(parsePriceToCents("1500,5")).toBe(150_050);
    expect(parsePriceToCents("abc")).toBe("invalid");
  });
  it("duración sugerida es opcional y solo para recurrentes", () => {
    const sinMeses = formToInput({ ...emptyForm(), name: "R", modality: "recurring" });
    expect(sinMeses.ok && sinMeses.value.months).toBeUndefined();
    expect(formToInput({ ...emptyForm(), name: "R", modality: "recurring", months: "0" }).ok).toBe(false);
    const puntual = formToInput({ ...emptyForm(), name: "P", months: "6" });
    expect(puntual.ok && puntual.value.months).toBeUndefined();
  });
  it("publicidad siempre la paga el cliente", () => {
    const r = formToInput({ ...emptyForm(), name: "Ads", costType: "ad-spend", billedBy: "marca" });
    expect(r.ok && r.value.billedBy).toBe("client");
  });
  it("filtra por estado y área", () => {
    const list = [item({ id: "a", workAreaId: "seo" }), item({ id: "b", archived: true, workAreaId: "seo" }), item({ id: "c" })];
    expect(filterCatalog(list, "active", "").map((c) => c.id)).toEqual(["a", "c"]);
    expect(filterCatalog(list, "archived", "").map((c) => c.id)).toEqual(["b"]);
    expect(filterCatalog(list, "all", "seo").map((c) => c.id)).toEqual(["a", "b"]);
    expect(filterCatalog(list, "all", "none").map((c) => c.id)).toEqual(["c"]);
  });
});

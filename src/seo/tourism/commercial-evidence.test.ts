import { describe, expect, it } from "vitest";
import { emptyReview, isValidEvidenceUrl, reviewRows, updateControl, type CommercialReview } from "./commercial-review";

const base = () => emptyReview("a1", "2026-01-01T00:00:00Z");
const row = (r: CommercialReview, id: string) => reviewRows(r).find((x) => x.id === id)!;

describe("URL de evidencia en la evaluación comercial", () => {
  it("guarda y actualiza la URL sin tocar estado ni notas", () => {
    let r = updateControl(base(), "trust", { status: "needs-review", notes: "Sin reseñas" });
    r = updateControl(r, "trust", { evidenceUrl: "https://drive.google.com/a" });
    expect(row(r, "trust")).toMatchObject({ status: "needs-review", notes: "Sin reseñas", evidenceUrl: "https://drive.google.com/a" });
    r = updateControl(r, "trust", { evidenceUrl: "https://ejemplo.com/b" });
    expect(row(r, "trust").evidenceUrl).toBe("https://ejemplo.com/b");
    r = updateControl(r, "trust", { notes: "otra" });
    expect(row(r, "trust").evidenceUrl).toBe("https://ejemplo.com/b");
  });

  it("vaciar la URL la elimina", () => {
    let r = updateControl(base(), "trust", { evidenceUrl: "https://x.com" });
    r = updateControl(r, "trust", { evidenceUrl: "" });
    expect(r.controls["trust"]!.evidenceUrl).toBeUndefined();
    expect(row(r, "trust").evidenceUrl).toBe("");
  });

  it("no afecta a otros controles", () => {
    const r = updateControl(base(), "trust", { evidenceUrl: "https://x.com" });
    expect(row(r, "measurement").evidenceUrl).toBe("");
  });

  it("registros antiguos sin evidenceUrl siguen funcionando", () => {
    const legacy = { auditId: "a1", updatedAt: "x", controls: { trust: { status: "verified", notes: "ok" } } } as CommercialReview;
    expect(row(legacy, "trust")).toMatchObject({ status: "verified", notes: "ok", evidenceUrl: "" });
    const r = updateControl(legacy, "trust", { notes: "ok2" });
    expect(r.controls["trust"]!.evidenceUrl).toBeUndefined();
  });

  it("solo acepta http y https para mostrar en el anexo", () => {
    expect(isValidEvidenceUrl("https://ejemplo.com/captura.png")).toBe(true);
    expect(isValidEvidenceUrl("http://ejemplo.com")).toBe(true);
    expect(isValidEvidenceUrl("javascript:alert(1)")).toBe(false);
    expect(isValidEvidenceUrl("ftp://x.com")).toBe(false);
    expect(isValidEvidenceUrl("ejemplo.com")).toBe(false);
    expect(isValidEvidenceUrl("")).toBe(false);
    expect(isValidEvidenceUrl(undefined)).toBe(false);
  });
});

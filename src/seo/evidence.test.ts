import { describe, expect, it } from "vitest";

import {
  evidence,
  evidenceText,
  evidenceToStrings,
  isStructuredEvidence,
  normalizeEvidence,
  toStructuredEvidence,
  type EvidenceItem,
} from "./evidence";

describe("Evidence Engine — contrato común (Fase 1)", () => {
  it("acepta evidencia histórica en string y la reconoce como no estructurada", () => {
    const legacy: EvidenceItem = "https://ejemplo.com/a → HTTP 404";
    expect(isStructuredEvidence(legacy)).toBe(false);
    expect(evidenceText(legacy)).toBe("https://ejemplo.com/a → HTTP 404");
  });

  it("convierte strings históricas a nota estructurada sin perder texto", () => {
    expect(toStructuredEvidence("Sin title")).toEqual({ kind: "note", label: "Sin title" });
  });

  it("normaliza listas mixtas", () => {
    const items: EvidenceItem[] = ["nota libre", evidence.count("Imágenes sin ALT", 3)];
    const out = normalizeEvidence(items);
    expect(out).toHaveLength(2);
    expect(out[0]?.kind).toBe("note");
    expect(out[1]?.kind).toBe("count");
    expect(normalizeEvidence(undefined)).toEqual([]);
  });

  it("cubre los kinds mínimos requeridos", () => {
    expect(evidence.value("Title actual", "Camping").kind).toBe("value");
    expect(evidence.expected("Umbral", "300 palabras").kind).toBe("expected");
    expect(evidence.url("URL afectada", "https://x.com/a").kind).toBe("url");
    expect(evidence.count("Enlaces internos", 0).kind).toBe("count");
    expect(evidence.snippet("HTML", "<title></title>").kind).toBe("snippet");
    expect(evidence.note("Observación").kind).toBe("note");
  });

  it("proyecta evidencia estructurada a texto legible", () => {
    expect(evidenceText(evidence.value("Title actual", "Camping"))).toBe("Title actual: Camping");
    expect(evidenceText(evidence.count("Enlaces internos", 0))).toBe("Enlaces internos: 0");
    expect(evidenceText(evidence.expected("Umbral", "300", "120"))).toBe(
      "Umbral: 120 · esperado: 300",
    );
    expect(evidenceText(evidence.url("URL", "https://x.com/a"))).toBe(
      "URL: https://x.com/a · https://x.com/a",
    );
    expect(evidenceText(evidence.note("Solo etiqueta"))).toBe("Solo etiqueta");
  });

  it("mantiene compatibilidad con los modelos que hoy usan string[]", () => {
    const strings: string[] = evidenceToStrings(["legacy", evidence.count("Roto", 2)]);
    expect(strings).toEqual(["legacy", "Roto: 2"]);
    expect(evidenceToStrings()).toEqual([]);
  });
});

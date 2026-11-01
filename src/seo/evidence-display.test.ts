import { describe, it, expect } from "vitest";
import { evidence } from "./evidence";
import { toEvidenceDisplay, evidenceLine, pickEvidence } from "./evidence-display";

describe("evidence display", () => {
  it("value", () => expect(evidenceLine(evidence.value("Title actual", "Camping"))).toBe("Title actual: Camping"));
  it("expected", () => expect(evidenceLine(evidence.expected("Umbral", "300", "120"))).toBe("Umbral: 120 · esperado: 300"));
  it("count", () => expect(toEvidenceDisplay(evidence.count("Enlaces", 0)).count).toBe(0));
  it("snippet", () => expect(toEvidenceDisplay(evidence.snippet("HTML", "<h1>")).snippet).toBe("<h1>"));
  it("note", () => expect(evidenceLine(evidence.note("Solo etiqueta"))).toBe("Solo etiqueta"));
  it("url sin duplicar", () => {
    const line = evidenceLine(evidence.url("También usa este title", "https://x.com/a"));
    expect(line.split("https://x.com/a").length - 1).toBe(1);
    const d = toEvidenceDisplay(evidence.url("URL", "https://x.com/a"));
    expect(d.label).toBe("");
    expect(d.value).toBeUndefined();
  });
  it("url + value distintos", () => {
    const line = evidenceLine({ kind: "url", label: "Enlace roto", value: "HTTP 404", url: "https://x/r" });
    expect(line).toBe("Enlace roto: HTTP 404 · https://x/r");
  });
  it("históricas string", () => {
    expect(evidenceLine("https://x/a → HTTP 404")).toBe("https://x/a → HTTP 404");
    expect(toEvidenceDisplay("algo").legacy).toBe(true);
  });
  it("pickEvidence usa items y cae a strings", () => {
    const it1 = evidence.value("A", "b");
    expect(pickEvidence({ evidence: ["A: b"], evidenceItems: [it1] })).toEqual([it1]);
    expect(pickEvidence({ evidence: ["viejo"] })).toEqual(["viejo"]);
    expect(pickEvidence({})).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { buildDiagnostic, groupDiagnostics } from "./diagnostics";
import { evidenceToStrings, type StructuredEvidence } from "./evidence";
import { reportEvidence } from "./report-presentation";
import type { Audit, Finding } from "./types";

const full: StructuredEvidence = {
  kind: "value",
  label: "Title compartido",
  value: "Inicio",
  expected: "Título único",
  url: "https://demo.test/a",
  count: 3,
  snippet: "<title>Inicio</title>",
};

function finding(evidence: Finding["evidence"], id = "f1"): Finding {
  return {
    id, ruleId: "duplicate-title", ruleName: "Title duplicado", pageId: "p1",
    pageUrl: "https://demo.test/a", category: "onpage", kind: "onpage", severity: "warning",
    impact: 5, current: "Inicio", problem: "Title repetido", explanation: "x", evidence,
  } as Finding;
}

function audit(findings: Finding[]): Audit {
  return {
    id: "a1", name: "t", platform: "generic-web", rootUrl: "https://demo.test", isDemo: true,
    status: "done", createdAt: "2026-01-01", crawlLimit: 10, respectRobots: true,
    progress: { discovered: 1, crawled: 1, analyzed: 1 } as Audit["progress"],
    pages: [], findings,
  } as Audit;
}

describe("Diagnostic conserva evidencia estructurada", () => {
  it("mantiene todos los campos originales", () => {
    const f = finding([full]);
    const d = buildDiagnostic(audit([f]), f);
    expect(d.evidenceItems).toEqual([full]);
  });

  it("no comparte referencias con el Finding (no muta el original)", () => {
    const f = finding([full]);
    const d = buildDiagnostic(audit([f]), f);
    (d.evidenceItems![0] as StructuredEvidence).value = "otro";
    expect((f.evidence![0] as StructuredEvidence).value).toBe("Inicio");
  });

  it("strings históricos se conservan como strings", () => {
    const f = finding(["Enlace roto: /x", full]);
    const d = buildDiagnostic(audit([f]), f);
    expect(d.evidenceItems![0]).toBe("Enlace roto: /x");
    expect(d.evidence).toEqual(evidenceToStrings(f.evidence));
  });

  it("sin evidencia sigue undefined/vacía como antes", () => {
    const f = finding(undefined);
    const d = buildDiagnostic(audit([f]), f);
    expect(d.evidenceItems).toBeUndefined();
    expect(d.evidence).toEqual([]);
  });

  it("el informe sigue generando grupos con evidencia mixta", () => {
    const fs = [finding([full], "f1"), finding(["texto histórico"], "f2")];
    const a = audit(fs);
    expect(groupDiagnostics(a).length).toBeGreaterThan(0);
    for (const g of groupDiagnostics(a)) for (const d of g.items) expect(Array.isArray(reportEvidence(d, a))).toBe(true);
  });
});

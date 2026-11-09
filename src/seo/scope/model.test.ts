import { describe, expect, it } from "vitest";
import { createInitialScope, excludeUrl, includeUrl, isScopeConsistent, pagesInScope, scopeCounts, validateScope } from "./model";
import type { AuditScope } from "./types";

const T0 = "2026-11-09T00:00:00.000Z";
const T1 = "2026-11-09T01:00:00.000Z";
const pages = [{ url: "https://a.com/" }, { url: "https://a.com/x" }, { url: "https://a.com/y" }];

describe("Etapa 2 — modelo de alcance", () => {
  it("auditoría nueva: todas las evaluables incluidas", () => {
    const s = createInitialScope(pages, T0);
    expect(s.includedUrls).toEqual(pages.map((p) => p.url));
    expect(s.excludedUrls).toEqual([]);
    expect(s.selectionMode).toBe("all");
    expect(isScopeConsistent(s)).toBe(true);
  });

  it("exclusión manual registra motivo, origen, fecha y nota sin perder la URL evaluable", () => {
    const s0 = createInitialScope(pages, T0);
    const s1 = excludeUrl(s0, "https://a.com/x", "confirmed-residual", { note: "borrador", at: T1 });
    expect(s1.includedUrls).toEqual(["https://a.com/", "https://a.com/y"]);
    expect(s1.excludedUrls).toEqual([
      { url: "https://a.com/x", reason: "confirmed-residual", origin: "manual", excludedAt: T1, note: "borrador" },
    ]);
    expect(s1.evaluableUrls).toEqual(pages.map((p) => p.url));
    expect(s1.updatedAt).toBe(T1);
    expect(s1.createdAt).toBe(T0);
  });

  it("es inmutable: no altera el alcance anterior", () => {
    const s0 = createInitialScope(pages, T0);
    const snap = JSON.stringify(s0);
    excludeUrl(s0, "https://a.com/x", "manual", { at: T1 });
    expect(JSON.stringify(s0)).toBe(snap);
  });

  it("rechaza URLs fuera del conjunto evaluable, doble exclusión y motivo inválido", () => {
    const s0 = createInitialScope(pages, T0);
    expect(() => excludeUrl(s0, "https://a.com/zzz", "manual")).toThrow();
    const s1 = excludeUrl(s0, "https://a.com/x", "manual");
    expect(() => excludeUrl(s1, "https://a.com/x", "manual")).toThrow();
    expect(() => excludeUrl(s0, "https://a.com/y", "possible-duplicate" as never)).toThrow();
    expect(() => includeUrl(s0, "https://a.com/y")).toThrow();
  });

  it("modificación posterior: reincluir conserva el orden original", () => {
    const s1 = excludeUrl(createInitialScope(pages, T0), "https://a.com/", "manual", { at: T1 });
    const s2 = includeUrl(s1, "https://a.com/", T1);
    expect(s2.includedUrls).toEqual(pages.map((p) => p.url));
    expect(s2.excludedUrls).toEqual([]);
    expect(isScopeConsistent(s2)).toBe(true);
  });

  it("rechaza estructuras inconsistentes", () => {
    const base = createInitialScope(pages, T0);
    const overlap: AuditScope = {
      ...base,
      excludedUrls: [{ url: "https://a.com/x", reason: "manual", origin: "manual", excludedAt: T0 }],
    };
    expect(validateScope(overlap).join()).toMatch(/a la vez/);
    expect(validateScope({ ...base, includedUrls: [...base.includedUrls, "https://a.com/x"] }).join()).toMatch(/duplicadas/);
    expect(validateScope({ ...base, includedUrls: ["https://otra.com/"] }).length).toBeGreaterThan(0);
    expect(validateScope({ ...base, includedUrls: ["https://a.com/"] }).join()).toMatch(/sin clasificar/);
    expect(validateScope(null).length).toBe(1);
    expect(() => createInitialScope([{ url: "u" }, { url: "u" }])).toThrow();
  });

  it("auditoría antigua sin scope: páginas intactas y conteos sin inferir alcance", () => {
    const audit = { pages, coverage: { discovered: 23, excluded: [{ url: "z", reason: "limit-reached" }] } } as never;
    const before = JSON.stringify(audit);
    expect(pagesInScope(pages)).toEqual(pages);
    const c = scopeCounts(audit);
    expect(c).toMatchObject({ crawlerDiscovered: 23, crawlerTechnicalExclusions: 1, evaluable: 3, hasRecordedScope: false });
    expect(c.included).toBeUndefined();
    expect(JSON.stringify(audit)).toBe(before);
  });

  it("filtra páginas por alcance y mantiene separados crawler y evaluables", () => {
    const s = excludeUrl(createInitialScope(pages, T0), "https://a.com/y", "out-of-commercial-scope");
    expect(pagesInScope(pages, s).map((p) => p.url)).toEqual(["https://a.com/", "https://a.com/x"]);
    const c = scopeCounts({ pages, scope: s, coverage: { discovered: 23, excluded: [] } } as never);
    expect(c).toMatchObject({ crawlerDiscovered: 23, evaluable: 3, included: 2, editorialExclusions: 1, crawlerTechnicalExclusions: 0 });
  });
});

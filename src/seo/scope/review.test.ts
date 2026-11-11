import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "../types";
import { classifyUrls } from "./classifier";
import { createInitialScope, validateScope } from "./model";
import { suggestForPreset, SCOPE_PRESETS } from "./presets";
import { excludeMany, filterUrls, includeMany, sameScope } from "./review";

const page = (path: string, over: Partial<PageSnapshot> = {}): PageSnapshot => ({
  id: path, url: `https://e.com${path}`, path, pageType: "other", statusCode: 200, title: `T ${path}`,
  h1: ["H"], h2: [], h3: [], wordCount: 300, images: [], internalLinks: [], externalLinks: 0,
  schemaTypes: [], depth: 1, hasViewport: true, ...over,
});
const pages = [page("/", { depth: 0, internalLinks: [{ href: "https://e.com/a", anchor: "a" }] }), page("/a"), page("/prueba"), page("/servicio-2")];
const AT = "2026-01-01T00:00:00.000Z";

describe("presets (Etapa 3)", () => {
  it("ningún preset excluye URLs: el alcance queda intacto", () => {
    const classes = [...classifyUrls(pages, "https://e.com/").values()];
    const scope = createInitialScope(pages, AT);
    for (const p of SCOPE_PRESETS) {
      const s = suggestForPreset(p.id, classes);
      expect(s.every((x) => x.suggestedAction === "review_for_exclusion" || x.suggestedAction === "priority_include")).toBe(true);
      expect(s.some((x) => "reason" in x)).toBe(false);
    }
    expect(scope.includedUrls).toHaveLength(4);
    expect(scope.excludedUrls).toHaveLength(0);
  });
  it("la portada nunca se sugiere para exclusión", () => {
    const classes = [...classifyUrls(pages, "https://e.com/").values()];
    const s = suggestForPreset("ecommerce", classes).find((x) => x.url === "https://e.com/");
    expect(s?.suggestedAction).toBe("priority_include");
  });
});

describe("review (Etapa 3)", () => {
  const scope = createInitialScope(pages, AT);
  it("exclusión sin motivo elegido se rechaza", () => {
    expect(() => excludeMany(scope, ["https://e.com/a"], "", { origin: "manual" })).toThrow();
    expect(() => excludeMany(scope, ["https://e.com/a"], undefined, { origin: "preset" })).toThrow();
  });
  it("exclusión múltiple registra origen y motivo humanos, sin mutar", () => {
    const n = excludeMany(scope, ["https://e.com/a", "https://e.com/prueba"], "confirmed-residual", { origin: "preset", at: AT });
    expect(n.excludedUrls.map((r) => [r.reason, r.origin])).toEqual([["confirmed-residual", "preset"], ["confirmed-residual", "preset"]]);
    expect(scope.excludedUrls).toHaveLength(0);
    expect(validateScope(n)).toEqual([]);
    const back = includeMany(n, ["https://e.com/a", "https://e.com/prueba"], AT);
    expect(back.includedUrls).toEqual(scope.includedUrls);
    expect(sameScope(back, scope)).toBe(true);
  });
  it("filtra por estado", () => {
    const n = excludeMany(scope, ["https://e.com/a"], "manual", { origin: "manual", at: AT });
    const classes = new Map([...classifyUrls(pages, "https://e.com/").values()].map((c) => [c.url, c]));
    expect(filterUrls(n, classes, { status: "excluded", signal: "any", query: "" })).toEqual(["https://e.com/a"]);
    expect(filterUrls(n, classes, { status: "included", signal: "any", query: "" })).toHaveLength(3);
  });
});

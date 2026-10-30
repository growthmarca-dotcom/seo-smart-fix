import { describe, expect, it } from "vitest";
import type { Audit, PageSnapshot } from "@/seo/types";
import type { GscConnection } from "@/seo/gsc/types";
import { COMMERCIAL_CONTROLS, emptyReview, isValidEvidenceUrl, updateControl } from "./commercial-review";
import { appendSuggestionToNotes, generateCommercialSuggestions } from "./commercial-suggestions";

const page = (o: Partial<PageSnapshot>): PageSnapshot => ({
  id: o.url ?? "p", url: "https://a.com/", path: "/", pageType: "other", statusCode: 200,
  h1: [], h2: [], h3: [], wordCount: 0, images: [], internalLinks: [], externalLinks: 0,
  schemaTypes: [], depth: 1, hasViewport: false, ...o,
});
const audit = (id: string, pages: PageSnapshot[]): Audit => ({
  id, name: id, platform: "generic-web", rootUrl: "https://a.com", isDemo: false, status: "done",
  createdAt: "2026-01-01", crawlLimit: 50, respectRobots: true,
  progress: { discovered: pages.length, analyzed: pages.length, issues: 0 }, pages, findings: [],
  score: { total: 82, categories: [], drivers: [], pagesAnalyzed: pages.length, method: "x" },
});
const full = () => audit("a1", [
  page({ url: "https://a.com/", pageType: "home", depth: 0, title: "Dúplex del Centro", h1: ["Dúplex en San Martín"], h2: ["Tarifas y check-in"], wordCount: 300, hasViewport: true,
    schemaTypes: ["LodgingBusiness"], localSignals: { phone: "2972 123", address: "Calle 1" },
    images: [{ src: "a.jpg" }], internalLinks: [{ href: "/reservar", anchor: "Reservar" }] }),
  page({ url: "https://a.com/reservar", path: "/reservar", wordCount: 10 }),
  page({ url: "https://a.com/contacto", path: "/contacto", pageType: "contact" }),
]);

describe("precarga de observaciones comerciales", () => {
  it("genera sugerencias para los 10 controles", () => {
    const r = generateCommercialSuggestions(full());
    expect(Object.keys(r)).toEqual(COMMERCIAL_CONTROLS.map((c) => c.id));
  });
  it("sin datos no inventa: todo 'none' con nota vacía y sin URL", () => {
    const r = generateCommercialSuggestions(audit("e", []));
    for (const s of Object.values(r)) {
      expect(s.evidenceLevel).toBe("none");
      expect(s.suggestedNote).toBe("");
      expect(s.evidenceUrl).toBeUndefined();
      expect(s.limitation.length).toBeGreaterThan(0);
    }
  });
  it("distingue completa, parcial e inexistente", () => {
    const r = generateCommercialSuggestions(full());
    expect(r["property-info"]!.evidenceLevel).toBe("full");
    expect(r["contact-whatsapp"]!.evidenceLevel).toBe("partial");
    expect(r["ota-consistency"]!.evidenceLevel).toBe("none");
    expect(r["measurement"]!.evidenceLevel).toBe("none");
  });
  it("no afirma ausencia de WhatsApp, motor ni analítica", () => {
    const r = generateCommercialSuggestions(audit("e", [page({ pageType: "home", depth: 0, title: "X" })]));
    const all = Object.values(r).map((s) => s.suggestedNote + s.limitation).join(" ");
    expect(all).not.toMatch(/no tiene|no existe WhatsApp|falta (GA4|analítica)/i);
    expect(r["contact-whatsapp"]!.limitation).toMatch(/no significa que no existan/);
  });
  it("URLs sugeridas solo de páginas reales de esta auditoría", () => {
    const a = full();
    const urls = new Set(a.pages.map((p) => p.url));
    for (const s of Object.values(generateCommercialSuggestions(a))) if (s.evidenceUrl) expect(urls.has(s.evidenceUrl)).toBe(true);
    expect(generateCommercialSuggestions(a)["booking-engine"]!.evidenceUrl).toBe("https://a.com/reservar");
  });
  it("no propone como evidenceUrl una URL sin http:// ni https://", () => {
    const bad = "ftp://a.com/reservar";
    const a = audit("a1", [
      page({ url: "https://a.com/", pageType: "home", depth: 0, title: "X", internalLinks: [{ href: "/reservar", anchor: "Reservar" }] }),
      page({ url: bad, path: "/reservar" }),
    ]);
    for (const s of Object.values(generateCommercialSuggestions(a))) {
      expect(s.evidenceUrl).not.toBe(bad);
      if (s.evidenceUrl) expect(isValidEvidenceUrl(s.evidenceUrl)).toBe(true);
    }
  });
  it("aislamiento: GSC de otra auditoría se ignora; la propia se usa", () => {
    const g = (auditId: string): GscConnection => ({ auditId, property: { siteUrl: "sc-domain:a.com", type: "domain" }, source: "live", status: "connected", connectedAt: "x", rows: [] });
    expect(generateCommercialSuggestions(full(), g("otra"))["measurement"]!.evidenceLevel).toBe("none");
    const own = generateCommercialSuggestions(full(), g("a1"))["measurement"]!;
    expect(own.evidenceLevel).toBe("partial");
    expect(Object.values(generateCommercialSuggestions(full())).every((s) => s.auditId === "a1")).toBe(true);
  });
  it("no modifica puntuación ni hallazgos de la auditoría", () => {
    const a = full();
    const before = JSON.stringify(a);
    generateCommercialSuggestions(a);
    expect(JSON.stringify(a)).toBe(before);
  });
  it("conserva notas, estado y URL existentes al copiar; compatible con evaluaciones antiguas", () => {
    let rv = emptyReview("a1", "2026-01-01T00:00:00Z");
    rv = updateControl(rv, "trust", { status: "verified", notes: "Nota previa", evidenceUrl: "https://drive/x" });
    const merged = appendSuggestionToNotes(rv.controls["trust"]!.notes, "Sugerida");
    rv = updateControl(rv, "trust", { notes: merged });
    expect(rv.controls["trust"]!.notes).toBe("Nota previa\n\nSugerida");
    expect(rv.controls["trust"]!.status).toBe("verified");
    expect(rv.controls["trust"]!.evidenceUrl).toBe("https://drive/x");
    expect(appendSuggestionToNotes(merged, "Sugerida")).toBe(merged);
    expect(appendSuggestionToNotes("", "Sugerida")).toBe("Sugerida");
  });
});

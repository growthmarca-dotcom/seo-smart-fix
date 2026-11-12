/**
 * Etapa 3 — Persistencia aislada del alcance editorial.
 * Usa almacenamiento simulado en memoria: nunca toca el localStorage real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialScope } from "./model";
import { excludeMany } from "./review";
import { suggestForPreset } from "./presets";
import { classifyUrls } from "./classifier";

const STATE = "seo-fixer:state:v1";

class FakeStorage {
  data = new Map<string, string>();
  writes = 0;
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.writes++; this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

const pg = (path: string) => ({
  id: path, url: `https://h.test${path}`, path, pageType: "other", statusCode: 200, title: `T ${path}`,
  h1: ["H"], h2: [], h3: [], wordCount: 300, images: [], internalLinks: [], externalLinks: 0,
  schemaTypes: [], depth: path === "/" ? 0 : 1, hasViewport: true,
});
const seed = () => ({
  audits: [{
    id: "hist1", name: "Histórica", platform: "generic-web", rootUrl: "https://h.test/", isDemo: false,
    status: "done", createdAt: "2026-10-27T10:00:00Z", crawlLimit: 100, respectRobots: true,
    pages: [pg("/"), pg("/a"), pg("/prueba")],
    findings: [{ id: "f1", ruleId: "r1", pageId: "/a", severity: "high" }],
    score: { total: 93 },
    coverage: { discovered: 5, excluded: [{ url: "https://h.test/x.pdf", reason: "non-html" }] },
  }],
  changes: [], history: [], companies: [], roadmaps: [], settings: { brandName: "MarCa" },
});

let storage: FakeStorage;
async function load(raw: string) {
  storage = new FakeStorage();
  storage.data.set(STATE, raw);
  vi.stubGlobal("window", { localStorage: storage });
  vi.resetModules();
  return import("@/store/app-store");
}
async function reload() {
  vi.resetModules();
  const m = await import("@/store/app-store");
  m.hydrate();
  return m;
}
const persisted = () => JSON.parse(storage.getItem(STATE)!);
const audit = () => persisted().audits.find((a: { id: string }) => a.id === "hist1");
const URLS: string[] = ["https://h.test/", "https://h.test/a", "https://h.test/prueba"];

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("Etapa 3 — persistencia del alcance editorial (aislada)", () => {
  it("1. auditoría histórica sin scope: al hidratar sigue sin scope y no se escribe", async () => {
    const raw = JSON.stringify(seed());
    const m = await load(raw);
    m.hydrate();
    expect(storage.getItem(STATE)).toBe(raw);
    expect(JSON.parse(storage.getItem(STATE)!).audits[0].scope).toBeUndefined();
  });

  it("2 y 8. borrador, preset y cancelación no modifican store ni almacenamiento", async () => {
    const raw = JSON.stringify(seed());
    const m = await load(raw);
    m.hydrate();
    const writesBefore = storage.writes;
    const pages = seed().audits[0]!.pages as never[];
    const draft = createInitialScope(pages);
    suggestForPreset("integral" as never, [...classifyUrls(pages, "https://h.test/").values()]);
    const edited = excludeMany(draft, ["https://h.test/prueba"], "confirmed-residual", { origin: "preset" });
    expect(edited.excludedUrls).toHaveLength(1);
    // Salir/cancelar = no invocar setAuditScope.
    expect(storage.writes).toBe(writesBefore);
    expect(storage.getItem(STATE)).toBe(raw);
    const again = await reload();
    expect(again).toBeTruthy();
    expect(audit().scope).toBeUndefined();
  });

  it("3–6. guardar persiste el alcance completo, se recupera idéntico y no altera páginas/hallazgos/score", async () => {
    const m = await load(JSON.stringify(seed()));
    m.hydrate();
    const before = audit();
    const scope = excludeMany(createInitialScope(before.pages, "2026-11-10T00:00:00.000Z"),
      ["https://h.test/prueba"], "confirmed-residual", { origin: "manual", note: "borrador", at: "2026-11-10T01:00:00.000Z" });
    expect(m.actions.setAuditScope("hist1", scope)).toBeUndefined();

    const saved = audit();
    expect(saved.scope).toEqual(scope);
    expect(saved.scope.evaluableUrls).toEqual(URLS);
    expect(saved.scope.includedUrls).toEqual(URLS.slice(0, 2));
    expect(saved.scope.excludedUrls[0]).toMatchObject({ url: URLS[2], reason: "confirmed-residual", origin: "manual", note: "borrador" });
    expect(saved.pages).toEqual(before.pages);
    expect(saved.findings).toEqual(before.findings);
    expect(saved.score).toEqual(before.score);
    expect(saved.coverage).toEqual(before.coverage);

    const rawAfterSave = storage.getItem(STATE);
    await reload();
    expect(storage.getItem(STATE)).toBe(rawAfterSave);
    expect(audit().scope).toEqual(scope);
    expect(audit().score).toEqual(before.score);
  });

  it("7. alcance inconsistente se rechaza sin escrituras ni historial", async () => {
    const raw = JSON.stringify(seed());
    const m = await load(raw);
    m.hydrate();
    const writes = storage.writes;
    const foreign = createInitialScope([{ url: "https://otra.test/" }]);
    expect(m.actions.setAuditScope("hist1", foreign)).toMatch(/no corresponde/);
    const bad = { ...createInitialScope(seed().audits[0]!.pages), includedUrls: [URLS[0]!] };
    expect(m.actions.setAuditScope("hist1", bad)).toBeTruthy();
    expect(m.actions.setAuditScope("inexistente", createInitialScope(seed().audits[0]!.pages))).toMatch(/no existe/);
    expect(storage.writes).toBe(writes);
    expect(storage.getItem(STATE)).toBe(raw);
    expect(persisted().history).toEqual([]);
  });
});

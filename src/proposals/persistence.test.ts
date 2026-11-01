import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STATE = "seo-fixer:state:v1";
const B1 = "seo-fixer:state:backup:pre-b1";
const P3 = "seo-fixer:state:backup:pre-p3";

class FakeStorage {
  data = new Map<string, string>();
  failOn = new Set<string>();
  writes: string[] = [];
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.failOn.has(k)) throw new Error("QuotaExceededError");
    this.writes.push(k);
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const seed = (extra: Record<string, unknown> = {}) => ({
  audits: [{ id: "au1", name: "Viae", rootUrl: "https://viae.test", isDemo: false, createdAt: "2026-10-27T10:00:00Z", pages: [], findings: [], score: { total: 93 } }],
  changes: [],
  history: [],
  commercialReviews: [{ auditId: "au1", updatedAt: "2026-10-27T11:00:00Z", controls: { "property-info": { status: "verified", notes: "Clara" } } }],
  companies: [{ id: "c1", tradeName: "Viae", industry: "tourism-lodging", status: "active", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", auditIds: ["au1"] }],
  roadmaps: [{ companyId: "c1", phases: [], createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" }],
  settings: { brandName: "MarCa" },
  ...extra,
});

const svc = {
  name: "Gestión de campañas Meta",
  scope: "Configuración y optimización",
  deliverables: "Informe mensual",
  term: "Mensual",
  modality: "recurring" as const,
  costType: "own-fee" as const,
  currency: "ARS",
  quantity: 1,
  unitPriceCents: 10000000,
};

let storage: FakeStorage;

async function load(raw: string | null = JSON.stringify(seed())) {
  storage = new FakeStorage();
  if (raw !== null) storage.data.set(STATE, raw);
  vi.stubGlobal("window", { localStorage: storage });
  vi.resetModules();
  const m = await import("@/store/app-store");
  m.hydrate();
  storage.writes = [];
  return m;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

const parsed = () => JSON.parse(storage.getItem(STATE)!);
const p3Raw = () => JSON.parse(storage.getItem(P3)!).raw as string | null;
const PRESERVED = ["audits", "companies", "roadmaps", "commercialReviews", "companyAssessments", "settings", "changes", "history"] as const;

describe("P3 — migración sin escrituras", () => {
  it("un estado anterior sin colecciones P3 abre con listas vacías y sin escribir v1 ni pre-P3", async () => {
    const original = JSON.stringify(seed());
    const m = await load(original);
    expect(m.getAppState().proposals).toEqual([]);
    expect(m.getAppState().serviceCatalog).toEqual([]);
    expect(storage.getItem(STATE)).toBe(original);
    expect(storage.getItem(P3)).toBeNull();
    expect(storage.writes).toEqual([]);
  });

  it("datos P3 malformados se conservan y bloquean escrituras P3 y el reinicio", async () => {
    const original = JSON.stringify(seed({ proposals: [{ id: "x" }] }));
    const m = await load(original);
    expect(m.getP3IntegrityError()).toBeTruthy();
    const r = m.catalogActions.upsert(svc);
    expect(r.ok).toBe(false);
    expect(m.actions.resetDemo().ok).toBe(false);
    expect(storage.getItem(STATE)).toBe(original);
    expect(m.getAppState().proposals).toEqual([{ id: "x" }]);
  });
});

describe("P3 — respaldo pre-P3", () => {
  it("se crea antes de la primera escritura P3, byte a byte igual al estado previo", async () => {
    const original = JSON.stringify(seed());
    const m = await load(original);
    const b1Before = storage.getItem(B1);
    expect(m.catalogActions.upsert(svc).ok).toBe(true);
    expect(p3Raw()).toBe(original);
    expect(m.getP3BackupStatus()).toMatchObject({ ok: true, state: "created" });
    expect(storage.getItem(B1)).toBe(b1Before);
    expect(m.readPreP3Backup(storage)).toBe(original);
  });

  it("no se sobrescribe en escrituras posteriores", async () => {
    const original = JSON.stringify(seed());
    const m = await load(original);
    m.catalogActions.upsert(svc);
    const backup = storage.getItem(P3);
    m.catalogActions.upsert({ ...svc, name: "Otro" });
    m.proposalActions.create({ companyId: "c1" });
    expect(storage.getItem(P3)).toBe(backup);
    expect(p3Raw()).toBe(original);
  });

  it("respaldo preexistente desactualizado sin escrituras P3 se reemplaza por el estado actual", async () => {
    const original = JSON.stringify(seed());
    storage = new FakeStorage();
    const m = await load(original);
    storage.data.set(P3, JSON.stringify({ kind: "seo-fixer-pre-p3-backup", createdAt: "2020-01-01", raw: JSON.stringify(seed({ audits: [] })) }));
    expect(m.catalogActions.upsert(svc).ok).toBe(true);
    expect(m.getP3BackupStatus()?.state).toBe("replaced-stale");
    expect(p3Raw()).toBe(original);
  });

  it("si faltan el respaldo y ya hay datos P3, bloquea", async () => {
    const m = await load();
    m.catalogActions.upsert(svc);
    storage.data.delete(P3);
    const before = storage.getItem(STATE);
    const r = m.catalogActions.upsert({ ...svc, name: "Nuevo" });
    expect(r.ok).toBe(false);
    expect(storage.getItem(STATE)).toBe(before);
  });

  it("fallo al escribir el respaldo: no se modifica v1 ni la memoria", async () => {
    const original = JSON.stringify(seed());
    const m = await load(original);
    storage.failOn.add(P3);
    const r = m.catalogActions.upsert(svc);
    expect(r.ok).toBe(false);
    expect(storage.getItem(STATE)).toBe(original);
    expect(m.getAppState().serviceCatalog).toEqual([]);
  });

  it("fallo al escribir v1: la memoria no cambia", async () => {
    const m = await load();
    m.catalogActions.upsert(svc); // crea respaldo
    storage.failOn.add(STATE);
    const r = m.proposalActions.create({ companyId: "c1" });
    expect(r.ok).toBe(false);
    expect(m.getAppState().proposals).toEqual([]);
  });
});

describe("P3 — validación de restauración", () => {
  it("rechaza JSON inválido y propuestas malformadas sin alterar el estado", async () => {
    const m = await load();
    m.catalogActions.upsert(svc);
    const before = storage.getItem(STATE);
    expect(m.restoreStateBackup("{no", storage).ok).toBe(false);
    expect(m.restoreStateBackup(JSON.stringify(seed({ proposals: [{ id: 1 }] })), storage).ok).toBe(false);
    expect(m.restoreStateBackup(JSON.stringify(seed({ serviceCatalog: "x" })), storage).ok).toBe(false);
    expect(storage.getItem(STATE)).toBe(before);
  });

  it("acepta estados anteriores a P3 y el propio respaldo pre-P3", async () => {
    const original = JSON.stringify(seed());
    const m = await load(original);
    m.catalogActions.upsert(svc);
    expect(m.validatePersistedState(original).ok).toBe(true);
    expect(m.restoreStateBackup(m.readPreP3Backup(storage)!, storage).ok).toBe(true);
    expect(storage.getItem(STATE)).toBe(original);
  });
});

describe("P3 — inmutabilidad y reglas", () => {
  it("crear, enviar y versionar propuestas no altera el resto de los datos", async () => {
    const original = seed();
    const m = await load(JSON.stringify(original));
    const c = m.catalogActions.upsert(svc);
    const p = m.proposalActions.create({ companyId: "c1" });
    if (!c.ok || !p.ok) throw new Error("setup");
    expect(m.proposalActions.addFromCatalog(p.id, c.id).ok).toBe(true);
    expect(m.proposalActions.send(p.id).ok).toBe(true);
    expect(m.proposalActions.newVersion(p.id).ok).toBe(true);
    const after = parsed();
    for (const k of PRESERVED) expect(after[k] ?? null).toEqual((original as Record<string, unknown>)[k] ?? (k === "companyAssessments" ? [] : null));
    expect(after.proposals).toHaveLength(2);
  });

  it("propuesta enviada no se edita; vencida no se acepta; nueva versión deja intacta la original", async () => {
    const m = await load();
    const c = m.catalogActions.upsert(svc);
    const p = m.proposalActions.create({ companyId: "c1", validUntil: "2000-01-01" });
    if (!c.ok || !p.ok) throw new Error("setup");
    m.proposalActions.addFromCatalog(p.id, c.id);
    m.proposalActions.send(p.id);
    const sent = JSON.stringify(m.getAppState().proposals[0]);
    expect(m.proposalActions.setVatPercent(p.id, 21).ok).toBe(false);
    expect(m.proposalActions.accept(p.id).ok).toBe(false);
    const v = m.proposalActions.newVersion(p.id);
    expect(v.ok).toBe(true);
    expect(JSON.stringify(m.getAppState().proposals.find((x) => x.id === p.id))).toBe(sent);
  });

  it("cambiar el catálogo no altera propuestas existentes", async () => {
    const m = await load();
    const c = m.catalogActions.upsert(svc);
    const p = m.proposalActions.create({ companyId: "c1" });
    if (!c.ok || !p.ok) throw new Error("setup");
    m.proposalActions.addFromCatalog(p.id, c.id);
    m.catalogActions.upsert({ ...svc, id: c.id, unitPriceCents: 1 });
    expect(m.getAppState().proposals[0]!.items[0]!.unitPriceCents).toBe(10000000);
  });

  it("empresa inexistente es rechazada", async () => {
    const m = await load();
    expect(m.proposalActions.create({ companyId: "zz" }).ok).toBe(false);
  });
});

describe("resetDemo", () => {
  it("se bloquea si hay propuestas y no borra nada", async () => {
    const m = await load();
    m.proposalActions.create({ companyId: "c1" });
    const before = storage.getItem(STATE);
    const r = m.actions.resetDemo();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/No se puede reiniciar/);
    expect(storage.getItem(STATE)).toBe(before);
  });

  it("se bloquea si hay evaluaciones integrales", async () => {
    const m = await load();
    expect(m.assessmentActions.create("c1").ok).toBe(true);
    const before = storage.getItem(STATE);
    expect(m.actions.resetDemo().ok).toBe(false);
    expect(storage.getItem(STATE)).toBe(before);
  });

  it("sin propuestas ni evaluaciones mantiene el comportamiento previo", async () => {
    const m = await load();
    expect(m.actions.resetDemo().ok).toBe(true);
  });
});

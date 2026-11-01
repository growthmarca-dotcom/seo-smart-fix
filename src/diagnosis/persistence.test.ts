import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STATE = "seo-fixer:state:v1";
const BACKUP = "seo-fixer:state:backup:pre-b1";

class FakeStorage {
  data = new Map<string, string>();
  failOn = new Set<string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.failOn.has(k)) throw new Error("QuotaExceededError");
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const seed = () => ({
  audits: [{ id: "au1", name: "Viae", rootUrl: "https://viae.test", isDemo: false, createdAt: "2026-10-27T10:00:00Z", pages: [], findings: [], score: { total: 93 } }],
  changes: [],
  history: [],
  commercialReviews: [
    {
      auditId: "au1",
      updatedAt: "2026-10-27T11:00:00Z",
      controls: {
        "property-info": { status: "verified", notes: "Clara" },
        "mobile-path": { status: "needs-review", notes: "Botón oculto" },
      },
    },
  ],
  companies: [
    { id: "c1", tradeName: "Viae", industry: "tourism-lodging", status: "active", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", auditIds: ["au1"] },
  ],
  roadmaps: [{ companyId: "c1", phases: [], createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" }],
  settings: { brandName: "MarCa" },
});

let storage: FakeStorage;

async function load(raw: string | null = JSON.stringify(seed())) {
  storage = new FakeStorage();
  if (raw !== null) storage.data.set(STATE, raw);
  vi.stubGlobal("window", { localStorage: storage });
  vi.resetModules();
  const mod = await import("@/store/app-store");
  return mod;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

const parsed = () => JSON.parse(storage.getItem(STATE)!);
const backupRaw = () => JSON.parse(storage.getItem(BACKUP)!).raw as string | null;

describe("B.1 — respaldo pre-B1", () => {
  it("se crea al hidratar con la cadena exacta del estado y se verifica", async () => {
    const original = JSON.stringify(seed());
    const m = await load(original);
    m.hydrate();
    expect(m.getBackupStatus()).toMatchObject({ ok: true, state: "created" });
    expect(backupRaw()).toBe(original);
    expect(storage.getItem(STATE)).toBe(original); // hidratar no escribe el estado
  });

  it("no se sobrescribe en guardados posteriores de B.1", async () => {
    const original = JSON.stringify(seed());
    const m = await load(original);
    m.hydrate();
    const r = m.assessmentActions.create("c1");
    expect(r.ok).toBe(true);
    const id = (r as { id: string }).id;
    m.assessmentActions.updateControl(id, "web-mobile", { status: "meets" });
    m.assessmentActions.updateMeta(id, { title: "Segunda pasada" });
    m.assessmentActions.create("c1");
    expect(backupRaw()).toBe(original);
    // Una nueva hidratación tampoco lo toca (ya hay escrituras B.1).
    const again = await (async () => {
      vi.resetModules();
      return import("@/store/app-store");
    })();
    again.hydrate();
    expect(again.getBackupStatus()).toMatchObject({ ok: true, state: "kept" });
    expect(backupRaw()).toBe(original);
  });

  it("respaldo preexistente desactualizado (sin escrituras B.1) se reemplaza por el estado actual", async () => {
    const original = JSON.stringify(seed());
    storage = new FakeStorage();
    const m = await load(original);
    storage.data.set(BACKUP, JSON.stringify({ kind: "seo-fixer-pre-b1-backup", createdAt: "2020-01-01", raw: JSON.stringify({ audits: [] }) }));
    m.hydrate();
    expect(m.getBackupStatus()).toMatchObject({ ok: true, state: "replaced-stale" });
    expect(backupRaw()).toBe(original);
  });

  it("respaldo dañado con evaluaciones ya guardadas → bloquea escrituras B.1 sin tocar el estado", async () => {
    const s = { ...seed(), companyAssessments: [{ id: "x", companyId: "c1", title: "t", assessmentDate: "2026-11-01", status: "in-progress", controls: {}, createdAt: "a", updatedAt: "a" }] };
    const raw = JSON.stringify(s);
    const m = await load(raw);
    storage.data.set(BACKUP, "{no-json");
    m.hydrate();
    expect(m.getBackupStatus()?.ok).toBe(false);
    const r = m.assessmentActions.create("c1");
    expect(r.ok).toBe(false);
    expect(storage.getItem(STATE)).toBe(raw);
    expect(storage.getItem(BACKUP)).toBe("{no-json");
  });

  it("fallo al escribir el respaldo → no se crea la evaluación ni se modifica el estado", async () => {
    const original = JSON.stringify(seed());
    const m = await load(original);
    storage.failOn.add(BACKUP);
    m.hydrate();
    expect(m.getBackupStatus()).toMatchObject({ ok: false, state: "error" });
    const r = m.assessmentActions.create("c1");
    expect(r).toMatchObject({ ok: false });
    expect(storage.getItem(STATE)).toBe(original);
    expect(storage.getItem(BACKUP)).toBeNull();
  });

  it("respaldo verificado que no coincide → error", async () => {
    const m = await load();
    const s = new FakeStorage();
    s.data.set(STATE, JSON.stringify(seed()));
    s.setItem = (k: string, v: string) => {
      s.data.set(k, k === BACKUP ? v.replace("Viae", "Otro") : v);
    };
    expect(m.ensurePreB1Backup(s)).toMatchObject({ ok: false });
  });

  it("sin estado previo: el respaldo registra raw null", async () => {
    const m = await load(null);
    expect(m.ensurePreB1Backup(storage)).toMatchObject({ ok: true, state: "created" });
    expect(backupRaw()).toBeNull();
  });
});

describe("B.1 — restauración validada", () => {
  it("JSON inválido → rechazada sin alterar estado ni almacenamiento", async () => {
    const m = await load();
    m.hydrate();
    m.assessmentActions.create("c1");
    const before = storage.getItem(STATE);
    const mem = m.getBackupStatus();
    expect(m.restoreStateBackup("{oops", storage)).toMatchObject({ ok: false });
    expect(storage.getItem(STATE)).toBe(before);
    expect(m.getBackupStatus()).toBe(mem);
  });

  it("esquema incompatible → rechazada sin alterar estado", async () => {
    const m = await load();
    m.hydrate();
    const before = storage.getItem(STATE);
    for (const bad of [JSON.stringify([]), JSON.stringify({ companies: [] }), JSON.stringify({ audits: [], companies: {} }), JSON.stringify({ audits: [{}] })]) {
      expect(m.restoreStateBackup(bad, storage).ok).toBe(false);
      expect(storage.getItem(STATE)).toBe(before);
    }
  });

  it("fallo de escritura al restaurar → mantiene el vigente", async () => {
    const m = await load();
    m.hydrate();
    const before = storage.getItem(STATE);
    storage.failOn.add(STATE);
    expect(m.restoreStateBackup(JSON.stringify(seed()), storage).ok).toBe(false);
    expect(storage.getItem(STATE)).toBe(before);
  });

  it("restaura el estado original desde el respaldo pre-B1", async () => {
    const original = JSON.stringify(seed());
    const m = await load(original);
    m.hydrate();
    m.assessmentActions.create("c1");
    expect(parsed().companyAssessments).toHaveLength(1);
    const res = m.restoreStateBackup(m.readPreB1Backup(storage)!, storage);
    expect(res.ok).toBe(true);
    expect(storage.getItem(STATE)).toBe(original);
    expect(backupRaw()).toBe(original);
  });
});

describe("B.1 — evaluaciones y no-regresión", () => {
  it("crear y actualizar no altera empresas, auditorías, evaluaciones turísticas ni roadmaps", async () => {
    const m = await load();
    m.hydrate();
    const before = parsed();
    const r = m.assessmentActions.create("c1", { title: "Inicial" }, { tourismFromAuditId: "au1" });
    expect(r.ok).toBe(true);
    const id = (r as { id: string }).id;
    m.assessmentActions.updateControl(id, "web-offer-clarity", { status: "needs-improvement", notes: "Revisado" });
    m.assessmentActions.updateControl(id, "web-has-site", { status: "meets", evidenceUrl: "https://viae.test" });
    m.assessmentActions.updateMeta(id, { status: "completed" });
    const after = parsed();
    for (const k of ["audits", "companies", "commercialReviews", "roadmaps", "changes", "history"]) {
      expect(after[k]).toEqual(before[k]);
    }
    // settings: el store ya completaba valores por defecto al guardar (comportamiento previo a B.1); los guardados se conservan.
    expect(after.settings).toMatchObject(before.settings);
    const a = after.companyAssessments[0];
    expect(a.controls["web-offer-clarity"]).toMatchObject({ status: "needs-improvement", sourceKind: "manual" });
    expect(a.controls["web-mobile"]).toMatchObject({ status: "needs-improvement", sourceKind: "tourism-import" });
    expect(after.commercialReviews[0].controls["property-info"].status).toBe("verified");
  });

  it("historial: varias evaluaciones coexisten sin sobrescribirse", async () => {
    const m = await load();
    m.hydrate();
    const a = m.assessmentActions.create("c1", { title: "Uno", assessmentDate: "2026-10-01" });
    const b = m.assessmentActions.create("c1", { title: "Dos", assessmentDate: "2026-11-01" });
    expect(a.ok && b.ok).toBe(true);
    m.assessmentActions.updateControl((b as { id: string }).id, "web-mobile", { status: "meets" });
    const list = parsed().companyAssessments;
    expect(list.map((x: { title: string }) => x.title)).toEqual(["Uno", "Dos"]);
    expect(list[0].controls).toEqual({});
  });

  it("rechaza «No aplica» sin justificación y empresa inexistente sin escribir", async () => {
    const m = await load();
    m.hydrate();
    const r = m.assessmentActions.create("c1");
    const id = (r as { id: string }).id;
    const before = storage.getItem(STATE);
    expect(m.assessmentActions.updateControl(id, "web-mobile", { status: "not-applicable" }).ok).toBe(false);
    expect(m.assessmentActions.create("nope").ok).toBe(false);
    expect(storage.getItem(STATE)).toBe(before);
  });

  it("estado guardado sin companyAssessments se hidrata como []", async () => {
    const m = await load();
    m.hydrate();
    expect(m.assessmentActions.create("c1").ok).toBe(true); // no lanza con estado previo sin el campo
  });

  it("no existe acción de borrado de evaluaciones", async () => {
    const m = await load();
    expect(Object.keys(m.assessmentActions).sort()).toEqual(["create", "updateControl", "updateMeta"]);
  });
});

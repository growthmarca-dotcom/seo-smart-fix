import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DIMENSIONS, CONTROLS } from "@/diagnosis/dimensions";
import { TOURISM_EQUIVALENCES } from "@/diagnosis/equivalences";
import {
  NA_JUSTIFICATION_REQUIRED,
  INVALID_URL,
  decideEvidenceSave,
  decideNotesSave,
  decideStatusChange,
} from "./control-row";

const STATE = "seo-fixer:state:v1";
const BACKUP = "seo-fixer:state:backup:pre-b1";

class FakeStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const ALL_TOURISM = Object.fromEntries(
  ["property-info", "photos-description", "contact-whatsapp", "booking-engine", "mobile-path", "ota-consistency", "value-proposition", "measurement", "rates-policies", "trust"].map(
    (id) => [id, { status: "verified", notes: `n-${id}`, evidenceUrl: `https://ev.test/${id}` }],
  ),
);

const seed = () => ({
  audits: [{ id: "au1", name: "Viae", rootUrl: "https://viae.test", isDemo: false, createdAt: "2026-10-27T10:00:00Z", pages: [], findings: [], score: { total: 93 } }],
  changes: [],
  history: [],
  commercialReviews: [{ auditId: "au1", updatedAt: "2026-10-27T11:00:00Z", controls: ALL_TOURISM }],
  companies: [
    { id: "c1", tradeName: "Viae", industry: "tourism-lodging", status: "active", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", auditIds: ["au1"] },
    { id: "c2", tradeName: "Otra", industry: "restaurant", status: "active", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", auditIds: [] },
  ],
  roadmaps: [{ companyId: "c1", phases: [], createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" }],
  settings: { brandName: "MarCa" },
});

let storage: FakeStorage;
async function boot(existing?: FakeStorage) {
  storage = existing ?? new FakeStorage();
  if (!existing) storage.data.set(STATE, JSON.stringify(seed()));
  vi.stubGlobal("window", { localStorage: storage });
  vi.resetModules();
  const m = await import("@/store/app-store");
  m.hydrate();
  return m;
}
const persisted = () => JSON.parse(storage.getItem(STATE)!);

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("B.2 — catálogo y dimensiones intactos", () => {
  it("conserva las seis dimensiones con sus ids y nombres", () => {
    expect(DIMENSIONS.map((d) => [d.id, d.title])).toEqual([
      ["web", "Presencia digital y sitio web"],
      ["visibility", "Visibilidad y reputación"],
      ["sales", "Comercialización y ventas"],
      ["brand", "Marca, comunicación y contenidos"],
      ["channels", "Canales y experiencia del cliente"],
      ["opportunities", "Oportunidades y desarrollo comercial"],
    ]);
  });
  it("no modifica el catálogo ni las 8 equivalencias al usar la pantalla", async () => {
    const before = JSON.stringify(CONTROLS);
    const m = await boot();
    const id = m.assessmentActions.create("c1", {}, { tourismFromAuditId: "au1" }).id!;
    m.assessmentActions.updateControl(id, "web-mobile", { status: "needs-improvement" });
    expect(JSON.stringify(CONTROLS)).toBe(before);
    expect(Object.keys(TOURISM_EQUIVALENCES)).toHaveLength(8);
  });
});

describe("B.2 — reglas de «No aplica» en la interfaz", () => {
  it("sin justificación impide el cambio de estado", () => {
    expect(decideStatusChange("not-applicable", "   ")).toEqual({ ok: false, error: NA_JUSTIFICATION_REQUIRED });
  });
  it("con justificación envía estado y notas juntos", () => {
    expect(decideStatusChange("not-applicable", "No usa WhatsApp")).toEqual({ ok: true, patch: { status: "not-applicable", notes: "No usa WhatsApp" } });
  });
  it("una sola llamada con estado+notas es aceptada por la acción B1", async () => {
    const m = await boot();
    const id = m.assessmentActions.create("c2").id!;
    const d = decideStatusChange("not-applicable", "No tiene reservas online");
    expect(d.ok).toBe(true);
    const r = m.assessmentActions.updateControl(id, "ch-whatsapp", (d as { patch: object }).patch);
    expect(r.ok).toBe(true);
    expect(persisted().companyAssessments[0].controls["ch-whatsapp"]).toMatchObject({ status: "not-applicable", notes: "No tiene reservas online" });
  });
  it("no permite borrar la justificación de un control en «No aplica»", () => {
    expect(decideNotesSave("not-applicable", "")).toEqual({ ok: false, error: NA_JUSTIFICATION_REQUIRED });
    expect(decideNotesSave("meets", "")).toEqual({ ok: true, patch: { notes: "" } });
  });
  it("la acción B1 también rechaza vaciar la justificación (doble barrera) y el error es comunicable", async () => {
    const m = await boot();
    const id = m.assessmentActions.create("c2").id!;
    m.assessmentActions.updateControl(id, "ch-whatsapp", { status: "not-applicable", notes: "Sin WhatsApp" });
    const r = m.assessmentActions.updateControl(id, "ch-whatsapp", { notes: "" });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(persisted().companyAssessments[0].controls["ch-whatsapp"].notes).toBe("Sin WhatsApp");
  });
  it("valida la URL de evidencia", () => {
    expect(decideEvidenceSave("ftp://x")).toEqual({ ok: false, error: INVALID_URL });
    expect(decideEvidenceSave(" https://ok.test/a ")).toEqual({ ok: true, patch: { evidenceUrl: "https://ok.test/a" } });
  });
});

describe("B.2 — historial, recarga, precarga y respaldo", () => {
  it("una evaluación anterior sigue intacta al crear otra", async () => {
    const m = await boot();
    const a = m.assessmentActions.create("c1", { assessmentDate: "2026-10-01" }).id!;
    m.assessmentActions.updateControl(a, "web-mobile", { status: "meets", notes: "ok" });
    const snap = JSON.stringify(persisted().companyAssessments.find((x: { id: string }) => x.id === a));
    m.assessmentActions.create("c1", { assessmentDate: "2026-11-01" });
    const list = persisted().companyAssessments;
    expect(list).toHaveLength(2);
    expect(JSON.stringify(list.find((x: { id: string }) => x.id === a))).toBe(snap);
  });

  it("una recarga conserva los cambios guardados", async () => {
    const m = await boot();
    const id = m.assessmentActions.create("c1").id!;
    m.assessmentActions.updateControl(id, "web-mobile", { status: "needs-improvement", notes: "Botón chico", evidenceUrl: "https://e.test" });
    const m2 = await boot(storage); // mismo almacenamiento, módulo nuevo
    // Una escritura posterior desde el módulo recargado conserva lo guardado antes.
    expect(m2.assessmentActions.updateControl(id, "brand-value", { status: "meets" }).ok).toBe(true);
    const a = persisted().companyAssessments.find((x: { id: string }) => x.id === id);
    expect(a.controls["brand-value"].status).toBe("meets");
    expect(a.controls["web-mobile"]).toMatchObject({ status: "needs-improvement", notes: "Botón chico", evidenceUrl: "https://e.test" });
  });

  it("precarga exactamente las 8 equivalencias sin modificar commercialReviews ni auditorías", async () => {
    const m = await boot();
    const before = JSON.stringify({ r: persistedOrSeed().commercialReviews, a: persistedOrSeed().audits });
    const id = m.assessmentActions.create("c1", {}, { tourismFromAuditId: "au1" }).id!;
    const a = persisted().companyAssessments.find((x: { id: string }) => x.id === id);
    expect(Object.keys(a.controls).sort()).toEqual(Object.values(TOURISM_EQUIVALENCES).sort());
    expect(Object.values(a.controls).every((c) => (c as { sourceKind: string }).sourceKind === "tourism-import")).toBe(true);
    m.assessmentActions.updateControl(id, "web-mobile", { status: "needs-improvement", notes: "Editado" });
    const after = persisted();
    expect(JSON.stringify({ r: after.commercialReviews, a: after.audits })).toBe(before);
    expect(after.commercialReviews[0].controls["mobile-path"]).toEqual(ALL_TOURISM["mobile-path"]);
  });

  it("un error de guardado (respaldo inválido) se comunica y no escribe", async () => {
    const m = await boot();
    const id = m.assessmentActions.create("c1").id!;
    const prev = storage.getItem(STATE);
    storage.removeItem(BACKUP);
    const r = m.assessmentActions.updateControl(id, "web-mobile", { status: "meets" });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(storage.getItem(STATE)).toBe(prev);
  });

  it("el respaldo B1 no cambia tras las operaciones de B2", async () => {
    const m = await boot();
    const backup = storage.getItem(BACKUP);
    expect(backup).toBeTruthy();
    const id = m.assessmentActions.create("c1", {}, { tourismFromAuditId: "au1" }).id!;
    m.assessmentActions.updateControl(id, "ch-whatsapp", { status: "not-applicable", notes: "Sin WhatsApp" });
    m.assessmentActions.updateControl(id, "web-mobile", { evidenceUrl: "https://e.test" });
    m.assessmentActions.create("c1");
    expect(storage.getItem(BACKUP)).toBe(backup);
  });

  it("empresas y roadmaps permanecen idénticos", async () => {
    const m = await boot();
    const id = m.assessmentActions.create("c1").id!;
    m.assessmentActions.updateControl(id, "web-mobile", { status: "meets" });
    const s = seed();
    expect(persisted().companies).toEqual(s.companies);
    expect(persisted().roadmaps).toEqual(s.roadmaps);
  });
});

function persistedOrSeed() {
  const raw = storage.getItem(STATE);
  return raw ? JSON.parse(raw) : seed();
}

/**
 * Estado de aplicación (cliente) con persistencia en localStorage.
 * Preparado para reemplazarse por persistencia real + autenticación:
 * toda la UI consume estas acciones, no el almacenamiento directamente.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { runAudit } from "@/seo/engine";
import { buildDemoSite, DEMO_ROOT_URL, DEMO_STORE_NAME } from "@/seo/demo";
import { getConnector } from "@/seo/connectors";
import { proposalFromFinding } from "@/seo/suggestions";
import { mergeRows } from "@/seo/gsc/import";
import { emptyReview, updateControl, type CommercialReview, type CommercialStatus } from "@/seo/tourism/commercial-review";
import * as cm from "@/companies/model";
import * as dm from "@/diagnosis/model";
import type { AssessmentControlState, AssessmentInput, AssessmentMetaPatch, CompanyAssessment } from "@/diagnosis/model";
import { TOURISM_EQUIVALENCES } from "@/diagnosis/equivalences";
import type { Company, CompanyInput, Roadmap, TaskPatch, TaskPriority } from "@/companies/model";
import type { GscConnection, GscRow } from "@/seo/gsc/types";
import { mergeCategories, mergeProducts } from "@/seo/commerce/dedupe";
import type {
  CommerceApiError,
  CommerceSource,
  NormalizedCategory,
  NormalizedProduct,
  StoreConnection,
  StoreConnectionStatus,
  StoreImport,
} from "@/seo/commerce/types";
import type {
  Audit,
  ChangeProposal,
  ChangeStatus,
  Finding,
  HistoryEntry,
  PageSnapshot,
  PlatformId,
  SiteContext,
} from "@/seo/types";

export interface Settings {
  defaultCrawlLimit: number;
  respectRobots: boolean;
  brandName: string;
  locale: string;
  disabledRules: string[];
}

export interface AppState {
  hydrated: boolean;
  audits: Audit[];
  changes: ChangeProposal[];
  history: HistoryEntry[];
  /**
   * Campo NUEVO y aditivo: claves `auditId:findingId` marcadas como revisadas.
   * No reemplaza ningún campo existente; si falta en datos guardados se
   * hidrata como array vacío (sin migraciones destructivas).
   */
  reviewed: string[];
  /**
   * FASE 6A (aditivo): conexiones de Google Search Console, una por auditId
   * como máximo. Nunca se comparten datos entre auditorías.
   */
  gsc: GscConnection[];
  /**
   * FASE 7B (aditivo): conexiones de tienda (Tienda Nube / demo) e
   * importaciones normalizadas. Una importación pertenece siempre a
   * UNA auditoría y UNA tienda (`auditId` + `storeId`).
   */
  stores: StoreConnection[];
  storeImports: StoreImport[];
  /** Aditivo: evaluación comercial manual de alojamientos, una por auditId. */
  commercialReviews: CommercialReview[];
  /** Aditivo: empresas y su roadmap propio (uno por empresa). */
  companies: Company[];
  roadmaps: Roadmap[];
  /** Etapa B.1 (aditivo): evaluaciones integrales por empresa. Historial; nunca se borran. */
  companyAssessments: CompanyAssessment[];
  settings: Settings;
}

const STORAGE_KEY = "seo-fixer:state:v1";

const initialState: AppState = {
  hydrated: false,
  audits: [],
  changes: [],
  history: [],
  reviewed: [],
  gsc: [],
  stores: [],
  storeImports: [],
  commercialReviews: [],
  companies: [],
  roadmaps: [],
  companyAssessments: [],
  settings: {
    defaultCrawlLimit: 100,
    respectRobots: true,
    brandName: "Outdoor Patagonia",
    locale: "es-AR",
    disabledRules: [],
  },
};

let state: AppState = initialState;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function set(updater: (prev: AppState) => AppState) {
  state = updater(state);
  if (typeof window !== "undefined" && state.hydrated) {
    try {
      const { hydrated: _h, ...persisted } = state;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      /* cuota o modo privado */
    }
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const id = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

function log(entry: Omit<HistoryEntry, "id" | "at">) {
  return { ...entry, id: id(), at: now() };
}

export function hydrate() {
  if (state.hydrated) return;
  // B.1: crear/verificar el respaldo pre-B1 ANTES de cualquier escritura posterior.
  try {
    backupStatus = ensurePreB1Backup(window.localStorage);
  } catch {
    backupStatus = { ok: false, state: "error", error: "No se pudo acceder al almacenamiento del navegador." };
  }
  let loaded: Partial<AppState> = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) loaded = JSON.parse(raw) as Partial<AppState>;
  } catch {
    loaded = {};
  }
  state = {
    ...initialState,
    ...loaded,
    reviewed: loaded.reviewed ?? [],
    gsc: loaded.gsc ?? [],
    stores: loaded.stores ?? [],
    storeImports: loaded.storeImports ?? [],
    commercialReviews: loaded.commercialReviews ?? [],
    ...cm.migrateCompanies(loaded, (loaded.audits ?? []).map((a) => a.id)),
    companyAssessments: dm.migrateAssessments(loaded.companyAssessments),
    settings: { ...initialState.settings, ...(loaded.settings ?? {}) },
    hydrated: true,
  };
  emit();
  if (state.audits.length === 0) {
    const demo = createAuditFromSite(buildDemoSite("generic-web"), {
      name: `${DEMO_STORE_NAME} — auditoría inicial`,
      platform: "generic-web",
      rootUrl: DEMO_ROOT_URL,
      isDemo: true,
      crawlLimit: 100,
      respectRobots: true,
    });
    set((prev) => ({
      ...prev,
      audits: [demo],
      changes: buildProposals(demo),
      history: [
        log({
          auditId: demo.id,
          action: "Auditoría demo creada",
          detail: `${demo.pages.length} URLs analizadas · ${demo.findings.length} hallazgos`,
        }),
      ],
    }));
  }
}

export function createAuditFromSite(
  site: SiteContext,
  meta: {
    name: string;
    platform: PlatformId;
    rootUrl: string;
    isDemo: boolean;
    crawlLimit: number;
    respectRobots: boolean;
  },
): Audit {
  const tags = getConnector(meta.platform)?.ruleTags ?? [];
  const { findings, score } = runAudit(site, tags, state.settings.disabledRules);
  const issues = findings.filter((f) => f.severity !== "ok").length;
  return {
    id: id(),
    name: meta.name,
    platform: meta.platform,
    rootUrl: meta.rootUrl,
    isDemo: meta.isDemo,
    status: "done",
    createdAt: now(),
    finishedAt: now(),
    crawlLimit: meta.crawlLimit,
    respectRobots: meta.respectRobots,
    progress: {
      discovered: site.coverage?.discovered ?? site.pages.length,
      analyzed: site.pages.length,
      issues,
    },
    pages: site.pages,
    findings,
    score,
    sitemapFound: site.sitemap?.found,
    robotsFound: site.robotsTxt?.found,
    coverage: site.coverage,
  };
}

export function buildProposals(audit: Audit): ChangeProposal[] {
  return audit.findings
    .map((f) => proposalFromFinding(f, audit.id, audit.platform))
    .filter((c): c is ChangeProposal => Boolean(c));
}

const ctx: cm.Ctx = { now, newId: id };

function detachAuditFromCompanies(prev: AppState, auditId: string) {
  const roadmaps = [...prev.roadmaps];
  const companies = prev.companies.map((c) => {
    if (!c.auditIds.includes(auditId)) return c;
    const idx = roadmaps.findIndex((r) => r.companyId === c.id);
    const res = cm.unlinkAudit(c, roadmaps[idx], auditId, ctx, "Auditoría SEO eliminada");
    if (idx !== -1 && res.roadmap) roadmaps[idx] = res.roadmap;
    return res.company;
  });
  return { companies, roadmaps };
}

function setRoadmap(companyId: string, fn: (r: Roadmap) => Roadmap) {
  set((prev) => ({
    ...prev,
    roadmaps: prev.roadmaps.map((r) => (r.companyId === companyId ? fn(r) : r)),
  }));
}

/** Acciones de Empresas + Roadmap. Toda la lógica vive en src/companies/model.ts. */
export const companyActions = {
  create(input: CompanyInput): Company {
    const { company, roadmap } = cm.createCompany(input, ctx);
    set((prev) => ({
      ...prev,
      companies: [company, ...prev.companies],
      roadmaps: [...prev.roadmaps, roadmap],
    }));
    return company;
  },
  update(companyId: string, input: CompanyInput) {
    set((prev) => ({
      ...prev,
      companies: prev.companies.map((c) => (c.id === companyId ? cm.updateCompany(c, input, ctx) : c)),
    }));
  },
  remove(companyId: string) {
    // Solo borra la empresa y su roadmap; las auditorías asociadas se conservan.
    set((prev) => ({
      ...prev,
      companies: prev.companies.filter((c) => c.id !== companyId),
      roadmaps: prev.roadmaps.filter((r) => r.companyId !== companyId),
    }));
  },
  linkAudit(companyId: string, auditId: string) {
    set((prev) => {
      const audit = prev.audits.find((a) => a.id === auditId);
      const company = prev.companies.find((c) => c.id === companyId);
      if (!audit || !company) return prev;
      const roadmap = prev.roadmaps.find((r) => r.companyId === companyId);
      const res = cm.linkAudit(company, roadmap, auditId, `${audit.name} (${audit.rootUrl})`, ctx);
      return {
        ...prev,
        companies: prev.companies.map((c) => (c.id === companyId ? res.company : c)),
        roadmaps: prev.roadmaps.map((r) => (r.companyId === companyId && res.roadmap ? res.roadmap : r)),
      };
    });
  },
  unlinkAudit(companyId: string, auditId: string) {
    set((prev) => {
      const company = prev.companies.find((c) => c.id === companyId);
      if (!company) return prev;
      const roadmap = prev.roadmaps.find((r) => r.companyId === companyId);
      const res = cm.unlinkAudit(company, roadmap, auditId, ctx);
      return {
        ...prev,
        companies: prev.companies.map((c) => (c.id === companyId ? res.company : c)),
        roadmaps: prev.roadmaps.map((r) => (r.companyId === companyId && res.roadmap ? res.roadmap : r)),
      };
    });
  },
  /** Asocia, cambia o quita (null) la empresa de una auditoría, sin duplicados. */
  assignAudit(auditId: string, companyId: string | null) {
    set((prev) => {
      const audit = prev.audits.find((a) => a.id === auditId);
      if (!audit) return prev;
      const res = cm.assignAudit(prev.companies, prev.roadmaps, auditId, companyId, `${audit.name} (${audit.rootUrl})`, ctx);
      return { ...prev, ...res };
    });
  },
  updateTask(companyId: string, taskId: string, patch: TaskPatch, statusNote?: string) {
    setRoadmap(companyId, (r) => cm.updateTask(r, taskId, patch, ctx, statusNote));
  },
  addEvidence(companyId: string, taskId: string, ev: { url?: string; note: string }) {
    setRoadmap(companyId, (r) => cm.addEvidence(r, taskId, ev, ctx));
  },
  addTask(companyId: string, phaseId: string, input: { title: string; description?: string; priority?: TaskPriority }) {
    setRoadmap(companyId, (r) => cm.addTask(r, phaseId, input, ctx));
  },
  addPhase(companyId: string, title: string) {
    setRoadmap(companyId, (r) => cm.addPhase(r, title, ctx));
  },
  moveTask(companyId: string, taskId: string, dir: -1 | 1) {
    setRoadmap(companyId, (r) => cm.moveTask(r, taskId, dir, ctx));
  },
  movePhase(companyId: string, phaseId: string, dir: -1 | 1) {
    setRoadmap(companyId, (r) => cm.movePhase(r, phaseId, dir, ctx));
  },
};

export const actions = {
  addAudit(audit: Audit) {
    set((prev) => ({
      ...prev,
      audits: [audit, ...prev.audits],
      changes: [...buildProposals(audit), ...prev.changes],
      history: [
        log({
          auditId: audit.id,
          action: audit.isDemo ? "Auditoría demo creada" : "Auditoría completada",
          detail: `${audit.rootUrl} · ${audit.pages.length} URLs · ${audit.findings.length} hallazgos`,
        }),
        ...prev.history,
      ],
    }));
    return audit;
  },
  deleteAudit(auditId: string) {
    set((prev) => ({
      ...prev,
      audits: prev.audits.filter((a) => a.id !== auditId),
      changes: prev.changes.filter((c) => c.auditId !== auditId),
      reviewed: prev.reviewed.filter((k) => !k.startsWith(`${auditId}:`)),
      gsc: (prev.gsc ?? []).filter((g) => g.auditId !== auditId),
      // FASE 7B: al borrar una auditoría se borran solo SUS importaciones.
      storeImports: (prev.storeImports ?? []).filter((i) => i.auditId !== auditId),
      commercialReviews: (prev.commercialReviews ?? []).filter((r) => r.auditId !== auditId),
      ...detachAuditFromCompanies(prev, auditId),
      stores: (prev.stores ?? []).map((s) => ({
        ...s,
        auditIds: s.auditIds.filter((a) => a !== auditId),
      })),
    }));
  },
  setChangeStatus(changeId: string, status: ChangeStatus, note?: string) {
    set((prev) => {
      const change = prev.changes.find((c) => c.id === changeId);
      const at = now();
      return {
        ...prev,
        changes: prev.changes.map((c) =>
          c.id === changeId
            ? {
                ...c,
                status,
                note,
                updatedAt: at,
                history: [...(c.history ?? []), { at, status, detail: note }],
              }
            : c,
        ),
        history: change
          ? [
              log({
                auditId: change.auditId,
                action:


                  status === "approved"
                    ? "Cambio aprobado"
                    : status === "rejected"
                      ? "Cambio rechazado"
                      : status === "applied"
                        ? "Cambio aplicado"
                        : "Cambio pendiente",
                detail: `${change.field} · ${change.pageUrl}`,
              }),
              ...prev.history,
            ]
          : prev.history,
      };
    });
  },
  bulkSetStatus(changeIds: string[], status: ChangeStatus) {
    changeIds.forEach((cid) => actions.setChangeStatus(cid, status));
  },
  editChange(changeId: string, value: string) {
    set((prev) => ({
      ...prev,
      changes: prev.changes.map((c) =>
        c.id === changeId ? { ...c, editedValue: value, updatedAt: now() } : c,
      ),
    }));
  },
  updateSettings(patch: Partial<Settings>) {
    set((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  },
  toggleRule(ruleId: string) {
    set((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        disabledRules: prev.settings.disabledRules.includes(ruleId)
          ? prev.settings.disabledRules.filter((r) => r !== ruleId)
          : [...prev.settings.disabledRules, ruleId],
      },
    }));
  },
  /** Evaluación comercial (manual): actualiza un control de UNA auditoría. */
  setCommercialControl(
    auditId: string,
    controlId: string,
    patch: { status?: CommercialStatus | null; notes?: string; evidenceUrl?: string },
  ) {
    set((prev) => {
      const list = prev.commercialReviews ?? [];
      const current = list.find((r) => r.auditId === auditId) ?? emptyReview(auditId);
      const next = updateControl(current, controlId, patch);
      return { ...prev, commercialReviews: [...list.filter((r) => r.auditId !== auditId), next] };
    });
  },
  toggleReviewed(auditId: string, findingId: string) {
    const key = `${auditId}:${findingId}`;
    set((prev) => ({
      ...prev,
      reviewed: (prev.reviewed ?? []).includes(key)
        ? prev.reviewed.filter((k) => k !== key)
        : [...(prev.reviewed ?? []), key],
    }));
  },
  /** FASE 6A — crea/actualiza la conexión GSC de UNA auditoría. */
  setGscConnection(connection: GscConnection) {
    set((prev) => ({
      ...prev,
      gsc: [
        connection,
        ...(prev.gsc ?? []).filter((g) => g.auditId !== connection.auditId),
      ],
      history: [
        log({
          auditId: connection.auditId,
          action:
            connection.source === "demo"
              ? "GSC demo vinculado"
              : "Propiedad de Search Console vinculada",
          detail: `${connection.property.siteUrl} · ${connection.rows.length} registros`,
        }),
        ...prev.history,
      ],
    }));
  },
  /** Importa filas deduplicando por auditId+propiedad+fecha+dimensiones. */
  importGscRows(auditId: string, rows: GscRow[], patch: Partial<GscConnection> = {}) {
    set((prev) => ({
      ...prev,
      gsc: (prev.gsc ?? []).map((g) =>
        g.auditId === auditId
          ? {
              ...g,
              ...patch,
              rows: mergeRows(g.rows, rows),
              lastSyncAt: now(),
              status: mergeRows(g.rows, rows).length === 0 ? "no-data" : "connected",
            }
          : g,
      ),
    }));
  },
  patchGscConnection(auditId: string, patch: Partial<GscConnection>) {
    set((prev) => ({
      ...prev,
      gsc: (prev.gsc ?? []).map((g) => (g.auditId === auditId ? { ...g, ...patch } : g)),
    }));
  },
  removeGscConnection(auditId: string) {
    set((prev) => ({ ...prev, gsc: (prev.gsc ?? []).filter((g) => g.auditId !== auditId) }));
  },

  /* ------------------ FASE 7B — Tiendas (solo lectura) ------------------ */

  /** Crea/actualiza una conexión de tienda por `storeId` (sin tokens). */
  setStoreConnection(connection: StoreConnection) {
    set((prev) => {
      const existing = (prev.stores ?? []).find(
        (s) => s.storeId === connection.storeId && s.source === connection.source,
      );
      const merged: StoreConnection = {
        ...connection,
        auditIds: [...new Set([...(existing?.auditIds ?? []), ...connection.auditIds])],
        apiErrors: connection.apiErrors.length ? connection.apiErrors : (existing?.apiErrors ?? []),
      };
      return {
        ...prev,
        stores: [
          merged,
          ...(prev.stores ?? []).filter(
            (s) => !(s.storeId === connection.storeId && s.source === connection.source),
          ),
        ],
      };
    });
  },
  patchStoreStatus(
    storeId: string,
    source: CommerceSource,
    status: StoreConnectionStatus,
    error?: string,
  ) {
    set((prev) => ({
      ...prev,
      stores: (prev.stores ?? []).map((s) =>
        s.storeId === storeId && s.source === source ? { ...s, status, error } : s,
      ),
    }));
  },
  /**
   * Importa datos normalizados de UNA tienda en UNA auditoría.
   * Deduplica por `storeId + externalId`; no toca importaciones de otras
   * auditorías ni de otras tiendas. Nunca escribe en la tienda.
   */
  importStoreData(input: {
    auditId: string;
    storeId: string;
    source: CommerceSource;
    products: NormalizedProduct[];
    categories: NormalizedCategory[];
    errors?: CommerceApiError[];
    apiPages?: number;
  }) {
    set((prev) => {
      const imports = prev.storeImports ?? [];
      const current = imports.find(
        (i) => i.auditId === input.auditId && i.storeId === input.storeId,
      );
      const products = mergeProducts(current?.products ?? [], input.products).items;
      const categories = mergeCategories(current?.categories ?? [], input.categories).items;
      const next: StoreImport = {
        auditId: input.auditId,
        storeId: input.storeId,
        source: input.source,
        syncedAt: now(),
        syncVersion: (current?.syncVersion ?? 0) + 1,
        products,
        categories,
        errors: input.errors ?? [],
        apiPages: input.apiPages ?? 0,
      };
      return {
        ...prev,
        storeImports: [
          next,
          ...imports.filter(
            (i) => !(i.auditId === input.auditId && i.storeId === input.storeId),
          ),
        ],
        stores: (prev.stores ?? []).map((s) =>
          s.storeId === input.storeId && s.source === input.source
            ? {
                ...s,
                status: products.length === 0 ? "no-data" : "synced",
                lastSyncAt: next.syncedAt,
                error: undefined,
                apiErrors: input.errors ?? [],
                auditIds: [...new Set([...s.auditIds, input.auditId])],
              }
            : s,
        ),
        history: [
          log({
            auditId: input.auditId,
            action:
              input.source === "demo"
                ? "Tienda demo Tienda Nube importada"
                : "Datos de Tienda Nube importados (lectura)",
            detail: `${products.length} productos · ${categories.length} categorías · sync #${next.syncVersion}`,
          }),
          ...prev.history,
        ],
      };
    });
  },
  removeStoreImport(auditId: string, storeId: string) {
    set((prev) => ({
      ...prev,
      storeImports: (prev.storeImports ?? []).filter(
        (i) => !(i.auditId === auditId && i.storeId === storeId),
      ),
    }));
  },
  resetDemo() {
    set(() => ({ ...initialState, hydrated: true }));
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    state = { ...initialState, hydrated: false };
    hydrate();
  },
};

function shallowEqual(a: unknown, b: unknown) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return (
      ka.length === kb.length &&
      ka.every(
        (k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k],
      )
    );
  }
  return false;
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cache = useRef<{ value: T } | null>(null);

  useEffect(() => {
    hydrate();
  }, []);

  const getSnapshot = useCallback(() => {
    const next = selectorRef.current(state);
    if (cache.current && shallowEqual(cache.current.value, next)) return cache.current.value;
    cache.current = { value: next };
    return next;
  }, []);

  const serverCache = useRef<{ value: T } | null>(null);
  const getServerSnapshot = useCallback(() => {
    if (!serverCache.current) serverCache.current = { value: selectorRef.current(initialState) };
    return serverCache.current.value;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useAudit(auditId: string) {
  return useAppState((s) => s.audits.find((a) => a.id === auditId));
}

export function findPage(audit: Audit | undefined, pageId: string): PageSnapshot | undefined {
  return audit?.pages.find((p) => p.id === pageId);
}

export function findingsForPage(audit: Audit | undefined, pageId: string): Finding[] {
  return (audit?.findings ?? []).filter((f) => f.pageId === pageId);
}

/** FASE 6A — conexión GSC de UNA auditoría (aislamiento estricto). */
export function useGscConnection(auditId: string) {
  return useAppState((s) => (s.gsc ?? []).find((g) => g.auditId === auditId));
}

/** FASE 7B — conexiones de tienda registradas (sin tokens ni secretos). */
export function useStoreConnections() {
  return useAppState((s) => s.stores ?? []);
}

/** FASE 7B — importación de UNA tienda en UNA auditoría (aislamiento estricto). */
export function useStoreImport(auditId: string, storeId?: string) {
  return useAppState((s) =>
    (s.storeImports ?? []).find(
      (i) => i.auditId === auditId && (storeId ? i.storeId === storeId : true),
    ),
  );
}

/** FASE 7B — todas las importaciones de una auditoría (histórico por tienda). */
export function useStoreImportsForAudit(auditId: string) {
  return useAppState((s) => (s.storeImports ?? []).filter((i) => i.auditId === auditId));
}

/** Evaluación comercial de UNA auditoría (aislamiento estricto). */
export function useCommercialReview(auditId: string) {
  return useAppState((s) => (s.commercialReviews ?? []).find((r) => r.auditId === auditId));
}

export function useCompany(companyId: string) {
  return useAppState((s) => s.companies.find((c) => c.id === companyId));
}

export function useRoadmap(companyId: string) {
  return useAppState((s) => s.roadmaps.find((r) => r.companyId === companyId));
}

/* ------------------------------------------------------------------ */
/* Etapa B.1 — Respaldo pre-B1, restauración validada y evaluaciones.  */
/* ------------------------------------------------------------------ */

export const STATE_KEY = STORAGE_KEY;
export const PRE_B1_BACKUP_KEY = "seo-fixer:state:backup:pre-b1";

/** Almacenamiento mínimo (localStorage o un doble en pruebas). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Envoltorio del respaldo: `raw` es la cadena EXACTA de seo-fixer:state:v1 (null si no había estado). */
interface BackupEnvelope {
  kind: "seo-fixer-pre-b1-backup";
  createdAt: string;
  raw: string | null;
}

export interface BackupStatus {
  ok: boolean;
  state: "created" | "kept" | "replaced-stale" | "error";
  error?: string | undefined;
}

let backupStatus: BackupStatus | undefined;
export function getBackupStatus(): BackupStatus | undefined {
  return backupStatus;
}

const COLLECTIONS = [
  "audits", "changes", "history", "reviewed", "gsc", "stores", "storeImports",
  "commercialReviews", "companies", "roadmaps", "companyAssessments",
] as const;

/** Valida el esquema compatible del estado persistido (todas las versiones previas). */
export function validatePersistedState(raw: string): { ok: true; value: Partial<AppState> } | { ok: false; error: string } {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { ok: false, error: "JSON inválido." };
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, error: "El estado no es un objeto." };
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.audits)) return { ok: false, error: "Falta la colección «audits»." };
  for (const k of COLLECTIONS) {
    if (o[k] !== undefined && !Array.isArray(o[k])) return { ok: false, error: `La colección «${k}» no es una lista.` };
  }
  for (const k of ["audits", "companies", "roadmaps", "commercialReviews", "companyAssessments"] as const) {
    const list = (o[k] ?? []) as unknown[];
    if (list.some((x) => !x || typeof x !== "object")) return { ok: false, error: `La colección «${k}» tiene elementos inválidos.` };
  }
  if ((o.audits as { id?: unknown }[]).some((a) => typeof a.id !== "string")) return { ok: false, error: "Hay auditorías sin id." };
  if (((o.companies ?? []) as { id?: unknown }[]).some((c) => typeof c.id !== "string")) return { ok: false, error: "Hay empresas sin id." };
  if (((o.roadmaps ?? []) as { companyId?: unknown }[]).some((r) => typeof r.companyId !== "string")) return { ok: false, error: "Hay roadmaps sin empresa." };
  if (((o.commercialReviews ?? []) as { auditId?: unknown }[]).some((r) => typeof r.auditId !== "string")) return { ok: false, error: "Hay evaluaciones turísticas sin auditoría." };
  if (o.settings !== undefined && (typeof o.settings !== "object" || o.settings === null || Array.isArray(o.settings)))
    return { ok: false, error: "«settings» inválido." };
  return { ok: true, value: o as Partial<AppState> };
}

function parseEnvelope(text: string | null): BackupEnvelope | undefined {
  if (text === null) return undefined;
  try {
    const e = JSON.parse(text) as BackupEnvelope;
    if (e?.kind !== "seo-fixer-pre-b1-backup" || typeof e.createdAt !== "string") return undefined;
    if (e.raw !== null && (typeof e.raw !== "string" || !validatePersistedState(e.raw).ok)) return undefined;
    return e;
  } catch {
    return undefined;
  }
}

/** true si el estado ya contiene escrituras de B.1 (al menos una evaluación integral). */
function hasB1Writes(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const v = JSON.parse(raw) as { companyAssessments?: unknown };
    return Array.isArray(v.companyAssessments) && v.companyAssessments.length > 0;
  } catch {
    return false;
  }
}

/**
 * Garantiza el respaldo pre-B1:
 * - Sin respaldo → se crea con la cadena exacta actual y se verifica releyéndolo.
 * - Respaldo válido y ya hubo escrituras B.1 → se conserva SIN tocar (estado original).
 * - Respaldo previo (válido o no) sin escrituras B.1 → es anterior/desactualizado: se reemplaza por el estado actual y se verifica.
 * - Respaldo inválido con escrituras B.1 → error: no se puede garantizar la recuperación.
 * Nunca escribe en seo-fixer:state:v1.
 */
export function ensurePreB1Backup(storage: KeyValueStorage, at: string = new Date().toISOString()): BackupStatus {
  const original = storage.getItem(STORAGE_KEY);
  const existingText = storage.getItem(PRE_B1_BACKUP_KEY);
  const existing = parseEnvelope(existingText);
  const b1 = hasB1Writes(original);
  if (existing && b1) return { ok: true, state: "kept" };
  if (!existing && b1)
    return { ok: false, state: "error", error: "El respaldo previo a B.1 falta o está dañado y ya hay evaluaciones integrales guardadas." };
  if (existing && existing.raw === original) return { ok: true, state: "kept" };
  const envelope: BackupEnvelope = { kind: "seo-fixer-pre-b1-backup", createdAt: at, raw: original };
  const text = JSON.stringify(envelope);
  try {
    storage.setItem(PRE_B1_BACKUP_KEY, text);
  } catch {
    return { ok: false, state: "error", error: "No se pudo escribir el respaldo (almacenamiento lleno o bloqueado)." };
  }
  const check = parseEnvelope(storage.getItem(PRE_B1_BACKUP_KEY));
  if (!check || check.raw !== original)
    return { ok: false, state: "error", error: "El respaldo escrito no coincide con el estado original." };
  return { ok: true, state: existingText === null ? "created" : "replaced-stale" };
}

/** Comprueba, sin escribir, que el respaldo pre-B1 sigue disponible y válido. */
export function verifyPreB1Backup(storage: KeyValueStorage): boolean {
  return !!parseEnvelope(storage.getItem(PRE_B1_BACKUP_KEY));
}

/** Devuelve la cadena original resguardada (para descargar o restaurar). */
export function readPreB1Backup(storage: KeyValueStorage): string | null | undefined {
  return parseEnvelope(storage.getItem(PRE_B1_BACKUP_KEY))?.raw;
}

/** Copia textual del estado vigente persistido. */
export function exportStateBackup(storage: KeyValueStorage = window.localStorage): string | null {
  return storage.getItem(STORAGE_KEY);
}

/**
 * Restaura un estado validando JSON y esquema completo ANTES de tocar nada.
 * Si falla la validación o la escritura, el estado vigente (memoria y almacenamiento) queda igual.
 * No modifica el respaldo pre-B1.
 */
export function restoreStateBackup(rawJson: string, storage: KeyValueStorage = window.localStorage): { ok: boolean; error?: string } {
  const v = validatePersistedState(rawJson);
  if (!v.ok) return { ok: false, error: v.error };
  const previous = storage.getItem(STORAGE_KEY);
  try {
    storage.setItem(STORAGE_KEY, rawJson);
    if (storage.getItem(STORAGE_KEY) !== rawJson) throw new Error("verify");
  } catch {
    try {
      if (previous !== null) storage.setItem(STORAGE_KEY, previous);
    } catch {
      /* el original sigue en el respaldo */
    }
    return { ok: false, error: "No se pudo escribir el estado restaurado; se mantiene el vigente." };
  }
  if (typeof window !== "undefined" && storage === window.localStorage) {
    state = { ...initialState, hydrated: false };
    hydrate();
  }
  return { ok: true };
}

export type AssessmentResult = { ok: true; id: string } | { ok: false; error: string };

/** Antes de cada escritura B.1: respaldo creado la primera vez y verificado (sin sobrescribir) después. */
function guardB1Write(): string | undefined {
  if (typeof window === "undefined") return "Sin almacenamiento disponible.";
  try {
    // Antes de la primera escritura B.1 refresca el respaldo al estado exacto vigente;
    // después lo conserva sin sobrescribirlo (ver ensurePreB1Backup).
    backupStatus = ensurePreB1Backup(window.localStorage);
    if (!backupStatus.ok) return backupStatus.error;
    if (!verifyPreB1Backup(window.localStorage)) {
      backupStatus = { ok: false, state: "error", error: "El respaldo previo a B.1 ya no está disponible o está dañado." };
      return backupStatus.error;
    }
  } catch {
    return "No se pudo verificar el respaldo.";
  }
  return undefined;
}

export const assessmentActions = {
  /** Crea una evaluación NUEVA (nunca reemplaza otra). Opcionalmente precarga los controles turísticos equivalentes. */
  create(companyId: string, input: AssessmentInput = {}, opts: { tourismFromAuditId?: string } = {}): AssessmentResult {
    if (!state.companies.some((c) => c.id === companyId)) return { ok: false, error: "Empresa inexistente." };
    const err = guardB1Write();
    if (err) return { ok: false, error: err };
    const at = now();
    let a = dm.emptyAssessment(id(), companyId, at, input);
    if (opts.tourismFromAuditId) {
      const review = state.commercialReviews.find((r) => r.auditId === opts.tourismFromAuditId);
      const company = state.companies.find((c) => c.id === companyId)!;
      if (review && company.auditIds.includes(review.auditId))
        a = dm.importTourismEquivalences(a, structuredClone(review), TOURISM_EQUIVALENCES, at);
    }
    set((prev) => ({ ...prev, companyAssessments: [...prev.companyAssessments, a] }));
    return { ok: true, id: a.id };
  },
  updateControl(
    assessmentId: string,
    controlId: string,
    patch: Partial<Pick<AssessmentControlState, "status" | "notes" | "evidenceUrl" | "sourceKind">>,
  ): AssessmentResult {
    const cur = state.companyAssessments.find((x) => x.id === assessmentId);
    if (!cur) return { ok: false, error: "Evaluación inexistente." };
    const next = dm.updateAssessmentControl(cur, controlId, patch, now());
    if (next === cur) return { ok: false, error: "Cambio rechazado (estado inválido o «No aplica» sin justificación)." };
    const err = guardB1Write();
    if (err) return { ok: false, error: err };
    set((prev) => ({ ...prev, companyAssessments: prev.companyAssessments.map((x) => (x.id === assessmentId ? next : x)) }));
    return { ok: true, id: assessmentId };
  },
  updateMeta(assessmentId: string, patch: AssessmentMetaPatch): AssessmentResult {
    const cur = state.companyAssessments.find((x) => x.id === assessmentId);
    if (!cur) return { ok: false, error: "Evaluación inexistente." };
    const next = dm.updateAssessmentMeta(cur, patch, now());
    if (next === cur) return { ok: false, error: "Cambio rechazado (datos inválidos)." };
    const err = guardB1Write();
    if (err) return { ok: false, error: err };
    set((prev) => ({ ...prev, companyAssessments: prev.companyAssessments.map((x) => (x.id === assessmentId ? next : x)) }));
    return { ok: true, id: assessmentId };
  },
};

/** Historial de evaluaciones integrales de UNA empresa, más reciente primero. */
export function useCompanyAssessments(companyId: string) {
  return useAppState((s) =>
    s.companyAssessments
      .filter((a) => a.companyId === companyId)
      .sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate) || b.createdAt.localeCompare(a.createdAt)),
  );
}

export function useCompanyAssessment(assessmentId: string) {
  return useAppState((s) => s.companyAssessments.find((a) => a.id === assessmentId));
}

/** Solo pruebas: reinicia el estado en memoria. */
export function __resetForTests() {
  state = { ...initialState };
  backupStatus = undefined;
}

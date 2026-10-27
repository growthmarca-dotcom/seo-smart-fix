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

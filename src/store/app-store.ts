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
  settings: Settings;
}

const STORAGE_KEY = "seo-fixer:state:v1";

const initialState: AppState = {
  hydrated: false,
  audits: [],
  changes: [],
  history: [],
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

const id = () => Math.random().toString(36).slice(2, 10);
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

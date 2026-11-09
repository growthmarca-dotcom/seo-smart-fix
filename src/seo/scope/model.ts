/**
 * Etapa 2 — Lógica pura e inmutable del alcance editorial de una auditoría.
 * Ninguna función muta sus argumentos; todas devuelven objetos nuevos.
 * No toca crawler, engine ni scoring. Auditorías sin `scope` se respetan tal cual.
 */
import type { Audit, PageSnapshot } from "../types";
import {
  SCOPE_EXCLUSION_REASONS,
  type AuditScope,
  type ExcludedUrlRecord,
  type ScopeDecisionOrigin,
  type ScopeExclusionReason,
  type ScopeSelectionMode,
} from "./types";

export class ScopeError extends Error {}

const nowIso = () => new Date().toISOString();

/** Alcance inicial: todas las URLs evaluables de `audit.pages` incluidas. */
export function createInitialScope(
  pages: readonly Pick<PageSnapshot, "url">[],
  at: string = nowIso(),
): AuditScope {
  const urls = pages.map((p) => p.url);
  if (new Set(urls).size !== urls.length) throw new ScopeError("URLs evaluables duplicadas.");
  return {
    evaluableUrls: [...urls],
    includedUrls: [...urls],
    excludedUrls: [],
    selectionMode: "all",
    createdAt: at,
    updatedAt: at,
  };
}

export function excludeUrl(
  scope: AuditScope,
  url: string,
  reason: ScopeExclusionReason,
  opts: { origin?: ScopeDecisionOrigin; note?: string; at?: string; selectionMode?: ScopeSelectionMode } = {},
): AuditScope {
  assertValid(scope);
  if (!scope.evaluableUrls.includes(url)) throw new ScopeError(`URL fuera del conjunto evaluable: ${url}`);
  if (!SCOPE_EXCLUSION_REASONS.includes(reason)) throw new ScopeError(`Motivo inválido: ${reason}`);
  if (!scope.includedUrls.includes(url)) throw new ScopeError(`La URL ya está excluida: ${url}`);
  const at = opts.at ?? nowIso();
  const record: ExcludedUrlRecord = {
    url,
    reason,
    excludedAt: at,
    origin: opts.origin ?? "manual",
    ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
  };
  return {
    ...scope,
    evaluableUrls: [...scope.evaluableUrls],
    includedUrls: scope.includedUrls.filter((u) => u !== url),
    excludedUrls: [...scope.excludedUrls.map((r) => ({ ...r })), record],
    selectionMode: opts.selectionMode ?? (opts.origin === "preset" ? "preset" : "custom"),
    updatedAt: at,
  };
}

export function includeUrl(scope: AuditScope, url: string, at: string = nowIso()): AuditScope {
  assertValid(scope);
  if (!scope.evaluableUrls.includes(url)) throw new ScopeError(`URL fuera del conjunto evaluable: ${url}`);
  if (!scope.excludedUrls.some((r) => r.url === url)) throw new ScopeError(`La URL no está excluida: ${url}`);
  const excluded = scope.excludedUrls.filter((r) => r.url !== url).map((r) => ({ ...r }));
  // Conserva el orden original de evaluableUrls.
  const includedSet = new Set([...scope.includedUrls, url]);
  return {
    ...scope,
    evaluableUrls: [...scope.evaluableUrls],
    includedUrls: scope.evaluableUrls.filter((u) => includedSet.has(u)),
    excludedUrls: excluded,
    selectionMode: excluded.length === 0 ? "all" : "custom",
    updatedAt: at,
  };
}

/** Lista de errores; vacía si el alcance es consistente. */
export function validateScope(scope: unknown): string[] {
  const errors: string[] = [];
  if (!scope || typeof scope !== "object") return ["El alcance no es un objeto."];
  const s = scope as Partial<AuditScope>;
  const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
  if (!isStrArr(s.evaluableUrls)) errors.push("evaluableUrls inválido.");
  if (!isStrArr(s.includedUrls)) errors.push("includedUrls inválido.");
  if (!Array.isArray(s.excludedUrls)) errors.push("excludedUrls inválido.");
  if (typeof s.createdAt !== "string" || typeof s.updatedAt !== "string") errors.push("Fechas inválidas.");
  if (errors.length) return errors;

  const evaluable = new Set(s.evaluableUrls);
  if (evaluable.size !== s.evaluableUrls!.length) errors.push("URLs evaluables duplicadas.");
  const included = new Set(s.includedUrls);
  if (included.size !== s.includedUrls!.length) errors.push("URLs incluidas duplicadas.");
  const excludedSeen = new Set<string>();
  for (const r of s.excludedUrls as unknown[]) {
    const rec = r as Partial<ExcludedUrlRecord>;
    if (!rec || typeof rec.url !== "string") { errors.push("Registro de exclusión sin URL."); continue; }
    if (excludedSeen.has(rec.url)) errors.push(`URL excluida duplicada: ${rec.url}`);
    excludedSeen.add(rec.url);
    if (!SCOPE_EXCLUSION_REASONS.includes(rec.reason as ScopeExclusionReason)) errors.push(`Motivo inválido en ${rec.url}.`);
    if (rec.origin !== "manual" && rec.origin !== "preset") errors.push(`Origen inválido en ${rec.url}.`);
    if (typeof rec.excludedAt !== "string") errors.push(`Fecha de exclusión inválida en ${rec.url}.`);
    if (included.has(rec.url)) errors.push(`URL incluida y excluida a la vez: ${rec.url}`);
  }
  for (const u of [...included, ...excludedSeen]) {
    if (!evaluable.has(u)) errors.push(`URL fuera del conjunto evaluable: ${u}`);
  }
  for (const u of evaluable) {
    if (!included.has(u) && !excludedSeen.has(u)) errors.push(`URL evaluable sin clasificar: ${u}`);
  }
  return errors;
}

export function isScopeConsistent(scope: unknown): scope is AuditScope {
  return validateScope(scope).length === 0;
}

function assertValid(scope: AuditScope) {
  const errs = validateScope(scope);
  if (errs.length) throw new ScopeError(`Alcance inconsistente: ${errs.join(" ")}`);
}

/** Sin `scope` (auditorías históricas): devuelve las mismas páginas, sin inferir nada. */
export function pagesInScope<T extends Pick<PageSnapshot, "url">>(pages: readonly T[], scope?: AuditScope): T[] {
  if (!scope) return [...pages];
  const inc = new Set(scope.includedUrls);
  return pages.filter((p) => inc.has(p.url));
}

/**
 * Conteos separados. `crawlerDiscovered` viene del crawler y NO se mezcla con
 * las evaluables. No se calcula ningún porcentaje de cobertura.
 */
export function scopeCounts(audit: Pick<Audit, "coverage" | "pages" | "scope">) {
  return {
    crawlerDiscovered: audit.coverage?.discovered,
    crawlerTechnicalExclusions: audit.coverage?.excluded.length,
    evaluable: audit.scope ? audit.scope.evaluableUrls.length : audit.pages.length,
    included: audit.scope ? audit.scope.includedUrls.length : undefined,
    editorialExclusions: audit.scope ? audit.scope.excludedUrls.length : undefined,
    hasRecordedScope: Boolean(audit.scope),
  };
}

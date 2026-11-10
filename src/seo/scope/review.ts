/**
 * Etapa 3 — Operaciones puras del borrador de revisión de alcance.
 * Reutiliza `excludeUrl`/`includeUrl` (Etapa 2). Toda exclusión exige un motivo
 * elegido por la persona; no hay motivo por defecto.
 */
import { excludeUrl, includeUrl, ScopeError } from "./model";
import {
  SCOPE_EXCLUSION_REASONS,
  type AuditScope,
  type ScopeDecisionOrigin,
  type ScopeExclusionReason,
  type UrlClassification,
} from "./types";

export function excludeMany(
  scope: AuditScope,
  urls: readonly string[],
  reason: ScopeExclusionReason | undefined | "",
  opts: { origin: ScopeDecisionOrigin; note?: string; at?: string },
): AuditScope {
  if (!reason || !SCOPE_EXCLUSION_REASONS.includes(reason)) {
    throw new ScopeError("Elegí un motivo de exclusión.");
  }
  let next = scope;
  for (const u of urls) {
    if (!next.includedUrls.includes(u)) continue;
    next = excludeUrl(next, u, reason, opts);
  }
  return next;
}

export function includeMany(scope: AuditScope, urls: readonly string[], at?: string): AuditScope {
  let next = scope;
  for (const u of urls) {
    if (next.excludedUrls.some((r) => r.url === u)) next = includeUrl(next, u, at);
  }
  return next;
}

export type ScopeStatusFilter = "all" | "included" | "excluded";
export type ScopeSignalFilter = "any" | "orphan" | "duplicate" | "residual" | "non-indexable";

export function filterUrls(
  scope: AuditScope,
  classes: ReadonlyMap<string, UrlClassification>,
  f: { status: ScopeStatusFilter; signal: ScopeSignalFilter; query: string },
): string[] {
  const q = f.query.trim().toLowerCase();
  const inc = new Set(scope.includedUrls);
  return scope.evaluableUrls.filter((u) => {
    if (f.status === "included" && !inc.has(u)) return false;
    if (f.status === "excluded" && inc.has(u)) return false;
    if (q && !u.toLowerCase().includes(q)) return false;
    const c = classes.get(u);
    if (f.signal === "any") return true;
    if (!c) return false;
    if (f.signal === "orphan") return c.isOrphan;
    if (f.signal === "duplicate") return c.duplicates.possibleDuplicate;
    if (f.signal === "residual") return c.residual.possibleResidual;
    return c.indexability.isNonIndexable;
  });
}

/** Igualdad de contenido para detectar cambios sin guardar. */
export function sameScope(a: AuditScope | undefined, b: AuditScope | undefined): boolean {
  if (!a || !b) return a === b;
  const key = (s: AuditScope) =>
    JSON.stringify([s.includedUrls, s.excludedUrls.map((r) => [r.url, r.reason, r.origin, r.note ?? ""])]);
  return key(a) === key(b);
}

/**
 * Etapa 3 — Revisión y selección del alcance editorial.
 * El borrador vive en memoria; `audit.scope` solo se escribe tras confirmar.
 * No recalcula hallazgos ni SEO Score. Presets = sugerencias, nunca exclusiones.
 */
import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { DemoBadge, EmptyState, StatCard } from "@/components/seo-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { classifyUrls } from "@/seo/scope/classifier";
import { createInitialScope, scopeCounts } from "@/seo/scope/model";
import { SCOPE_PRESETS, suggestForPreset, type ScopePresetId } from "@/seo/scope/presets";
import {
  excludeMany,
  filterUrls,
  includeMany,
  sameScope,
  type ScopeSignalFilter,
  type ScopeStatusFilter,
} from "@/seo/scope/review";
import { SCOPE_EXCLUSION_LABELS, type AuditScope, type UrlClassification } from "@/seo/scope/types";
import { ScopeExclusionDialog } from "@/seo/scope/ui/scope-exclusion-dialog";
import { actions, useAppState } from "@/store/app-store";

export const Route = createFileRoute("/audits/$auditId/scope")({
  head: () => ({
    meta: [
      { title: "Alcance editorial de la auditoría — SEO Fixer" },
      { name: "description", content: "Revisá qué URLs evaluables quedan dentro del alcance editorial de la auditoría." },
      { property: "og:title", content: "Alcance editorial de la auditoría — SEO Fixer" },
      { property: "og:description", content: "Revisión humana del alcance: incluir o excluir URLs con motivo explícito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScopePage,
});

function ScopePage() {
  const { auditId } = Route.useParams();
  const audit = useAppState((s) => s.audits.find((a) => a.id === auditId));
  const hasGsc = useAppState((s) => (s.gsc ?? []).some((g) => g.auditId === auditId));

  const saved = audit?.scope;
  const [draft, setDraft] = useState<AuditScope | undefined>(undefined);
  useEffect(() => {
    if (audit && !draft) setDraft(saved ? structuredClone(saved) : createInitialScope(audit.pages));
  }, [audit, saved, draft]);

  const classes = useMemo(() => {
    const m = new Map<string, UrlClassification>();
    if (!audit) return m;
    for (const c of classifyUrls(audit.pages, audit.rootUrl).values()) m.set(c.url, c);
    return m;
  }, [audit]);

  const baseline = useMemo(() => (audit ? (saved ?? createInitialScope(audit.pages, draft?.createdAt)) : undefined), [audit, saved, draft?.createdAt]);
  const dirty = Boolean(draft && baseline && !sameScope(draft, baseline));

  useBlocker({
    shouldBlockFn: () => (dirty ? !window.confirm("Hay cambios sin guardar en el alcance. ¿Salir igualmente?") : false),
    enableBeforeUnload: () => dirty,
  });

  const [status, setStatus] = useState<ScopeStatusFilter>("all");
  const [signal, setSignal] = useState<ScopeSignalFilter>("any");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [presetId, setPresetId] = useState<ScopePresetId | "">("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [excluding, setExcluding] = useState<{ urls: string[]; fromPreset: boolean } | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);

  if (!audit) {
    return <EmptyState title="Auditoría no encontrada" description="La auditoría solicitada no existe o fue eliminada." />;
  }
  if (!draft) return null;

  const counts = scopeCounts(audit);
  const visible = filterUrls(draft, classes, { status, signal, query });
  const pageByUrl = new Map(audit.pages.map((p) => [p.url, p]));
  const excludedMap = new Map(draft.excludedUrls.map((r) => [r.url, r]));
  const suggestions = presetId
    ? suggestForPreset(presetId, [...classes.values()]).filter((s) => !dismissed.has(s.url))
    : [];

  const toggle = (u: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(u)) n.delete(u);
      else n.add(u);
      return n;
    });

  const doExclude = (reason: Parameters<typeof excludeMany>[2], note: string) => {
    if (!excluding) return;
    try {
      setDraft(excludeMany(draft, excluding.urls, reason, { origin: excluding.fromPreset ? "preset" : "manual", note }));
      setSelected(new Set());
      setExcluding(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const save = () => {
    const err = actions.setAuditScope(audit.id, draft);
    setConfirmSave(false);
    if (err) toast.error(err);
    else toast.success("Alcance guardado. El SEO Score y los hallazgos no se recalcularon.");
  };

  const selIncluded = [...selected].filter((u) => draft.includedUrls.includes(u));
  const selExcluded = [...selected].filter((u) => excludedMap.has(u));

  return (
    <>
      <PageHeader
        title="Alcance editorial"
        description={`${audit.name} · Revisión humana de qué URLs evaluables integran el alcance. Nada se excluye sin tu confirmación.`}
        actions={
          <div className="flex items-center gap-2">
            {audit.isDemo && <DemoBadge />}
            <Button variant="outline" asChild>
              <Link to="/audits/$auditId" params={{ auditId: audit.id }}>Volver a la auditoría</Link>
            </Button>
            <Button disabled={!dirty} onClick={() => setConfirmSave(true)}>Guardar alcance</Button>
          </div>
        }
      />

      {!saved && (
        <p className="mb-4 rounded border bg-muted/40 p-3 text-sm text-muted-foreground">
          Alcance no registrado: se conserva la evaluación original. Este borrador solo se guarda si lo confirmás.
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-5">
        <StatCard label="Descubiertas por el crawler" value={counts.crawlerDiscovered ?? "No informado"} />
        <StatCard label="Exclusiones técnicas del crawler" value={counts.crawlerTechnicalExclusions ?? "No informado"} />
        <StatCard label="Evaluables" value={draft.evaluableUrls.length} />
        <StatCard label="Incluidas (borrador)" value={draft.includedUrls.length} />
        <StatCard label="Excluidas editorialmente (borrador)" value={draft.excludedUrls.length} />
      </div>

      <section className="mb-6 rounded-lg border p-4">
        <h2 className="mb-1 font-semibold">Presets orientativos</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Un preset solo sugiere URLs para revisar. Ninguna URL se excluye automáticamente.
          {!hasGsc && " Datos de tráfico orgánico no disponibles: las sugerencias usan solo señales estructurales."}
        </p>
        <Select value={presetId} onValueChange={(v) => { setPresetId(v as ScopePresetId); setDismissed(new Set()); }}>
          <SelectTrigger className="w-64" aria-label="Preset orientativo"><SelectValue placeholder="Elegí un preset" /></SelectTrigger>
          <SelectContent>
            {SCOPE_PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {presetId && (
          <>
            <p className="mt-2 text-xs text-muted-foreground">{SCOPE_PRESETS.find((p) => p.id === presetId)?.description}</p>
            {suggestions.length === 0 ? (
              <p className="mt-3 text-sm">Sin sugerencias para este preset.</p>
            ) : (
              <ul className="mt-3 divide-y rounded border">
                {suggestions.map((s) => {
                  const isExcluded = excludedMap.has(s.url);
                  return (
                    <li key={s.url} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                      <Badge variant={s.suggestedAction === "priority_include" ? "secondary" : "outline"}>
                        {s.suggestedAction === "priority_include" ? "Conservar (prioritaria)" : "Revisar"}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate">{pageByUrl.get(s.url)?.title || s.url}<span className="block truncate text-xs text-muted-foreground">{s.url} · {s.heuristicReason}</span></span>
                      {s.suggestedAction === "review_for_exclusion" && !isExcluded && (
                        <Button size="sm" variant="outline" onClick={() => setExcluding({ urls: [s.url], fromPreset: true })}>Revisar y excluir</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDismissed((d) => new Set(d).add(s.url))}>Conservar incluida</Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input className="w-64" placeholder="Buscar URL" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={status} onValueChange={(v) => setStatus(v as ScopeStatusFilter)}>
          <SelectTrigger className="w-44" aria-label="Estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="included">Incluidas</SelectItem>
            <SelectItem value="excluded">Excluidas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={signal} onValueChange={(v) => setSignal(v as ScopeSignalFilter)}>
          <SelectTrigger className="w-52" aria-label="Indicio"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Cualquier indicio</SelectItem>
            <SelectItem value="orphan">Sin enlaces entrantes</SelectItem>
            <SelectItem value="duplicate">Posible duplicado</SelectItem>
            <SelectItem value="residual">Posible residual</SelectItem>
            <SelectItem value="non-indexable">No indexable</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">{selected.size} seleccionadas</span>
        <Button size="sm" variant="outline" disabled={!selIncluded.length} onClick={() => setExcluding({ urls: selIncluded, fromPreset: false })}>Excluir seleccionadas</Button>
        <Button size="sm" variant="outline" disabled={!selExcluded.length} onClick={() => { setDraft(includeMany(draft, selExcluded)); setSelected(new Set()); }}>Incluir seleccionadas</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-2">
                <Checkbox
                  aria-label="Seleccionar visibles"
                  checked={visible.length > 0 && visible.every((u) => selected.has(u))}
                  onCheckedChange={(c) => setSelected(c ? new Set(visible) : new Set())}
                />
              </th>
              <th className="p-2">URL</th>
              <th className="p-2">Entrantes</th>
              <th className="p-2">Profundidad</th>
              <th className="p-2">Indicios</th>
              <th className="p-2">Estado</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => {
              const c = classes.get(u);
              const p = pageByUrl.get(u);
              const ex = excludedMap.get(u);
              return (
                <tr key={u} className="border-t align-top">
                  <td className="p-2"><Checkbox aria-label={`Seleccionar ${u}`} checked={selected.has(u)} onCheckedChange={() => toggle(u)} /></td>
                  <td className="max-w-md p-2">
                    <div className="truncate font-medium">{p?.title || "Sin título"}</div>
                    <div className="truncate text-xs text-muted-foreground">{u}</div>
                  </td>
                  <td className="p-2">{c?.inboundLinksCount ?? "—"}</td>
                  <td className="p-2">{p?.depth ?? "—"}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {c?.isOrphan && <Badge variant="outline">Sin entrantes</Badge>}
                      {c?.duplicates.possibleDuplicate && <Badge variant="outline">Posible duplicado</Badge>}
                      {c?.residual.possibleResidual && <Badge variant="outline">Posible residual</Badge>}
                      {c?.indexability.isNonIndexable && <Badge variant="outline">No indexable</Badge>}
                    </div>
                  </td>
                  <td className="p-2">
                    {ex ? (
                      <div>
                        <Badge variant="secondary">Excluida</Badge>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {SCOPE_EXCLUSION_LABELS[ex.reason]} · sugerencia {ex.origin === "preset" ? "de preset" : "manual"}, confirmada por vos
                          {ex.note ? ` · ${ex.note}` : ""}
                        </div>
                      </div>
                    ) : (
                      <Badge>Incluida</Badge>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {ex ? (
                      <Button size="sm" variant="ghost" onClick={() => setDraft(includeMany(draft, [u]))}>Incluir</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setExcluding({ urls: [u], fromPreset: false })}>Excluir</Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Sin URLs para estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ScopeExclusionDialog
        open={Boolean(excluding)}
        urls={excluding?.urls ?? []}
        fromPreset={excluding?.fromPreset ?? false}
        onCancel={() => setExcluding(null)}
        onConfirm={doExclude}
      />

      <AlertDialog open={confirmSave} onOpenChange={setConfirmSave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar el alcance editorial?</AlertDialogTitle>
            <AlertDialogDescription>
              Quedarán {draft.includedUrls.length} URLs incluidas y {draft.excludedUrls.length} excluidas. Solo se guarda el alcance:
              no se recalculan hallazgos ni el SEO Score, y la auditoría original no se modifica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={save}>Guardar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

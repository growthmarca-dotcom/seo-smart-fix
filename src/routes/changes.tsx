import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Download, Rocket, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { CategoryBadge, EmptyState, SeverityBadge } from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getConnector } from "@/seo/connectors";
import { exportChanges } from "@/seo/suggestions";
import { actions, useAppState } from "@/store/app-store";
import type { ChangeStatus } from "@/seo/types";

export const Route = createFileRoute("/changes")({
  head: () => ({
    meta: [
      { title: "Sugerencias y cambios — SEO Fixer" },
      {
        name: "description",
        content: "Revisá, editá, aprobá o rechazá cada sugerencia SEO antes de aplicarla.",
      },
      { property: "og:title", content: "Sugerencias y cambios — SEO Fixer" },
      { property: "og:description", content: "Flujo de aprobación de cambios SEO." },
    ],
  }),
  component: Changes,
});

const STATUS_LABELS: Record<ChangeStatus, string> = {
  pending: "Pendientes",
  approved: "Aprobados",
  rejected: "Rechazados",
  applied: "Aplicados",
};

function Changes() {
  const changes = useAppState((s) => s.changes);
  const audits = useAppState((s) => s.audits);
  const [tab, setTab] = useState<ChangeStatus>("pending");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const rows = useMemo(
    () =>
      changes
        .filter((c) => c.status === tab)
        .filter((c) =>
          query.trim()
            ? `${c.pageUrl} ${c.field} ${c.suggestedValue}`.toLowerCase().includes(query.toLowerCase())
            : true,
        ),
    [changes, tab, query],
  );

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  function download() {
    const approved = changes.filter((c) => c.status === "approved");
    const blob = new Blob([exportChanges(approved)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seo-fixer-cambios-aprobados.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Sugerencias y cambios"
        description="Actual → Problema → Sugerencia → Aprobar/Rechazar → Aplicar. Los conectores de solo lectura exportan instrucciones en lugar de escribir."
        actions={
          <>
            <Button variant="outline" onClick={download}>
              <Download className="mr-1 size-4" /> Exportar aprobados
            </Button>
            <Button
              disabled={selected.length === 0}
              onClick={() => {
                const writables = selected.filter(
                  (id) => changes.find((c) => c.id === id)?.writable,
                );
                if (writables.length === 0) {
                  toast.error(
                    "Ningún conector autorizado permite escribir estos campos todavía. Exportá las instrucciones.",
                  );
                  return;
                }
                actions.bulkSetStatus(writables, "applied");
                setSelected([]);
                toast.success(`${writables.length} cambio(s) marcado(s) como aplicado(s)`);
              }}
            >
              <Rocket className="mr-1 size-4" /> Aplicar seleccionados
            </Button>
          </>
        }
      />

      <div className="panel mb-4 flex flex-wrap items-center gap-3 p-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as ChangeStatus)}>
          <TabsList>
            {(Object.keys(STATUS_LABELS) as ChangeStatus[]).map((s) => (
              <TabsTrigger key={s} value={s}>
                {STATUS_LABELS[s]} ({changes.filter((c) => c.status === s).length})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          className="max-w-xs"
          placeholder="Buscar URL o campo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nada por aquí"
          description="No hay cambios en este estado. Ejecutá una auditoría o revisá otro estado."
          action={
            <Button asChild>
              <Link to="/audits/new">Nueva auditoría</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const audit = audits.find((a) => a.id === c.auditId);
            return (
              <article key={c.id} className="panel p-4">
                <header className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selected.includes(c.id)}
                    onChange={() => toggle(c.id)}
                    aria-label="Seleccionar cambio"
                  />
                  <SeverityBadge severity={c.severity} />
                  <CategoryBadge category={c.category} />
                  <span className="font-mono text-xs text-muted-foreground">{c.field}</span>
                  <Link
                    to="/audits/$auditId/url/$pageId"
                    params={{ auditId: c.auditId, pageId: c.pageId }}
                    className="truncate text-sm font-medium hover:text-primary"
                  >
                    {c.pageUrl}
                  </Link>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {getConnector(audit?.platform ?? "generic-web")?.name} ·{" "}
                    {c.writable ? "escritura disponible" : "solo lectura"}
                  </span>
                </header>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/50 p-3">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">Actual</p>
                    <p className="mt-1 break-words text-sm">{c.currentValue}</p>
                  </div>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <p className="text-[11px] font-semibold uppercase text-primary">Sugerido</p>
                    <p className="mt-1 break-words text-sm">{c.editedValue ?? c.suggestedValue}</p>
                  </div>
                </div>

                <footer className="mt-3 flex flex-wrap justify-end gap-2">
                  {c.status !== "approved" && (
                    <Button size="sm" onClick={() => actions.setChangeStatus(c.id, "approved")}>
                      <Check className="mr-1 size-3.5" /> Aprobar
                    </Button>
                  )}
                  {c.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => actions.setChangeStatus(c.id, "rejected")}
                    >
                      <X className="mr-1 size-3.5" /> Rechazar
                    </Button>
                  )}
                  {c.status === "approved" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        c.writable
                          ? actions.setChangeStatus(c.id, "applied")
                          : toast.error(
                              "El conector actual no permite escribir este campo. Exportá la instrucción.",
                            )
                      }
                    >
                      <Rocket className="mr-1 size-3.5" /> Aplicar
                    </Button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

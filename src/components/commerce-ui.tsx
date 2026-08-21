/**
 * FASE 7B — UI de conexión de tienda y trazabilidad de fuentes de datos.
 * Solo lectura: ningún control de este archivo modifica la tienda.
 */
import { AlertTriangle, CheckCircle2, Clock, Database, KeyRound, Loader2 } from "lucide-react";
import {
  MATCH_METHOD_LABELS,
  MATCH_STATE_LABELS,
  STORE_STATUS_LABELS,
  type CommerceMatch,
  type MatchSummary,
  type StoreConnection,
  type StoreConnectionStatus,
  type StoreImportCounts,
} from "@/seo/commerce/types";
import { Stat } from "@/components/link-graph-ui";

const STATUS_STYLES: Record<
  StoreConnectionStatus,
  { className: string; Icon: typeof CheckCircle2 }
> = {
  disconnected: { className: "bg-muted text-muted-foreground border-border", Icon: Clock },
  connecting: { className: "bg-muted text-muted-foreground border-border", Icon: Loader2 },
  connected: { className: "bg-okay-soft text-okay border-okay/30", Icon: CheckCircle2 },
  syncing: { className: "bg-muted text-muted-foreground border-border", Icon: Loader2 },
  synced: { className: "bg-okay-soft text-okay border-okay/30", Icon: CheckCircle2 },
  error: { className: "bg-critical-soft text-critical border-critical/30", Icon: AlertTriangle },
  "auth-required": {
    className: "bg-important-soft text-important-foreground border-important/40",
    Icon: KeyRound,
  },
  "no-data": { className: "bg-muted text-muted-foreground border-border", Icon: Database },
};

export function StoreStatusPill({ status }: { status: StoreConnectionStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.className}`}
    >
      <style.Icon className="size-3" />
      {STORE_STATUS_LABELS[status]}
    </span>
  );
}

export function StoreSummary({
  connection,
  counts,
  syncVersion,
}: {
  connection: StoreConnection;
  counts: StoreImportCounts;
  syncVersion?: number | undefined;
}) {
  return (
    <div className="mt-3 space-y-3">
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Tienda</dt>
          <dd className="font-medium">{connection.name ?? connection.storeId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dominio</dt>
          <dd className="font-mono text-[11px]">{connection.domain ?? "No informado por la API"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Store ID</dt>
          <dd className="font-mono text-[11px]">{connection.storeId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Última sincronización</dt>
          <dd>
            {connection.lastSyncAt
              ? new Date(connection.lastSyncAt).toLocaleString("es-AR")
              : "Sin sincronizar"}
            {syncVersion ? ` · sync #${syncVersion}` : ""}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Productos" value={counts.products} />
        <Stat label="Categorías" value={counts.categories} />
        <Stat label="Variantes" value={counts.variants} />
        <Stat label="Imágenes" value={counts.images} />
        <Stat label="Publicados" value={counts.publishedProducts} />
        <Stat label="Ya no disponibles" value={counts.unavailableProducts} />
        <Stat label="Sin categoría" value={counts.productsWithoutCategory} />
        <Stat label="Imágenes sin ALT" value={counts.imagesWithoutAlt} />
      </div>

      {connection.apiErrors.length ? (
        <ul className="space-y-1 rounded-lg border border-critical/30 bg-critical-soft/40 p-3 text-[11px]">
          {connection.apiErrors.map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <span className="font-semibold">{e.scope}</span>: {e.message}
              {e.status ? ` [${e.status}]` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function MatchSummaryPanel({ summary }: { summary: MatchSummary }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="Tienda + crawler" value={summary.matched} />
      <Stat label="Solo tienda" value={summary.storeOnly} />
      <Stat label="Solo crawler" value={summary.crawlerOnly} />
      <Stat label="Inciertas" value={summary.uncertain} />
    </div>
  );
}

export function MatchTable({ matches }: { matches: CommerceMatch[] }) {
  if (matches.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin entidades para comparar en esta auditoría.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-[11px] uppercase text-muted-foreground">
          <tr>
            <th className="pb-2 pr-3">Entidad</th>
            <th className="pb-2 pr-3">Nombre</th>
            <th className="pb-2 pr-3">URL</th>
            <th className="pb-2 pr-3">Estado</th>
            <th className="pb-2">Método</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m, i) => (
            <tr key={`${m.entity}-${m.externalId}-${m.pageId ?? i}`} className="border-t border-border/60">
              <td className="py-2 pr-3">{m.entity === "product" ? "Producto" : "Categoría"}</td>
              <td className="py-2 pr-3">{m.name ?? "—"}</td>
              <td className="max-w-[280px] truncate py-2 pr-3 font-mono text-[11px]">
                {m.storeUrl ?? m.pageUrl ?? "Sin URL"}
              </td>
              <td className="py-2 pr-3">
                <span title={m.detail}>{MATCH_STATE_LABELS[m.state]}</span>
              </td>
              <td className="py-2">{MATCH_METHOD_LABELS[m.method]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

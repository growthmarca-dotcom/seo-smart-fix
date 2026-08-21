import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatchSummaryPanel, StoreStatusPill, StoreSummary } from "@/components/commerce-ui";
import { tiendanubeImportFn, tiendanubeStatusFn } from "@/lib/tiendanube.functions";
import { CONNECTORS } from "@/seo/connectors";
import { INTEGRATIONS } from "@/seo/integrations";
import {
  countImport,
  matchStoreWithCrawler,
  summarizeMatches,
  type CommerceSource,
  type StoreConnection,
} from "@/seo/commerce";
import {
  buildDemoStoreConnection,
  buildDemoStoreImport,
  DEMO_STORE_ID,
  DEMO_STORE_NAME,
} from "@/seo/tiendanube/demo";
import { actions, useAppState, useStoreConnections, useStoreImport } from "@/store/app-store";
import type { PlatformConnector } from "@/seo/connectors";


export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: "Integraciones y conectores — SEO Fixer" },
      {
        name: "description",
        content:
          "Conectores de plataforma (Web genérica, Tienda Nube, Mercado Libre) e integraciones de Google preparadas.",
      },
      { property: "og:title", content: "Integraciones y conectores — SEO Fixer" },
      {
        property: "og:description",
        content: "Estado de cada conector y campos que puede leer o modificar.",
      },
    ],
  }),
  component: Integrations,
});

function Integrations() {
  return (
    <>
      <PageHeader
        title="Integraciones y conectores"
        description="Cada plataforma es un módulo independiente que alimenta al mismo motor SEO. Los conectores declaran qué campos pueden leer y cuáles pueden modificar."
      />

      <h2 className="mb-3 font-display text-lg font-semibold">Conectores de plataforma</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {CONNECTORS.map((c) => (
          <ConnectorCard key={c.id} connector={c} />
        ))}
        <div className="panel border-dashed p-5">
          <h3 className="font-display text-base font-semibold text-muted-foreground">
            Próximos conectores
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            WordPress / WooCommerce y Shopify se agregan implementando la misma interfaz
            <span className="font-mono text-xs"> PlatformConnector</span>, sin tocar el núcleo.
          </p>
        </div>
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Tienda Nube (Fase 7B)</h2>
      <TiendanubePanel />

      <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Integraciones de datos</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {INTEGRATIONS.map((i) => (
          <div key={i.id} className="panel p-5">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold">{i.name}</h3>
              <StatusPill status={i.status} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{i.description}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {i.provides.map((p) => (
                <li
                  key={p}
                  className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

function StatusPill({ status }: { status: "available" | "planned" | "needs-credentials" }) {
  const map = {
    available: { label: "Activo", className: "bg-okay-soft text-okay border-okay/30", Icon: CheckCircle2 },
    "needs-credentials": {
      label: "Requiere credenciales",
      className: "bg-important-soft text-important-foreground border-important/40",
      Icon: KeyRound,
    },
    planned: {
      label: "Planificado",
      className: "bg-muted text-muted-foreground border-border",
      Icon: Clock,
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${map.className}`}
    >
      <map.Icon className="size-3" />
      {map.label}
    </span>
  );
}

function ConnectorCard({ connector }: { connector: PlatformConnector }) {
  return (
    <div className="panel flex flex-col p-5">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-base font-semibold">{connector.name}</h3>
        <StatusPill status={connector.status} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{connector.description}</p>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Campos declarados
        </p>
        <ul className="mt-2 space-y-1 text-xs">
          {connector.capabilities.map((cap) => (
            <li key={cap.field} className="flex items-center justify-between gap-2">
              <span className="truncate">{cap.label}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {cap.read ? "lee" : "—"} / {cap.write ? "escribe" : "no escribe"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {connector.status === "needs-credentials" ? (
        <div className="mt-4 space-y-2 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            Autenticación prevista: {connector.authModel.toUpperCase()}. La conexión real se habilita
            cuando estén disponibles las credenciales y la autorización de la plataforma.
          </p>
          <div className="grid gap-1.5">
            <Label className="text-xs" htmlFor={`store-${connector.id}`}>
              Tienda / cuenta a auditar
            </Label>
            <Input id={`store-${connector.id}`} placeholder="Identificador de la tienda" disabled />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast.info(
                `${connector.name}: pendiente de credenciales. La arquitectura del conector ya está lista.`,
              )
            }
          >
            Conectar
          </Button>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-okay/30 bg-okay-soft/50 p-3 text-xs">
          Listo para auditar cualquier sitio público desde “Nueva auditoría”.
        </p>
      )}
    </div>
  );
}

/**
 * FASE 7B — Panel Tienda Nube (SOLO LECTURA).
 * Importa productos/categorías/variantes hacia una auditoría existente.
 * Ningún control de este panel escribe en la tienda.
 */
function TiendanubePanel() {
  const audits = useAppState((s) => s.audits);
  const connections = useStoreConnections();
  const [auditId, setAuditId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<{
    configured: boolean;
    appConfigured: boolean;
    authorizeUrl: string | null;
    missing: string[];
  } | null>(null);

  useEffect(() => {
    void tiendanubeStatusFn().then(setConfig);
  }, []);

  const selectedAuditId = auditId || audits[0]?.id || "";
  const audit = audits.find((a) => a.id === selectedAuditId);
  const liveConnection = connections.find((c) => c.source === "tiendanube");
  const demoConnection = connections.find((c) => c.source === "demo");
  const activeSource: CommerceSource = liveConnection ? "tiendanube" : "demo";
  const connection: StoreConnection | undefined = liveConnection ?? demoConnection;
  const imported = useStoreImport(selectedAuditId, connection?.storeId);
  const counts = countImport(imported);

  const matches = useMemo(() => {
    if (!audit || !imported) return [];
    return matchStoreWithCrawler({
      audit,
      storeId: imported.storeId,
      products: imported.products,
      categories: imported.categories,
    });
  }, [audit, imported]);

  async function syncLive() {
    if (!audit) {
      toast.error("Primero elegí una auditoría para asociar la tienda.");
      return;
    }
    setBusy(true);
    try {
      const res = await tiendanubeImportFn({
        data: {
          auditId: audit.id,
          ...(imported?.syncedAt ? { updatedSince: imported.syncedAt } : {}),
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      actions.setStoreConnection({
        source: "tiendanube",
        storeId: res.storeId,
        name: res.storeName,
        domain: res.domain,
        status: "connected",
        connectedAt: new Date().toISOString(),
        apiErrors: res.errors.map((e) => ({
          at: new Date().toISOString(),
          scope: e.scope,
          message: e.message,
          status: e.status,
        })),
        auditIds: [audit.id],
      });
      actions.importStoreData({
        auditId: audit.id,
        storeId: res.storeId,
        source: "tiendanube",
        products: res.products,
        categories: res.categories,
        apiPages: res.apiPages,
        errors: res.errors.map((e) => ({
          at: new Date().toISOString(),
          scope: e.scope,
          message: e.message,
          status: e.status,
        })),
      });
      toast.success(
        `${res.products.length} productos y ${res.categories.length} categorías importados en modo lectura.`,
      );
    } finally {
      setBusy(false);
    }
  }

  function syncDemo() {
    if (!audit) {
      toast.error("Primero elegí una auditoría para asociar la tienda demo.");
      return;
    }
    const data = buildDemoStoreImport(audit.id);
    actions.setStoreConnection(buildDemoStoreConnection(audit.id));
    actions.importStoreData({
      auditId: audit.id,
      storeId: DEMO_STORE_ID,
      source: "demo",
      products: data.products,
      categories: data.categories,
    });
    toast.info(`${DEMO_STORE_NAME}: datos demo importados (identificados como demo, no reales).`);
  }

  const status = busy
    ? "syncing"
    : (connection?.status ?? (config?.configured ? "connected" : "auth-required"));

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-semibold">Tienda Nube</h3>
        <StoreStatusPill status={status} />
        {connection?.source === "demo" ? (
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold">
            Datos demo
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Importación en <strong>modo lectura</strong> de productos, categorías, variantes e imágenes.
        No se edita ni publica nada en la tienda: la escritura pertenece a una fase posterior.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Auditoría asociada</Label>
          <Select value={selectedAuditId} onValueChange={setAuditId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Elegí una auditoría" />
            </SelectTrigger>
            <SelectContent>
              {audits.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button size="sm" disabled={busy || !audit} onClick={() => void syncLive()}>
            <RefreshCw className={`mr-1 size-3.5 ${busy ? "animate-spin" : ""}`} />
            Sincronizar tienda real
          </Button>
          <Button size="sm" variant="outline" disabled={!audit} onClick={syncDemo}>
            Cargar tienda demo
          </Button>
        </div>
      </div>

      {config && !config.configured ? (
        <div className="mt-4 rounded-lg border border-important/40 bg-important-soft/50 p-3 text-xs">
          <p className="font-semibold">Autorización de Tienda Nube pendiente</p>
          <p className="mt-1">
            La conexión real usa OAuth 2.0 de Tienda Nube (el comercio autoriza la aplicación; nunca
            se pide la contraseña de la tienda). Falta configurar en el entorno del servidor:{" "}
            <span className="font-mono">{config.missing.join(", ") || "—"}</span>. Los tokens se leen
            solo en el servidor y no se muestran nunca en la interfaz.
          </p>
        </div>
      ) : null}

      {connection && imported ? (
        <>
          <StoreSummary
            connection={connection}
            counts={counts}
            syncVersion={imported.syncVersion}
          />
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Correspondencia con el crawler
            </p>
            <div className="mt-2">
              <MatchSummaryPanel summary={summarizeMatches(matches)} />
            </div>
          </div>
          {audit ? (
            <Button asChild size="sm" variant="outline" className="mt-4">
              <Link to="/audits/$auditId/ecommerce" params={{ auditId: audit.id }}>
                Ver análisis SEO E-commerce
              </Link>
            </Button>
          ) : null}
        </>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Sin datos importados para esta auditoría. Cada importación queda aislada por
          <span className="font-mono"> auditId</span> +<span className="font-mono"> storeId</span>:
          los datos de una tienda nunca aparecen en otra auditoría. Fuente activa:{" "}
          {activeSource === "tiendanube" ? "API real" : "demo"}.
        </p>
      )}
    </div>
  );
}

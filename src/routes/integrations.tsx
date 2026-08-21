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

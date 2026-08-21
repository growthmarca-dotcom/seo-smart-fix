/**
 * FASE 7A — Vista "SEO E-commerce".
 * Capa derivada de UNA auditoría: no rastrea, no ejecuta reglas generales y no
 * modifica hallazgos, score, GSC, arquitectura ni contenido.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { DemoBadge, EmptyState, StatCard } from "@/components/seo-ui";
import { Stat } from "@/components/link-graph-ui";
import {
  CategoryRow,
  DetectionPanel,
  EcommerceFindingCard,
  EcommerceTypeBadge,
  ProductRow,
} from "@/components/ecommerce-ui";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  analyzeEcommerce,
  ECOMMERCE_CLASS_LABELS,
  ECOMMERCE_TYPE_LABELS,
  type EcommerceClass,
  type EcommerceType,
} from "@/seo/ecommerce";
import {
  countImport,
  matchStoreWithCrawler,
  summarizeMatches,
  withStoreData,
} from "@/seo/commerce";
import { MatchSummaryPanel, MatchTable, StoreStatusPill } from "@/components/commerce-ui";
import { SEVERITY_LABELS } from "@/seo/rules";
import { useAppState, useStoreConnections, useStoreImport } from "@/store/app-store";
import type { Severity } from "@/seo/types";


export const Route = createFileRoute("/audits/$auditId/ecommerce")({
  head: () => ({
    meta: [
      { title: "SEO E-commerce — SEO Fixer" },
      {
        name: "description",
        content:
          "Auditoría SEO de tiendas online agnóstica de plataforma: productos, categorías, variantes, facetas, paginación y datos estructurados Product/Offer.",
      },
      { property: "og:title", content: "SEO E-commerce — SEO Fixer" },
      {
        property: "og:description",
        content:
          "Detección de estructura e-commerce, entidades de producto y categoría y señales SEO específicas, sin alterar el SEO Score.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EcommerceView,
});

const FILTER_TYPES: EcommerceType[] = [
  "product",
  "product-variant",
  "category",
  "subcategory",
  "collection",
  "faceted",
  "pagination",
];

function EcommerceView() {
  const { auditId } = Route.useParams();
  const audit = useAppState((s) => s.audits.find((a) => a.id === auditId));
  const [query, setQuery] = useState("");
  const [type, setType] = useState<EcommerceType | "all">("all");
  const [klass, setKlass] = useState<EcommerceClass | "all">("all");
  const [severity, setSeverity] = useState<Severity | "all">("all");

  // FASE 7B — datos de tienda importados para ESTA auditoría (aislamiento estricto).
  const connections = useStoreConnections();
  const storeImport = useStoreImport(auditId);
  const connection = connections.find((c) => c.storeId === storeImport?.storeId);

  const matches = useMemo(() => {
    if (!audit || !storeImport) return [];
    return matchStoreWithCrawler({
      audit,
      storeId: storeImport.storeId,
      products: storeImport.products,
      categories: storeImport.categories,
    });
  }, [audit, storeImport]);

  const augmentation = useMemo(() => {
    if (!audit || !storeImport) return null;
    return withStoreData({
      audit,
      products: storeImport.products,
      categories: storeImport.categories,
      matches,
    });
  }, [audit, storeImport, matches]);

  const effectiveAudit = augmentation?.audit ?? audit;
  const analysis = useMemo(
    () => (effectiveAudit ? analyzeEcommerce(effectiveAudit) : null),
    [effectiveAudit],
  );


  if (!audit || !analysis) {
    return (
      <EmptyState
        title="Auditoría no encontrada"
        description="La auditoría solicitada no existe o fue eliminada."
      />
    );
  }

  const { detection, stats } = analysis;

  if (!detection.isEcommerce) {
    return (
      <>
        <PageHeader
          title="SEO E-commerce"
          description={`No se detectó una estructura de comercio electrónico suficiente en ${audit.name}. El resto de la auditoría no se modifica.`}
        />
        <div className="mt-4">
          <DetectionPanel detection={detection} />
        </div>
      </>
    );
  }

  const findings = analysis.findings.filter((f) => {
    if (type !== "all" && f.ecommerceType !== type) return false;
    if (klass !== "all" && f.classification !== klass) return false;
    if (severity !== "all" && f.severity !== severity) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        f.pageUrl.toLowerCase().includes(q) ||
        f.pagePath.toLowerCase().includes(q) ||
        f.signalName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="SEO E-commerce"
        description={`Capa e-commerce derivada de ${audit.name}: interpreta las páginas ya rastreadas como productos, categorías, variantes, facetas y paginación. Es descriptiva y no modifica el SEO Score.`}
        actions={audit.isDemo ? <DemoBadge /> : null}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Productos detectados" value={stats.products} />
        <StatCard label="Categorías y subcategorías" value={stats.categories + stats.subcategories} />
        <StatCard label="Problemas e-commerce" value={stats.problems} />
        <StatCard label="Señales para revisar" value={stats.reviews} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DetectionPanel detection={detection} />

        <section className="panel p-4">
          <h2 className="font-display text-base font-semibold">Estructura detectada</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Recuento descriptivo por tipo de entidad e-commerce. No es un score.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Productos" value={stats.products} />
            <Stat label="Variantes" value={stats.variants} />
            <Stat label="Categorías" value={stats.categories} />
            <Stat label="Subcategorías" value={stats.subcategories} />
            <Stat label="Colecciones" value={stats.collections} />
            <Stat label="Facetas" value={stats.facets} />
            <Stat label="Paginación" value={stats.paginated} />
            <Stat label="Carrito / checkout" value={stats.cartCheckout} />
            <Stat label="Product schema" value={`${stats.productsWithSchema}/${stats.products}`} />
            <Stat label="Sin enlaces entrantes" value={stats.productsWithoutInbound} />
            <Stat label="Sin categoría" value={stats.productsWithoutCategory} />
            <Stat label="Categorías sin productos" value={stats.categoriesWithoutProducts} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Datos disponibles en esta auditoría: precio{" "}
            {analysis.capabilities.connectorPricing ? "sí" : "no"} · disponibilidad{" "}
            {analysis.capabilities.connectorAvailability ? "sí" : "no"} · datos estructurados{" "}
            {analysis.capabilities.schemaTypes ? "sí" : "no"}. Las señales que dependen de datos
            ausentes no se evalúan.
          </p>
        </section>
      </div>

      <section className="panel mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Productos detectados</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3">Producto</th>
                <th className="pb-2 pr-3">Tipo</th>
                <th className="pb-2 pr-3">Schema</th>
                <th className="pb-2 pr-3">Precio</th>
                <th className="pb-2 pr-3">Disponibilidad</th>
                <th className="pb-2 pr-3">Entrantes</th>
                <th className="pb-2 pr-3">Prof.</th>
                <th className="pb-2">Jerarquía</th>
              </tr>
            </thead>
            <tbody>
              {analysis.products.map((p) => (
                <ProductRow key={p.pageId} product={p} auditId={audit.id} />
              ))}
            </tbody>
          </table>
          {analysis.products.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin productos detectados.</p>
          ) : null}
        </div>
      </section>

      <section className="panel mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Categorías detectadas</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3">Categoría</th>
                <th className="pb-2 pr-3">Tipo</th>
                <th className="pb-2 pr-3">Productos enlazados</th>
                <th className="pb-2 pr-3">Palabras / umbral</th>
                <th className="pb-2 pr-3">Entrantes</th>
                <th className="pb-2 pr-3">Prof.</th>
                <th className="pb-2">Indexabilidad</th>
              </tr>
            </thead>
            <tbody>
              {analysis.categories.map((c) => (
                <CategoryRow key={c.pageId} category={c} auditId={audit.id} />
              ))}
            </tbody>
          </table>
          {analysis.categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin categorías detectadas.</p>
          ) : null}
        </div>
      </section>

      {analysis.variants.length > 0 || analysis.facets.length > 0 || analysis.pagination.length > 0 ? (
        <section className="panel mt-4 grid gap-4 p-4 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold">Variantes</h3>
            {analysis.variants.map((g) => (
              <p key={g.mainUrl ?? g.variantUrls[0]} className="mt-2 text-xs text-muted-foreground">
                {g.mainUrl ? `Principal: ${g.mainUrl}` : "Sin producto principal detectado"} ·{" "}
                {g.variantUrls.length} variante(s) · canonical: {g.canonicalCoverage} ·{" "}
                {g.duplicateContent ? "contenido casi idéntico" : "contenido diferenciado"}
              </p>
            ))}
            {analysis.variants.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Sin señales de variantes.</p>
            ) : null}
          </div>
          <div>
            <h3 className="text-sm font-semibold">Filtros y facetas</h3>
            {analysis.facets.map((f) => (
              <p key={f.baseUrl} className="mt-2 text-xs text-muted-foreground">
                {f.baseUrl} · {f.urls.length} URL(s) · parámetros: {f.parameters.join(", ") || "—"} ·{" "}
                {f.indexableCount} indexable(s)
              </p>
            ))}
            {analysis.facets.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Sin URLs de faceta detectadas.</p>
            ) : null}
          </div>
          <div>
            <h3 className="text-sm font-semibold">Paginación</h3>
            {analysis.pagination.map((p) => (
              <p key={p.baseUrl} className="mt-2 text-xs text-muted-foreground">
                {p.baseUrl} · hasta página {p.maxPage} · {p.indexableCount} indexable(s) ·{" "}
                {p.canonicalToFirst} con canonical al listado base
              </p>
            ))}
            {analysis.pagination.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Sin paginación detectada.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel mt-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-base font-semibold">Problemas y oportunidades e-commerce</h2>
          <span className="text-xs text-muted-foreground">
            {findings.length} de {analysis.findings.length}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Buscar por URL o señal"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select value={type} onValueChange={(v) => setType(v as EcommerceType | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo e-commerce" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {FILTER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {ECOMMERCE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={klass} onValueChange={(v) => setKlass(v as EcommerceClass | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Clasificación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las clasificaciones</SelectItem>
              {(Object.keys(ECOMMERCE_CLASS_LABELS) as EcommerceClass[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {ECOMMERCE_CLASS_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={(v) => setSeverity(v as Severity | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Severidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las severidades</SelectItem>
              {(["critical", "important", "improvement"] as Severity[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 space-y-2">
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguna señal e-commerce coincide con los filtros aplicados.
            </p>
          ) : (
            findings.map((f) => (
              <EcommerceFindingCard key={f.id} finding={f} auditId={audit.id} />
            ))
          )}
        </div>
      </section>

      <section className="panel mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Clasificación por URL</h2>
        <div className="mt-3 space-y-1">
          {analysis.pages.map((p) => (
            <div key={p.pageId} className="flex flex-wrap items-center gap-2 text-xs">
              <EcommerceTypeBadge type={p.ecommerceType} />
              <span className="truncate text-muted-foreground">{p.path}</span>
              <span className="text-[11px] text-muted-foreground">
                {p.detectedSignals.join(" · ") || "sin señales específicas"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

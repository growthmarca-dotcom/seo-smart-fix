/**
 * FASE 7A — UI de la capa e-commerce (solo presentación de datos derivados).
 */
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/seo-ui";
import {
  AVAILABILITY_LABELS,
  ECOMMERCE_CLASS_LABELS,
  ECOMMERCE_TYPE_LABELS,
  ENTITY_CONFIDENCE_LABELS,
  HIERARCHY_CONFIDENCE_LABELS,
  type EcommerceCategory,
  type EcommerceClass,
  type EcommerceDetection,
  type EcommerceFinding,
  type EcommerceProduct,
  type EcommerceType,
  type EntityConfidence,
  type HierarchyConfidence,
} from "@/seo/ecommerce";

export function EcommerceTypeBadge({ type }: { type: EcommerceType }) {
  return (
    <Badge variant="outline" className="font-normal">
      {ECOMMERCE_TYPE_LABELS[type]}
    </Badge>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: EntityConfidence }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {ENTITY_CONFIDENCE_LABELS[confidence]}
    </Badge>
  );
}

export function HierarchyBadge({ confidence }: { confidence: HierarchyConfidence }) {
  return (
    <Badge variant={confidence === "confirmed" ? "default" : "outline"} className="font-normal">
      {HIERARCHY_CONFIDENCE_LABELS[confidence]}
    </Badge>
  );
}

export function ClassBadge({ classification }: { classification: EcommerceClass }) {
  return (
    <Badge
      variant={classification === "problem" ? "destructive" : "secondary"}
      className="font-normal"
    >
      {ECOMMERCE_CLASS_LABELS[classification]}
    </Badge>
  );
}

export function DetectionPanel({ detection }: { detection: EcommerceDetection }) {
  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-base font-semibold">Detección del tipo de sitio</h2>
        <Badge variant={detection.isEcommerce ? "default" : "outline"}>
          {detection.isEcommerce ? "Estructura e-commerce detectada" : "Sin estructura e-commerce suficiente"}
        </Badge>
        <Badge variant="secondary">Confianza {detection.confidence}/100</Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detection.criterion}</p>
      <ul className="mt-3 space-y-2">
        {detection.signals.map((s) => (
          <li key={s.id} className="rounded-md border border-border/60 p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">
                {s.occurrences} coincidencia(s) · peso {s.weight}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{s.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EcommerceFindingCard({
  finding,
  auditId,
}: {
  finding: EcommerceFinding;
  auditId: string;
}) {
  return (
    <article className="rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ClassBadge classification={finding.classification} />
        {finding.severity ? <SeverityBadge severity={finding.severity} /> : null}
        <EcommerceTypeBadge type={finding.ecommerceType} />
        <span className="font-medium">{finding.signalName}</span>
      </div>
      <Link
        to="/audits/$auditId/url/$pageId"
        params={{ auditId, pageId: finding.pageId }}
        className="mt-2 block truncate text-xs text-primary hover:underline"
      >
        {finding.pageUrl}
      </Link>
      <dl className="mt-2 space-y-1 text-xs">
        <div>
          <dt className="inline font-medium">Actual: </dt>
          <dd className="inline text-muted-foreground">{finding.current}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Por qué importa: </dt>
          <dd className="inline text-muted-foreground">{finding.explanation}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Recomendación: </dt>
          <dd className="inline text-muted-foreground">{finding.recommendation}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Criterio: </dt>
          <dd className="inline text-muted-foreground">{finding.criterion}</dd>
        </div>
      </dl>
      {finding.evidence.length > 0 ? (
        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          {finding.evidence.slice(0, 6).map((e) => (
            <li key={e} className="truncate">
              · {e}
            </li>
          ))}
        </ul>
      ) : null}
      {finding.relatedFindingIds.length > 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {finding.relatedFindingIds.length} diagnóstico(s) general(es) ya existentes para esta URL: se
          referencian, no se duplican.
        </p>
      ) : null}
    </article>
  );
}

export function ProductRow({ product, auditId }: { product: EcommerceProduct; auditId: string }) {
  return (
    <tr className="border-t border-border/60 text-xs">
      <td className="max-w-[280px] py-2 pr-3">
        <Link
          to="/audits/$auditId/url/$pageId"
          params={{ auditId, pageId: product.pageId }}
          className="block truncate text-primary hover:underline"
        >
          {product.name ?? product.path}
        </Link>
        <span className="block truncate text-muted-foreground">{product.path}</span>
      </td>
      <td className="py-2 pr-3">{product.isVariant ? "Variante" : "Producto"}</td>
      <td className="py-2 pr-3">
        {product.schema.status === "present"
          ? "Product + Offer"
          : product.schema.status === "incomplete"
            ? "Product sin Offer"
            : "Sin Product"}
      </td>
      <td className="py-2 pr-3">
        {product.price ? `${product.price}${product.currency ? ` ${product.currency}` : ""}` : "—"}
      </td>
      <td className="py-2 pr-3">{AVAILABILITY_LABELS[product.availability]}</td>
      <td className="py-2 pr-3">{product.inbound}</td>
      <td className="py-2 pr-3">{product.depth}</td>
      <td className="py-2">
        <HierarchyBadge confidence={product.categoryConfidence} />
      </td>
    </tr>
  );
}

export function CategoryRow({ category, auditId }: { category: EcommerceCategory; auditId: string }) {
  return (
    <tr className="border-t border-border/60 text-xs">
      <td className="max-w-[280px] py-2 pr-3">
        <Link
          to="/audits/$auditId/url/$pageId"
          params={{ auditId, pageId: category.pageId }}
          className="block truncate text-primary hover:underline"
        >
          {category.name ?? category.path}
        </Link>
        <span className="block truncate text-muted-foreground">{category.path}</span>
      </td>
      <td className="py-2 pr-3">{category.isSubcategory ? "Subcategoría" : "Categoría"}</td>
      <td className="py-2 pr-3">{category.productLinks.length}</td>
      <td className="py-2 pr-3">
        {category.wordCount}
        {category.minWords !== null ? ` / ${category.minWords}` : " / sin umbral"}
      </td>
      <td className="py-2 pr-3">{category.inbound}</td>
      <td className="py-2 pr-3">{category.depth}</td>
      <td className="py-2">{category.indexable ? "Indexable" : "No indexable"}</td>
    </tr>
  );
}

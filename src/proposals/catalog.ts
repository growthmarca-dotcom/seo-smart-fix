/**
 * P3 — Catálogo editable de servicios de MarCa Growth (modelo PURO).
 * Cada ítem es una plantilla: al agregarlo a una propuesta se copia POR VALOR,
 * así los cambios posteriores del catálogo nunca alteran propuestas existentes.
 * Los ítems no se borran: se archivan.
 */
import { validateItem, type BilledBy, type CostType, type Modality, type Proposal, type ProposalItem } from "./model";

export interface CatalogItem {
  id: string;
  name: string;
  scope: string;
  deliverables: string;
  term: string;
  modality: Modality;
  months?: number | undefined;
  costType: CostType;
  billedBy?: BilledBy | undefined;
  currency: string;
  quantity: number;
  /** Centavos. Vacío = "No informado". */
  unitPriceCents?: number | undefined;
  platform?: string | undefined;
  provider?: string | undefined;
  collaboratorName?: string | undefined;
  workAreaId?: string | undefined;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Copia por valor de un ítem del catálogo como línea de propuesta. */
export function catalogToProposalItem(c: CatalogItem, newId: string): ProposalItem {
  const copy = structuredClone(c);
  return {
    id: newId,
    name: copy.name,
    scope: copy.scope,
    deliverables: copy.deliverables,
    term: copy.term,
    modality: copy.modality,
    months: copy.months,
    costType: copy.costType,
    billedBy: copy.billedBy,
    currency: copy.currency,
    quantity: copy.quantity,
    unitPriceCents: copy.unitPriceCents,
    platform: copy.platform,
    provider: copy.provider,
    collaboratorName: copy.collaboratorName,
    sourceItemId: copy.id,
  };
}

/** Reutiliza las reglas de P2 para la plantilla (precio vacío permitido). */
export function validateCatalogItem(c: CatalogItem): string | undefined {
  if (!c.id) return "Falta el identificador.";
  return validateItem(catalogToProposalItem(c, c.id));
}

const STATUSES = new Set(["draft", "sent", "accepted", "rejected"]);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** Forma mínima persistida de una propuesta (no corrige ni descarta nada). */
export function isProposalShape(x: unknown): x is Proposal {
  return (
    isObj(x) &&
    typeof x["id"] === "string" &&
    typeof x["companyId"] === "string" &&
    typeof x["status"] === "string" &&
    STATUSES.has(x["status"]) &&
    typeof x["version"] === "number" &&
    Array.isArray(x["items"]) &&
    Array.isArray(x["discounts"])
  );
}

export function isCatalogShape(x: unknown): x is CatalogItem {
  return isObj(x) && typeof x["id"] === "string" && typeof x["name"] === "string" && typeof x["archived"] === "boolean";
}

/** Error si alguna colección P3 tiene elementos con forma inválida. */
export function p3IntegrityError(proposals: unknown, catalog: unknown): string | undefined {
  if (proposals !== undefined && !Array.isArray(proposals)) return "La colección «proposals» no es una lista.";
  if (catalog !== undefined && !Array.isArray(catalog)) return "La colección «serviceCatalog» no es una lista.";
  if (((proposals ?? []) as unknown[]).some((p) => !isProposalShape(p))) return "Hay propuestas guardadas con formato inválido.";
  if (((catalog ?? []) as unknown[]).some((c) => !isCatalogShape(c))) return "Hay servicios del catálogo con formato inválido.";
  return undefined;
}

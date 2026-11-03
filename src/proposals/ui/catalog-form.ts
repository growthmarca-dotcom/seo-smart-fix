/**
 * P4.1 — Utilidades PURAS del formulario de catálogo (sin cálculos comerciales).
 * Convierten texto del formulario a la forma de `catalogActions.upsert` y filtran la lista.
 */
import type { CatalogItem } from "../catalog";
import type { BilledBy, CostType, Modality } from "../model";

export const COST_TYPE_LABELS: Record<CostType, string> = {
  "own-fee": "Honorario propio",
  collaborator: "Honorario de colaborador",
  coordination: "Coordinación",
  "external-license": "Licencia / gasto externo",
  "ad-spend": "Inversión publicitaria (pago directo del cliente)",
};

export const MODALITY_LABELS: Record<Modality, string> = { "one-off": "Puntual", recurring: "Recurrente (mensual)" };

export interface CatalogForm {
  id?: string | undefined;
  name: string;
  description: string;
  scope: string;
  /** true si el registro original combinaba descripción y alcance (pre-P4.2). */
  needsReview?: boolean | undefined;
  deliverables: string;
  term: string;
  workAreaId: string;
  modality: Modality;
  costType: CostType;
  billedBy: "" | BilledBy;
  currency: string;
  price: string;
  months: string;
  collaboratorName: string;
  provider: string;
  platform: string;
}

export const emptyForm = (): CatalogForm => ({
  name: "", description: "", scope: "", deliverables: "", term: "", workAreaId: "", modality: "one-off", costType: "own-fee",
  billedBy: "", currency: "ARS", price: "", months: "", collaboratorName: "", provider: "", platform: "",
});

export function formFromItem(c: CatalogItem): CatalogForm {
  return {
    id: c.id, name: c.name, description: c.description ?? "", scope: c.scope, needsReview: c.description === undefined && c.scope.trim() !== "", deliverables: c.deliverables, term: c.term, workAreaId: c.workAreaId ?? "",
    modality: c.modality, costType: c.costType, billedBy: c.billedBy ?? "", currency: c.currency,
    price: c.unitPriceCents === undefined ? "" : formatCents(c.unitPriceCents), months: c.months === undefined ? "" : String(c.months),
    collaboratorName: c.collaboratorName ?? "", provider: c.provider ?? "", platform: c.platform ?? "",
  };
}

/** "150.000,50" (es-AR) → 15000050 centavos. Vacío → undefined (No informado, nunca 0). */
export function parsePriceToCents(s: string): number | undefined | "invalid" {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return undefined;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return "invalid";
  const [int, dec = ""] = t.replace(/\./g, "").split(",");
  return Number(int) * 100 + Number(dec.padEnd(2, "0"));
}

export function formatCents(c: number): string {
  return (c / 100).toLocaleString("es-AR", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
}

type UpsertInput = Omit<CatalogItem, "id" | "createdAt" | "updatedAt" | "archived"> & { id?: string };
const opt = (s: string) => (s.trim() ? s.trim() : undefined);

export function formToInput(f: CatalogForm): { ok: true; value: UpsertInput } | { ok: false; error: string } {
  const price = parsePriceToCents(f.price);
  if (price === "invalid") return { ok: false, error: "Precio inválido. Usá el formato 150.000 o 150.000,50, o dejalo vacío." };
  let months: number | undefined;
  if (f.modality === "recurring" && f.months.trim()) {
    months = Number(f.months);
    if (!Number.isInteger(months) || months <= 0) return { ok: false, error: "La duración sugerida debe ser un número entero de meses mayor que 0, o quedar vacía." };
  }
  const billedBy: BilledBy | undefined =
    f.costType === "ad-spend" ? "client" : f.costType === "external-license" ? (f.billedBy || undefined) : undefined;
  return {
    ok: true,
    value: {
      ...(f.id ? { id: f.id } : {}),
      name: f.name.trim(), description: f.description.trim(), scope: f.scope.trim(), deliverables: f.deliverables.trim(), term: f.term.trim(),
      workAreaId: opt(f.workAreaId), modality: f.modality, months, costType: f.costType, billedBy,
      currency: f.currency.trim().toUpperCase(), quantity: 1, unitPriceCents: price,
      collaboratorName: f.costType === "collaborator" ? opt(f.collaboratorName) : undefined,
      provider: f.costType === "external-license" ? opt(f.provider) : undefined,
      platform: f.costType === "ad-spend" ? opt(f.platform) : undefined,
    },
  };
}

export type StatusFilter = "active" | "archived" | "all";

export function filterCatalog(items: CatalogItem[], status: StatusFilter, area: string): CatalogItem[] {
  return items
    .filter((c) => (status === "all" ? true : status === "archived" ? c.archived : !c.archived))
    .filter((c) => (area === "" ? true : area === "none" ? !c.workAreaId : c.workAreaId === area))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

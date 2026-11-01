/**
 * Vista previa del diagnóstico integral por empresa. SOLO LECTURA: arma un diagnóstico efímero
 * en memoria a partir de datos existentes (auditorías vinculadas y evaluación turística).
 * No guarda, no modifica las entradas y no inventa valores: lo que no existe queda "Sin evaluar".
 */
import type { Company } from "@/companies/model";
import { isTourismIndustry } from "@/companies/model";
import type { Audit } from "@/seo/types";
import type { CommercialReview } from "@/seo/tourism/commercial-review";
import { DIMENSIONS, controlsFor, type ControlSource, type DimensionId } from "./dimensions";
import { TOURISM_EQUIVALENCES, pickCurrentReview, resolveControl, type CurrentReviewChoice } from "./equivalences";
import { emptyDiagnosis, type CompanyDiagnosis, type ControlStatus } from "./model";
import { SEO_CONTROL_ID, dimensionResults, globalIndex, seoReference, type DimensionResult, type GlobalIndex } from "./scoring";

export const auditDate = (a: Audit) => a.finishedAt ?? a.createdAt;

export interface PreviewControl {
  id: string;
  title: string;
  source: ControlSource;
  /** Estado mostrado; "integration" y "seo" no tienen estado evaluable. */
  status: ControlStatus | "integration" | "seo-reference";
  origin: "tourism" | "none";
  /** Auditoría de la que proviene el valor turístico, si corresponde. */
  fromAuditId?: string | undefined;
  unjustifiedNotApplicable: boolean;
  notes: string;
  evidenceUrl?: string | undefined;
}

export interface PreviewDimension {
  id: DimensionId;
  title: string;
  result: DimensionResult;
  controls: PreviewControl[];
}

export interface SeoRef {
  score: number;
  auditId: string;
  auditName: string;
  date: string;
  isDemo: boolean;
}

export interface DiagnosisPreview {
  tourism: boolean;
  dimensions: PreviewDimension[];
  index: GlobalIndex;
  seo: SeoRef | undefined;
  review: CurrentReviewChoice | undefined;
  /** Controles aplicables sin valor, agrupados por origen del dato. */
  missingBySource: Partial<Record<ControlSource, string[]>>;
  linkedAudits: { id: string; name: string; date: string; isDemo: boolean }[];
}

export function buildDiagnosisPreview(
  company: Company,
  audits: Audit[],
  reviews: CommercialReview[],
  selectedReviewAuditId?: string,
): DiagnosisPreview {
  const linked = audits.filter((a) => company.auditIds.includes(a.id));
  const tourism = isTourismIndustry(company.industry);

  const review = tourism
    ? pickCurrentReview(
        linked.map((a) => ({ auditId: a.id, auditDate: auditDate(a), review: reviews.find((r) => r.auditId === a.id) })),
        selectedReviewAuditId,
      )
    : undefined;
  const currentReview = review?.current?.review;

  const seoAudit = [...linked].filter((a) => a.score).sort((a, b) => auditDate(b).localeCompare(auditDate(a)))[0];
  const seoScore = seoAudit?.score?.total;
  const seo: SeoRef | undefined =
    seoAudit && seoScore !== undefined
      ? { score: seoReference({ seoScore })!, auditId: seoAudit.id, auditName: seoAudit.name, date: auditDate(seoAudit), isDemo: seoAudit.isDemo }
      : undefined;

  // Diagnóstico efímero (en memoria): solo valores leídos de la evaluación turística vigente.
  let diag: CompanyDiagnosis = emptyDiagnosis(company.id, "");
  const resolved = new Map<string, ReturnType<typeof resolveControl>>();
  if (currentReview) {
    for (const target of Object.values(TOURISM_EQUIVALENCES)) {
      const r = resolveControl(target, undefined, currentReview);
      resolved.set(target, r);
      if (r.state && r.state.status !== "unevaluated") diag = { ...diag, controls: { ...diag.controls, [target]: r.state } };
    }
  }

  const results = dimensionResults(company.industry, diag, { seoScore });
  const index = globalIndex(company.industry, results, diag, { seoScore });
  const missingBySource: DiagnosisPreview["missingBySource"] = {};

  const dimensions = DIMENSIONS.map((dim) => ({
    id: dim.id,
    title: dim.title,
    result: results.find((r) => r.id === dim.id)!,
    controls: controlsFor(company.industry, dim.id).map((c): PreviewControl => {
      if (c.id === SEO_CONTROL_ID)
        return { id: c.id, title: c.title, source: c.source, status: "seo-reference", origin: "none", unjustifiedNotApplicable: false, notes: "" };
      if (c.source === "integration") {
        (missingBySource.integration ??= []).push(c.title);
        return { id: c.id, title: c.title, source: c.source, status: "integration", origin: "none", unjustifiedNotApplicable: false, notes: "" };
      }
      const r = resolved.get(c.id);
      const st = diag.controls[c.id];
      const status: ControlStatus = st?.status ?? "unevaluated";
      if (status === "unevaluated" || status === "no-data") (missingBySource[c.source] ??= []).push(c.title);
      return {
        id: c.id,
        title: c.title,
        source: c.source,
        status,
        origin: st ? "tourism" : "none",
        fromAuditId: st ? review?.current?.auditId : undefined,
        unjustifiedNotApplicable: !!r?.unjustifiedNotApplicable,
        notes: st?.notes ?? "",
        evidenceUrl: st?.evidenceUrl,
      };
    }),
  }));

  return {
    tourism,
    dimensions,
    index,
    seo,
    review,
    missingBySource,
    linkedAudits: linked.map((a) => ({ id: a.id, name: a.name, date: auditDate(a), isDemo: a.isDemo })),
  };
}

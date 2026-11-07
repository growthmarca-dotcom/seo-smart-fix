/**
 * P6.2 — Lectura PURA de la evaluación vinculada a una propuesta. No escribe nada.
 * Solo devuelve datos si la evaluación existe y pertenece a la MISMA empresa de la propuesta.
 */
import type { Company } from "@/companies/model";
import type { CompanyAssessment } from "@/diagnosis/model";
import { buildSynthesis, type Synthesis } from "@/diagnosis/synthesis";
import type { Proposal } from "../model";

export interface LinkedDiagnosis {
  assessment: CompanyAssessment;
  synthesis: Synthesis;
}

export function linkedDiagnosis(
  p: Pick<Proposal, "companyId" | "assessmentId">,
  company: Pick<Company, "id" | "industry"> | undefined,
  assessments: CompanyAssessment[],
): LinkedDiagnosis | undefined {
  if (!p.assessmentId || !company || company.id !== p.companyId) return undefined;
  const a = assessments.find((x) => x.id === p.assessmentId && x.companyId === p.companyId);
  if (!a) return undefined;
  return { assessment: a, synthesis: buildSynthesis(company, a) };
}

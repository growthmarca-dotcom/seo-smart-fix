/**
 * FASE 6B/2.3 — Núcleo compartido de sub-criterios de prioridad.
 *
 * Primitivas PURAS y agnósticas de GSC, usadas por:
 * - `correlate.ts` (Fase 6B): como porción de `relevanceFactor` y `easeFactor`.
 * - `diagnostics.ts` (Fase 2.3): para la prioridad por hallazgo sin GSC.
 *
 * No ejecutan reglas, no leen datos de Search Console ni modifican el score.
 */
import type { Severity } from "@/seo/types";
import { PRIORITY_SCALES } from "./types";

/**
 * Relevancia derivada ÚNICAMENTE de la severidad del hallazgo (escala 0–4,
 * la misma que PRIORITY_SCALES.relevance).
 *
 *   critical    → 4 (máx)
 *   important   → 3
 *   improvement → 2
 *   ok          → 0
 */
export function severityRelevance(severity: Severity): number {
  switch (severity) {
    case "critical":
      return PRIORITY_SCALES.relevance.max;
    case "important":
      return 3;
    case "improvement":
      return 2;
    case "ok":
      return 0;
  }
}

/**
 * Facilidad derivada ÚNICAMENTE de si el hallazgo propone un campo editable
 * (escala 0–4, la misma que PRIORITY_SCALES.ease).
 *
 *   con campo editable → 4 (máx): acción directa sobre title/meta/etc.
 *   sin campo editable → 1: requiere revisión manual.
 */
export function editableFieldEase(hasField: boolean): number {
  return hasField ? PRIORITY_SCALES.ease.max : 1;
}

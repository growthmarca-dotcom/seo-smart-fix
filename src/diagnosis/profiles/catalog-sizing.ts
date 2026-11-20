/**
 * Etapa D1 — Correspondencia única de los controles C1 con su dimensionamiento.
 * Solo lectura: no modifica CONTROLS, IDs, dimensiones, criticidad ni pesos.
 */
import type { Industry } from "@/companies/model";
import { controlsFor, type DiagnosisControl } from "../dimensions";
import { criticalControlsFor } from "../weights";
import { AUDIT_PROFILES, type AuditProfileId, type ControlSizing, type VerificationMode } from "./types";

const s = (controlId: string, minProfile: AuditProfileId, mode: VerificationMode, depthGuidance?: ControlSizing["depthGuidance"]): ControlSizing =>
  Object.freeze({ controlId, minProfile, mode, ...(depthGuidance ? { depthGuidance } : {}) });

export const CATALOG_SIZING: readonly ControlSizing[] = Object.freeze([
  // Esencial
  s("web-seo-health", "essential", "auto"),
  s("web-has-site", "essential", "registry"),
  s("web-offer-clarity", "essential", "registry"),
  s("web-mobile", "essential", "external-test", { essential: "Lectura y botones principales probados en un teléfono.", integral360: "Flujos interactivos completos en varios dispositivos." }),
  s("web-contact-visible", "essential", "registry"),
  s("web-performance", "essential", "external-test", { essential: "Fluidez aparente y sin bloqueos al navegar desde el celular.", integral360: "Core Web Vitals (LCP, INP, CLS) con medición instrumental; requiere integración." }),
  s("vis-gbp", "essential", "registry"),
  s("vis-reviews", "essential", "registry", { essential: "Existencia y visibilidad de reseñas.", professional: "Tasa, tono y tiempo de respuesta a reseñas." }),
  s("sales-pricing-visible", "essential", "registry"),
  s("brand-identity", "essential", "registry"),
  s("ch-primary-contact", "essential", "registry"),
  s("ch-whatsapp", "essential", "external-test"),
  s("opp-quick-wins", "essential", "registry"),
  // Profesional
  s("web-ownership", "professional", "registry"),
  s("vis-consistency", "professional", "registry"),
  s("vis-external-references", "professional", "registry"),
  s("vis-ota", "professional", "registry"),
  s("vis-marketplace", "professional", "registry"),
  s("sales-response", "professional", "external-test"),
  s("sales-followup", "professional", "registry"),
  s("sales-quotes", "professional", "registry"),
  s("brand-value", "professional", "registry"),
  s("brand-content", "professional", "registry"),
  s("brand-social", "professional", "registry"),
  s("brand-proof", "professional", "registry"),
  s("ch-forms", "professional", "external-test"),
  s("ch-booking", "professional", "external-test"),
  s("ch-checkout", "professional", "external-test"),
  s("opp-competitors", "professional", "registry"),
  s("opp-channels", "professional", "registry"),
  s("opp-seasonality", "professional", "registry"),
  s("opp-goals", "professional", "registry"),
  // Integral 360
  s("vis-gbp-data", "integral360", "integration"),
  s("sales-conversion", "integral360", "registry"),
  s("sales-direct", "integral360", "registry"),
  s("ch-loyalty", "integral360", "registry"),
  s("opp-keywords", "integral360", "integration"),
]);

const BY_ID = new Map(CATALOG_SIZING.map((x) => [x.controlId, x]));

export function getControlSizing(controlId: string): ControlSizing | undefined {
  return BY_ID.get(controlId);
}

const rank = (p: AuditProfileId) => AUDIT_PROFILES.indexOf(p);

/**
 * Controles del rubro para un perfil. Los críticos aplicables al rubro se incluyen SIEMPRE.
 * El orden y los objetos son los de controlsFor(industry) (sin copias ni cambios).
 */
export function controlsForProfile(profileId: AuditProfileId, industry: Industry): DiagnosisControl[] {
  const critical = new Set(criticalControlsFor(industry));
  return controlsFor(industry).filter((c) => {
    if (critical.has(c.id)) return true;
    const sz = BY_ID.get(c.id);
    return !!sz && rank(sz.minProfile) <= rank(profileId);
  });
}

/**
 * P0 — Áreas de trabajo de MarCa Growth (sin precios). Solo SUGERENCIAS por control:
 * la combinación final la decide MarCa en la propuesta. Nunca influyen en cobertura,
 * madurez ni índice. Las áreas no se borran: se desactivan (`active: false`).
 */
export interface WorkArea {
  id: string;
  name: string;
  active: boolean;
  /** Controles del diagnóstico para los que se sugiere esta área. */
  suggestedFor: string[];
}

export const WORK_AREAS: WorkArea[] = [
  { id: "web-dev", name: "Desarrollo / optimización web", active: true, suggestedFor: ["web-has-site", "web-offer-clarity", "web-mobile", "web-contact-visible", "web-ownership", "sales-pricing-visible", "ch-checkout", "ch-forms"] },
  { id: "seo", name: "SEO técnico, SEO local y contenidos", active: true, suggestedFor: ["web-offer-clarity", "brand-content", "vis-external-references"] },
  { id: "gbp", name: "Google Business Profile / Maps", active: true, suggestedFor: ["vis-gbp", "vis-reviews", "vis-consistency"] },
  { id: "bing", name: "Bing / Bing Places", active: true, suggestedFor: ["vis-consistency"] },
  { id: "ads", name: "Publicidad Meta, Google y TikTok", active: true, suggestedFor: ["opp-channels", "sales-direct"] },
  { id: "chatgpt-ads", name: "ChatGPT Ads (cuando esté disponible comercialmente)", active: false, suggestedFor: ["opp-channels"] },
  { id: "social", name: "Redes sociales orgánicas", active: true, suggestedFor: ["brand-social", "brand-identity", "brand-value", "brand-proof"] },
  { id: "distribution", name: "Canales de distribución, marketplaces y plataformas de reservas", active: true, suggestedFor: ["vis-ota", "vis-marketplace", "sales-direct", "ch-booking", "opp-channels"] },
  { id: "whatsapp", name: "WhatsApp Business", active: true, suggestedFor: ["ch-whatsapp", "ch-primary-contact", "sales-response"] },
  { id: "crm", name: "CRM", active: true, suggestedFor: ["sales-followup", "sales-quotes", "ch-loyalty"] },
  { id: "lead-tracking", name: "Seguimiento de consultas y clientes", active: true, suggestedFor: ["sales-response", "sales-followup", "sales-conversion"] },
  { id: "reputation", name: "Satisfacción, reputación y fidelización", active: true, suggestedFor: ["vis-reviews", "ch-loyalty", "brand-proof"] },
  { id: "measurement", name: "Medición y mejora", active: true, suggestedFor: ["sales-conversion", "opp-goals", "opp-seasonality", "opp-competitors", "opp-quick-wins"] },
];

/** Áreas activas sugeridas para un control (orden del catálogo). */
export function suggestedAreasFor(controlId: string, areas: WorkArea[] = WORK_AREAS): WorkArea[] {
  return areas.filter((a) => a.active && a.suggestedFor.includes(controlId));
}

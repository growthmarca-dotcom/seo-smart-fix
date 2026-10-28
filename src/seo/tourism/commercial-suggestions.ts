/**
 * Precarga de observaciones comerciales (Fase 2).
 * Función pura: lee SOLO la auditoría indicada (y su conexión GSC, si existe).
 * Nunca marca estados, nunca escribe notas ni URLs: solo propone texto que la
 * persona que audita puede copiar o descartar. No afecta el SEO Score.
 */
import type { Audit, PageSnapshot } from "@/seo/types";
import type { GscConnection } from "@/seo/gsc/types";
import { COMMERCIAL_CONTROLS, isValidEvidenceUrl } from "./commercial-review";

export type EvidenceLevel = "full" | "partial" | "none";

export const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
  full: "Evidencia completa",
  partial: "Evidencia parcial",
  none: "Sin evidencia automática",
};

export interface CommercialSuggestion {
  controlId: string;
  auditId: string;
  suggestedNote: string;
  evidenceLevel: EvidenceLevel;
  evidenceUrl?: string | undefined;
  limitation: string;
}

const LODGING_SCHEMA = /^(LodgingBusiness|Hotel|Motel|Hostel|BedAndBreakfast|Resort|Campground|VacationRental|Apartment|House|Accommodation)$/i;
const BUSINESS_SCHEMA = /^(LocalBusiness|Organization|LodgingBusiness|Hotel|Motel|Hostel|BedAndBreakfast|Resort|Campground|VacationRental)$/i;
const BOOKING_RE = /reserv|booking|book-now|disponibilidad/i;
const CONTACT_RE = /contacto|contact/i;
const RATES_RE = /tarifa|precio|cancelaci|check-?in|check-?out|pol[ií]tica|dep[oó]sito|se[nñ]a/i;
const TRUST_RE = /rese[nñ]a|opini|testimon|review|comentarios/i;

function okPages(audit: Audit): PageSnapshot[] {
  return (audit.pages ?? []).filter((p) => p.statusCode >= 200 && p.statusCode < 300);
}

/** Solo URLs que existen en ESTA auditoría y son http/https. */
function realUrl(audit: Audit, url: string | undefined): string | undefined {
  if (!url || !isValidEvidenceUrl(url)) return undefined;
  return (audit.pages ?? []).some((p) => p.url === url) ? url : undefined;
}

function home(audit: Audit): PageSnapshot | undefined {
  const pages = okPages(audit);
  return pages.find((p) => p.pageType === "home") ?? pages.find((p) => p.depth === 0);
}

function pageText(p: PageSnapshot): string {
  return [p.path, p.title, ...p.h1, ...p.h2, ...p.h3].filter(Boolean).join(" ");
}

function s(audit: Audit, controlId: string, level: EvidenceLevel, note: string, limitation: string, url?: string): CommercialSuggestion {
  return {
    controlId,
    auditId: audit.id,
    evidenceLevel: level,
    suggestedNote: level === "none" ? "" : note,
    evidenceUrl: realUrl(audit, url),
    limitation,
  };
}

export function generateCommercialSuggestions(
  audit: Audit,
  gsc?: GscConnection | undefined,
): Record<string, CommercialSuggestion> {
  const pages = okPages(audit);
  const h = home(audit);
  const out: Record<string, CommercialSuggestion> = {};
  const add = (x: CommercialSuggestion) => (out[x.controlId] = x);
  const gscOwn = gsc && gsc.auditId === audit.id ? gsc : undefined;

  // 1. property-info
  {
    const lodging = [...new Set(pages.flatMap((p) => p.schemaTypes).filter((t) => LODGING_SCHEMA.test(t)))];
    const addr = pages.find((p) => p.localSignals?.address);
    const facts: string[] = [];
    if (h?.title) facts.push(`Título de la portada: «${h.title}».`);
    if (h?.h1[0]) facts.push(`H1 de la portada: «${h.h1[0]}».`);
    if (lodging.length) facts.push(`Datos estructurados de alojamiento detectados: ${lodging.join(", ")}.`);
    if (addr?.localSignals?.address) facts.push(`Dirección detectada en ${addr.url}.`);
    const level: EvidenceLevel = !h ? "none" : lodging.length && addr ? "full" : facts.length ? "partial" : "none";
    add(s(audit, "property-info", level, `Observado en el rastreo: ${facts.join(" ")}`,
      "El rastreo no permite confirmar capacidad, unidades ni tipo de alojamiento: revisar manualmente.", h?.url));
  }

  // 2. photos-description
  {
    const imgs = pages.reduce((n, p) => n + p.images.length, 0);
    const withImgs = pages.filter((p) => p.images.length > 0).length;
    const words = h?.wordCount ?? 0;
    const level: EvidenceLevel = pages.length === 0 ? "none" : imgs > 0 && words > 0 ? "partial" : imgs > 0 || words > 0 ? "partial" : "none";
    add(s(audit, "photos-description", level,
      `Observado en el rastreo: ${imgs} imágenes en ${withImgs} de ${pages.length} páginas analizadas; la portada tiene ${words} palabras de texto visible.`,
      "Se cuentan imágenes y texto; no se evalúa calidad, actualidad ni atractivo de las fotografías.", h?.url));
  }

  // 3. contact-whatsapp
  {
    const phone = pages.find((p) => p.localSignals?.phone);
    const contact = pages.find((p) => p.pageType === "contact" || CONTACT_RE.test(p.path));
    const facts: string[] = [];
    if (phone) facts.push(`Teléfono visible en el texto de ${phone.url}.`);
    if (contact) facts.push(`Página de contacto rastreada: ${contact.url}.`);
    add(s(audit, "contact-whatsapp", facts.length ? "partial" : "none", `Observado en el rastreo: ${facts.join(" ")}`,
      "El rastreador no ejecuta JavaScript ni conserva enlaces tel:, mailto: ni de WhatsApp: no detectarlos no significa que no existan. Probar manualmente.",
      contact?.url ?? phone?.url));
  }

  // 4. booking-engine
  {
    const links = pages.flatMap((p) => p.internalLinks.filter((l) => BOOKING_RE.test(l.href) || BOOKING_RE.test(l.anchor)));
    const bookPage = pages.find((p) => BOOKING_RE.test(p.path));
    const facts: string[] = [];
    if (links.length) facts.push(`${links.length} enlaces internos con texto o destino de reserva (ej.: «${links[0]!.anchor || links[0]!.href}»).`);
    if (bookPage) facts.push(`Página de reserva rastreada: ${bookPage.url} (HTTP ${bookPage.statusCode}, ${bookPage.wordCount} palabras).`);
    add(s(audit, "booking-engine", facts.length ? "partial" : "none", `Observado en el rastreo: ${facts.join(" ")}`,
      "No se detectan motores de reserva externos, en iframes o cargados con JavaScript: no detectarlos no significa que no existan. Recorrer la reserva manualmente.",
      bookPage?.url));
  }

  // 5. rates-policies
  {
    const hits = pages.filter((p) => RATES_RE.test(pageText(p)));
    add(s(audit, "rates-policies", hits.length ? "partial" : "none",
      `Observado en el rastreo: ${hits.length} páginas mencionan tarifas, políticas o check-in/out en su URL, título o encabezados (ej.: ${hits[0]?.url ?? ""}).`,
      "No se verifica la vigencia de precios ni que las condiciones sean completas o claras.", hits[0]?.url));
  }

  // 6. mobile-path
  {
    const vp = pages.filter((p) => p.hasViewport).length;
    const level: EvidenceLevel = pages.length === 0 ? "none" : "partial";
    add(s(audit, "mobile-path", level,
      `Observado en el rastreo: ${vp} de ${pages.length} páginas declaran la etiqueta viewport para móviles.`,
      "La etiqueta viewport es un requisito técnico básico; no prueba que consultar o reservar desde el celular sea fácil. Probar en un teléfono.",
      h?.url));
  }

  // 7. ota-consistency — nunca automático
  add(s(audit, "ota-consistency", "none", "",
    "Requiere comprobación manual: el rastreo no consulta Booking, Airbnb ni otras plataformas."));

  // 8. value-proposition
  {
    const facts: string[] = [];
    if (h?.title) facts.push(`Título de la portada: «${h.title}».`);
    if (h?.h1[0]) facts.push(`H1 de la portada: «${h.h1[0]}».`);
    if (h?.h2.length) facts.push(`Subtítulos de la portada: ${h.h2.slice(0, 4).map((x) => `«${x}»`).join(", ")}.`);
    add(s(audit, "value-proposition", facts.length ? "partial" : "none", `Observado en el rastreo: ${facts.join(" ")}`,
      "Si la propuesta diferencia al alojamiento frente a la competencia requiere criterio comercial.", h?.url));
  }

  // 9. trust
  {
    const biz = [...new Set(pages.flatMap((p) => p.schemaTypes).filter((t) => BUSINESS_SCHEMA.test(t)))];
    const rev = pages.find((p) => TRUST_RE.test(pageText(p)));
    const facts: string[] = [];
    if (biz.length) facts.push(`Datos estructurados del negocio: ${biz.join(", ")}.`);
    if (rev) facts.push(`Página con reseñas u opiniones en su título o encabezados: ${rev.url}.`);
    if (pages.some((p) => p.localSignals?.phone || p.localSignals?.address)) facts.push("Hay datos de contacto visibles en el texto.");
    add(s(audit, "trust", facts.length ? "partial" : "none", `Observado en el rastreo: ${facts.join(" ")}`,
      "No se verifica la autenticidad de reseñas ni la reputación en Google u otras plataformas.", rev?.url));
  }

  // 10. measurement — solo GSC
  {
    const connected = gscOwn && gscOwn.source === "live" && gscOwn.status === "connected";
    add(s(audit, "measurement", connected ? "partial" : "none",
      `Search Console vinculado a esta auditoría (propiedad ${gscOwn?.property.siteUrl ?? ""}).`,
      "El rastreo no detecta Google Analytics, Tag Manager ni píxeles; esto no indica si existen o faltan. Revisar manualmente."));
  }

  // Garantiza los 10 controles en el orden oficial.
  const ordered: Record<string, CommercialSuggestion> = {};
  for (const c of COMMERCIAL_CONTROLS) ordered[c.id] = out[c.id]!;
  return ordered;
}

/** Une una sugerencia a notas existentes sin borrarlas. */
export function appendSuggestionToNotes(current: string, suggestion: string): string {
  const cur = current.trim();
  const add = suggestion.trim();
  if (!add || cur.includes(add)) return current;
  return cur ? `${cur}\n\n${add}` : add;
}

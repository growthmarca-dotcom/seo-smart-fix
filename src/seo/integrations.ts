/** Capa de integraciones externas: módulos preparados, aún no conectados. */
export interface IntegrationModule {
  id: string;
  name: string;
  description: string;
  status: "planned" | "needs-credentials";
  provides: string[];
}

export const INTEGRATIONS: IntegrationModule[] = [
  {
    id: "google-search-console",
    name: "Google Search Console",
    description:
      "Cobertura de indexación, consultas, clics e impresiones reales por URL para cruzar con los hallazgos.",
    status: "needs-credentials",
    provides: ["Indexación real", "Consultas y CTR", "Errores de rastreo"],
  },
  {
    id: "google-analytics",
    name: "Google Analytics 4",
    description: "Sesiones y conversiones por página para priorizar hallazgos por impacto de negocio.",
    status: "needs-credentials",
    provides: ["Tráfico por URL", "Conversiones"],
  },
  {
    id: "pagespeed",
    name: "PageSpeed Insights / Core Web Vitals",
    description: "LCP, INP y CLS de campo y laboratorio para la categoría de rendimiento.",
    status: "needs-credentials",
    provides: ["Core Web Vitals", "Diagnóstico móvil"],
  },
  {
    id: "google-business-profile",
    name: "Google Business Profile",
    description: "Ficha de empresa, NAP, categorías y reseñas para el módulo de SEO local.",
    status: "planned",
    provides: ["NAP verificado", "Categorías locales", "Reseñas"],
  },
  {
    id: "authority",
    name: "Autoridad y backlinks",
    description: "Módulo futuro de perfil de enlaces, autoridad de dominio y análisis de competencia.",
    status: "planned",
    provides: ["Backlinks", "Competidores", "Gap de keywords"],
  },
];

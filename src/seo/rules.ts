/**
 * Rule Engine — reglas SEO universales + reglas etiquetadas por plataforma.
 * Agregar una regla nueva = agregar un objeto a este array. El motor
 * (engine.ts) no necesita cambios.
 */
import type {
  Category,
  Finding,
  FindingKind,
  PageSnapshot,
  Severity,
  SiteContext,
} from "./types";

export interface RuleResult {
  severity?: Severity | undefined;
  current: string;
  problem: string;
  suggestion?: string | undefined;
  /** Evidencia concreta: URLs, imágenes o enlaces afectados. */
  evidence?: string[] | undefined;
}

export interface SeoRule {
  id: string;
  name: string;
  category: Category;
  /** Naturaleza de la regla: hecho técnico/indexación/on-page, oportunidad o heurística. */
  kind: FindingKind;
  severity: Severity;
  impact: number;
  field?: string | undefined;
  /** Por qué importa. Se muestra al usuario. */
  explanation: string;
  /** "universal" o etiquetas de plataforma (tiendanube, mercadolibre, ...). */
  tags: string[];
  appliesTo?: (page: PageSnapshot) => boolean;
  check: (page: PageSnapshot, site: SiteContext) => RuleResult | null;
}

const has = (v?: string) => Boolean(v && v.trim().length);

export const RULES: SeoRule[] = [
  // ---------- ON-PAGE ----------
  {
    id: "title-missing",
    kind: "onpage",
    name: "Title ausente",
    category: "onpage",
    severity: "critical",
    impact: 10,
    field: "title",
    tags: ["universal"],
    explanation:
      "El title es la señal on-page más fuerte y el texto que se muestra en Google. Sin title la página compite en desventaja y el buscador inventa uno.",
    check: (p) =>
      has(p.title)
        ? null
        : {
            current: "(sin title)",
            problem: "La página no define etiqueta <title>.",
            suggestion: p.h1[0] ? `${p.h1[0]} | ${hostOf(p.url)}` : `Página | ${hostOf(p.url)}`,
          },
  },
  {
    id: "title-length",
    kind: "heuristic",
    name: "Longitud del title (recomendación)",
    category: "onpage",
    severity: "improvement",
    impact: 4,
    field: "title",
    tags: ["universal"],
    explanation:
      "Recomendación basada en buenas prácticas, no una regla de Google: entre 30 y 60 caracteres el title suele mostrarse completo en resultados. Fuera de ese rango la página puede seguir posicionando.",
    check: (p) => {
      if (!has(p.title)) return null;
      const t = p.title!.trim();
      if (t.length >= 30 && t.length <= 60) return null;
      return {
        severity: t.length < 15 || t.length > 75 ? "important" : "improvement",
        current: `${t} (${t.length} caracteres)`,
        problem:
          t.length < 30
            ? "El title es más corto de lo recomendado (30-60 caracteres)."
            : "El title supera los 60 caracteres recomendados y puede truncarse en el snippet.",
        suggestion:
          t.length > 60 ? `${t.slice(0, 57).trim()}…` : `${t} | ${hostOf(p.url).split(".")[0]}`,
      };
    },
  },
  {
    id: "meta-description-missing",
    kind: "onpage",
    name: "Meta description ausente",
    category: "onpage",
    severity: "important",
    impact: 7,
    field: "metaDescription",
    tags: ["universal"],
    explanation:
      "No es un factor de ranking directo, pero define el snippet y afecta mucho al CTR desde los resultados.",
    check: (p) =>
      has(p.metaDescription)
        ? null
        : {
            current: "(sin meta description)",
            problem: "La página no define meta description.",
            suggestion: p.textSample
              ? `${p.textSample.slice(0, 145).trim()}…`
              : `Conocé ${p.h1[0] ?? "esta página"} en ${hostOf(p.url)}. Envíos, atención y asesoramiento.`,
          },
  },
  {
    id: "meta-description-length",
    kind: "heuristic",
    name: "Longitud de meta description (recomendación)",
    category: "onpage",
    severity: "improvement",
    impact: 3,
    field: "metaDescription",
    tags: ["universal"],
    explanation:
      "Recomendación heurística: entre 70 y 160 caracteres la descripción suele mostrarse completa. Google reescribe el snippet con frecuencia, así que no es una regla fija.",
    check: (p) => {
      if (!has(p.metaDescription)) return null;
      const d = p.metaDescription!.trim();
      if (d.length >= 70 && d.length <= 160) return null;
      return {
        current: `${d} (${d.length} caracteres)`,
        problem:
          d.length < 70
            ? "La descripción es más corta de lo recomendado."
            : "La descripción supera la longitud recomendada y puede recortarse.",
        suggestion: d.length > 160 ? `${d.slice(0, 157).trim()}…` : undefined,
      };
    },
  },
  {
    id: "h1-missing",
    kind: "onpage",
    name: "H1 ausente",
    category: "onpage",
    severity: "important",
    impact: 7,
    field: "h1",
    tags: ["universal"],
    explanation:
      "El H1 comunica el tema principal al usuario y al buscador. Sin H1 la página pierde claridad temática.",
    check: (p) =>
      p.h1.length === 0
        ? {
            current: "(sin H1)",
            problem: "La página no tiene encabezado H1.",
            suggestion: p.title ?? "Encabezado principal descriptivo",
          }
        : null,
  },
  {
    id: "h1-multiple",
    kind: "heuristic",
    name: "Múltiples H1",
    category: "onpage",
    severity: "improvement",
    impact: 3,
    field: "h1",
    tags: ["universal"],
    explanation:
      "Varios H1 diluyen el foco temático. Se recomienda un solo H1 y bajar el resto a H2.",
    check: (p) =>
      p.h1.length > 1
        ? {
            current: p.h1.join(" | "),
            problem: `Se encontraron ${p.h1.length} H1 en la misma página.`,
            suggestion: `Mantener solo "${p.h1[0]}" como H1 y convertir el resto en H2.`,
          }
        : null,
  },
  {
    id: "heading-structure",
    kind: "heuristic",
    name: "Estructura de headings",
    category: "onpage",
    severity: "improvement",
    impact: 3,
    field: "h2",
    tags: ["universal"],
    explanation:
      "Una jerarquía H1 → H2 → H3 ayuda a entender la estructura del contenido y habilita fragmentos destacados.",
    check: (p) =>
      p.wordCount > 300 && p.h2.length === 0
        ? {
            current: `H1: ${p.h1.length} · H2: 0 · H3: ${p.h3.length}`,
            problem: "Contenido extenso sin subtítulos H2.",
            suggestion: "Dividir el contenido en secciones con H2 descriptivos.",
          }
        : null,
  },
  {
    id: "thin-content",
    kind: "opportunity",
    name: "Contenido pobre",
    category: "content",
    severity: "important",
    impact: 6,
    field: "content",
    tags: ["universal"],
    explanation:
      "Oportunidad de contenido: no existe un mínimo oficial de palabras, pero páginas con muy poco texto suelen resolver peor la intención de búsqueda frente a resultados más completos.",
    check: (p) =>
      p.statusCode === 200 && p.wordCount < 150
        ? {
            severity: p.wordCount < 60 ? "important" : "improvement",
            current: `${p.wordCount} palabras`,
            problem: "Contenido demasiado breve para cubrir la intención de búsqueda.",
            suggestion:
              "Ampliar a 300+ palabras útiles: características, usos, materiales, preguntas frecuentes.",
          }
        : null,
  },
  {
    id: "duplicate-content",
    kind: "indexation",
    name: "Contenido duplicado",
    category: "content",
    severity: "important",
    impact: 7,
    field: "content",
    tags: ["universal"],
    explanation:
      "Contenido casi idéntico entre URLs hace que compitan entre sí y el buscador elija una sola versión.",
    check: (p, site) => {
      if (!p.contentHash || p.wordCount < 40) return null;
      const twins = site.pages.filter((o) => o.id !== p.id && o.contentHash === p.contentHash);
      return twins.length
        ? {
            current: `Igual a ${twins.length} URL(s): ${twins
              .slice(0, 3)
              .map((t) => t.path)
              .join(", ")}`,
            evidence: twins.map((t) => t.url),
            problem: "El contenido principal se repite en otras URLs.",
            suggestion:
              "Diferenciar el texto o consolidar con canonical hacia la versión preferida.",
          }
        : null;
    },
  },
  {
    id: "duplicate-title",
    kind: "onpage",
    name: "Title duplicado",
    category: "onpage",
    severity: "important",
    impact: 6,
    field: "title",
    tags: ["universal"],
    explanation:
      "Titles repetidos impiden diferenciar las páginas en resultados y sugieren canibalización de keywords.",
    check: (p, site) => {
      if (!has(p.title)) return null;
      const twins = site.pages.filter((o) => o.id !== p.id && o.title === p.title);
      return twins.length
        ? {
            current: p.title!,
            evidence: twins.map((t) => t.url),
            problem: `El mismo title se usa en ${twins.length} URL(s) más.`,
            suggestion: `${p.title} — ${p.h1[0] ?? p.path}`,
          }
        : null;
    },
  },
  {
    id: "images-alt",
    kind: "onpage",
    name: "Imágenes sin ALT",
    category: "onpage",
    severity: "improvement",
    impact: 3,
    field: "images.alt",
    tags: ["universal"],
    explanation:
      "El ALT describe la imagen para accesibilidad y para Google Imágenes, una fuente real de tráfico en e-commerce.",
    check: (p) => {
      const missing = p.images.filter((i) => !has(i.alt));
      if (!missing.length) return null;
      // Una sola imagen secundaria sin ALT no merece un hallazgo.
      if (missing.length === 1 && p.images.length > 3) return null;
      const ratio = missing.length / Math.max(1, p.images.length);
      return {
        severity: missing.length >= 5 && ratio > 0.5 ? "important" : "improvement",
        current: `${missing.length} de ${p.images.length} imágenes sin ALT`,
        evidence: missing.slice(0, 8).map((i) => i.fileName ?? i.src),
        problem: "Hay imágenes sin texto alternativo.",
        suggestion: `Describir cada imagen, ej: "${p.h1[0] ?? "producto"} — vista frontal".`,
      };
    },
  },
  {
    id: "image-filenames",
    kind: "heuristic",
    name: "Nombres de archivo poco descriptivos",
    category: "onpage",
    severity: "improvement",
    impact: 2,
    field: "images.fileName",
    tags: ["universal"],
    explanation:
      "Nombres como IMG_1234.jpg no aportan contexto. Nombres con palabras clave ayudan en búsqueda de imágenes.",
    check: (p) => {
      const bad = p.images.filter((i) =>
        /^(img|dsc|image|photo|whatsapp|screenshot)[-_ ]?\d+|^\d+\.(jpg|jpeg|png|webp)/i.test(
          i.fileName ?? "",
        ),
      );
      return bad.length
        ? {
            current: bad
              .slice(0, 4)
              .map((b) => b.fileName)
              .join(", "),
            problem: `${bad.length} imagen(es) con nombre de archivo genérico.`,
            suggestion: `Renombrar a formato descriptivo: ${slug(p.h1[0] ?? "producto")}-01.webp`,
          }
        : null;
    },
  },
  {
    id: "internal-links-few",
    kind: "opportunity",
    name: "Pocos enlaces internos",
    category: "content",
    severity: "improvement",
    impact: 4,
    field: "internalLinks",
    tags: ["universal"],
    explanation:
      "Los enlaces internos reparten autoridad y ayudan al rastreo. Páginas huérfanas o casi sin enlaces salientes se rastrean peor.",
    check: (p) =>
      p.statusCode === 200 && p.internalLinks.length < 3
        ? {
            current: `${p.internalLinks.length} enlaces internos`,
            problem: "La página casi no enlaza a otras secciones del sitio.",
            suggestion:
              "Agregar enlaces contextuales a categorías relacionadas y productos complementarios.",
          }
        : null,
  },
  {
    id: "anchor-text-generic",
    kind: "heuristic",
    name: "Anchor text genérico",
    category: "content",
    severity: "improvement",
    impact: 2,
    field: "anchorText",
    tags: ["universal"],
    explanation:
      "Anchors como 'ver más' no describen el destino. Un anchor descriptivo aporta contexto sobre la página enlazada.",
    check: (p) => {
      const bad = p.internalLinks.filter((l) =>
        /^(ver m[aá]s|click aqu[ií]|aqu[ií]|leer m[aá]s|m[aá]s info|link)$/i.test(l.anchor.trim()),
      );
      return bad.length
        ? {
            current: `${bad.length} enlaces con anchor genérico`,
            problem: "Enlaces internos con texto no descriptivo.",
            suggestion: "Reemplazar por texto que describa el destino, ej: 'camperas de trekking'.",
          }
        : null;
    },
  },
  {
    id: "url-quality",
    kind: "heuristic",
    name: "URL poco amigable",
    category: "technical",
    severity: "improvement",
    impact: 3,
    field: "url",
    tags: ["universal"],
    explanation:
      "URLs cortas, en minúsculas y con guiones son más fáciles de compartir e interpretar por el buscador.",
    check: (p) => {
      const issues: string[] = [];
      if (/[A-Z]/.test(p.path)) issues.push("mayúsculas");
      if (/_/.test(p.path)) issues.push("guiones bajos");
      if (p.path.length > 100) issues.push("longitud excesiva");
      if ((p.path.match(/\?|&/g) ?? []).length > 1) issues.push("muchos parámetros");
      return issues.length
        ? {
            current: p.path,
            problem: `URL con ${issues.join(", ")}.`,
            suggestion: `/${slug(p.h1[0] ?? p.path)}`,
          }
        : null;
    },
  },

  // ---------- TÉCNICO ----------
  {
    id: "noindex",
    kind: "indexation",
    name: "Página con noindex",
    category: "technical",
    severity: "critical",
    impact: 10,
    field: "robotsMeta",
    tags: ["universal"],
    explanation:
      "Una etiqueta noindex excluye la página del índice de Google. Si es una página comercial, no puede recibir tráfico orgánico.",
    check: (p) =>
      /noindex/i.test(p.robotsMeta ?? "")
        ? {
            current: p.robotsMeta!,
            problem: "La página se está excluyendo del índice.",
            suggestion: "index, follow",
          }
        : null,
  },
  {
    id: "nofollow-meta",
    kind: "indexation",
    name: "Meta robots nofollow",
    category: "technical",
    severity: "important",
    impact: 6,
    field: "robotsMeta",
    tags: ["universal"],
    explanation:
      "Con nofollow a nivel página el buscador no sigue sus enlaces, cortando el flujo de rastreo hacia el resto del sitio.",
    check: (p) =>
      /nofollow/i.test(p.robotsMeta ?? "")
        ? {
            current: p.robotsMeta!,
            problem: "La página no permite seguir sus enlaces.",
            suggestion: "index, follow",
          }
        : null,
  },
  {
    id: "canonical-missing",
    kind: "indexation",
    name: "Canonical ausente",
    category: "technical",
    severity: "improvement",
    impact: 4,
    field: "canonical",
    tags: ["universal"],
    explanation:
      "El canonical indica la versión preferida de una URL y evita duplicados por parámetros, filtros o paginación.",
    check: (p) =>
      p.statusCode === 200 && !has(p.canonical)
        ? {
            current: "(sin canonical)",
            problem: "La página no declara URL canónica.",
            suggestion: p.url,
          }
        : null,
  },
  {
    id: "canonical-mismatch",
    kind: "indexation",
    name: "Canonical apunta a otra URL",
    category: "technical",
    severity: "important",
    impact: 7,
    field: "canonical",
    tags: ["universal"],
    explanation:
      "Si el canonical apunta a otra URL, el buscador puede ignorar esta página y consolidar señales en otra.",
    check: (p, site) => {
      if (!has(p.canonical)) return null;
      try {
        const c = new URL(p.canonical!, p.url);
        const self = new URL(p.url);
        const same =
          c.origin === self.origin && c.pathname.replace(/\/$/, "") === self.pathname.replace(/\/$/, "");
        if (same) return null;
        const target = site.pages.find(
          (o) => o.url.replace(/\/$/, "") === c.toString().replace(/\/$/, ""),
        );
        const targetOk = target
          ? target.statusCode < 300 && !/noindex/i.test(target.robotsMeta ?? "")
          : undefined;
        return {
          // Si el destino existe y es indexable puede tratarse de una consolidación deliberada.
          severity: targetOk === true ? "improvement" : "important",
          current: p.canonical!,
          evidence: target ? [`Destino ${target.url}: HTTP ${target.statusCode}`] : undefined,
          problem:
            targetOk === false
              ? "El canonical apunta a una URL con error o marcada como noindex."
              : "El canonical no coincide con la URL de la página.",
          suggestion: p.url,
        };
      } catch {
        return { current: p.canonical!, problem: "Canonical inválido.", suggestion: p.url };
      }
    },
  },
  {
    id: "http-error",
    kind: "technical",
    name: "Código HTTP con error",
    category: "technical",
    severity: "critical",
    impact: 9,
    field: "statusCode",
    tags: ["universal"],
    explanation:
      "Las URLs 4xx/5xx no se indexan y consumen presupuesto de rastreo. Si están enlazadas, además dañan la experiencia.",
    check: (p) =>
      p.statusCode >= 400
        ? {
            current: `HTTP ${p.statusCode}`,
            problem: "La URL responde con error.",
            suggestion:
              p.statusCode === 404
                ? "Restaurar el contenido o redirigir 301 a la página equivalente."
                : "Revisar el servidor y corregir la respuesta.",
          }
        : null,
  },
  {
    id: "redirect-chain",
    kind: "technical",
    name: "Redirecciones encadenadas",
    category: "technical",
    severity: "important",
    impact: 5,
    field: "redirects",
    tags: ["universal"],
    explanation:
      "Cada salto añade latencia y diluye señales. Lo ideal es una única redirección 301 directa al destino final.",
    check: (p) =>
      (p.redirectedFrom?.length ?? 0) > 1
        ? {
            current: [...(p.redirectedFrom ?? []), p.url].join(" → "),
            problem: `Cadena de ${p.redirectedFrom!.length} redirecciones.`,
            suggestion: "Redirigir la URL original directamente al destino final.",
          }
        : null,
  },
  {
    id: "deep-page",
    kind: "technical",
    name: "Profundidad de clics excesiva",
    category: "technical",
    severity: "improvement",
    impact: 4,
    field: "depth",
    tags: ["universal"],
    explanation:
      "Las páginas a más de 3 clics del inicio reciben menos rastreo y menos autoridad interna.",
    check: (p) =>
      p.depth > 3
        ? {
            severity: p.depth > 5 ? "important" : "improvement",
            current: `${p.depth} clics desde la home`,
            problem: "Página demasiado profunda en la arquitectura.",
            suggestion:
              "Enlazarla desde una categoría principal o desde la home para reducir la profundidad.",
          }
        : null,
  },
  {
    id: "robots-txt-missing",
    kind: "indexation",
    name: "robots.txt ausente o bloqueante",
    category: "technical",
    severity: "critical",
    impact: 9,
    field: "robots.txt",
    tags: ["universal"],
    appliesTo: (p) => p.pageType === "home",
    explanation:
      "Un robots.txt con Disallow: / bloquea todo el rastreo. Su ausencia impide dar directivas y declarar el sitemap.",
    check: (_p, site) => {
      if (site.robotsTxt?.disallowsAll)
        return {
          current: "Disallow: /",
          problem: "robots.txt bloquea el rastreo de todo el sitio.",
          suggestion: "Permitir el rastreo y bloquear solo carrito, checkout y búsquedas internas.",
        };
      if (site.robotsTxt && !site.robotsTxt.found)
        return {
          severity: "improvement",
          current: "(sin robots.txt)",
          problem: "No se encontró robots.txt.",
          suggestion: `User-agent: *\nAllow: /\nSitemap: ${site.rootUrl.replace(/\/$/, "")}/sitemap.xml`,
        };
      return null;
    },
  },
  {
    id: "sitemap-missing",
    kind: "indexation",
    name: "sitemap.xml ausente",
    category: "technical",
    severity: "important",
    impact: 7,
    field: "sitemap.xml",
    tags: ["universal"],
    appliesTo: (p) => p.pageType === "home",
    explanation:
      "El sitemap acelera el descubrimiento de URLs nuevas, especialmente en catálogos grandes.",
    check: (_p, site) =>
      site.sitemap && !site.sitemap.found
        ? {
            current: "(sin sitemap.xml)",
            problem: "No se encontró sitemap.xml en las rutas habituales.",
            suggestion: "Generar /sitemap.xml y declararlo en robots.txt y en Search Console.",
          }
        : null,
  },
  {
    id: "viewport-missing",
    kind: "technical",
    name: "Sin viewport móvil",
    category: "performance",
    severity: "important",
    impact: 7,
    field: "viewport",
    tags: ["universal"],
    explanation:
      "Sin meta viewport la página no se adapta a móvil, y Google indexa priorizando la versión móvil.",
    check: (p) =>
      p.statusCode === 200 && !p.hasViewport
        ? {
            current: "(sin meta viewport)",
            problem: "La página no declara viewport responsive.",
            suggestion: '<meta name="viewport" content="width=device-width, initial-scale=1">',
          }
        : null,
  },
  {
    id: "heavy-page",
    kind: "heuristic",
    name: "Página pesada",
    category: "performance",
    severity: "improvement",
    impact: 4,
    field: "weight",
    tags: ["universal"],
    explanation:
      "El peso alto empeora LCP y Core Web Vitals, sobre todo en móvil con conexiones lentas.",
    check: (p) => {
      const heavyImgs = p.images.filter((i) => (i.sizeKb ?? 0) > 300);
      if ((p.htmlSizeKb ?? 0) < 250 && heavyImgs.length === 0) return null;
      return {
        current: `HTML ${p.htmlSizeKb ?? 0} KB · ${heavyImgs.length} imágenes > 300 KB`,
        problem: "Recursos pesados que pueden degradar la carga.",
        suggestion: "Comprimir imágenes a WebP/AVIF, aplicar lazy loading y reducir HTML/JS.",
      };
    },
  },

  // ---------- STRUCTURED DATA ----------
  {
    id: "schema-invalid",
    kind: "technical",
    name: "JSON-LD inválido",
    category: "structured-data",
    severity: "important",
    impact: 6,
    field: "schema",
    tags: ["universal"],
    explanation:
      "Un JSON-LD mal formado se ignora por completo, por lo que se pierden resultados enriquecidos.",
    check: (p) =>
      p.schemaTypes.includes("INVALID_JSON_LD")
        ? {
            current: "JSON-LD con error de sintaxis",
            problem: "Hay un bloque de datos estructurados que no se puede parsear.",
            suggestion: "Corregir el JSON-LD y validarlo con la prueba de resultados enriquecidos.",
          }
        : null,
  },
  {
    id: "schema-recommended",
    kind: "opportunity",
    name: "Datos estructurados recomendados",
    category: "structured-data",
    severity: "important",
    impact: 6,
    field: "schema",
    tags: ["universal"],
    explanation:
      "Schema.org permite resultados enriquecidos (precio, stock, valoraciones, migas, FAQ) y mejora la comprensión de la página.",
    check: (p) => {
      const expected = RECOMMENDED_SCHEMA[p.pageType] ?? [];
      const missing = expected.filter((t) => !p.schemaTypes.includes(t));
      return missing.length
        ? {
            severity: p.pageType === "product" ? "important" : "improvement",
            current: p.schemaTypes.length ? p.schemaTypes.join(", ") : "(sin datos estructurados)",
            problem: `Falta marcado ${missing.join(", ")} para este tipo de página.`,
            suggestion: `Agregar JSON-LD de tipo ${missing.join(" + ")}.`,
          }
        : null;
    },
  },
  {
    id: "breadcrumb-schema",
    kind: "opportunity",
    name: "Breadcrumb sin marcado",
    category: "structured-data",
    severity: "improvement",
    impact: 3,
    field: "schema",
    tags: ["universal"],
    explanation:
      "BreadcrumbList muestra la ruta de navegación en los resultados y refuerza la arquitectura del sitio.",
    check: (p) =>
      p.depth >= 2 && !p.schemaTypes.includes("BreadcrumbList")
        ? {
            current: "(sin BreadcrumbList)",
            problem: "Página interna sin marcado de migas de pan.",
            suggestion: "Agregar JSON-LD BreadcrumbList reflejando Inicio → Categoría → Página.",
          }
        : null,
  },

  // ---------- SEO LOCAL ----------
  {
    id: "local-nap",
    kind: "opportunity",
    name: "Datos NAP incompletos",
    category: "local",
    severity: "important",
    impact: 5,
    field: "nap",
    tags: ["universal"],
    appliesTo: (p) => p.pageType === "contact" || p.pageType === "home",
    explanation:
      "Nombre, dirección y teléfono consistentes son la base del SEO local y del posicionamiento en Maps.",
    check: (p) => {
      const missing: string[] = [];
      if (!p.localSignals?.phone) missing.push("teléfono");
      if (!p.localSignals?.address) missing.push("dirección");
      if (!p.localSignals?.openingHours) missing.push("horarios");
      return missing.length
        ? {
            current: `Detectado: ${
              [
                p.localSignals?.phone ? "teléfono" : null,
                p.localSignals?.address ? "dirección" : null,
              ]
                .filter(Boolean)
                .join(", ") || "nada"
            }`,
            problem: `Faltan señales locales: ${missing.join(", ")}.`,
            suggestion:
              "Publicar nombre, dirección, teléfono y horarios en texto (no solo en imagen) y replicarlos en el pie.",
          }
        : null;
    },
  },
  {
    id: "local-business-schema",
    kind: "opportunity",
    name: "LocalBusiness ausente",
    category: "local",
    severity: "improvement",
    impact: 4,
    field: "schema",
    tags: ["universal"],
    appliesTo: (p) => p.pageType === "contact" || p.pageType === "home",
    explanation:
      "LocalBusiness conecta el sitio con la ficha de empresa y refuerza las señales geográficas.",
    check: (p) =>
      p.schemaTypes.some((t) => /LocalBusiness|Store|Organization/i.test(t))
        ? null
        : {
            current: "(sin LocalBusiness / Organization)",
            problem: "No hay marcado de negocio con datos de contacto y ubicación.",
            suggestion: "Agregar JSON-LD LocalBusiness con address, telephone, geo y openingHours.",
          },
  },

  // ---------- REGLAS ESPECÍFICAS DE PLATAFORMA ----------
  {
    id: "tn-product-title-format",
    kind: "heuristic",
    name: "Título de producto poco optimizado",
    category: "onpage",
    severity: "important",
    impact: 6,
    field: "title",
    tags: ["tiendanube"],
    appliesTo: (p) => p.pageType === "product",
    explanation:
      "En Tienda Nube el nombre del producto alimenta el title. Incluir tipo de producto + atributo + marca capta búsquedas long tail.",
    check: (p) => {
      const t = p.title ?? "";
      return t && t.split(/\s+/).length < 5
        ? {
            current: t,
            problem: "El título del producto es demasiado escueto.",
            suggestion: `${t} — talle, color y uso principal | Outdoor Patagonia`,
          }
        : null;
    },
  },
  {
    id: "ml-title-length",
    kind: "onpage",
    name: "Título de publicación fuera de rango",
    category: "onpage",
    severity: "important",
    impact: 7,
    field: "title",
    tags: ["mercadolibre"],
    appliesTo: (p) => p.pageType === "product",
    explanation:
      "Mercado Libre limita el título a 60 caracteres y prioriza el formato Producto + Marca + Modelo + Atributo.",
    check: (p) => {
      const t = (p.title ?? "").trim();
      if (!t) return null;
      if (t.length <= 60 && t.split(/\s+/).length >= 4) return null;
      return {
        current: `${t} (${t.length} caracteres)`,
        problem:
          t.length > 60
            ? "El título supera el límite de la publicación."
            : "El título no sigue el formato Producto + Marca + Modelo + Atributo.",
        suggestion: t.length > 60 ? t.slice(0, 60).trim() : `${t} Original Talle M`,
      };
    },
  },
  {
    id: "ml-attributes",
    kind: "onpage",
    name: "Atributos de ficha incompletos",
    category: "content",
    severity: "important",
    impact: 6,
    field: "attributes",
    tags: ["mercadolibre"],
    appliesTo: (p) => p.pageType === "product",
    explanation:
      "Los atributos de la ficha técnica se usan en filtros y en el buscador interno; incompletos reducen visibilidad.",
    check: (p) => {
      const filled = Number(p.source?.["attributesFilled"] ?? 0);
      const total = Number(p.source?.["attributesTotal"] ?? 0);
      return total > 0 && filled / total < 0.8
        ? {
            current: `${filled}/${total} atributos completos`,
            problem: "La ficha técnica tiene atributos sin completar.",
            suggestion: "Completar marca, modelo, material, talle y color en la ficha técnica.",
          }
        : null;
    },
  },

  // ---------- ENLAZADO / RASTREO (requieren contexto del sitio) ----------
  {
    id: "broken-internal-links",
    kind: "technical",
    name: "Enlaces internos rotos",
    category: "technical",
    severity: "critical",
    impact: 8,
    field: "internalLinks",
    tags: ["universal"],
    explanation:
      "Un enlace interno que responde 4xx/5xx desperdicia rastreo, corta la navegación y deja páginas sin recibir autoridad interna.",
    check: (p, site) => {
      const broken = (site.brokenLinks ?? []).filter((b) => b.from === p.url);
      if (!broken.length) return null;
      return {
        severity: broken.length > 3 ? "critical" : "important",
        current: `${broken.length} enlace(s) roto(s)`,
        evidence: broken.slice(0, 10).map((b) => `${b.to} → HTTP ${b.status}`),
        problem: "La página enlaza a URLs que responden con error.",
        suggestion:
          "Actualizar el destino del enlace o redirigir 301 la URL antigua a la equivalente vigente.",
      };
    },
  },
  {
    id: "internal-link-redirects",
    kind: "technical",
    name: "Enlaces internos hacia redirecciones",
    category: "technical",
    severity: "improvement",
    impact: 3,
    field: "internalLinks",
    tags: ["universal"],
    explanation:
      "Enlazar a una URL que redirige añade un salto innecesario. Conviene enlazar directamente al destino final.",
    check: (p, site) => {
      const redirects = site.coverage?.redirects ?? [];
      if (!redirects.length) return null;
      const hits = p.internalLinks.filter((l) =>
        redirects.some((r) => r.from.replace(/\/$/, "") === l.href.replace(/\/$/, "")),
      );
      if (!hits.length) return null;
      return {
        current: `${hits.length} enlace(s) hacia URLs que redirigen`,
        evidence: hits.slice(0, 10).map((h) => h.href),
        problem: "Hay enlaces internos que pasan por una redirección.",
        suggestion: "Reemplazar el href por la URL final para evitar saltos intermedios.",
      };
    },
  },
  {
    id: "duplicate-meta-description",
    kind: "onpage",
    name: "Meta description duplicada",
    category: "onpage",
    severity: "improvement",
    impact: 3,
    field: "metaDescription",
    tags: ["universal"],
    explanation:
      "Descripciones repetidas producen snippets iguales para páginas distintas y reducen el CTR de cada resultado.",
    check: (p, site) => {
      if (!has(p.metaDescription)) return null;
      const twins = site.pages.filter(
        (o) => o.id !== p.id && o.metaDescription === p.metaDescription,
      );
      return twins.length
        ? {
            current: p.metaDescription!,
            evidence: twins.slice(0, 8).map((t) => t.url),
            problem: `La misma descripción se repite en ${twins.length} URL(s).`,
            suggestion: "Escribir una descripción propia que resuma el contenido de esta URL.",
          }
        : null;
    },
  },
  {
    id: "orphan-page",
    kind: "opportunity",
    name: "Página sin enlaces entrantes internos",
    category: "content",
    severity: "important",
    impact: 6,
    field: "internalLinks",
    tags: ["universal"],
    explanation:
      "Una URL sin enlaces internos entrantes depende solo del sitemap: se rastrea peor y recibe muy poca autoridad interna.",
    appliesTo: (p) => p.depth > 0 && p.statusCode < 300,
    check: (p, site) => {
      // Solo evaluable si se analizó más de una página del sitio.
      if (site.pages.length < 2) return null;
      const norm = (u: string) => u.replace(/\/$/, "");
      const inbound = site.pages.filter(
        (o) => o.id !== p.id && o.internalLinks.some((l) => norm(l.href) === norm(p.url)),
      );
      return inbound.length === 0
        ? {
            current: "0 enlaces internos entrantes detectados",
            problem: "Ninguna página analizada enlaza a esta URL.",
            suggestion:
              "Enlazarla desde su categoría, desde el menú o desde contenidos relacionados.",
          }
        : null;
    },
  },
];

export const RECOMMENDED_SCHEMA: Record<string, string[]> = {
  home: ["WebSite", "Organization"],
  product: ["Product"],
  category: ["ItemList"],
  article: ["Article"],
  contact: ["LocalBusiness"],
  landing: [],
  other: [],
};

export const CATEGORY_LABELS: Record<Category, string> = {
  onpage: "On-page",
  technical: "Técnico",
  "structured-data": "Datos estructurados",
  performance: "Rendimiento / UX",
  local: "SEO local",
  content: "Contenido y enlazado",
  authority: "Autoridad y competencia",
};

export const KIND_LABELS: Record<FindingKind, string> = {
  technical: "Problema técnico",
  indexation: "Problema de indexación",
  onpage: "Problema on-page",
  opportunity: "Oportunidad",
  heuristic: "Recomendación (heurística)",
};

export const KIND_HINTS: Record<FindingKind, string> = {
  technical: "Hecho verificable en la respuesta del servidor o el HTML.",
  indexation: "Afecta directamente el rastreo o la indexación de la URL.",
  onpage: "Elemento on-page ausente, duplicado o mal formado.",
  opportunity: "Mejora de contenido o enlazado interno, no un error.",
  heuristic: "Buena práctica habitual del sector, no una regla de Google.",
};

/** Etiqueta tolerante con auditorías guardadas antes de clasificar por naturaleza. */
export function kindLabel(kind?: FindingKind) {
  return kind ? (KIND_LABELS[kind] ?? "Hallazgo") : "Hallazgo";
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Crítico",
  important: "Importante",
  improvement: "Mejora",
  ok: "Correcto",
};

/** Peso de cada categoría en el SEO Score ponderado. */
export const CATEGORY_WEIGHTS: Record<Category, number> = {
  technical: 0.3,
  onpage: 0.25,
  content: 0.15,
  "structured-data": 0.12,
  performance: 0.1,
  local: 0.08,
  authority: 0,
};

export function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function slug(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function rulesForPlatform(tags: string[]) {
  return RULES.filter((r) => r.tags.some((t) => t === "universal" || tags.includes(t)));
}

export type { Finding };

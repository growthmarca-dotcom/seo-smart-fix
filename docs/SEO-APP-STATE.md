# Estado del proyecto — SEO Fixer (base de MarCa Audit)

> Producto confirmado: **MarCa Audit**, mercado inicial turismo y alojamientos.
> Estado del MVP y backlog: `docs/MARCA-AUDIT-PRODUCT.md`.

> Snapshot de arquitectura y estado por fase.Documento de referencia vivo;
> actualizar al cerrar cada fase. Fecha de esta revisión: corresponde al estado
> del código en el repositorio al momento de sincronizar esta documentación.

## Resumen ejecutivo

SEO Fixer es una aplicación SaaS de auditoría y optimización SEO con un **motor
universal** agnóstico de plataforma. Las plataformas (web genérica, Tienda Nube,
Mercado Libre) funcionan como conectores independientes que alimentan snapshots
normalizados al mismo Audit Engine. Hoy funciona **end-to-end con datos demo**
("Outdoor Patagonia") y con rastreo real de sitios web públicos.

Persistencia y autenticación son simuladas vía `localStorage` y están preparadas
para reemplazarse por un backend real (Lovable Cloud). No hay escritura automática
en sitios de terceros en el MVP genérico.

## Stack

- **Framework:** TanStack Start v1 (React 19, Vite 8, SSR/edge).
- **Routing:** TanStack Router (file-based, `src/routes`).
- **Server functions:** `createServerFn` (`@tanstack/react-start`).
- **UI:** Tailwind v4 + shadcn/ui + lucide-react + recharts.
- **Tests:** Vitest.
- **Persistencia actual:** `localStorage` (`src/store/app-store.ts`).

## Estado por fase

| Fase | Nombre | Estado |
|------|--------|--------|
| 1 | Fundación (modelos, motor, crawler, UI base, demo) | ✅ Completa |
| 2 | Endurecimiento del motor y crawler | ✅ Completa |
| 2.1 | Ajuste final del crawler (robots, sitemap, enlaces rotos, KPIs, score "Salud SEO") | ✅ Completa |
| 2.3 | Diagnóstico técnico accionable + prioridad por hallazgo (sin GSC) | ✅ Completa |
| 3 | SEO On-Page contextual por tipo de página | ✅ Completa |
| 4 | Arquitectura y enlazado interno | ✅ Completa |
| 5 | Contenido y oportunidades SEO | ✅ Completa |
| 6A | Google Search Console (lectura) | ✅ Completa |
| 6B | Correlación GSC + auditoría + priorización | ✅ Completa |
| 7A | Motor SEO e-commerce agnóstico de plataforma | ✅ Completa |
| 7B | Tienda Nube (lectura) | ✅ Completa |
| 7C | Mercado Libre (lectura) | 🔶 Solo código preparatorio/mock (estado C) |
| —  | Evidence Engine (evidencia estructurada) | 🔶 Fases 1, 1.1, 1.2 completas (3 reglas migradas) |
| MVP-1 | Informe profesional imprimible/PDF (`audits.$auditId.report.tsx`) | ✅ Implementado (pendiente de prueba con cliente real) |
| —  | Persistencia/autenticación real (Lovable Cloud) | ⛔ No iniciada |
| —  | GA4, PageSpeed/Core Web Vitals, Google Business Profile | ⛔ No iniciadas |
| —  | IA / sugerencias generativas | ⛔ No iniciada |

## Motor y reglas

- **Reglas universales + contextuales:** 48 reglas en `src/seo/rules.ts`
  (on-page, técnico, structured data, rendimiento, SEO local, e-commerce,
  arquitectura, contexto por tipo de página).
- **Severidades:** `critical | important | improvement | ok`.
- **Naturaleza del hallazgo (`FindingKind`):** `technical | indexation | onpage |
  content | structure | images | opportunity | heuristic` (separa hechos de
  heurísticas/opiniones).
- **Score:** ponderado por categoría con `drivers` (puntos por regla) y cobertura.
  No es garantía de ranking.

## Crawler

- Descubrimiento combinado: **robots.txt + sitemap.xml (index + hijos) + enlaces
  internos**.
- Límite configurable (50/100/500/1000), tope duro `MAX_CRAWL_LIMIT = 1000`.
- Respeto opcional de robots.txt con grupos por user-agent.
- Normalización de URLs (dropping de params de tracking) con registro de motivos.
- Verificación de enlaces con presupuesto escalable y clasificación de estados
  (`ok | redirect | not-found | gone | forbidden | rate-limited | server-error |
  timeout | network-error`), diferenciando rotura definitiva (404/410) de temporal.
- Reporte de cobertura: descubiertas, analizadas, excluidas (con motivo), errores.
- **Limitación documentada:** no ejecuta JavaScript; sin Core Web Vitals reales.

## Diagnóstico técnico (Fase 2.3)

- Capa derivada (`src/seo/diagnostics.ts`): combina hallazgo + regla + `score.driver`.
- Cada `Diagnostic` lleva: problema, ubicación, severidad, impacto estimado en
  puntos, evidencia, recomendación, ocurrencias y estado `pending` (regla
  incompleta).
- **Prioridad por hallazgo sin GSC:** `relevance`, `ease`, `priorityLabel`
  (alta/media/baja) y `priorityExplanation`, derivadas SOLO de severidad + campo
  editable, reusando `severityRelevance` / `editableFieldEase` del núcleo compartido
  (`src/seo/priority/factors.ts`).
- `groupDiagnostics` agrupa por regla y ordena por severidad → prioridad →
  relevancia + facilidad.

## GSC (6A/6B)

- Importación de filas GSC (CSV) con deduplicación por `auditId` + propiedad +
  fecha + dimensiones.
- Correlación GSC ↔ crawler ↔ diagnósticos ↔ arquitectura ↔ contenido.
- Oportunidades tipificadas (CTR bajo, margen de posición, visibilidad + problema
  SEO, etc.) con índice 0–100 **explicable** (factores impact/evidence/relevance/
  ease con pesos y razones). No es el SEO Score.
- Aislamiento estricto por `auditId`; una conexión GSC como máximo por auditoría.

## E-commerce (7A/7B)

- **7A:** detección de e-commerce ponderada y 22 señales agnósticas de plataforma.
- **7B:** adapter Tienda Nube → modelo normalizado → motor 7A. OAuth oficial en
  `src/lib/tiendanube.server.ts`; tokens solo servidor, nunca en respuestas al
  cliente ni en el store. Matching con el crawler por normalización local.
- Capa de comercio agnóstica (`src/seo/commerce/*`): match, dedupe, to-snapshots.

## Conectores

- `generic-web` (rastreo real), `tiendanube` (lectura real + OAuth),
  `mercadolibre` (descriptor preparatorio, sin API real — estado C).
- Contrato único `PlatformConnector` con `capabilities` (read/write por campo).
- Agregar plataforma = nuevo conector + registro en `src/seo/connectors/index.ts`.

## Estado de Mercado Libre

**C — Solo código preparatorio/mock.** Existe el descriptor del conector
(`src/seo/connectors/mercadolibre.ts`) y reglas placeholder (`ml-title-length`,
`ml-attributes`), pero no hay cliente de API, flujo OAuth ni adapter funcional.
Próximo paso recomendado: Fase 7C (lectura) siguiendo el patrón de Tienda Nube.

## Gaps conocidos (no bloqueantes para demo)

- **Evidence Engine** en progreso: `finding.evidence` es `EvidenceItem[]`;
  solo 3 reglas estructuradas, el resto texto libre con baja cobertura (~25% de reglas) y sin formato
  estructurado común. Propuesta aprobada (no implementada): tipo unión
  `EvidenceItem` estructurado con render uniforme.
- Sin backend de persistencia/autenticación (store en `localStorage`).
- Sin métricas de rendimiento reales (PageSpeed/Core Web Vitals).
- Crawler sin render JS.

## robots.txt y fiabilidad del rastreo (oct 2026)

- Política explícita: apply / no-rules (404 o vacío) / ignored (desactivado) / restricted-unverified (ilegible → solo home).
- "Disallow: /" con Allow que reabre rutas ya no detiene la auditoría.
- noindex se detecta por meta robots y X-Robots-Tag solo en páginas descargadas; las bloqueadas figuran como "no verificadas".
- El informe lista la política aplicada y las URLs no analizadas por causa.
- Tests: src/lib/crawl.server.test.ts.

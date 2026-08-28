# Roadmap — SEO Fixer

> Hoja de ruta priorizada. Las fases marcadas ✅ están completas en código;
> 🔶 están parcialmente preparadas; ⛔ no iniciadas. El orden sugerido respeta
> el principio de no acoplar el núcleo a una plataforma.

## Principios del roadmap

1. **Núcleo universal primero.** El motor trabaja sobre `PageSnapshot`; las
   plataformas son conectores.
2. **Cada fase es aditiva y aislada** por `auditId`. No se rehace el núcleo.
3. **No inventar APIs ni credenciales.** Integración real solo cuando existan
   credenciales/autorización.
4. **MVP genérico sin escritura automática** en sitios de terceros: aprobar +
   exportar/instruir.

## Completado

### Fase 1 — Fundación ✅
Modelos (`types.ts`), HTML parser (`html.ts`), motor de reglas (`engine.ts`,
`rules.ts`), crawler servidor (`crawl.server.ts`), UI base (dashboard, nueva
auditoría, resultados, detalle de URL), datos demo "Outdoor Patagonia".

### Fase 2 — Endurecimiento del motor y crawler ✅
Límites 50–1000, descubrimiento sitemap + links, reglas suavizadas, score
ponderado con drivers, score explanation y cobertura en la UI.

### Fase 2.1 — Ajuste final del crawler ✅
robots.txt con grupos por user-agent; sitemap index + hijos sin bucles; enlaces
rotos con clasificación (404/410 vs 429/5xx); KPIs claros; score "Salud SEO";
detalle de URL con indexabilidad, canonical y profundidad.

### Fase 2.3 — Diagnóstico técnico accionable ✅
Capa `diagnostics.ts` (derivada, solo lectura). Problema, impacto estimado en
puntos, evidencia, ubicación exacta, recomendación. Acciones: ver URL, ver
regla, marcar como revisado, aprobar/rechazar/aplicar. Agrupación por regla.
**Prioridad por hallazgo sin GSC** (`relevance`, `ease`, `priorityLabel`,
`priorityExplanation`) reusando el núcleo compartido `priority/factors.ts`.

### Fase 3 — SEO On-Page contextual por tipo de página ✅
`page-profiles.ts` (8 tipos) y reglas contextuales. No toca crawler ni scoring
global. Panel `PageContextPanel` muestra aplicabilidad por regla.

### Fase 4 — Arquitectura y enlazado interno ✅
`link-graph.ts`: huérfanas, conectividad, profundidad. Ruta
`audits.$auditId.architecture.tsx`. Solo lectura sobre el crawl.

### Fase 5 — Contenido y oportunidades SEO ✅
`content-signals.ts` (11 señales) + `content-analysis.ts` (tokenización,
clustering, duplicado/canibalización). Ruta `audits.$auditId.content.tsx`.

### Fase 6A — Google Search Console (lectura) ✅
Modelo GSC, importación CSV deduplicada, matching local, oportunidades. Datos
mock para "Outdoor Patagonia". Ruta `audits.$auditId.gsc.tsx`.

### Fase 6B — Correlación GSC + auditoría + priorización ✅
`priority/correlate.ts`: oportunidades tipificadas con índice 0–100 explicable
(impact/evidence/relevance/ease). Ruta `audits.$auditId.priorities.tsx`.

### Fase 7A — Motor SEO e-commerce agnóstico ✅
`ecommerce/detect.ts` (detección ponderada) + `ecommerce/signals.ts`
(22 señales). Capa de comercio agnóstica (`commerce/*`).

### Fase 7B — Tienda Nube (lectura) ✅
Adapter Tienda Nube → normalizado → motor 7A. OAuth oficial en servidor.
Tokens solo servidor. Matching con crawler. Aislamiento `auditId` + `storeId`.

## En progreso / preparado

### Fase 7C — Mercado Libre (lectura) 🔶
**Estado C — preparatorio/mock.** Descriptor de conector + reglas placeholder,
sin API/OAuth real. Próximo paso: implementar lectura siguiendo el patrón de
Tienda Nube (adapter → modelo normalizado → motor 7A), cuando existan
credenciales/autorización.

## No iniciado (priorizado)

### Evidence Engine ⛔ (pausado por instrucción)
Evidencia estructurada común por hallazgo. Propuesta aprobada: tipo unión
`EvidenceItem` (`{ kind, label, value, url? }`) con render uniforme y migración
gradual sin romper `string[]` existente. **No implementar hasta instrucción
explícita.**

### Backend real (persistencia + autenticación) ⛔
Reemplazar el store `localStorage` por Lovable Cloud: PostgreSQL con RLS,
auth (login/Google/Apple), storage. Migrar el modelo existente sin cambiar
las acciones del store (las UI ya consumen `actions`, no el storage directo).

### PageSpeed / Core Web Vitals ⛛
Integración preparada: el crawler ya guarda `htmlSizeKb`, `responseMs`,
`hasViewport`; falta el conector real a PageSpeed para métricas LCP/CLS/INP.

### Google Business Profile ⛛
SEO local: hoy detecta NAP y `LocalBusiness`. Falta conector GBP para
gestión de ficha y reseñas.

### GA4 ⛛
Analítica de tráfico para cruzar con oportunidades (no inicio de sesión, solo
datos agregados).

### Autoridad / backlinks / competencia ⛛
Módulo preparado en el roadmap original, sin implementar.

### IA / sugerencias generativas ⛛
Generación de title/meta/ALT sugeridos. No iniciado.

## Orden sugerido

1. Fase 7C (Mercado Libre lectura) — cierra el set de conectores e-commerce.
2. Backend real (Lovable Cloud) — habilita multiusuario y persistencia.
3. Evidence Engine — consistencia de evidencia entre reglas.
4. PageSpeed / Core Web Vitals — métricas de rendimiento reales.
5. Google Business Profile + GA4 + autoridad — profundización.
6. IA generativa — aceleración de sugerencias.

## Control de cambios

Cada fase cerrada debe:
- No romper tests existentes (`bunx vitest run`).
- No acoplar el núcleo a una plataforma.
- Mantener aislamiento por `auditId`.
- Documentar el estado en `docs/SEO-APP-STATE.md`.

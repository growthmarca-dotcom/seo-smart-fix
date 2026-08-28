# Arquitectura — SEO Fixer

> Documento de arquitectura. Describe capas, contratos y flujo de datos. La
> regla rectora: **el núcleo es un motor SEO universal; las plataformas son
> conectores**.

## Diagrama de capas

```text
 ┌─────────────────────────────────────────────────────────────────┐
 │                          UI (src/routes, src/components)         │
 │  Dashboard · Nueva auditoría · Auditoría (pestañas) · Detalle URL │
 │  Sugerencias y cambios · Integraciones · Reglas · Historial       │
 └───────────────▲───────────────────────────────▲───────────────────┘
                 │ useAppState (store)           │ server functions (RPC)
 ┌───────────────┴───────────────┐  ┌────────────┴────────────────────┐
 │  Store cliente (app-store)     │  │  Server functions (*.functions)  │
 │  - audits, changes, history   │  │  - crawlSiteFn / analyzeUrlFn    │
 │  - gsc, stores, storeImports  │  │  - tiendanubeStatusFn/ImportFn   │
 │  - settings, reviewed          │  │  - gsc (import/opportunities)    │
 │  persistencia: localStorage    │  └────────────┬────────────────────┘
 └───────────────▲───────────────────────────────┘               │
                 │                                          ┌─────▼───────┐
                 │                                          │  *.server   │
                 │                                          │ crawl.server │
                 │                                          │ tiendanube..│
                 │                                          │ gsc.server  │
                 │                                          └─────┬───────┘
 ┌───────────────┴────────────────────────────────────────────────▼──────────┐
 │                    NÚCLEO SEO UNIVERSAL (src/seo)                          │
 │                                                                            │
 │  types.ts ── PageSnapshot, Finding, Audit, Severity, Category, SiteContext │
 │                                                                            │
 │  html.ts ───────── parseHtml → PageSnapshot                                │
 │  engine.ts ─────── runAudit(site, tags, disabled) → {findings, score}      │
 │  rules.ts ──────── RULES (48) universales + contextuales + por plataforma  │
 │  page-profiles.ts  expectativas por tipo de página (Fase 3)                │
 │                                                                            │
 │  Capas derivadas (solo lectura):                                           │
 │  ├─ diagnostics.ts   (Fase 2.3)  hallazgo + regla + score.driver + prioridad │
 │  ├─ link-graph.ts    (Fase 4)   huérfanas, conectividad, profundidad        │
 │  ├─ content-signals.ts         11 señales de contenido                      │
 │  ├─ content-analysis.ts (Fase 5) duplicado, similitud, canibalización       │
 │  ├─ ecommerce/*      (Fase 7A)  detección + 22 señales agnósticas           │
 │  ├─ gsc/*            (Fase 6A)  import + normalize + opportunities          │
 │  └─ priority/*      (Fase 6B)  correlación + índice 0–100 explicable        │
 │       └─ factors.ts  núcleo compartido: severityRelevance / editableFieldEase │
 └────────────────────────────────────────────────────────────────────────────┘
                 ▲                                              ▲
                 │                                              │
 ┌───────────────┴──────────────┐               ┌────────────────┴───────────┐
 │   Conectores (src/seo/      │               │   Adapter plataforma       │
 │        connectors/)         │               │   src/seo/tiendanube/      │
 │  generic-web · tiendanube · │               │   adapter.ts (normaliza)   │
 │  mercadolibre               │               └────────────────────────────┘
 │  Contrato: PlatformConnector │
 │  (capabilities read/write)  │
 └─────────────────────────────┘
```

## Contrato central: `PlatformConnector`

Todo conector implementa la misma interfaz (`src/seo/connectors/types.ts`):

```ts
interface PlatformConnector {
  id: PlatformId;
  name: string;
  status: "available" | "planned" | "needs-credentials";
  authModel: "none" | "oauth2" | "api-key";
  ruleTags: string[];            // reglas específicas habilitadas
  capabilities: FieldCapability[]; // read/write por campo
  fetchSnapshots?(input): Promise<{ pages: PageSnapshot[]; ... }>;
}
```

Agregar una plataforma = nuevo archivo conector + registro en
`connectors/index.ts`. El motor **nunca** pregunta "¿es Tienda Nube?"; solo
ejecuta reglas sobre `PageSnapshot` y aplica `ruleTags`.

## Modelo de datos (núcleo)

- **`PageSnapshot`** — representación normalizada de una página/producto/publicación.
  Agnóstica de plataforma: el crawler web y los adapters de e-commerce producen
  el mismo tipo.
- **`SiteContext`** — contexto del sitio: rootUrl, platform, robots, sitemap,
  `pages: PageSnapshot[]`, brokenLinks, coverage.
- **`Finding`** — hallazgo: `ruleId`, `pageId`, `category`, `kind`
  (`technical|indexation|onpage|content|structure|images|opportunity|heuristic`),
  `severity`, `impact` (1–10), `field?`, `current`, `problem`, `explanation`,
  `suggestion?`, `evidence?` (`string[]`).
- **`Audit`** — `pages`, `findings`, `score`, `coverage`, `progress`, meta.
- **`Score`** — `total`, por categoría, `drivers` (puntos por regla), cobertura.

## Motor de auditoría

`runAudit(site, tags, disabledRules)` en `src/seo/engine.ts`:
1. Para cada `PageSnapshot`, ejecuta las `RULES` aplicables (universales +
   `tags` del conector), excluyendo `disabledRules`.
2. Cada regla produce `Finding[]` con severidad, impacto, evidencia y sugerencia.
3. Agrega hallazgos a nivel sitio (contenido duplicado, enlaces rotos, huérfanas).
4. Calcula el **score ponderado** por categoría con `drivers` por regla.

Las reglas contextuales (Fase 3) consultan `page-profiles.ts` para ajustar
expectativas por `pageType` (home, producto, categoría…) sin tocar el scoring global.

## Crawler (solo servidor)

`src/lib/crawl.server.ts` produce un `SiteContext`:
- Robots.txt: parseo de grupos por user-agent, `Disallow/Allow`, `Sitemap`.
- Sitemap.xml: index + hijos (profundidad limitada, sin bucles).
- Enlaces internos: extraídos del HTML parseado.
- Normalización: dropping de params de tracking, deduplicación con motivos.
- Verificación de enlaces: presupuesto escalable, clasificación de estados,
  distinción rotura definitiva (404/410) vs temporal (429/5xx/timeout).
- Cobertura: descubiertas, analizadas, excluidas (con `ExclusionReason`), errores.

`crawl.functions.ts` expone `crawlSiteFn` y `analyzeUrlFn` como `createServerFn`.

## Diagnóstico (Fase 2.3)

`src/seo/diagnostics.ts` es **derivada y de solo lectura**: no ejecuta reglas ni
recalcula score. Toma `Audit.findings` + la `RULE` que los originó + `score.driver`
y produce `Diagnostic` con prioridad por hallazgo. La prioridad reusa el núcleo
compartido `priority/factors.ts` (`severityRelevance`, `editableFieldEase`) sobre
las escalas de `priority/types.ts` (`PRIORITY_SCALES`). **No depende de GSC.**

## GSC + priorización (6A/6B)

- `src/seo/gsc/*`: tipos, import (dedup por auditId+propiedad+fecha+dimensiones),
  normalize (matching local), opportunities, demo.
- `src/seo/priority/*`: `correlate.ts` cruza GSC ↔ crawler ↔ diagnósticos ↔
  arquitectura ↔ contenido y produce `SeoOpportunity` con `priorityIndex` 0–100
  **explicable** (factores `impact/evidence/relevance/ease` con pesos y razones).
- `priority/factors.ts` es el **núcleo compartido**: lo usan tanto 6B (como
  porción de `relevanceFactor`/`easeFactor`) como 2.3 (prioridad por hallazgo).

## E-commerce (7A/7B)

- `src/seo/ecommerce/*`: detección ponderada de tienda + 22 señales agnósticas.
- `src/seo/commerce/*`: capa de comercio agnóstica (match, dedupe, to-snapshots).
- `src/seo/tiendanube/adapter.ts`: normaliza la respuesta de Tienda Nube al
  modelo del núcleo. `src/lib/tiendanube.server.ts`: OAuth + lectura. **Tokens
  solo servidor**; nunca en respuestas al cliente ni en el store.

## Server boundaries

- `createServerFn` desde `@tanstack/react-start` para lógica app-interna.
- `*.functions.ts` = wrappers finos; `*.server.ts` = lógica de red/IO.
- `process.env` se lee **dentro** del handler.
- Tokens de OAuth nunca cruzan al cliente.
- Rutas externas/webhooks bajo `src/routes/api/public/*`.

## Estado y persistencia

`src/store/app-store.ts` es un store React con `useSyncExternalStore` y
persistencia en `localStorage` (`seo-fixer:state:v1`). Toda la UI consume
`actions`, no el storage directo → preparado para reemplazo por backend real
(Lovable Cloud) sin tocar la UI.

Aislamiento: `audits`, `changes`, `gsc`, `stores`, `storeImports`, `reviewed`
se filtran siempre por `auditId`. Al borrar una auditoría se borran solo SUS
datos relacionados.

## UI / routing

- TanStack Router file-based en `src/routes`. `__root.tsx` monta shell + `<Outlet>`.
- Cada ruta tiene su `head()` (title, description, og).
- shadcn/ui + Tailwind v4 (tokens semánticos). Sidebar fija. Responsive.
- Componentes de dominio en `src/components/*` (`seo-ui`, `diagnostic`,
  `content-ui`, `link-graph-ui`, `page-context-ui`, `priority-ui`,
  `ecommerce-ui`, `commerce-ui`).

## Extensibilidad

- **Nueva plataforma:** conector + registro. El motor no cambia.
- **Nueva regla:** agregar a `rules.ts` con `category`, `severity`, `impact`,
  `field?`, `explanation`, `suggestion?`. Las reglas contextuales usan perfiles.
- **Nueva capa derivada:** solo lectura sobre `Audit`; no mutar el score ni el
  crawl. Aislar por `auditId`.
- **Nueva integración (GSC/PageSpeed/GBP/GA4):** conector de integración en
  `src/seo/<name>/*` + server function; no acoplar al núcleo.

## Limitaciones de arquitectura (documentadas)

- Crawler sin render JS (enlaces client-side no descubiertos).
- Sin Core Web Vitals reales (PageSpeed pendiente).
- Mercado Libre: descriptor preparatorio, sin API real.
- Sin backend de persistencia/autenticación (store en localStorage).

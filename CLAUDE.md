# CLAUDE.md

Guía para agentes (Claude y similares) que trabajan en el repositorio de **SEO Fixer**.
Este archivo NO es código ni configuración: es orientación para no romper la arquitectura.

## Reglas de oro

1. **El núcleo es un MOTOR SEO UNIVERSAL.** No acoples lógica a Tienda Nube, Mercado
   Libre ni a ninguna plataforma concreta. Las plataformas son **conectores**
   que implementan `PlatformConnector` (`src/seo/connectors/types.ts`) y alimentan
   snapshots normalizados (`PageSnapshot`) al mismo Audit Engine.
2. **No inventar APIs ni credenciales.** Si un conector no tiene credenciales, lanza
   un error explícito. Nunca devuelvas datos ficticios como si fueran reales.
3. **Aislamiento por `auditId`.** Toda pantalla, store action, sugerencia,
   diagnóstico y oportunidad pertenece a UNA auditoría. Las conexiones (GSC, tiendas)
   nunca comparten datos entre auditorías.
4. **El SEO Score es ponderado y explicado**, no una garantía de ranking. Mostrar
   siempre categorías, drivers y cobertura para que el usuario entienda el resultado.
5. **No modificar el crawler, el scoring global, ni las reglas existentes** salvo que
   la tarea lo pida explícitamente. Cada fase se documenta como aditiva y aislada.

## Limpieza de capas (qué toca cada capa)

| Capa | Archivos | Responsabilidad |
|------|----------|-----------------|
| Modelos | `src/seo/types.ts` | Tipos agnósticos de plataforma (`PageSnapshot`, `Finding`, `Audit`, `Severity`, etc.). |
| Crawler | `src/lib/crawl.server.ts`, `src/lib/crawl.functions.ts` | Descubrimiento (robots + sitemap + links), normalización, verificación de enlaces. Solo servidor. |
| Motor / Reglas | `src/seo/engine.ts`, `src/seo/rules.ts`, `src/seo/html.ts` | Ejecuta reglas sobre `PageSnapshot` y calcula el score ponderado. |
| Contexto On-Page | `src/seo/page-profiles.ts`, `src/seo/page-context.ts` | Expectativas por tipo de página (home, producto, categoría…). No toca scoring. |
| Arquitectura | `src/seo/link-graph.ts` | Huérfanas, conectividad, profundidad. Solo lectura sobre el crawl. |
| Contenido | `src/seo/content-signals.ts`, `src/seo/content-analysis.ts` | Contenido pobre, duplicado, canibalización. No toca scoring. |
| Diagnóstico (2.3) | `src/seo/diagnostics.ts` | Capa derivada: combina hallazgo + regla + score.driver. Prioridad por hallazgo sin GSC. |
| GSC (6A/6B) | `src/seo/gsc/*`, `src/seo/priority/*` | Importación GSC, correlación y priorización explicable 0–100. |
| E-commerce (7A) | `src/seo/ecommerce/*` | Detección y señales de tienda, agnósticas de plataforma. |
| Tienda Nube (7B) | `src/seo/tiendanube/*`, `src/lib/tiendanube.*` | Adapter + OAuth/lectura. Tokens nunca cruzan al cliente. |
| Conectores | `src/seo/connectors/*` | Contrato único. Agregar plataforma = nuevo archivo + registro en `index.ts`. |
| Store (cliente) | `src/store/app-store.ts` | Estado + persistencia localStorage. Preparado para reemplazo por backend real. |
| UI | `src/routes/*`, `src/components/*` | TanStack Router (file-based) + shadcn/ui. Cada ruta tiene su propio `head()`. |

## Convenciones

- **TanStack Start v1** (React 19, Vite 8, SSR/edge). No usar React Router DOM ni `src/pages`.
- **Server functions** con `createServerFn` desde `@tanstack/react-start`. Los
  `*.functions.ts` son wrappers finos; la lógica de red/IO vive en `*.server.ts`.
  Lee `process.env` **dentro** del handler, nunca en module scope.
- **Rutas**: una ruta por archivo en `src/routes`. No editar `src/routeTree.gen.ts`.
  Toda ruta padre debe renderizar `<Outlet />`.
- **Estilos**: Tailwind v4 vía `src/styles.css` con tokens semánticos. No hardcodear
  colores (`text-white`, `bg-[#...]`); usar tokens del tema.
- **Tests**: Vitest. `*.test.ts` junto al código. Los tests existentes son la red de
  seguridad; no romperlos al refactorizar.
- **i18n**: la UI está en es-AR. Mantener ese idioma en textos de usuario.

## Datos demo

- Tienda ficticia **"Outdoor Patagonia"** en `src/seo/demo.ts`, marcada `isDemo: true`.
- Permite recorrer el flujo completo sin credenciales reales.
- Nunca borrar ni mezclar datos demo con datos reales en el mismo render.

## Limitaciones conocidas (documentadas, no simuladas)

- El crawler **no ejecuta JavaScript**: los enlaces generados en cliente no se descubren.
- No hay **Core Web Vitals reales** (requiere integración de PageSpeed, pendiente).
- **Mercado Libre** está en estado **C — preparatorio/mock**: descriptor del conector
  y reglas placeholder, sin API/OAuth real.
- Sin backend de persistencia/autenticación: el store usa `localStorage` (preparado
  para reemplazo por Lovable Cloud).

## Qué NO hacer

- No agregar integraciones no listadas en el roadmap (GA4, PageSpeed, GBP, IA)
  salvo que el usuario lo pida explícitamente.
- No implementar escritura automática en sitios de terceros en el MVP genérico:
  registrar/aprobar y ofrecer exportación/instrucciones.
- No mezclar datos entre auditorías. No guardar tokens en el store cliente.
- No saltarse el contrato `PlatformConnector` para "casos especiales" de plataforma.

## Verificación rápida tras un cambio

```sh
bun run lint            # eslint
bun run build           # build de producción (detecta errores SSR/edge)
bunx vitest run         # tests unitarios
```

La preview en vivo está en el editor; para flujos de UI usar el preview del navegador.

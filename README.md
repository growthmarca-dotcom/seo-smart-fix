# SEO Fixer Hub

Crear desde cero una aplicación SaaS llamada SEO Fixer. Quiero una base sólida, modular y ampliable: NO debe quedar diseñada exclusivamente para Tienda Nube o Mercado Libre. El núcleo debe ser un MOTOR SEO UNIVERSAL y las plataformas deben funcionar como conectores independientes.

OBJETIVO: una herramienta de auditoría y optimización SEO lo más automática posible. Para una web genérica, el usuario introduce una URL raíz y la aplicación debe poder descubrir URLs mediante sitemap.xml y rastreo interno, analizar página por página y mostrar exactamente en qué URL está cada problema. También debe existir análisis puntual de una URL. Para plataformas e-commerce, preparar arquitectura de conectores para Tienda Nube y Mercado Libre; la conexión real por API/OAuth se implementará posteriormente cuando estén disponibles las credenciales/autorización. NO inventar APIs ni credenciales.

ARQUITECTURA:
- SEO Core / Audit Engine universal.
- Crawler/URL discovery para sitios web públicos.
- Platform Connectors independientes: Generic Web, Tienda Nube, Mercado Libre, preparados para agregar WordPress/WooCommerce/Shopify posteriormente.
- Rule Engine para reglas SEO universales y reglas específicas por plataforma.
- Suggestion Engine: Actual → Problema → Explicación → Sugerencia → Aprobar/Rechazar → Aplicar.
- Change Manager e historial para saber qué cambios fueron aprobados/aplicados.
- Integrations layer preparada para Google Search Console, Analytics, PageSpeed y Google Business Profile como módulos futuros.
- No acoplar la UI a una sola plataforma.

AUDITORÍA SEO UNIVERSAL — incluir como mínimo:
1. On-page: title, meta description, H1/H2/H3, estructura de headings, URL, contenido pobre, contenido duplicado, intención/temática, imágenes, nombres de archivo, ALT, enlaces internos, anchor text.
2. Técnico: indexability, noindex, robots.txt, sitemap.xml, canonical, códigos HTTP, redirects, 404, enlaces rotos, URLs duplicadas, profundidad de clics y arquitectura.
3. Structured data: detectar y validar de forma básica Schema.org y recomendar tipos cuando correspondan: Organization, LocalBusiness, Product, Article, Breadcrumb, FAQ, Event, WebSite, etc.
4. Rendimiento/UX cuando sea técnicamente posible: mobile, imágenes pesadas, Core Web Vitals/PageSpeed como integración preparada.
5. SEO local: señales locales, NAP, LocalBusiness y preparación para Google Business Profile.
6. Oportunidades de contenido y enlazado interno.
7. Preparar futuro módulo de autoridad/backlinks y competencia sin implementarlo todavía.

PRIORIZACIÓN: no limitarse a contar errores. Cada hallazgo debe tener categoría, severidad e impacto estimado. Severidades: Crítico, Importante, Mejora, Correcto. Priorizar problemas que realmente puedan afectar rastreo/indexación/posicionamiento antes que detalles menores. Explicar brevemente por qué importa.

SCORE: crear un SEO Score ponderado por categorías, pero no tratarlo como garantía de ranking. Mostrar categorías y factores para que el usuario entienda el resultado.

FLUJO WEB GENÉRICA:
1. Nueva auditoría.
2. Introducir URL raíz.
3. Descubrir sitemap.xml si existe y URLs internas mediante crawling.
4. Mostrar progreso: URLs descubiertas, URLs analizadas, problemas encontrados.
5. Tabla de resultados por URL.
6. Filtros por tipo de página, severidad, categoría y estado.
7. Abrir detalle de cualquier URL y ver cada hallazgo.
8. Generar sugerencias editables.
9. Aprobar/rechazar cambios.
10. Mostrar pantalla de cambios aprobados y, cuando exista integración capaz de escribir, aplicar. Para el MVP genérico, no modificar sitios de terceros automáticamente; registrar/aprobar y ofrecer exportación/instrucciones. Preparar interfaz para conectores que sí permitan escritura.

CONTROL DE CRAWL: permitir límites configurables de URLs (50, 100, 500, 1000, etc.) y evitar crawling indiscriminado. Mostrar claramente progreso y errores. Preparar arquitectura para respetar robots.txt y límites de rastreo.

TIENDA NUBE / MERCADO LIBRE:
- Crear pantallas de conexión, estado de integración y selección de tienda/cuenta.
- No implementar OAuth/API ficticio.
- Definir interfaces/adapters para que cuando tengamos credenciales/documentación se conecten al mismo Audit Engine.
- Para Tienda Nube, preparar análisis de productos, categorías, imágenes, títulos, descripciones y campos SEO que la API real permita.
- Para Mercado Libre, preparar análisis de publicaciones/productos, títulos, categorías, atributos, descripción e imágenes según datos realmente disponibles por su API.
- Cada conector debe poder declarar qué campos puede leer y cuáles puede modificar.

DATOS DEMO: crear una tienda demo llamada “Outdoor Patagonia”, con productos y páginas ficticias realistas. El usuario debe poder probar de punta a punta: Dashboard → auditoría → resultados por URL → detalle → sugerencia → aprobar → cambios → historial. Marcar claramente que son datos demo.

PANTALLAS:
- Dashboard
- Nueva auditoría
- Auditoría / resultados
- Detalle de URL/producto
- Sugerencias y cambios pendientes
- Integraciones / Conectores
- Historial
- Configuración
- Reglas SEO

DASHBOARD: score general, auditorías recientes, URLs analizadas, problemas críticos/importantes, oportunidades, evolución del score y CTA Nueva auditoría.

UI: SaaS profesional, moderna, limpia y orientada a productividad. Sidebar izquierda. Tablas potentes con búsqueda, filtros y orden. Badges de severidad. Vista detalle muy clara con Actual vs Sugerido. Responsive. Usar Tailwind + shadcn/ui.

ARQUITECTURA DE CÓDIGO: separar tipos/modelos, motor de reglas, crawler, conectores, sugerencias y UI. Diseñar interfaces para agregar nuevos conectores y módulos sin rehacer el núcleo. Mantener la app preparada para autenticación y persistencia real.

IMPORTANTE: construir una aplicación funcional con datos demo y flujo completo, no una landing page. Priorizar una base técnica limpia y extensible. El producto final debe poder evolucionar a un SaaS de auditoría/optimización SEO integral para agencias y comercios.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://seo-smart-fix.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2814231e-5723-4b81-9ed9-a8fafdd2467b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

# Manual de usuario — SEO Fixer

> Guía funcional para usar SEO Fixer con la tienda demo **"Outdoor Patagonia"**
> y con sitios web reales. Pensada para agencias y comercios que auditan SEO.

## Primeros pasos

Al abrir la app por primera vez, SEO Fixer crea automáticamente una auditoría
demo de **"Outdoor Patagonia"** (marcada como demo) para que puedas recorrer el
flujo completo sin conectar nada. Desde el **Dashboard** ves el score general,
auditorías recientes, URLs analizadas, problemas críticos/importantes y la
evolución del score.

## Navegación (sidebar)

| Sección | Para qué sirve |
|---------|----------------|
| **Dashboard** | Score general, KPIs y evolución. CTA "Nueva auditoría". |
| **Nueva auditoría** | Crear una auditoría (URL raíz o conector). |
| **Auditorías** | Listado de auditorías con búsqueda y filtros. |
| **Sugerencias y cambios** | Hallazgos convertidos en sugerencias editables; aprobar/rechazar/aplicar. Filtrable por auditoría. |
| **Integraciones** | Estado de conectores (web genérico, Tienda Nube, Mercado Libre) y Google Search Console. |
| **Reglas SEO** | Ver y activar/desactivar reglas universales y por plataforma. |
| **Historial** | Línea de tiempo de acciones (auditorías, cambios aprobados, etc.). |
| **Configuración** | Límite de rastreo por defecto, respeto de robots.txt, marca, locale. |

## Flujo de auditoría (web genérica)

1. **Nueva auditoría** → ingresá la **URL raíz** (ej. `https://ejemplo.com`).
2. Elegí el **límite de URLs** (50/100/500/1000) y si se respeta robots.txt.
3. SEO Fixer descubre el **sitemap.xml** (incluye index e hijos) y rastrea
   enlaces internos, normalizando y deduplicando URLs.
4. Se muestra **progreso**: URLs descubiertas, analizadas, problemas encontrados.
5. En la auditoría ves: **score de Salud SEO**, cobertura, tabla de resultados
   por URL con filtros por tipo de página, severidad, categoría y estado.
6. Abrí el **detalle de cualquier URL** para ver cada hallazgo (actual vs.
   sugerido), indexabilidad, canonical, profundidad, enlaces, imágenes, schema.

## Análisis puntual de una URL

Desde Nueva auditoría podés analizar una sola URL sin rastrear todo el sitio:
te devuelve el snapshot de esa página y sus hallazgos.

## Pestañas dentro de una auditoría

- **Resumen** — score, cobertura, KPIs, categorías.
- **Prioridades SEO** — oportunidades priorizadas (requiere GSC) con índice 0–100
  explicable: "esta oportunidad está priorizada porque…".
- **Arquitectura** — páginas huérfanas, conectividad, profundidad de clics.
- **Contenido** — contenido pobre, duplicado, similitud, canibalización potencial.
- **E-commerce** — (si la auditoría es tienda) detección y señales de producto.
- **Google Search Console** — importar filas GSC y ver oportunidades correlacionadas.

## Diagnóstico técnico accionable

Cada hallazgo se convierte en un diagnóstico con:
- **Problema** y **ubicación exacta** (URL + path).
- **Impacto estimado** en puntos de score.
- **Evidencia** (cuando la regla la provee).
- **Prioridad** (alta/media/baja) con explicación, sin depender de GSC.
- Acciones: **Ver URL**, **Ver regla**, **Marcar como revisado**,
  **Aprobar / Rechazar / Aplicar**.

Los diagnósticos se agrupan por regla, ordenados por severidad y prioridad.

## Sugerencias y cambios

- Cada hallazgo con campo editable genera una **sugerencia editable**
  (actual → sugerido). Podés editar el valor sugerido antes de aprobar.
- Estados: `pending → approved → applied` (o `rejected`).
- El selector "Todas las auditorías" + una opción por auditoría aísla los cambios.
- En el MVP genérico **no se modifica el sitio de terceros automáticamente**:
  los cambios aprobados se registran y se ofrece exportación/instrucciones. La
  UI ya está preparada para conectores con escritura (Tienda Nube declara
  campos `write`).

## Integraciones

### Web genérica
Rastreo real de sitios públicos. No requiere credenciales.

### Google Search Console (lectura)
Importá un CSV de GSC para una auditoría. Las filas se deduplican y se cruzan
con las URLs rastreadas. Modo demo disponible para "Outdoor Patagonia".

### Tienda Nube (lectura)
Conectá vía OAuth (requiere `TIENDANUBE_*` env vars). Importa productos y
categorías normalizados que alimentan el motor e-commerce. Una importación
pertenece siempre a UNA auditoría y UNA tienda.

### Mercado Libre
**Preparatorio.** Visible en Integraciones como conector con estado
"necesita credenciales", sin API real todavía.

## Reglas SEO

- Activá/desactivá reglas universales y específicas de plataforma.
- Las reglas desactivadas se excluyen del score en nuevas auditorías.
- Cada regla declara categoría, severidad, impacto y (opcional) campo editable.

## Configuración

- **Límite de rastreo por defecto** y **respeto de robots.txt**.
- **Marca** y **locale** (por defecto es-AR).
- Las preferencias se guardan en el navegador (preparado para backend real).

## Datos demo

La auditoría demo de "Outdoor Patagonia" está marcada con un badge **Demo**.
Podés probar de punta a punta: Dashboard → auditoría → resultados por URL →
detalle → sugerencia → aprobar → cambios → historial, sin tocar datos reales.

## Limitaciones conocidas (documentadas en la UI)

- El crawler **no ejecuta JavaScript**: los enlaces generados en cliente no se
  descubren.
- No hay **Core Web Vitals reales** (pendiente integración PageSpeed).
- Sin backend de usuarios: el estado se guarda en el navegador del equipo.

## Preguntas frecuentes

**¿El SEO Score garantiza ranking?** No. Es una salud SEO ponderada por
categorías para priorizar trabajo. Muestra siempre los factores y la cobertura.

**¿Puedo auditar una tienda Tienda Nube?** Sí, con credenciales OAuth. Sin
credenciales, usá la auditoría demo o el rastreo web genérico de la URL pública.

**¿Se modifica mi sitio automáticamente?** No en el MVP genérico. Se aprueban
cambios y se ofrecen instrucciones/exportación. Los conectores con escritura
(Tienda Nube) están preparados para aplicar campos en el futuro.

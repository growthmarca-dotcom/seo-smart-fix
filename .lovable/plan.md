# MarCa Audit — Plan revisado: diagnóstico integral de negocio

Todo lo numérico (umbrales, pesos, criticidades) es **propuesta sujeta a aprobación**. Nada se implementa hasta autorización explícita por etapa.

## 1. Diagnóstico de lo que existe hoy

| Pieza | Estado comprobado | Archivo |
|---|---|---|
| Motor SEO, rastreador, reglas, score SEO, Evidence Engine | Funcional, no se toca | `src/seo/*`, `src/lib/crawl.*` |
| Informe SEO individual (A4) | Funcional, queda intacto | `audits.$auditId.report.tsx` |
| Evaluación comercial turística | 10 controles por **auditoría**, estados Verificado / Requiere revisión / No aplica + "Sin evaluar" implícito, notas, URL de evidencia, sugerencias | `src/seo/tourism/commercial-review.ts`, `audits.$auditId.commercial.tsx` |
| Empresas + Roadmap A–G | CRUD, vínculo con auditorías, informe de empresa | `src/companies/*` |
| Rubros existentes | Alojamiento turístico, Hotel, Cabañas/dúplex, Hostel, Restaurante/gastronomía, Inmobiliaria, E-commerce, Otro | `src/companies/model.ts` |
| Plantilla de roadmap genérica | **Copia de la turística** (`GENERIC_TEMPLATE` mapea fases de `TOURISM_TEMPLATE`) | `src/companies/templates.ts` |
| Diagnóstico integral Etapa A | Lógica pura: 6 dimensiones, 27 controles con origen, pesos por perfil, `MIN_COVERAGE = 0.5` y **renormalización** de pesos | `src/diagnosis/*` |
| Persistencia | Solo localStorage | `src/store/app-store.ts` |

Problemas a corregir del plan anterior:
- La Etapa A **redistribuye** el peso de dimensiones faltantes: produce un índice aparentemente completo. Se reemplaza por criterio de suficiencia (sección 4).
- No existe estado "Sin datos" distinto de "Sin evaluar"; "No aplica" no exige justificación.
- Hay controles duplicados conceptualmente entre `commercial-review.ts` y `diagnosis/dimensions.ts` (WhatsApp, reservas, OTA, propuesta de valor, celular).
- No existe el rubro "Servicios profesionales".

## 2. Matriz de los diez controles turísticos

"Verificado" hoy significa "revisado y en condiciones"; "Requiere revisión" = problema u observación pendiente.

| Control actual | Qué mide | Evidencia posible | Dimensión(es) | Decisión |
|---|---|---|---|---|
| property-info | Tipo, ubicación, capacidad claros | Captura/URL del sitio; parte detectable (texto de página) | web | Adaptar → control genérico "oferta clara" con guía por rubro; reemplaza `web-offer-clarity` |
| photos-description | Fotos y descripción explican la propuesta | Capturas, conteo de imágenes (detectable parcial) | web, brand | Reutilizar como `brand-content` con variante turismo |
| contact-whatsapp | Contacto visible y funcional | Prueba manual + enlaces wa.me/tel detectables | channels | Fusionar con `ch-whatsapp` (una sola fuente) |
| booking-engine | Camino de reserva claro | Recorrido probado, URL motor | channels, sales | Fusionar con `ch-booking` (genérico "reserva/compra/solicitud") |
| rates-policies | Tarifas, condiciones, políticas | Página de políticas, captura | sales | Exclusivo turismo (equivalentes por rubro: carta/precios, envíos/devoluciones) |
| mobile-path | Consulta/reserva desde el celular | Prueba en teléfono | web | Fusionar con `web-mobile` |
| ota-consistency | Coherencia sitio ↔ OTAs | URLs Booking/Airbnb, capturas | visibility | Exclusivo turismo; fusionar con `vis-ota` |
| value-proposition | Diferenciación | Evaluación profesional | brand | Fusionar con `brand-value` |
| trust | Reseñas, políticas, datos verificables | Reseñas, URL perfiles | visibility | Adaptar: se divide la parte reseñas (`vis-reviews`) y confianza del sitio (web) — requiere decisión |
| measurement | Medición de consultas/reservas | Declaración cliente, presencia de etiquetas (detectable parcial) | sales | Fusionar con `sales-conversion` (renombrar "medición de consultas y conversión") |

Regla de fuente única: los controles fusionados se identifican por un **mapa de equivalencias** (id turístico → id de diagnóstico). El valor editado sigue guardado donde está hoy (evaluación por auditoría) y el diagnóstico de empresa lo **lee** de la auditoría vinculada; si ambos tienen valor, se muestra el conflicto, no se elige en silencio. Ningún control turístico pasa a SEO.

## 3. Plantillas por actividad (diseño, no se construyen todavía)

Rubros: se mantienen los existentes. Se propone **agregar "Servicios profesionales"** (estudios, consultoras, salud, oficios) porque hoy caen en "Otro" y su ciclo de venta (consulta → presupuesto → seguimiento) difiere del comercio. Requiere aprobación (cambio aditivo en `Industry`).

| Rubro | Detectable automáticamente | Informa el cliente | Evaluación profesional |
|---|---|---|---|
| Turismo y alojamientos | Salud SEO, enlaces WhatsApp/tel, presencia de motor de reservas, datos estructurados de alojamiento | Canal de reservas principal, % OTA vs directo, tiempo de respuesta, estacionalidad | Recorrido de reserva, coherencia OTA, propuesta de valor, fotos |
| Gastronomía | Carta publicada (HTML vs PDF/imagen), horarios en el sitio, enlaces a delivery/reservas | Volumen de reservas/pedidos, plataformas de delivery usadas, ticket promedio (si lo mide) | Perfil de mapas y reseñas, fotos de platos, recorrido de reserva/pedido |
| Comercio y e-commerce | Fichas de producto, carrito, señales e-commerce existentes (`src/seo/ecommerce`), políticas de envío/devolución | Tasa de abandono, medios de pago, logística | Recorrido de compra completo, confianza en checkout, catálogo |
| Servicios profesionales | Página de servicios, formulario, datos de contacto, casos/testimonios | Fuente de clientes, tiempo de respuesta, formato y tasa de aceptación de presupuestos | Claridad de especialidad, credenciales visibles, proceso de consulta |
| Inmobiliarias | Listado de propiedades, fichas con fotos/precio/ubicación, formularios por propiedad | Portales usados, respuesta a consultas, captación de propietarios | Calidad de fichas, coherencia con portales, seguimiento de interesados |
| Empresas generales | Salud SEO, contacto visible, oferta descripta | Objetivos comerciales, canales actuales, medición | Claridad de oferta, marca, canales desaprovechados |

La plantilla de roadmap genérica dejará de copiar fases turísticas: cada rubro tendrá tareas derivadas de sus propios controles (Etapa D).

## 4. Rubros, dimensiones y suficiencia (propuesta)

Tres conceptos separados:

**a) Relevancia por dimensión (peso hipotético, suma 100)**

| Rubro | Web | Visibilidad | Ventas | Marca | Canales | Oportun. | Justificación comercial |
|---|---|---|---|---|---|---|---|
| Turismo | 20 | 20 | 20 | 10 | 20 | 10 | Reserva directa vs OTA y reputación deciden la venta |
| Gastronomía | 10 | 30 | 15 | 15 | 20 | 10 | La decisión ocurre en mapas y reseñas |
| E-commerce | 30 | 10 | 20 | 10 | 20 | 10 | El sitio es el punto de venta |
| Serv. profesionales | 15 | 20 | 25 | 15 | 15 | 10 | Venta consultiva: respuesta y presupuesto |
| Inmobiliaria | 15 | 15 | 25 | 10 | 20 | 15 | Seguimiento de interesados y portales |
| General | 20 | 15 | 20 | 15 | 15 | 15 | Sin sesgo fuerte |

Criterios para validar: aplicar a 3–5 casos reales de MarCa por rubro y comparar el orden de prioridades con el juicio del consultor; ajustar si el índice contradice sistemáticamente al profesional.

**b) Criticidad de controles:** cada control se marca `crítico` / `estándar` por rubro. Ej.: turismo críticos = recorrido de reserva, contacto funcional, coherencia OTA; gastronomía = perfil de mapas, reseñas, horarios; e-commerce = recorrido de compra, salud del sitio, políticas.

**c) Suficiencia para publicar un índice (umbrales propuestos):**
- Por dimensión: cobertura = evaluados / aplicables. Se muestra **siempre** madurez (0–100 sobre lo evaluado) + cobertura.
- Cobertura total = evaluados / aplicables en todas las dimensiones; se muestra siempre.
- Índice global solo si: cobertura total ≥ 70 %, cada dimensión con peso ≥ 20 tiene cobertura ≥ 50 %, y **todos** los controles críticos del rubro están evaluados.
- Si no se cumple: rótulo "Diagnóstico parcial", madurez por dimensión y lista de lo que falta; **sin** índice global ni redistribución de pesos.
- Estados distintos, ninguno vale cero: `Sin evaluar` (nadie lo revisó), `Sin datos` (se intentó y no hay información disponible; cuenta como no cubierto), `No aplica` (se excluye del denominador **solo con justificación escrita obligatoria**).
- Integraciones futuras no cuentan como faltantes hasta que estén conectadas.

## 5. Modelo de hallazgo de negocio

```text
Hallazgo
  problema observado        texto concreto
  tipo de afirmación        hecho comprobado | declaración del cliente | hipótesis profesional
  evidencia[]               EvidenceItem reutilizado (URL, captura, fragmento) + fuente
  método                    automático | cliente | profesional | integración
  dimensión / control       vínculo al control que lo origina
  impacto posible           redactado en condicional ("puede reducir consultas"), sin cifras no medidas
  prioridad + justificación alta/media/baja con motivo (criticidad + cercanía a la venta)
  recomendación             acción concreta
  esfuerzo / urgencia       opcional; vacío = "No estimado"
  roadmap                   id de tarea vinculada (opcional)
  servicio MarCa            opcional, solo si hay mapa control → servicio aprobado
```
Los hallazgos SEO existentes no cambian; el control `web-seo-health` resume su score y enlaza al informe SEO.

## 6. Utilidad comercial del informe de empresa

Secciones: Situación actual (madurez y cobertura) · Fortalezas (controles "Verificado") · Dónde puede estar perdiendo oportunidades (hallazgos, en condicional) · Qué mejorar primero y por qué (orden por prioridad justificada) · Servicios relacionados.

Vínculo con servicios: tabla editable **control → servicio MarCa** aprobada por MarCa. Un servicio aparece solo si hay un hallazgo abierto en un control mapeado, y se muestra junto al hallazgo que lo justifica. Sin hallazgo, no hay servicio. Bloque separado y rotulado "Servicios de MarCa Growth relacionados", sin precios. Catálogo de servicios: **pendiente de que MarCa lo provea** (no se inventa).

## 7. Ejemplo ficticio (rotulado "Caso ficticio — Cabañas Ejemplo")

```text
CASO FICTICIO — datos inventados solo para ilustrar el formato
Diagnóstico parcial · Cobertura total 58 % (umbral 70 %)
Falta para el índice: control crítico "Coherencia en OTAs" sin evaluar
Web 72 (cob. 80 %) · Visibilidad 45 (cob. 60 %) · Ventas — (cob. 25 %, insuficiente)
Fortaleza: WhatsApp visible y probado (hecho comprobado, captura 12/10)
Hallazgo alta: el motor de reservas abre en otra web sin volver al sitio
  (hecho comprobado) → puede llevar al huésped a reservar por intermediarios
  Acción: integrar reserva en la página de cada cabaña · Roadmap fase C
  Servicio relacionado: Optimización de reserva directa (si MarCa lo aprueba)
Declaración del cliente: "70 % de reservas llegan por Booking" (no verificado)
```

## 8. Etapas de implementación

| Etapa | Contenido | Archivos | Requiere aprobación de persistencia |
|---|---|---|---|
| A2 | Corregir lógica pura: quitar renormalización, estados `no-data`, justificación de No aplica, criticidad, suficiencia, rubro servicios profesionales en perfiles | `src/diagnosis/*`, tests | No |
| A3 | Mapa de equivalencias turismo ↔ diagnóstico y lectura sin duplicar | `src/diagnosis/equivalences.ts` nuevo | No |
| B | Pantalla de diagnóstico por empresa | nueva ruta `companies.$companyId_.diagnosis.tsx`, store | **Sí**: nuevo campo `diagnoses` por empresa en localStorage, aditivo, ausente = vacío |
| B2 | Rubro "Servicios profesionales" | `companies/model.ts` | **Sí**: valor nuevo de `Industry`, empresas antiguas sin cambios |
| C | Hallazgos de negocio + sección en informe de empresa | `company-report.ts`, ruta del informe | Sí, si se guardan hallazgos manuales |
| D | Plantillas de roadmap por rubro (solo empresas nuevas o regeneración explícita) | `companies/templates.ts` | No (roadmaps existentes intactos) |
| E | Mapa control → servicio MarCa | nuevo módulo de configuración | Sí; requiere catálogo de MarCa |
| F | Dashboard reposicionado | `routes/index.tsx` | No |
| G | Integraciones (GBP, PageSpeed, GA4) | — | Fuera de alcance |

Dependencias: A2 → A3 → B → C → E; D y F independientes tras B.

Riesgos: doble edición de controles fusionados (mitigado con fuente única y aviso de conflicto); usuarios leyendo madurez parcial como resultado final (rótulo obligatorio); pesos no validados (rotulados "propuestos"); localStorage sin respaldo.

Pruebas de regresión:
- Suite completa existente (195) sin cambios; demo Outdoor Patagonia y duplexdelcentro mantienen hallazgos y score SEO.
- Nuevos: Sin evaluar/Sin datos/No aplica nunca valen cero; No aplica sin justificación se rechaza; sin crítico evaluado → "Diagnóstico parcial" y sin índice; no hay renormalización; equivalencias no duplican controles; datos antiguos sin `diagnoses` cargan sin error; servicio solo aparece con hallazgo vinculado; informe SEO idéntico antes/después.

## Decisiones pendientes de MarCa
1. Umbrales (70 % total, 50 % por dimensión relevante, críticos completos).
2. Matriz de pesos y criticidad por rubro.
3. Agregar rubro "Servicios profesionales".
4. División del control "Confianza".
5. Catálogo de servicios MarCa Growth para el mapa control → servicio.
6. Aprobación del nuevo campo de persistencia por empresa (Etapa B).

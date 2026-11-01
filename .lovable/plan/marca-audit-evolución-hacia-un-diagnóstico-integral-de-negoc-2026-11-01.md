# MarCa Audit: evolución hacia un diagnóstico integral de negocio

## 1. Cómo está hoy el proyecto

Lo que ya existe y se reutiliza:

| Módulo | Qué hace hoy | Estado |
|---|---|---|
| Auditoría SEO (rastreador, reglas, puntuación, evidencias, informe PDF) | Puntuación SEO 0–100 ponderada por 6 categorías técnicas. Es la única puntuación del sistema. | Completo. No se toca. |
| Evaluación comercial turística | 10 controles manuales con estados Verificado / Requiere revisión / No aplica, notas, URL de evidencia y sugerencias desde el rastreo. No suma puntos. | Completo, pero **pertenece a una auditoría SEO**, no a la empresa. |
| Empresas | Ficha, rubro (8 rubros), contacto, estado, auditorías asociadas. | Completo. |
| Roadmap | Fases A–G con tareas, estados, responsables, fechas, evidencias y avance (sin contar «No aplica»). Plantilla turismo y plantilla genérica (que hoy es una copia de la de turismo). | Completo. |
| Informe de empresa | Identificación, avance, auditorías asociadas y roadmap completo en PDF A4. | Completo (Etapas 1 y 2). |
| Integraciones | Search Console y Tienda Nube parciales; Google Business, PageSpeed y GA4 solo figuran como planificadas. | Parcial. |
| Guardado | Todo vive en el navegador (localStorage), en un único estado versionado. | Sin cambios. |

**Problemas de posicionamiento que se ven en el código:**
- El Dashboard muestra «SEO Score ponderado» como indicador principal. Es la única cifra global que existe.
- La evaluación comercial está colgada de una auditoría SEO. Sin una auditoría no hay forma de evaluar el negocio.
- Las fases del roadmap ya cubren varias dimensiones (B, D, E, F), pero ninguna produce un diagnóstico, solo tareas.
- No hay un lugar donde registrar lo que informa el cliente (canales, cómo responde, presupuestos, reseñas).

## 2. Cómo encajan las seis dimensiones

| Dimensión | Detectable por el sistema hoy | Debe aportarlo el cliente | Evaluación profesional | Integración futura (requiere permisos) |
|---|---|---|---|---|
| 1. Presencia digital y sitio web | Auditoría SEO completa, señales de móvil, contacto visible y datos estructurados | Plataforma del sitio y accesos | Claridad de la oferta, recorrido de compra o reserva | PageSpeed, Search Console |
| 2. Visibilidad y reputación | Solo señales del propio sitio (datos locales, enlaces a redes) | Perfiles existentes y volumen de reseñas | Calidad de las reseñas y de las respuestas | Google Business / Maps |
| 3. Comercialización y ventas | Nada, salvo los formularios y botones del sitio | Tiempos de respuesta, presupuestos, seguimiento y conversión | Proceso comercial | CRM (no planificado) |
| 4. Marca, comunicación y contenidos | Señales de contenido (contenido pobre, duplicados) | Manual de marca y redes | Coherencia, tono y propuesta de valor | Ninguna |
| 5. Canales y experiencia del cliente | Presencia de WhatsApp, formularios y motor de reservas en el sitio | Canales activos y fidelización | Prueba real de los recorridos | Ninguna |
| 6. Oportunidades y desarrollo comercial | Nada | Competidores conocidos y objetivos | Análisis profesional | Semrush u otras (no planificado) |

Conclusión: solo la dimensión 1 tiene detección automática fuerte. Las demás dependen sobre todo de información del cliente y de la evaluación profesional. El diseño debe mostrar esa diferencia en lugar de esconderla.

## 3. Principios de diseño propuestos

1. **El diagnóstico integral pertenece a la empresa, no a una auditoría SEO.** La auditoría SEO pasa a ser una fuente de evidencia más dentro de la dimensión 1.
2. **Cada control declara su origen:** detectado, informado por el cliente, evaluación profesional o integración futura. El informe muestra el origen de cada dato.
3. **Sin datos no es cero.** Cada control queda en uno de cuatro estados:
   - Sin evaluar
   - Cumple
   - Requiere mejora
   - No aplica

   «Sin evaluar» y «No aplica» no suman ni restan.
4. **Cada dimensión informa su madurez junto con su cobertura**, por ejemplo «Madurez 60 % · 4 de 7 controles evaluados». Si la cobertura no llega a un mínimo (por ejemplo el 50 %), la dimensión se muestra como «Diagnóstico incompleto» y no entra en el índice global.
5. **El índice global es opcional y configurable por rubro.** Se calcula como un promedio ponderado solo de las dimensiones con cobertura suficiente, y reparte el peso entre esas dimensiones. Siempre se muestra junto a «basado en X de 6 dimensiones». Los pesos por rubro son fijos en el código al principio (turismo, gastronomía, e-commerce, genérico) y el profesional no los edita en la primera versión.
6. **El SEO no domina.** La puntuación SEO entra como **un solo indicador** dentro de la dimensión 1, junto a los controles manuales de esa dimensión. Nunca reemplaza a la dimensión entera ni al índice global.
7. **No se migra nada existente.** Los 10 controles comerciales turísticos se reutilizan como origen de datos: se leen desde la auditoría asociada y se muestran en las dimensiones 1 y 5. No se mueven ni se copian.

## 4. Plan por etapas (bajo riesgo primero)

**Etapa A: catálogo de dimensiones (sin pantallas ni cambios de datos)**
- Definir las 6 dimensiones, sus controles iniciales por rubro y el origen de cada control.
- Definir los pesos por rubro y el cálculo de madurez, cobertura e índice global como funciones puras con pruebas.
- Sin ningún cambio visible para el usuario.

**Etapa B: diagnóstico integral por empresa (la primera pieza vendible)**
- Nueva pantalla «Diagnóstico integral» dentro de la ficha de empresa, con las 6 dimensiones.
- Cada control se puede marcar con un estado y llevar notas y URL de evidencia.
- La dimensión 1 muestra de solo lectura la puntuación SEO de la auditoría asociada y los controles comerciales ya evaluados.
- **Requiere tu aprobación expresa:** agregar al estado guardado un apartado nuevo con los diagnósticos por empresa. Es un cambio aditivo, no modifica los datos existentes, y los datos guardados antes se cargan con el diagnóstico vacío.

**Etapa C: informe de empresa con diagnóstico integral**
- Nueva sección «Diagnóstico integral» en el informe de empresa, ubicada antes del roadmap.
- Muestra la madurez y la cobertura por dimensión, el índice global con su aclaración, el origen de cada dato y los controles que requieren mejora.
- El informe SEO individual queda igual.

**Etapa D: conexión diagnóstico → roadmap**
- Desde un control marcado «Requiere mejora», ofrecer «Crear tarea en el roadmap» en la fase correspondiente.
- Es siempre una acción explícita del usuario y nunca automática.
- No cambia las plantillas ni la lógica de avance.

**Etapa E: reposicionar la interfaz**
- El Dashboard pasa a mostrar las empresas y su diagnóstico integral como vista principal.
- El SEO Score queda como una tarjeta del módulo SEO.
- Se revisan los textos que presentan al producto como «SEO Fixer».
- Solo cambios de presentación.

**Etapa F (futura, con permisos): integraciones**
- Google Business / Maps para la dimensión 2 y PageSpeed para la dimensión 1.
- Cada una alimentaría controles con origen «integración» y no se implementa sin credenciales reales.

## 5. Qué se preserva sin cambios

- El motor SEO, sus reglas, el rastreador, la puntuación SEO y el sistema de evidencias.
- La evaluación comercial y su ubicación dentro de cada auditoría.
- Las Empresas y su relación con las auditorías.
- Las plantillas del roadmap y la lógica de avance y de «No aplica».
- El informe SEO individual y el informe de empresa actual. La Etapa C solo agrega una sección.
- El guardado en el navegador. Solo se suma un apartado nuevo en la Etapa B, sujeto a aprobación.

## 6. Riesgos y dependencias

- **Duplicación con la evaluación comercial:** se evita leyendo esos controles sin copiarlos. El riesgo es que el mismo dato se edite en dos pantallas; la propuesta es que solo se edite en su pantalla original.
- **Índice global malinterpretado:** se mitiga con la cobertura obligatoria y la exclusión de dimensiones incompletas. Aun así, conviene validar con un cliente real cómo se lee.
- **Espacio en el navegador:** se suman datos al mismo almacenamiento local, con riesgo de llegar al límite. Pasar a Lovable Cloud queda como decisión separada.
- **Rubros distintos de turismo:** hoy la plantilla genérica copia a la de turismo. Los controles por rubro necesitan tu definición de contenido para gastronomía, inmobiliaria y e-commerce.
- **Pesos por rubro:** son una decisión de negocio de MarCa. Propondré valores iniciales para que los apruebes.

## 7. Pruebas necesarias

- Madurez y cobertura por dimensión, con «Sin evaluar» y «No aplica» excluidos del cálculo.
- Dimensión con poca cobertura que no entra al índice global, y reparto de pesos entre las demás.
- Pesos distintos según rubro, y un rubro sin configuración que usa los pesos genéricos.
- El SEO aporta un solo indicador y una puntuación SEO baja no puede bajar el índice global más allá del peso de su dimensión.
- Los datos guardados antes de este cambio se cargan con el diagnóstico vacío, sin perder auditorías, empresas, roadmaps ni evaluaciones.
- El informe de empresa se genera con y sin diagnóstico, y el PDF A4 de varias páginas sale sin cortes.
- Regresión: las 182 pruebas actuales siguen pasando.

## Detalles técnicos

- **Nuevo módulo puro** `src/diagnosis/`:
  - `dimensions.ts`: catálogo de dimensiones y controles, con el origen de cada control y en qué rubros aplica.
  - `weights.ts`: pesos por rubro.
  - `scoring.ts`: madurez, cobertura e índice global.
  - `model.ts`: el tipo `CompanyDiagnosis` con `companyId`, los controles por id (estado, notas, URL de evidencia y fecha) y una función que normaliza los datos guardados antes de este cambio.
  - Pruebas `*.test.ts` junto a cada archivo.
- **Lectura sin copia:** la puntuación SEO se lee con `audit.score.total` y la evaluación comercial con `state.commercialReviews` de las auditorías en `company.auditIds`.
- **Store (Etapa B):** agregar `diagnoses: CompanyDiagnosis[]` al estado de `src/store/app-store.ts`, con acciones `diagnosisActions.setControl`. Al cargar datos guardados antes de este cambio, `diagnoses` empieza vacío. Al borrar una empresa se borra su diagnóstico.
- **Rutas:**
  - `src/routes/companies.$companyId_.diagnosis.tsx`: pantalla de diagnóstico, siguiendo la misma convención que `edit` y `report`.
  - Botón de acceso en `companies.$companyId.tsx`.
  - Nueva sección en `companies.$companyId_.report.tsx`, que reutiliza `Section`, `Meta`, `break-inside-avoid` y el estilo A4 actual.
- **Sin cambios en:** `src/seo/*`, `src/lib/crawl.*`, `src/companies/templates.ts`, `src/companies/model.ts` (salvo un eventual ajuste en `remove` para borrar el diagnóstico, que te consultaría antes) y `audits.$auditId.*`.
- **AGENTS.md:** registrar como regla que el diagnóstico integral vive a nivel empresa y que el SEO aporta un solo indicador.

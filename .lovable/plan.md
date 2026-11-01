# MarCa Audit — Diagnóstico y plan: servicios, propuesta modular y seguimiento (modelo A/B/C)

Revisión solo lectura. No se editó código ni datos.

## 1. Qué existe hoy (inspeccionado)

| Pieza | Dónde | Estado |
|---|---|---|
| Evaluación integral por empresa (historial, nunca se borra) | `src/diagnosis/model.ts` (`CompanyAssessment`, `updateAssessmentControl`, `importTourismEquivalences`, `migrateAssessments`) | Implementado (B1) |
| Catálogo de controles por rubro y 6 dimensiones | `src/diagnosis/dimensions.ts` (`DIMENSIONS`, `controlsFor`) | Implementado (C1) |
| Cálculo de cobertura, madurez, índice global | `src/diagnosis/scoring.ts`, `weights.ts` (`weightsFor`, `criticalControlsFor`) | Implementado, no se toca |
| Síntesis B3.1 (fortalezas, prioridades, límites) | `src/diagnosis/synthesis.ts` (`buildSynthesis`), `ui/synthesis-view.tsx` | Implementado, calculado al vuelo, no guarda |
| "Servicio vinculado" (B3.2) | `synthesis.ts`: `PriorityItem.service` siempre = `SERVICE_PENDING` ("Servicio a definir por MarCa") | Solo marcador, sin catálogo |
| Oportunidades comerciales (B3.3) | No existe en `src/diagnosis/`. Hay "oportunidades" solo del lado SEO (`src/seo/gsc/opportunities.ts`) y sugerencias turísticas (`src/seo/tourism/commercial-suggestions.ts`) | No implementado |
| Empresas y Roadmap fases A–G | `src/companies/model.ts` (`Company`, `Roadmap`, `RoadmapPhase`) | Implementado; el roadmap es de etapas de trabajo, no de precios |
| Propuestas / presupuestos / precios | — | No existe nada (sin tipos, rutas ni estado) |
| Persistencia | `src/store/app-store.ts`: clave `seo-fixer:state:v1`, campos aditivos en `AppState`, `validatePersistedState`, respaldo `seo-fixer:state:backup:pre-b1`, `guardB1Write()` | Implementado; todo en localStorage del navegador (~150 KB hoy) |

Nota: `ChangeProposal` / `changes` en `AppState` son cambios SEO sugeridos sobre páginas, no propuestas comerciales; no deben reutilizarse para presupuestos.

## 2. ¿B3.2 / B3.3 siguen siendo adecuadas?

Deben **redefinirse**:
- B3.2 asumía "un servicio por control". Con el modelo B (sin paquetes, combinación a medida) la relación correcta es **control → áreas de trabajo sugeridas (0..n)**, solo como sugerencia; la decisión final la toma MarCa en la propuesta.
- B3.3 "oportunidades comerciales" como cálculo dentro de la auditoría arriesga inventar valores económicos (prohibido por regla del proyecto). Se reemplaza por: **lista de prioridades con áreas sugeridas** (auditoría) + **propuesta modular** (gestión comercial), donde los precios son siempre cargados por MarCa.

## 3. Límite entre MarCa Audit y gestión comercial

Pertenece a MarCa Audit (auditoría A):
- Evaluación, síntesis, prioridades, límites (ya existe).
- Catálogo de **áreas de trabajo** (sin precios) y su vínculo sugerido con controles.
- Mostrar en la síntesis "áreas sugeridas" por prioridad.

Gestión comercial (B y C), módulo separado `src/proposals/`:
- Catálogo de **ítems de servicio** con precio de referencia editable.
- Propuestas modulares por empresa, con copia congelada al emitir.
- Seguimiento recurrente opcional (mensualidades).
- Todo lo económico vive aquí; nunca alimenta cobertura, madurez ni índice.

## 4. Diseño mínimo propuesto

```text
Control (dimensions.ts) --sugiere--> Área de trabajo (catálogo, sin precio)
                                          |
                                          v
Evaluación (historial) --origina--> Propuesta (empresa + evaluación de origen)
                                          |
                                     Ítems (copia congelada al emitir)
```

Área de trabajo (`WorkArea`): id, nombre, descripción, activa, `suggestedFor: controlId[]`. Precarga inicial con las áreas que nombraste (web, SEO técnico/local/contenidos, GBP/Maps, Bing Places, publicidad Meta/Google/TikTok, redes orgánicas, distribución/marketplaces/OTAs, WhatsApp Business, CRM, seguimiento de consultas, satisfacción/reputación/fidelización, medición). ChatGPT Ads queda **inactiva** hasta que exista comercialmente. Se pueden agregar áreas nuevas; no se borran, se desactivan.

Ítem de catálogo (`ServiceItem`): área, nombre, alcance, entregables, plazo, modalidad (`one-off` | `recurring`), tipo de costo (`own-fee` | `collaborator` | `coordination` | `external-license` | `ad-spend`), precio de referencia opcional (vacío = "No informado").

Propuesta (`Proposal`): id, companyId, assessmentId de origen, estado (`draft` | `sent` | `accepted` | `rejected`), fechas, moneda ARS, ítems, descuento (monto o %, solo sobre conceptos puntuales elegidos), notas.
- Ítem de propuesta: copia completa de nombre/alcance/entregables/plazo/modalidad/tipo/precio + `sourceItemId` opcional; permite ítems personalizados sin catálogo; `linkedControlIds` opcional.
- Totales calculados (no guardados): subtotal por tipo de costo, descuento, total del proyecto puntual; **mensualidades aparte**; inversión publicitaria mostrada aparte y no sumada a honorarios.
- Al pasar a `sent` se congela (`frozenAt`): no editable; para cambiar se duplica como nueva versión. Aceptadas/rechazadas nunca se borran.

Seguimiento C: no es entidad nueva en el MVP; son los ítems `recurring` de una propuesta aceptada, mostrados como "Seguimiento mensual". Gestión de cobros/contratos queda fuera.

## 5. Fases pequeñas

**P0 — Lógica pura de áreas (sin persistencia)**
- Archivos: `src/proposals/work-areas.ts` (+ test). Mapa control→áreas para rubros turístico y e-commerce.
- Acepta: cada `controlId` referenciado existe en `controlsFor`; SEO y controles de integración no reciben áreas obligatorias.
- Crédito relativo: bajo.

**P1 — Áreas sugeridas en la síntesis (B3.2 redefinida)**
- Archivos: `synthesis.ts` (reemplazar `service: string` por `suggestedAreas: string[]`, conservando `SERVICE_PENDING` cuando no hay), `ui/synthesis-view.tsx`, tests.
- Acepta: índice, cobertura y madurez idénticos antes/después (test comparativo); límites nunca reciben áreas.
- Crédito: bajo. **Opción mínima vendible = P0+P1.**

**P2 — Modelo y cálculo de propuesta (puro)**
- `src/proposals/model.ts` + test: crear, agregar/editar ítem, ítem personalizado, totales por tipo, descuento, mensualidades separadas, congelar al enviar, duplicar versión, transición de estados válida.
- Acepta: precios vacíos se muestran "No informado" y no suman como 0 silenciosamente (total marcado incompleto); propuesta enviada rechaza edición.
- Crédito: medio.

**P3 — Persistencia aditiva**
- `app-store.ts`: campos nuevos `workAreas`, `serviceItems`, `proposals`; migración tolerante; acciones sin borrado de propuestas.
- Respaldo: nuevo respaldo propio `seo-fixer:state:backup:pre-p3` con el mismo protocolo verificado de B1 y su guardia; **no** se toca ni reutiliza el de B1.
- Acepta: test de regresión que empresas, auditorías, evaluaciones turísticas, roadmaps, evaluaciones integrales y settings quedan idénticos; misma clave `seo-fixer:state:v1`.
- Crédito: medio.

**P4 — Pantallas**
- Catálogo editable (`/services`), propuestas por empresa (`/companies/$companyId/proposals`, detalle editable en borrador), botón "Crear propuesta desde esta evaluación" que precarga ítems sugeridos (por valor, editable).
- Acepta: recorrido en navegador de prueba aislado con datos ficticios; nada en VIAE ni datos reales.
- Crédito: medio-alto.

**P5 (posterior) — Propuesta en PDF A4** con diseño MarCa Growth, reutilizando el estilo de `companies.$companyId_.report.tsx`. Crédito: medio.

## 6. Exclusiones

- No precios inventados ni estimaciones de retorno/ingresos.
- No modificar motor SEO, `scoring.ts`, `weights.ts`, estados de control, evaluación turística ni respaldo B1.
- No facturación, cobros, contratos, impuestos, multimoneda, firma electrónica, envío por email, cuentas de usuario ni nube.
- No borrar propuestas ni evaluaciones. No publicar.

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| localStorage es local a un navegador: propuestas no se comparten entre equipos y pueden perderse al limpiar el navegador | Avisarlo en pantalla; exportación de respaldo; recomendar Lovable Cloud como paso siguiente para uso comercial real |
| Crecimiento del tamaño (límite ~5 MB) | Propuestas son livianas; mostrar tamaño en ajustes |
| Cambios de catálogo alteran propuestas emitidas | Copia congelada por valor al enviar |
| Confundir inversión publicitaria con honorarios | Tipo de costo obligatorio y totales separados |
| Mezclar lo económico con la madurez | Módulo separado; test de índice idéntico |

## Decisiones pendientes de MarCa

1. Moneda única ARS ¿correcto? ¿Precios con o sin IVA?
2. Descuento: ¿solo sobre honorarios propios o también colaboradores?
3. ¿Querés empezar por P0+P1 (mínimo) o directamente hasta P3?

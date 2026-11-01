# MarCa Audit — Aclaraciones al plan de diagnóstico integral

Este documento solo aclara el plan. No cambia código ni datos.

## 0. Aviso de estado

En el turno anterior se aprobó el plan y se implementaron A2 y A3 en lógica pura, antes de que se pidiera aprobación por etapa. Son módulos que todavía **no usa** ninguna pantalla, ningún informe ni el almacenamiento. Lo comprobé con una búsqueda: ningún archivo fuera de `src/diagnosis/` los importa. Ese código es reversible. Abajo se marca qué queda como está y qué conviene revertir o ajustar con tu aprobación.

## 1. Qué existe realmente hoy en `src/diagnosis/` (inspeccionado)

| Archivo | Contenido real |
|---|---|
| `dimensions.ts` | `DimensionId` (6), `DIMENSIONS`, `ControlSource` (detected/client/professional/integration), `SOURCE_LABELS`, `DiagnosisControl`, `CONTROLS` (27 controles: 23 para todos los rubros + 2 solo turismo, `vis-ota` y `sales-direct`), `controlsFor()` |
| `model.ts` | `ControlStatus` = Sin evaluar / **Sin datos** / Cumple / Requiere mejora / No aplica; `ControlState`, `CompanyDiagnosis`, `isJustifiedNotApplicable()`, `emptyDiagnosis()`, `setControl()` (rechaza «No aplica» sin nota), `migrateDiagnoses()` |
| `weights.ts` | `WEIGHT_PROFILES` (turismo, gastronomía, e-commerce, inmobiliaria, servicios profesionales, genérico), `CRITICAL_CONTROLS`, `SUFFICIENCY` (70 % / peso ≥ 20 / 50 %), `WEIGHTS_ARE_PROPOSED = true`, `weightProfileFor()`, `criticalControlsFor()` |
| `scoring.ts` | `dimensionResults()`, `globalIndex()` → completo o parcial, motivos, críticos faltantes; sin redistribución. **Hoy el score SEO cuenta como un control más de «web».** |
| `equivalences.ts` | `TOURISM_EQUIVALENCES` (8 de 10), `resolveControl()`: usa el valor propio, si no hay usa el turístico y avisa si hay conflicto. **Recibe una sola evaluación turística, sin regla para elegir entre varias auditorías.** |
| Pruebas | `diagnosis.test.ts` (18), `equivalences.test.ts` (4) |

**Solo propuesta (no existe):** pantalla de diagnóstico, guardado por empresa en el almacenamiento, hallazgos de negocio, mapa control → servicio, plantillas de roadmap por rubro, rubro «Servicios profesionales» en Empresas, cambios en informes.

Nota: el perfil «inmobiliaria» ya cambia el resultado para empresas de ese rubro en esta lógica, que hoy nadie usa. Se mantiene solo si apruebas sus pesos (decisión D2).

## 2. Evaluación turística con varias auditorías

- **Fuente única editable:** la evaluación sigue guardada por auditoría, igual que hoy. El diagnóstico de empresa **nunca copia** sus valores, solo los lee.
- **Evaluación vigente:** por defecto, la de la auditoría vinculada **más reciente que tenga al menos un control evaluado**. Se muestra siempre con la fecha de la auditoría y la de la última edición: «Fuente: auditoría del 12/10/2026, editada el 14/10». No es una elección silenciosa: el usuario puede cambiarla por otra auditoría vinculada.
- **Historial:** el resto de las evaluaciones no se borra ni se modifica. Para cada control, la pantalla muestra «Otras auditorías: Requiere revisión (03/2026)» cuando el valor difiere.
- **Si se elige otra auditoría,** se guarda la referencia `sourceAuditId` en el diagnóstico de la empresa. Es un dato nuevo, se agrega en la Etapa B y requiere aprobación.
- **Conflicto:** si el diagnóstico de empresa tiene un valor propio en un control equivalente y no coincide con el turístico, se muestran ambos. Lo resuelve quien audita: elige uno o edita la fuente turística.
- **Equivalencia de estados:**

| Turismo | Diagnóstico | Condición |
|---|---|---|
| Verificado | Cumple | Igual |
| Requiere revisión | Requiere mejora | Igual |
| No aplica | No aplica | Solo excluye el control si tiene nota. Sin nota → se trata como «Sin evaluar» y se avisa |
| Sin estado | Sin evaluar | Igual |

Los estados de la evaluación turística no cambian. Ajuste pendiente en el código: `resolveControl` hoy no trata «No aplica» sin nota como «Sin evaluar». Se corrige en la primera etapa.

## 3. Sin doble ponderación del SEO

El motor SEO ya revisa: viewport (`viewport-missing`), peso de la página (`heavy-page`), contenido pobre y duplicado, títulos y metadescripciones, imágenes, datos de contacto locales (`local-nap`), claridad esencial (`ctx-essential-clarity`) y siguiente paso (`ctx-landing-next-step`). Esto se superpone con los controles `web-mobile`, `web-performance`, `brand-content`, `vis-consistency`, `web-offer-clarity` y `ch-booking`. No hay una manera segura de descontar esas partes del score SEO sin tocar su cálculo, que está protegido.

**Decisión propuesta:** el score SEO pasa a ser una **referencia visible, sin puntos**. El control `web-seo-health` muestra el score y un enlace al informe SEO, pero no entra en la madurez ni en la cobertura. Los controles manuales se redactan para evaluar lo que el motor no ve:
- `web-mobile`: hacer la consulta o reserva desde un teléfono real, no la etiqueta viewport.
- `brand-content`: si el contenido es vigente y propio, no su largo.

El hallazgo SEO correspondiente se muestra como evidencia de apoyo, sin sumar. Requiere aprobación (D3). En consecuencia, `web-seo-health` sale de los críticos de e-commerce.

## 4. Fórmulas

- **Dentro de una dimensión, todos los controles pesan igual.** No se proponen pesos por control.
- **Aplicables** = controles del rubro, sin integraciones futuras, sin el SEO de referencia y sin «No aplica» justificado.
- **Evaluados** = Cumple + Requiere mejora. «Sin datos» y «Sin evaluar» son aplicables pero no evaluados.
- **Cobertura** = evaluados / aplicables.
- **Madurez** = Cumple / evaluados × 100. Si no hay evaluados, queda «Sin datos suficientes». Nunca vale 0.
- **Cobertura total** = Σ evaluados / Σ aplicables.
- **Índice global**, solo si se cumple la suficiencia: Σ(madurez × peso) / Σ(pesos de las dimensiones con aplicables > 0). Nunca se reparte el peso de una dimensión con datos insuficientes.
- **Críticos:** no pesan más. Funcionan como **condición de suficiencia**: deben estar en Cumple, Requiere mejora o «No aplica» justificado. Un crítico en «Requiere mejora» aparece primero en las prioridades.

**Ejemplo (rubro genérico):** «Marca» tiene 4 controles.
- Datos: Cumple 1, Requiere mejora 1, Sin datos 1, No aplica con nota 1.
- Aplicables 3, evaluados 2 → cobertura 67 %, madurez 1/2 = 50.
- Si la cobertura total del diagnóstico es 55 %: «Diagnóstico parcial», sin índice. Se muestra «Marca 50 (cobertura 67 %)».

## 5. Pruebas: número real

- Ejecución de hoy: **204 pruebas en 22 archivos**, todas correctas.
- Las «195» del informe anterior eran el total antes de A2 y A3.
- A2 y A3 agregaron 9 pruebas y ajustaron 4.
- **Propuestas, no existen todavía:**
  - el SEO de referencia no cambia la madurez;
  - elegir la evaluación más reciente y mostrar su fecha;
  - conservar las otras evaluaciones;
  - «No aplica» turístico sin nota se trata como Sin evaluar;
  - los diagnósticos guardados con el formato anterior siguen cargando (Etapa B);
  - el informe SEO queda igual antes y después.

## 6. «Servicios profesionales»

Sigue siendo una propuesta opcional. Mientras tanto, «Otro» lo cubre con el perfil genérico, sin cambiar datos ni compatibilidad. Si se aprueba, se agrega como valor nuevo y las empresas en «Otro» quedan como están, salvo que se reclasifiquen a mano. El perfil de pesos ya escrito no lo usa ningún rubro: está inactivo y no cambia ningún resultado.

## 7. Informe: fortalezas y afirmaciones

- **Fortaleza verificada** = Cumple + evidencia (enlace o nota con lo observado) + método profesional o detectado. Se titula «Fortalezas comprobadas».
- **Cumple sin evidencia** va en otro grupo, «Cumple según evaluación (sin evidencia adjunta)».
- **Lo informado por el cliente** se rotula «Según el cliente».
- **Lenguaje:** impactos siempre en condicional y cualitativos («puede reducir consultas directas»). No se muestran montos, porcentajes de pérdida ni proyecciones, salvo un dato medido y cargado con su fuente.

## 8. Alcance real de A2 (corrección)

- **Reglas de diseño**, para aprobar por escrito: pesos, umbrales, críticos, estados, SEO de referencia.
- **Código:** lo implementado queda **marcado como propuesto** y fuera de cualquier pantalla o informe hasta esa aprobación.
- **No se cambian:** los estados de la evaluación turística, lo guardado ni ningún resultado visible.

## 9. Decisiones por etapa

| Etapa | MarCa debe aprobar antes | ¿Necesita guardado nuevo? |
|---|---|---|
| A2.1 (ajustes de lógica pura) | D3 SEO como referencia; D1 umbrales provisionales; regla de «evaluación más reciente» | No: se prueba solo con pruebas automáticas |
| B (pantalla del diagnóstico) | D2 pesos y críticos por rubro, D4 campo nuevo por empresa (`diagnoses` con `sourceAuditId`) | Sí, agregado al formato actual |
| B2 (rubro nuevo) | D5 Servicios profesionales | Sí, valor nuevo |
| C (hallazgos e informe) | D6 criterio de fortaleza comprobada y textos | Solo si se guardan hallazgos manuales |
| D (plantillas de roadmap) | D7 tareas por rubro | No |
| E (servicios) | D8 catálogo de servicios de MarCa | Sí |
| — | D9 cómo dividir el control «Confianza» | No |

**Se puede probar primero sin guardado nuevo:** toda la Etapa A2.1, más una vista previa de solo lectura que combine una empresa y su evaluación turística más reciente, sin guardar nada.

## 10. Primera etapa propuesta (acotada)

**A2.1, solo lógica pura y pruebas.** Sin pantallas, sin guardado y sin cambios en los informes.

1. El SEO pasa a ser referencia, sin puntos, y sale de los críticos.
2. `resolveControl` trata «No aplica» sin nota como Sin evaluar.
3. Nueva función para elegir la evaluación vigente entre varias auditorías: la más reciente con datos, que devuelva también las otras con sus fechas.
4. Pruebas nuevas de la sección 5.

Archivos: `src/diagnosis/scoring.ts`, `weights.ts`, `equivalences.ts` y sus pruebas.

Requiere tu aprobación de D3, D1 (provisional) y la regla de la evaluación más reciente.

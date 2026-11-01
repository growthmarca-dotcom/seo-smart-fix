# Revisión de aceptación B2 y plan B3 — MarCa Audit

## 1. Revisión de aceptación B2 (solo lectura)

### Qué se revisó en esta ronda
Solo se leyó el código, sin abrir el navegador ni escribir datos: la pantalla de evaluación, la fila de control, la ventana de nueva evaluación, las acciones B1 y el cálculo.

### Qué está verificado
| Punto | Estado | Base |
|---|---|---|
| Seis dimensiones con ids y nombres exactos | Verificado | Se leen de `DIMENSIONS` sin copiarlas; hay una prueba que lo confirma |
| Catálogo por rubro sin cambios | Verificado | `controlsFor(industry, dim)`; prueba de que el catálogo no cambia |
| 4 estados visibles; «No aplica» con justificación en una sola llamada | Verificado | `decideStatusChange` / `decideNotesSave` y doble validación en B1; pruebas |
| Notas y URL se guardan al salir del campo; el borrador se conserva ante error | Verificado en código | Borradores propios de cada fila; el aviso de error no los borra |
| Cobertura, madurez, diagnóstico parcial e índice condicionado | Verificado | Usa `dimensionResults` / `globalIndex` sin fórmulas propias |
| Historial sin borrado; la evaluación anterior queda intacta | Verificado | Prueba automática |
| Recarga y respaldo pre-B1 sin cambios | Verificado | Pruebas automáticas, más una prueba en un navegador de prueba aislado durante B2 |
| Precarga turística sin alterar el origen | Verificado solo en pruebas automáticas | No probada en navegador |

### Observaciones y defectos (no se corrigieron)
1. **Faltantes sin explicar (menor).** Los controles de integración futura y el control de SEO no se muestran en la pantalla editable. El índice los excluye correctamente, pero no se ve la lista «Qué falta». Esa lista sí existe en la vista previa.
2. **«Guardando…» no llega a verse (cosmético).** El guardado es inmediato, así que solo se alterna entre «Guardado» y «Error».
3. **«Sin datos» se ve como «Sin evaluar» (menor).** El selector muestra «Sin evaluar» cuando el estado guardado es `no-data`. En B2 la pantalla no crea ese estado, pero podría venir de datos anteriores.
4. **Borradores que no se refrescan (menor).** Si la misma evaluación se edita en otra pestaña, los borradores abiertos no se actualizan hasta recargar.
5. **Notas sin guardar al cambiar de estado (riesgo bajo).** Si se cambia el estado a algo distinto de «No aplica» sin haber salido del campo de notas, la nota se guarda recién al salir del campo. Normalmente se sale del campo antes de hacer clic en el selector.

### Precarga turística en navegador: cómo probarla de forma segura
La prueba real **escribe datos** (crea una evaluación), así que no la ejecuté. Preparación aislada necesaria:
- Usar un navegador de prueba nuevo dentro del entorno, con almacenamiento propio y vacío. No usar la pestaña de la usuaria ni su almacenamiento.
- Cargar en ese almacenamiento un estado ficticio: una empresa de alojamiento de prueba, una auditoría de prueba vinculada y una evaluación turística de prueba con los 10 controles.
- Recorrido: crear con precarga → confirmar los 8 controles con «Tomado de evaluación turística» → editar uno → comparar la evaluación turística ficticia antes y después.
- Al cerrar el navegador de prueba se descarta todo. No se tocan empresas reales, VIAE, auditorías existentes ni el respaldo pre-B1.
- Requiere tu autorización explícita, porque escribe en ese almacenamiento descartable.

### Qué falta probar
- La precarga en navegador (requiere la preparación anterior).
- La lectura en celular de la pantalla editable.
- Una evaluación que llegue al «Índice global» completo en pantalla. Por ahora solo está cubierto por las pruebas de cálculo.

---

## 2. Propuesta B3 — Síntesis profesional de la evaluación

Objetivo: transformar una evaluación integral guardada en una síntesis legible para el cliente y en una base trazable para que MarCa Growth ofrezca servicios. Todo se calcula en el momento y nada se guarda.

### Principios
- Cada afirmación remite a un control y a su estado guardado. No hay texto sin un control de origen.
- Se muestra el origen del dato en 4 tipos: **Comprobado** (estado + URL de evidencia), **Informado por el cliente** (`source: client`), **Observación profesional** (`source: professional`, sin URL) e **Hipótesis** (solo en oportunidades, rotuladas así).
- No se mencionan pérdidas, montos, porcentajes de impacto, causas ni resultados no medidos.
- «Sin evaluar», «Sin datos» y «No aplica» nunca generan fortalezas ni recomendaciones. Van a «Límites del diagnóstico». «No aplica» se muestra con su justificación.
- Si la cobertura es insuficiente, la síntesis se rotula «Síntesis parcial» y no muestra índice, igual que B2.

### Etapa B3.1 — Motor de síntesis (lógica pura, sin pantalla)
- **Objetivo:** la función `buildSynthesis(company, assessment)` devuelve: fortalezas (controles en «Cumple»), mejoras (controles en «Requiere mejora», ordenadas primero por control crítico y después por peso propuesto de la dimensión), límites (sin evaluar / sin datos / No aplica / integraciones), cobertura e índice reutilizados.
- **Archivos probables:** `src/diagnosis/synthesis.ts` y `src/diagnosis/synthesis.test.ts`.
- **Depende de:** `scoring.ts`, `weights.ts`, `dimensions.ts`, `assessmentAsDiagnosis`.
- **Pruebas:** sin evaluaciones no hay fortalezas ni mejoras; «No aplica» va a límites con su justificación; el orden de prioridades es estable; el origen se etiqueta bien; los cálculos no se duplican (se compara con `globalIndex`).

### Etapa B3.2 — Catálogo de servicios MarCa Growth vinculado a controles
- **Objetivo:** una tabla fija `serviceForControl`: id de control → servicio, con nombre y descripción breve. Una recomendación aparece **solo** si el control está en «Requiere mejora». Nunca aparece por «Sin evaluar».
- **Archivos probables:** `src/diagnosis/services.ts` y `src/diagnosis/services.test.ts`.
- **Depende de:** B3.1. **Requiere de MarCa:** la lista real de servicios, nombres y descripciones. No se inventan. Hasta tenerla, se muestra «Servicio a definir por MarCa».
- **Pruebas:** cada servicio cita su control; no hay servicios sin control en «Requiere mejora»; los ids existen en el catálogo.

### Etapa B3.3 — Oportunidades de desarrollo comercial
- **Objetivo:** se toman solo de controles de la dimensión «Oportunidades y desarrollo comercial» y de mejoras ya verificadas. Se rotulan «Hipótesis a validar» cuando no tienen URL de evidencia.
- **Archivos probables:** se agregan a `synthesis.ts` y a sus pruebas.
- **Pruebas:** no hay oportunidades sin control de origen; el rótulo de hipótesis es obligatorio cuando no hay evidencia.

### Etapa B3.4 — Pantalla de síntesis (solo lectura)
- **Objetivo:** una sección o pestaña «Síntesis» dentro de la pantalla de evaluación existente, para la evaluación activa. Muestra: encabezado de cobertura y límites, fortalezas, prioridades de mejora, oportunidades, servicios vinculados y la leyenda de origen del dato.
- **Archivos probables:** `src/diagnosis/ui/synthesis-view.tsx` y una inserción en `src/routes/companies.$companyId_.diagnosis.tsx`.
- **Pruebas:** recorrido en un navegador de prueba aislado con datos ficticios. Las pruebas de B3.1 a B3.3 cubren el contenido.

Opcional, aparte: corregir las observaciones 1 y 3 de B2 (mostrar «Qué falta» y el estado «Sin datos»). Son cambios pequeños, solo de pantalla.

---

## 3. Exclusiones explícitas
- Informe PDF integral.
- Sincronización con el Roadmap, creación de tareas o hallazgos.
- Nube, autenticación, integraciones nuevas, IA, automatizaciones.
- Cambios en el motor SEO, la evaluación turística original, el modelo y la persistencia de B1, el respaldo, pesos, umbrales y controles críticos.
- Guardar la síntesis (se calcula al vuelo; guardar «conclusiones editadas» queda para una etapa posterior).
- Estimaciones económicas o de impacto.

---

## 4. Riesgos y criterios de aceptación

### Riesgos
- **Textos que suenan a resultado garantizado.** Mitigación: plantillas fijas y neutras, revisadas por MarCa.
- **Servicios inventados.** Mitigación: B3.2 no avanza sin la lista real de MarCa; mientras tanto, «A definir».
- **Duplicar el cálculo.** Mitigación: la síntesis solo consume `dimensionResults` y `globalIndex`; una prueba compara los resultados.
- **Confundir hipótesis con hechos.** Mitigación: el origen del dato es obligatorio en cada ítem.
- **Mezclar evaluaciones.** Mitigación: la síntesis recibe una sola evaluación; hay una prueba de aislamiento por empresa y por evaluación.

### Criterios de aceptación
- Cada ítem de la síntesis enlaza a un id de control existente y muestra su origen.
- Ningún ítem se genera desde «Sin evaluar», «Sin datos» o «No aplica».
- Con cobertura menor a la mínima: «Síntesis parcial», sin índice y con los límites visibles.
- No hay cifras económicas ni causas no registradas.
- Las 266 pruebas actuales siguen pasando, más las nuevas, y la revisión de tipos no da errores.
- No cambia ningún dato guardado (prueba de inmutabilidad del almacenamiento y del respaldo).

---

## 5. Alcance y consumo relativo
| Etapa | Tamaño | Consumo relativo |
|---|---|---|
| B3.1 Motor de síntesis | Pequeño-medio | Bajo |
| B3.2 Servicios vinculados (con la lista de MarCa) | Pequeño | Bajo |
| B3.3 Oportunidades | Pequeño | Bajo |
| B3.4 Pantalla de síntesis | Medio | Medio |
| Correcciones menores de B2 (opcional) | Muy pequeño | Muy bajo |

**Opción mínima vendible:** B3.1 + B3.4, con fortalezas, prioridades y límites, más servicios «A definir». Permite mostrar al cliente una síntesis honesta y trazable con el menor consumo. B3.2 y B3.3 se suman cuando MarCa entregue su catálogo de servicios.

### Pendiente de MarCa
- La lista de servicios MarCa Growth y a qué controles corresponde cada uno.
- Autorización para la prueba de precarga en un navegador de prueba aislado.

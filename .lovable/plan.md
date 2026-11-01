# Vista previa del diagnóstico integral por empresa (solo lectura)

**Esta etapa no habilita edición ni guardado.** No crea datos nuevos, no cambia lo que se guarda en el navegador y no toca auditorías, evaluaciones turísticas, roadmap, informes, panel de inicio ni motor SEO.

## 1. Inspeccionado y propuesta de archivos

Inspeccionado:
- `src/routes/companies.$companyId.tsx`: ficha con botones «Ver informe» y «Editar», auditorías vinculadas y roadmap.
- Rutas hermanas `companies.$companyId_.edit.tsx` y `companies.$companyId_.report.tsx`.
- `src/store/app-store.ts`: el estado tiene `audits`, `commercialReviews` y `companies`. No tiene diagnósticos.
- `Audit` (`createdAt`, `finishedAt`, `score?: SeoScore`, `isDemo`).
- `src/diagnosis/*`: `dimensionResults`, `globalIndex`, `seoReference`, `resolveControl`, `pickCurrentReview`, `controlsFor`, `SOURCE_LABELS`, `CONTROL_STATUS_LABELS` y `WEIGHTS_ARE_PROPOSED`.

Propuesta:
- **Crear `src/routes/companies.$companyId_.diagnosis.tsx`.** Es una ruta de solo lectura, con la misma convención que el informe de empresa.
- **Crear `src/diagnosis/preview.ts`.** Es una función pura que arma la vista previa a partir de la empresa, sus auditorías y sus evaluaciones. No guarda nada.
- **Crear `src/diagnosis/preview.test.ts`.**
- **Modificar `src/routes/companies.$companyId.tsx`.** Solo se agrega un botón «Diagnóstico (vista previa)» junto a «Ver informe».

## 2. Acceso y wireframe

Desde la ficha de empresa, el botón «Diagnóstico (vista previa)» lleva a `/companies/<id>/diagnosis`.

```text
[Volver a la ficha]
Diagnóstico integral — Vista previa (solo lectura, nada se guarda)
Rubro: Cabañas / dúplex · Pesos y umbrales: PROPUESTOS, sin aprobar

[ Diagnóstico parcial ]  Cobertura total 18 %  (mínimo propuesto 70 %)
Motivos: cobertura insuficiente · faltan críticos: Recorrido de reserva, Coherencia OTA
Índice global: no se muestra

Referencia técnica (no suma al índice)
  Score SEO 82 · auditoría duplexdelcentro.com.ar, 20/10/2026 · [Ver informe SEO]

Fuente turística usada: auditoría del 20/10/2026 (editada el 22/10) · regla: la más reciente con datos
  Otras evaluaciones: 1 (03/2026) · [ver]

Por dimensión
  Sitio web          Madurez 50 · Cobertura 2/4
    - Oferta clara ......... Cumple       (de evaluación turística)
    - Uso desde celular .... Sin evaluar
    - Control del dominio .. Sin evaluar  (lo informa el cliente)
    - Velocidad real ....... Integración futura (no cuenta)
  Visibilidad        Sin datos suficientes · Cobertura 0/3
  ...
Qué falta para un diagnóstico completo: lista por origen (cliente / profesional / integración)
```

## 3. Fuente de cada sección y datos faltantes

| Sección | Fuente | Si falta |
|---|---|---|
| Rubro | `company.industry` | — |
| Controles por dimensión | `controlsFor(industry)` | — |
| Valor de cada control | `resolveControl(id, undefined, evaluación vigente)`; no hay diagnóstico propio guardado | «Sin evaluar» |
| Evaluación vigente e historial | `pickCurrentReview` sobre las auditorías vinculadas (`auditIds`), con fecha `finishedAt ?? createdAt` y su `commercialReviews` | «Sin evaluación comercial vinculada» |
| Madurez, cobertura, suficiencia | `dimensionResults` + `globalIndex` | «Sin datos suficientes»; nunca 0 |
| Referencia SEO | `seoReference` con el `score` total de la auditoría vinculada más reciente que tenga score | «Sin auditoría SEO con puntaje» |
| Auditoría demo | `isDemo` | Rótulo «demo» visible; nunca se presenta como dato real |

Para rubros que no son turismo, no se lee la evaluación turística y todos los controles empiezan en «Sin evaluar». Se muestra la vista vacía con la lista de lo que falta.

## 4. Interactividad

**Permitida (solo en pantalla, se pierde al salir):**
- elegir otra auditoría vinculada como fuente turística, para comparar;
- desplegar el historial de evaluaciones;
- expandir o contraer dimensiones.

**Deshabilitada, con rótulo «Disponible cuando se apruebe el guardado»:**
- cambiar estados, notas o URL de controles;
- crear hallazgos o tareas de roadmap;
- imprimir o exportar.

Para editar un control turístico, el enlace lleva a la pantalla existente de evaluación comercial de esa auditoría.

## 5. Riesgos

- **Datos guardados en el navegador:** solo se leen. No se agrega ni cambia ningún campo del estado guardado, así que no hay migración.
- **RLS y base de datos:** no aplican, porque no hay backend.
- **Leer la vista previa como resultado final:** se mitiga con el rótulo fijo «Vista previa · pesos propuestos» y el estado «Diagnóstico parcial».
- **Regresión en la ficha:** el único cambio es un botón.
- **Elegir otra fuente:** no se recuerda al recargar la página. Así está previsto.

## 6. Pruebas

Nuevas, en `preview.test.ts`:
- Una empresa sin auditorías da «Diagnóstico parcial», sin índice global y con todos los controles en «Sin evaluar».
- En turismo con dos evaluaciones, se usa la más reciente con datos, se informa su fecha y la otra queda en el historial.
- Un rubro que no es turismo no lee la evaluación turística.
- El score SEO aparece como referencia y no cambia la madurez.
- «No aplica» sin nota en la evaluación turística se muestra como «Sin evaluar» con aviso.
- Las auditorías y evaluaciones recibidas quedan intactas, verificado comparando su copia antes y después.
- Una auditoría demo queda marcada como demo.

Regresión: pasan las 212 pruebas existentes, más el chequeo de tipos y la compilación. Además, una prueba en el navegador con una empresa de turismo vinculada y una empresa sin auditorías.

## 7. Aceptación y decisiones

Criterios de aceptación:
- se abre desde la ficha;
- no cambia nada de lo guardado en el navegador, comprobado comparando antes y después;
- muestra «Diagnóstico parcial» con sus motivos;
- muestra el SEO separado;
- indica la fuente turística con su fecha;
- no inventa valores.

Decisiones antes de construir:
1. Aprobar una ruta nueva en lugar de una sección dentro de la ficha.
2. Aprobar el texto del botón y el rótulo «Vista previa · pesos propuestos».
3. Confirmar que el SEO de referencia se toma de la auditoría vinculada más reciente con puntaje.
4. Confirmar que, fuera de turismo, la vista arranca vacía hasta aprobar el guardado (Etapa B).

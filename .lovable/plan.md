# P4.3 — Editor, visor y presentación de propuestas

## 1. Lo que ya existe (revisado en el código)

- **Modelo y cálculos P2** (`src/proposals/model.ts`): `ProposalItem`, `Discount`, `Proposal`, `computeTotals`, `computeItemAmounts`, `displayTotals` (usa la copia congelada si existe), `effectiveStatus`, `validateItem`, `validateDiscount`, `validateVatPercent`, `STATUS_LABELS`, y las transiciones `sendProposal`, `acceptProposal`, `rejectProposal`, `newVersion`.
- **Totales**: `TotalsBlock` por moneda y modalidad, con subtotales (honorarios propios, colaboradores, coordinación, gastos facturados por MarCa), descuentos con tope (`discountCapped`), base, IVA, pagos directos (`direct`), precios faltantes (`missingPriceItemIds`) y período recurrente (`period`, con `missingMonthsItemIds`). El editor puede mostrar todo esto sin hacer cálculos propios.
- **Acciones P3** (`proposalActions` en `app-store.ts`): `create`, `upsertItem`, `removeItem`, `upsertDiscount`, `removeDiscount`, `setVatPercent`, `setValidUntil`, `send`, `accept`, `reject`, `addFromCatalog` (copia por valor; rechaza servicios archivados) y `newVersion`. Hooks: `useProposal`, `useCompanyProposals`, `useServiceCatalog`.
- **UI P4.2**: `company-proposals-section.tsx` y `company-proposals.ts` (filas, estado efectivo y totales). Hoy las filas no enlazan a ningún detalle.
- **Informes imprimibles**: `audits.$auditId.report.tsx` y `companies.$companyId_.report.tsx` usan `window.print()` con estilos `@media print` en `styles.css`. Se pueden reutilizar para la vista previa del cliente, sin agregar PDF.

## 2. Lo que falta o tiene diferencias

1. **No existe la ruta `/proposals/$proposalId`**.
2. **Todos los textos se guardan en un solo campo.** `Proposal.notes` es el único campo de texto, y P4.2 guarda ahí la referencia comercial (`notes: reference`). No hay lugar para notas internas, observaciones para el cliente ni contexto/objetivo.
3. **No hay acción para editar textos ni evaluación asociada** después de crear la propuesta (solo validez, IVA, ítems y descuentos).
4. **Nueva versión desde una aceptada:** `newVersion` hoy solo permite partir de una propuesta enviada, rechazada o vencida. **El pedido dice que una aceptada también debe permitir crear una nueva versión.** Es una decisión comercial: hace falta tu confirmación.
5. La copia congelada (`frozen`) guarda ítems, descuentos, IVA y totales, pero no los textos. Igual no se pueden editar después de enviar, porque la edición está bloqueada fuera de borrador. Si se aprueba el punto 3, también hay que congelar los textos.
6. `newVersion` copia `notes`, conserva las duraciones (copia los ítems) y deja la validez vacía. Eso ya cumple el pedido.

## 3. Cambio mínimo al modelo (requiere tu autorización: toca `model.ts`, `catalog.ts` y una acción de `app-store.ts`)

Agregar a `Proposal` campos opcionales que no rompen nada:
- `reference?: string`: nombre o referencia comercial.
- `context?: string`: contexto y objetivo (se muestra al cliente).
- `clientNotes?: string`: observaciones y condiciones para el cliente.
- `internalNotes?: string`: solo para MarCa, nunca aparece en la vista previa.

**Compatibilidad sin migrar datos:** `notes` queda como está. Al leer, si falta `reference`, se muestra `notes` como referencia (lo que hizo P4.2), con el aviso "Referencia heredada". No se reescribe nada guardado. Desde P4.3, las propuestas nuevas guardan `reference`.

Además:
- Nueva función pura `setTexts(p, patch, at)`, que solo funciona en borrador.
- `newVersion` copia también los textos nuevos.
- `isProposalShape` acepta esos campos como opcionales.
- Una acción `proposalActions.setTexts` que sigue el patrón actual de `applyProposal` y `commitP3`, sin cambiar la persistencia, el respaldo ni las guardas.

**Alternativa sin tocar el modelo:** dejar todo en `notes`. No recomendada, porque no permite ocultar notas internas al cliente.

## 4. Pantallas

```text
/companies/$id  ── fila de propuesta ─▶ /proposals/$id (editor / visor)
                                          ├─ Cabecera
                                          ├─ Conceptos (catálogo + personalizados)
                                          ├─ Descuentos e IVA
                                          ├─ Desglose (por moneda, siempre visible)
                                          └─ [Vista previa cliente] ─▶ /proposals/$id/preview (imprimible)
```

- **Cabecera:** empresa (con enlace), referencia, versión (con enlace a la anterior si existe), estado efectivo, fechas de creación, envío y validez, evaluación asociada (con enlace) y acciones según el estado.
- **Conceptos:** "Agregar del catálogo" (solo servicios activos, usando `addFromCatalog`) y "Concepto personalizado" (diálogo con todos los campos del modelo; precio y meses opcionales; la modalidad de facturación aparece solo para licencias y gastos; la publicidad muestra siempre "Paga el cliente"). Editar o quitar usa `upsertItem` y `removeItem`. Los conceptos que necesitan datos muestran la etiqueta "No informado".
- **Descuentos:** lista con un diálogo (porcentaje o monto, a qué honorarios se aplica, modalidad). Los montos recurrentes se rotulan como "por mes". Si se aplicó el tope (`discountCapped`), se avisa.
- **IVA:** un único campo porcentual, vacío = sin IVA. Validez: un campo de fecha.
- **Desglose:** una tarjeta por moneda, con las secciones Puntual, Recurrente (importe mensual, meses y total del período por concepto; subtotal mensual y total del período) y Pagos directos del cliente. Si el cálculo está incompleto, se avisa y se nombran los conceptos con datos faltantes. Nunca se muestra un total combinado entre monedas.
- **Vista previa del cliente:** MarCa Growth, empresa, referencia y versión, contexto, conceptos con alcance, entregables y plazos, inversión desglosada, condiciones (`clientNotes`), validez e inversión directa estimada. **Excluye** `internalNotes`, nombres de colaboradores y el detalle por tipo de costo interno (en su lugar se muestran "Honorarios" e "Inversión directa"). Tiene botón "Imprimir / Guardar PDF" con `window.print()`, igual que los informes actuales; no se genera un PDF propio.
- **Ciclo de vida:** Enviar abre una confirmación ("se congelará"). En una propuesta enviada y vigente aparecen Aceptar y Rechazar. En una vencida no se puede ninguna de las dos. "Nueva versión" navega al nuevo borrador. Fuera de borrador todo es de solo lectura y se usa `displayTotals` (la copia congelada).

## 5. Archivos

**Nuevos**
- `src/routes/proposals.$proposalId.tsx`: editor y visor.
- `src/routes/proposals.$proposalId_.preview.tsx`: vista del cliente.
- `src/proposals/ui/proposal-item-dialog.tsx`
- `src/proposals/ui/discount-dialog.tsx`
- `src/proposals/ui/totals-breakdown.tsx`
- `src/proposals/ui/proposal-view.ts`: funciones puras de presentación (filas, "No informado", filtrado de lo que ve el cliente, referencia heredada).
- `src/proposals/ui/proposal-view.test.ts`

**Modificados**
- `src/proposals/ui/company-proposals-section.tsx`: enlace a la propuesta y alta con `reference`.
- `src/proposals/ui/company-proposals.ts`: referencia con fallback a `notes`.
- Solo si se aprueba el punto 3: `src/proposals/model.ts`, `model.test.ts`, `catalog.ts` (validación de forma), y la acción `setTexts` en `app-store.ts` más su prueba en `persistence.test.ts`.

## 6. Etapas

- **P4.3a:** modelo de textos y acción (si se autoriza), con sus pruebas.
- **P4.3b:** ruta del editor (cabecera, conceptos, descuentos, IVA, validez y desglose).
- **P4.3c:** ciclo de vida (enviar con confirmación, aceptar, rechazar, nueva versión).
- **P4.3d:** vista previa del cliente imprimible, sin información interna.

## 7. Pruebas de aceptación

Pruebas automáticas: alta desde catálogo sin alterar el catálogo; concepto personalizado; precio o meses faltantes como "No informado" y cálculo incompleto; varias monedas en bloques separados; descuentos fijos mensuales con tope; IVA vacío o con valor; pagos directos fuera del total; la vista del cliente no contiene notas internas ni colaboradores; enviar congela; vencida sin aceptar ni rechazar; nueva versión con número +1, vínculo, validez vacía y original intacta; referencias heredadas en `notes` que se siguen viendo. Además, la suite completa y el typecheck.

También una prueba en el navegador, con datos aislados y ficticios, del recorrido completo: borrador → enviar → aceptar → vista previa.

## 8. Riesgos y protecciones

- Ningún cálculo en los componentes: solo se usan `computeTotals` y `displayTotals`.
- No se migran datos: la referencia heredada se resuelve al leer.
- Los cambios de modelo son opcionales y aditivos. `isProposalShape` sigue aceptando las propuestas existentes; si no, P3 bloquearía las escrituras.
- No se tocan la persistencia, los respaldos B1 y pre-P3, VIAE, empresas, evaluaciones ni auditorías. Tampoco se publica.
- Riesgo de interfaz: el formulario de conceptos tiene muchos campos. Se mitiga con campos condicionales según el tipo de costo y la modalidad.

## 9. Estimación relativa

- P4.3a: baja.
- P4.3b: alta (la mayor parte del trabajo).
- P4.3c: baja.
- P4.3d: media.

Total: similar a P4.1 + P4.2 juntas, aproximadamente ×2. El mínimo útil es P4.3a + b + c. La vista previa (d) puede ir después.

## Decisiones que necesitamos de MarCa

1. ¿Autorizás los campos de texto opcionales (punto 3), que tocan `model.ts`?
2. ¿Una propuesta aceptada debe permitir crear una nueva versión? Hoy no está permitido.
3. En la vista del cliente, ¿mostramos "Honorarios" juntos o separados en "Honorarios MarCa" y "Colaboradores"?

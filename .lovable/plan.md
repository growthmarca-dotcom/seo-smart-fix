# Revisión: por qué el diagnóstico de viaetravel.com.ar solo muestra 1 control turístico

Revisión de solo lectura. No hay cambios de código, registros ni guardado.

## Límite de la revisión

Las evaluaciones, empresas y auditorías se guardan en el navegador de la usuaria (localStorage). Desde el entorno de trabajo no puedo leer ese navegador ni los registros de la empresa `2adb04e9-…` o la auditoría `4c88b040-…`, y en este turno no hubo registros de consola o red de su vista. **Por eso no puedo confirmar qué estados concretos tiene la evaluación turística (punto 1).** No los invento.

## 2. Equivalencias vigentes (`src/diagnosis/equivalences.ts`, sin cambios en C1)

| Control turístico | Control del diagnóstico | Dimensión | ¿Aplica en turismo tras C1? |
|---|---|---|---|
| property-info | web-offer-clarity | Sitio web | Sí |
| mobile-path | web-mobile | Sitio web | Sí |
| photos-description | brand-content | Marca | Sí |
| value-proposition | brand-value | Marca | Sí |
| contact-whatsapp | ch-whatsapp | Canales | Sí (turismo, gastronomía, e-commerce) |
| booking-engine | ch-booking | Canales | Sí (turismo, gastronomía) |
| ota-consistency | vis-ota | Visibilidad | Sí (solo turismo) |
| measurement | sales-conversion | Ventas | Sí (universal) |
| rates-policies | — | — | Sin equivalencia (exclusivo turismo) |
| trust | — | — | Sin equivalencia (decisión pendiente) |

## 3. ¿Hay ids, estados o filtros que bloqueen el mapeo?

Revisé el código, no los datos:
- Los 8 ids de origen existen en el catálogo turístico; los 8 destinos existen y aplican a los 4 rubros turísticos (lo cubre una prueba de C1).
- Estados: Verificado → Cumple, Requiere revisión → Requiere mejora, No aplica → No aplica. No hay estados incompatibles.
- Un control turístico solo se traslada si **tiene estado elegido**. Si solo tiene notas o URL de evidencia, queda «Sin evaluar». «No aplica» sin justificación también queda «Sin evaluar», con aviso.
- La vista toma **una sola evaluación**: la de la auditoría vinculada más reciente que tenga al menos un estado elegido. Las demás se listan como «Otras evaluaciones conservadas».
- El preview solo marca una empresa como turística si su rubro es Alojamiento, Hotel, Cabañas o Hostel. Como la usuaria ve un control «tomado de la evaluación turística», el rubro sí está detectado.

## 4. ¿La pantalla corresponde al código C1?

Sí, con alta probabilidad: «1/5» en Sitio web coincide con C1. Hoy se cuentan 5 controles: canal web propio, oferta, celular, contacto visible y dominio. El SEO y la velocidad no cuentan. Antes de C1 eran 3. La pantalla anterior a C1 mostraba «Cobertura 0/3», no «0/5».

## Causa más probable (sin confirmar)

El código traslada correctamente los 8 controles equivalentes. Que se vea solo uno indica que, en la evaluación elegida, **solo «Información del alojamiento» tiene estado**. Las otras causas posibles, en orden:
1. Los demás controles tienen notas o URL, pero sin estado elegido.
2. Están en «No aplica» sin justificación. En ese caso la pantalla mostraría el aviso en cada control.
3. La vista eligió otra auditoría vinculada más reciente, con un solo control evaluado, en lugar de la del 27/10/2026.

**No hay defecto de código demostrado; no propongo corrección todavía.**

## 5. Qué podría alimentar las seis dimensiones

- **Mapeo actual (8):** según la tabla. Llega a Sitio web, Visibilidad, Ventas, Marca y Canales.
- **Posible, requiere tu aprobación:**
  - `trust` → `vis-reviews`, solo si las notas hablan de reseñas. Hoy mezcla reseñas, políticas y datos de contacto, por eso conviene dividirlo antes.
  - `rates-policies` → `sales-pricing-visible`. Su alcance es más amplio que «precios visibles»: incluye condiciones y políticas.
- **No permitido:**
  - Llevar el SEO a madurez o cobertura.
  - Copiar un mismo control turístico a dos controles del diagnóstico.
  - Completar «Oportunidades». Ningún control turístico la cubre: necesita datos del cliente o la evaluación profesional.
- **Límite de cobertura:** aunque los 10 controles turísticos estén evaluados, Oportunidades y varios controles universales seguirán sin datos hasta la Etapa B (carga propia del diagnóstico). El diagnóstico seguirá siendo parcial, y eso es lo esperado.

## Pasos propuestos (sin cambios de código)

1. **Verificación en tu navegador:** en la auditoría del 27/10, abrir «Evaluación comercial». Anotar cuántos controles tienen estado elegido y cuántos solo tienen notas.
2. En la ficha de diagnóstico, revisar debajo de «Evaluación turística usada» qué fecha de auditoría aparece y si hay «Otras evaluaciones conservadas».
3. Según el resultado:
   - **Solo hay un estado elegido:** el funcionamiento es correcto; no hay que corregir nada.
   - **Hay más estados y no se trasladan:** es un defecto real. La corrección mínima sería en `src/diagnosis/preview.ts` o `equivalences.ts`, con una prueba que use esos estados.
   - **Se eligió otra auditoría:** usar el selector existente. Opcionalmente, mostrar con más claridad cuál está en uso, cambiando solo la pantalla.
4. **Opcional, solo pantalla y sin guardado:** en el diagnóstico, mostrar los controles turísticos que tienen notas o URL pero no tienen estado. Así se ve por qué no se trasladan.

## Decisiones pendientes

- Equivalencias nuevas para `trust` y `rates-policies`.
- Mantener WhatsApp como control crítico en turismo, o reemplazarlo por «canal de contacto principal».

# MarCa Audit — Revisión y plan para completar el modelo de diagnóstico integral

Solo propuesta. No se construye nada hasta aprobación expresa.

## 1. Diagnóstico de brechas (inspeccionado en `src/diagnosis/*`)

**Por qué hoy sale casi todo en 0%:** la vista previa es de solo lectura y no existe ninguna forma de cargar el estado de los controles del diagnóstico. Lo único que alimenta valores es la evaluación comercial turística (vía `equivalences.ts`). Por eso solo se llenan los controles con equivalente turístico; en empresas no turísticas todo queda «Sin evaluar». No es un error de cálculo: falta captura de datos.

**Aclaración sobre «presencia en notas coherentes con el sitio»:** en el catálogo el control es `vis-ota` — «Presencia en **OTAs** coherente con el sitio» (Booking, Airbnb). «OTAs» se lee como «notas». Ya está restringido a rubros turísticos, pero el título debe reescribirse sin siglas.

| Dimensión | Controles hoy | Alimentado por turismo | Estado real |
|---|---|---|---|
| Presencia digital y sitio | 5 (SEO referencia, claridad oferta, celular, control dominio, CWV integración) | claridad, celular | SEO no suma (correcto); CWV integración no implementada |
| Visibilidad y reputación | 5 (GBP, reseñas, coherencia datos, OTAs [turismo], métricas GBP [integración]) | OTAs | Sin fuente para los demás → 0% |
| Comercialización y ventas | 5 (respuesta, seguimiento, presupuestos, conversión, venta directa [turismo]) | conversión | 0% fuera de turismo |
| Marca y contenidos | 4 | contenido, propuesta de valor | Sin fuente fuera de turismo |
| Canales y experiencia | 4 (WhatsApp, reserva/compra, formularios, fidelización) | WhatsApp, reserva | WhatsApp y reserva/compra aplican hoy a TODOS los rubros (problema) |
| Oportunidades | 4 (1 integración) | ninguno | Siempre vacía |

Otros problemas detectados:
- Controles críticos propuestos asumen canales que no todos tienen: `generic` exige `ch-whatsapp`; `ecommerce` exige `ch-booking` (rótulo de reservas).
- No existe rubro «Servicios profesionales» (el perfil de pesos sí, sin uso).
- Control turístico `trust` sin equivalencia (pendiente de decisión); `rates-policies` exclusivo de turismo.

**Reutilización segura:** `dimensions.ts` (tipos), `scoring.ts` (cobertura, suficiencia, SEO como referencia), `model.ts` (estados y regla de No aplica justificado), `equivalences.ts` (turismo como fuente única), `preview.ts`. Nada de esto requiere cambiar el motor SEO ni la evaluación turística.

## 2. Catálogo transversal propuesto

Formato: qué se evalúa · evidencia · fuente · método verificable · aplica. Fuentes: A automática (auditoría SEO existente), E externa pública (revisión manual de fuentes públicas, sin integración), C cliente, P profesional MarCa, I integración futura (no evaluable hoy).

**Presencia digital y sitio**
- web-seo-health — salud técnica · auditoría vinculada · A · score SEO · todos con sitio. **Solo referencia, no suma.**
- web-has-site — existe canal web propio (sitio, tienda o landing) · URL · P · abrir URL · todos (No aplica justificado si opera solo por redes/marketplace).
- web-offer-clarity — oferta clara en primera visita · captura · P · prueba de 10 segundos · todos con sitio.
- web-mobile — uso desde celular · captura móvil · P · recorrido en teléfono · todos con sitio.
- web-contact-visible — datos de contacto y llamada a la acción visibles · captura · P · todos con sitio.
- web-ownership — control de dominio y editor · declaración · C · todos con sitio.
- web-performance — CWV · I · no evaluable hasta integrar PageSpeed.

**Visibilidad y reputación**
- vis-local-profile — perfil en Google Maps/Business existente y completo · URL del perfil · E · búsqueda pública del nombre · negocios con atención física o zona de servicio.
- vis-reviews — volumen, calificación y respuesta a reseñas · URL + capturas · E · lectura pública · donde existan reseñas públicas (No aplica justificado si no hay ninguna plataforma).
- vis-consistency — nombre, teléfono, ubicación coherentes · URLs comparadas · E · cotejo · todos.
- vis-external-references — **reemplaza la idea de «notas»**, ver punto 4.
- vis-ota — presencia en Booking/Airbnb coherente (título reescrito sin sigla) · turismo.
- vis-marketplace — publicaciones en marketplaces coherentes · e-commerce/comercio.
- vis-gbp-data — I.

**Comercialización y ventas**
- sales-response — tiempo de respuesta · consulta de prueba o declaración · P/C · todos.
- sales-followup — seguimiento de consultas no cerradas · registro o declaración · C · todos.
- sales-quotes — presupuestos/tarifas claros · ejemplo enviado · C/P · servicios, turismo, inmobiliaria, generales (no aplica a tienda con precio publicado).
- sales-pricing-visible — precios o rangos visibles · captura · P · e-commerce, gastronomía, turismo.
- sales-conversion — conoce su conversión · dato declarado · C · todos.
- sales-direct — venta directa frente a intermediarios · turismo.

**Marca, comunicación y contenidos**
- brand-identity, brand-value, brand-content, brand-social (ya existen; brand-social con No aplica justificado si no usa redes).
- brand-proof — casos, testimonios o portfolio · URL · P · servicios profesionales, generales.

**Canales y experiencia del cliente**
- ch-primary-contact — **el canal de contacto principal que el negocio declara** (WhatsApp, teléfono, email, formulario) funciona · prueba real · P · todos. Reemplaza a `ch-whatsapp` como control universal.
- ch-whatsapp — WhatsApp funciona · prueba · P · solo si el negocio usa WhatsApp (No aplica justificado en otro caso).
- ch-booking — reserva sin fricciones · prueba · P · turismo y gastronomía con reservas.
- ch-checkout — compra online sin fricciones · prueba hasta el pago (sin pagar) · P · e-commerce.
- ch-forms — formularios llegan · envío de prueba · P · si hay formulario.
- ch-loyalty — fidelización · declaración · C · todos.

**Oportunidades y desarrollo comercial**
- opp-competitors, opp-channels, opp-seasonality (existentes; estacionalidad aplica sobre todo a turismo/gastronomía, en otros como «objetivos comerciales»).
- opp-quick-wins — mejoras de bajo costo identificadas · lista P · todos.
- opp-keywords — I.

## 3. Plantillas por rubro (universales vs específicos)

Universales (todos): web-has-site, web-offer-clarity*, web-mobile*, web-contact-visible*, vis-consistency, vis-reviews, vis-external-references, sales-response, sales-followup, sales-conversion, brand-identity, brand-value, brand-content, ch-primary-contact, ch-loyalty, opp-competitors, opp-channels, opp-quick-wins. (*solo si hay sitio)

| Rubro | Específicos que se suman | Que NO se preguntan |
|---|---|---|
| Alojamiento/turismo | vis-ota, sales-direct, ch-booking, sales-pricing-visible, opp-seasonality, vis-local-profile | ch-checkout, vis-marketplace |
| Gastronomía | vis-local-profile, ch-booking (si toma reservas), sales-pricing-visible (carta/precios), opp-seasonality | vis-ota, sales-direct, ch-checkout |
| Comercio / e-commerce | ch-checkout, vis-marketplace, sales-pricing-visible, vis-local-profile solo si tiene local | vis-ota, ch-booking, sales-quotes |
| Servicios profesionales (rubro nuevo, requiere aprobación) | sales-quotes, brand-proof, vis-local-profile si atiende presencialmente | vis-ota, ch-booking, ch-checkout, sales-pricing-visible |
| Inmobiliaria | sales-quotes, ch-forms, vis-local-profile, brand-proof | vis-ota, ch-checkout |
| Generales («Otro») | sales-quotes, ch-forms | específicos de turismo/e-commerce |

Controles condicionales (ch-whatsapp, ch-forms, brand-social, vis-local-profile) aparecen pero se pueden marcar No aplica con justificación, en vez de ocultarse.

## 4. Menciones y referencias externas (nuevo `vis-external-references`)

- Qué evalúa: que el negocio tenga referencias externas relevantes y coherentes con su sitio.
- Evidencias válidas (cualquiera): directorios del rubro, cámaras o asociaciones, guías turísticas, blogs o medios locales, notas periodísticas, perfiles en plataformas sectoriales, sitios de socios o proveedores, eventos, premios.
- Método: búsqueda pública del nombre + rubro + ciudad; registrar hasta 3 URLs y si los datos coinciden con el sitio.
- Cumple: al menos una referencia relevante y coherente. Requiere mejora: no hay referencias o tienen datos desactualizados. No aplica justificado: negocio nuevo o rubro sin ecosistema de referencias, con explicación.
- Nunca exige notas periodísticas ni penaliza por no tenerlas.

## 5. Reglas de estados, cobertura y madurez

- Estados: Cumple (1), Requiere mejora (0), No evaluado (excluido), No aplica justificado (excluido del denominador). No aplica sin justificación = No evaluado (regla vigente). Integración futura = siempre excluido.
- Cobertura por dimensión = evaluados / aplicables. Madurez = cumplidos / evaluados, solo si la cobertura de esa dimensión alcanza el mínimo.
- Índice global solo si: cobertura total mínima, cada dimensión relevante del rubro con cobertura mínima y todos los controles críticos evaluados. Si no, «Diagnóstico parcial» con motivos (ya implementado; sin redistribuir pesos).
- Propuesta adicional: mostrar por dimensión «Sin datos suficientes» en vez de 0% cuando cobertura = 0, para que no se lea como incumplimiento.
- Controles críticos deben ser universales o específicos del rubro, nunca canales que el negocio puede no tener (reemplazar ch-whatsapp por ch-primary-contact; ch-booking por ch-checkout en e-commerce).

## 6. Evitar duplicación

- SEO: solo referencia visible en «Sitio web»; no suma, no cubre, no es crítico. Los controles web manuales (claridad, celular, contacto visible) evalúan experiencia, no lo que mide el motor.
- Coherencia de datos (vis-consistency) es un control único; ni SEO local ni reseñas lo repiten.
- Evaluación turística: sigue siendo la fuente única de sus equivalentes; los nuevos controles no tocan su formato. `trust` se mapearía a vis-reviews solo si MarCa lo aprueba.
- No se modifica el motor SEO, sus reglas, puntuación ni informes.

## 7. Qué es catálogo/lógica y qué requiere interfaz o persistencia

| Cambio | Tipo |
|---|---|
| Nuevos controles, títulos reescritos, aplicabilidad por rubro, críticos corregidos, «Sin datos suficientes» | Catálogo y lógica pura + texto en la vista previa |
| Rubro «Servicios profesionales» | Lista de rubros en el modelo de empresas (compatible: valor nuevo; empresas existentes no cambian) |
| Cargar estados, notas y evidencias de los controles | **Requiere guardado nuevo por empresa** (Etapa B, ya pendiente de aprobación) |

Sin la Etapa B, la vista previa seguirá mostrando cobertura baja en rubros no turísticos: es esperable y honesto.

## 8. Orden recomendado (bajo riesgo y bajo consumo)

1. **Etapa C1 — solo catálogo y lógica** (primera etapa acotada propuesta): actualizar `dimensions.ts` y `weights.ts` con el catálogo y plantillas de arriba, títulos claros, críticos corregidos, estado «Sin datos suficientes» en preview. Sin persistencia, sin migraciones, sin tocar SEO ni turismo.
2. **Etapa C2 — rubro Servicios profesionales**: agregar el valor y su plantilla de roadmap genérica existente.
3. **Etapa B — guardado del diagnóstico por empresa** y formulario de carga (requiere aprobación de almacenamiento).
4. Después: informe integral y vínculo de hallazgos con el roadmap.

## 9. Pruebas y criterios de aceptación (C1)

- Cada rubro recibe solo sus controles: turismo sin ch-checkout; e-commerce sin vis-ota/ch-booking; gastronomía sin vis-ota; generales sin específicos de turismo.
- vis-external-references presente en todos; No aplica justificado lo excluye; sin justificación cuenta como No evaluado.
- Ningún control crítico depende de un canal opcional.
- SEO sigue sin sumar ni cubrir (prueba existente se mantiene).
- Equivalencias turísticas producen los mismos resultados que hoy para los 8 controles mapeados.
- Dimensión con cobertura 0 muestra «Sin datos suficientes», no 0%.
- Las 212+ pruebas existentes siguen pasando; typecheck correcto; motor SEO y evaluación turística sin cambios.

## Decisiones que requieren tu aprobación

1. El catálogo y las plantillas por rubro (sección 2 y 3), incluidos los controles nuevos.
2. Reemplazar `ch-whatsapp` por `ch-primary-contact` como universal y crítico.
3. Controles críticos por rubro corregidos (propuesta: turismo ch-booking + ch-primary-contact + vis-ota; gastronomía vis-local-profile + vis-reviews; e-commerce ch-checkout; servicios sales-response + sales-quotes; generales web-offer-clarity + ch-primary-contact).
4. Pesos por rubro y umbrales (70% total, 50% por dimensión relevante): siguen como propuestos.
5. Crear el rubro «Servicios profesionales».
6. Cómo tratar `trust` de la evaluación turística.
7. Autorización separada para la Etapa B (guardado por empresa).

**Primera etapa lista para aprobar:** C1 (solo catálogo y lógica pura, sin guardado nuevo).

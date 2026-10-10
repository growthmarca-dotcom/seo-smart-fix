# MarCa Audit — Definición de producto y backlog del MVP

> Documento nuevo: no se encontró en el repositorio un "documento maestro"
> original. Este archivo NO lo reemplaza; registra las decisiones confirmadas
> hasta que exista el documento maestro definitivo. Complementa (no duplica)
> `SEO-APP-STATE.md`, `SEO-APP-ROADMAP.md` y `SEO-APP-ARCHITECTURE.md`.

## 1. Decisiones confirmadas

| Decisión | Valor |
|---|---|
| Producto | **MarCa Audit** |
| Base técnica | La app existente (SEO Fixer). Sin reconstrucción ni app paralela. |
| Mercado inicial | Turismo y alojamientos |
| Expansión | Otros rubros, tras validar el producto inicial |
| Usuario inicial | Uso profesional interno de MarCa Growth |
| Usuarios posteriores | Clientes con acceso a herramienta/resultados (etapa futura) |
| Objetivo central | Analizar presencia digital → detectar problemas y oportunidades → respaldar con evidencia → priorizar → entregar informe profesional |

## 2. Alcance del MVP

Trabajar con un sitio real y completar el flujo de punta a punta:
análisis SEO técnico y de páginas · problemas y oportunidades · evidencia y
explicación · priorización · criterios de turismo/alojamiento (cuando haya
información suficiente) · informe profesional.

## 3. Fuera del MVP (no eliminar lo existente; solo evaluar)

CRM/gestión comercial · proyectos/equipos/tareas · campañas/publicación ·
edición automática de sitios de terceros · reservas/canales/ingresos · BI
independiente · portal de autoservicio · integraciones nuevas sin necesidad
demostrada.

Capacidades existentes que quedan **fuera del MVP pero se conservan**:
módulo e-commerce (7A), Tienda Nube (7B), Mercado Libre (7C mock), flujo
"aplicar" de Sugerencias y cambios (se mantiene como registro, sin escritura
externa).

## 4. Estado del MVP frente al alcance

Criterio: "verificado" = probado con tests automatizados del núcleo. Ninguna
pantalla se considera verificada solo por compilar o figurar en la documentación.

| Capacidad MVP | Estado | Observación |
|---|---|---|
| Rastreo de sitio real | Implementado, pendiente de prueba | Sin prueba end-to-end documentada contra un sitio de alojamiento real. No ejecuta JavaScript. |
| Análisis técnico y on-page (48 reglas, score) | Completado y verificado (núcleo) | Tests del motor; UI pendiente de prueba manual. |
| Problemas y oportunidades (contenido, arquitectura) | Completado y verificado (núcleo) | `content-analysis`, `link-graph` con tests. |
| Evidencia | Pendiente de desarrollo (parcial) | Evidence Engine fases 1, 1.1 y 1.2 hechas: 3 reglas estructuradas, ~45 en texto libre. |
| Priorización | Completado y verificado (núcleo) | Prioridad por hallazgo (sin GSC) + índice 0–100 con GSC. |
| Criterios turismo/alojamiento | Pendiente de desarrollo | No existe perfil de página ni reglas de alojamiento (habitaciones, tarifas, reservas directas, `LodgingBusiness`/`Hotel`, mapas, reseñas). |
| Informe profesional | Implementado, pendiente de prueba con cliente real | Ruta `/audits/$auditId/report` (botón "Ver informe"): resumen, puntuación, cobertura, hallazgos con evidencia, oportunidades, plan por prioridad, metodología. PDF vía impresión del navegador. Marca las auditorías demo. |
| Persistencia | Bloqueante de uso real | Datos solo en el navegador; riesgo de pérdida y límite de tamaño con sitios grandes. |
| Acceso protegido | Pendiente de desarrollo | El rastreo es público si se publica la app. Necesario antes de uso con clientes. |

## 5. Backlog clasificado

### 1. Completado y verificado
Fases 1, 2, 2.1, 2.3 (incl. prioridad por hallazgo y núcleo `priority/factors.ts`),
3, 4, 5, 6A, 6B, 7A; Evidence Engine 1 (contrato), 1.1 (`thin-content`),
1.2 (2 reglas contextuales). Verificación: 81 tests del núcleo.

### 2. Implementado, pendiente de prueba
- Flujo completo en UI con un sitio real de alojamiento (nueva auditoría → resultados → detalle URL → prioridades).
- Importación CSV de Search Console con datos reales.
- Tienda Nube con credenciales reales (fuera del MVP).

### 3. Pendiente de desarrollo (priorizado por impacto en el MVP)
| # | Tarea | Tipo |
|---|---|---|
| P1 | Prueba end-to-end con un sitio real de alojamiento y registro de errores | Bloqueante (valida todo lo demás) |
| P2 | ~~Informe profesional~~ — implementado; falta validar con un sitio real | Hecho (pendiente de prueba) |
| P3 | Persistencia real + acceso protegido (Lovable Cloud) | Bloqueante para uso con clientes reales |
| P4 | Perfil y reglas de turismo/alojamiento | Diferencial del mercado inicial |
| P5 | Completar migración de evidencia en reglas que aparezcan en el informe | Calidad del informe |
| P6 | Dividir pantallas grandes (`audits.$auditId.index.tsx`, etc.) | Mejora opcional |
| P7 | Core Web Vitals (PageSpeed) | Mejora opcional; requiere integración nueva |

### 4. Bloqueado o dependiente
- P5 depende de P2 (definir qué evidencia muestra el informe).
- P4 depende de P1 (necesita sitios reales para calibrar reglas).
- Acceso de clientes depende de P3.
- Conexión OAuth real de GSC depende de P3 (credenciales por usuario).

### 5. Fuera del MVP
Fase 7C Mercado Libre · Tienda Nube real · GBP · GA4 · backlinks/competencia ·
IA generativa · todo el listado de la sección 3.

### 6. Necesita aclaración
- Formato del informe: ¿PDF descargable, enlace web, ambos? ¿Con marca MarCa Growth?
- Criterios de turismo: ¿qué rubros exactos (hotel, cabañas, hostel, complejo)? ¿OTAs y reseñas entran en el MVP o solo señales en el sitio?
- ¿El MVP necesita login desde el día uno o puede usarse solo internamente sin publicar?
- ¿Se mantiene el nombre visible "SEO Fixer" o se renombra a "MarCa Audit" ya?

## 6. Contradicciones detectadas en la documentación

1. `SEO-APP-ROADMAP.md` y `SEO-APP-STATE.md` decían "Evidence Engine no iniciado / pausado", pero las fases 1, 1.1 y 1.2 ya están implementadas. **Corregido** en ambos.
2. `CLAUDE.md` y `SEO-APP-STATE.md` indican "Vite 8"; el proyecto usa Vite 7. Sin corregir (no afecta producto).
3. Roadmap previo ordenaba "7C Mercado Libre" como primer paso; con el foco turismo queda fuera del MVP. **Actualizado.**
4. La auditoría "MarCa Growth Client Hub" (entregada fuera del repositorio) proponía clientes, servicios, tareas y CRM; las decisiones de MarCa Audit los dejan **fuera del MVP**. Prevalece este documento; el Client Hub queda como visión futura.

## 7. Primera tarea recomendada

**P1 — Prueba end-to-end con un sitio real de alojamiento.** Es la única forma
de saber qué funciona de verdad (nada de la UI está verificado con un sitio
real), no requiere cambiar código, y define los requisitos concretos de P2
(informe) y P4 (reglas de turismo). Necesita: 1–3 URLs reales de alojamientos
elegidas por MarCa Growth.

## 8. Estado real de conectores (verificado en código)

- Web genérica: funcional real.
- Google Search Console: código de API real vía conector, **sin conexión vinculada** → no verificado; CSV y demo funcionan.
- Tienda Nube: lectura implementada, credenciales globales no configuradas, sin ruta de callback OAuth → parcial.
- GA4, PageSpeed: solo tarjeta informativa. Google Business Profile: planificado. Mercado Libre: preparatorio (estado C). WordPress/WooCommerce/Shopify: solo mencionados.

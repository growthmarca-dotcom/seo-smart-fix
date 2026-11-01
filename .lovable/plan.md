# Estado del repositorio: cambios de A2, A3 y A2.1 (solo inspección)

No hice cambios, no revertí nada y no escribí archivos del proyecto. Este documento solo deja asentada la inspección.

## Estado de git

- **Cambios sin confirmar:** ninguno. `git status` sale vacío, así que todo está guardado en commits.
- **Commit base**, el último antes de A2: `f02eaeb` (01/11/2026 16:19 UTC).
- **Commit actual:** `2547f2d` (16:24 UTC).

## Commits con cambios de código

Son los commits posteriores a la base que tocan código o reglas. Los demás commits del período solo guardan o archivan el documento de plan.

| Commit | Hora UTC | Archivos |
|---|---|---|
| 25a233c | 16:20:28 | `src/diagnosis/scoring.ts`, `src/diagnosis/weights.ts` |
| d251e5f | 16:20:39 | `src/diagnosis/model.ts` |
| 29615cd | 16:21:18 | `src/diagnosis/equivalences.ts` (nuevo), `equivalences.test.ts` (nuevo), `diagnosis.test.ts` |
| 6a0f38a | 16:21:38 | `AGENTS.md` |
| 902409b | 16:24:18 | A2.1: `scoring.ts`, `weights.ts`, `equivalences.ts` y las dos pruebas |

## Archivos de `src/diagnosis/` y su estado frente a la base

| Archivo | Estado |
|---|---|
| `dimensions.ts` | Existía antes (Etapa A) y no se tocó |
| `model.ts` | Modificado |
| `scoring.ts` | Modificado |
| `weights.ts` | Modificado |
| `diagnosis.test.ts` | Modificado |
| `equivalences.ts` | Creado |
| `equivalences.test.ts` | Creado |

Todos estos cambios están en commits; no hay nada sin confirmar.

## Fuera de `src/diagnosis/` y del plan

- **`AGENTS.md`:** **sí se modificó** (commit 6a0f38a). Se cambió la regla de cobertura y se agregó la regla de fuente única para los controles turísticos. Corrijo lo que dije antes: este cambio está fuera de las carpetas que mencionaste.
- **`.lovable/plan/`:** los dos planes aprobados quedaron archivados ahí.
- **`roadmap.md`:** se modificó a las 16:14, en el turno del asistente de WhatsApp, antes de la base. No forma parte de A2, A3 ni A2.1.
- **Nada más:** no hay otros archivos de la app, pruebas, rutas, almacenamiento ni motor SEO tocados.

## Siguiente paso seguro (no ejecutado)

Primero, decidir qué hacer con lo ya implementado:

- **Conservarlo.** Es lógica que ninguna pantalla, informe ni guardado usa todavía, y las 210 pruebas pasan.
- **Revertirlo.** Se puede volver a la versión del historial anterior a esos cambios. También puedo revertir solo esos archivos y la regla de `AGENTS.md`.

Si se conserva, el paso siguiente es que apruebes por escrito estas decisiones, sin construir nada todavía:

- pesos y controles críticos por rubro;
- umbrales provisionales;
- guardado nuevo por empresa, con la auditoría elegida como fuente.

Recién después de eso empezaría la Etapa B, la pantalla de diagnóstico por empresa.

No agregué esta verificación a `roadmap.md` porque estoy en modo de solo lectura.

Sigo sin hacer cambios hasta que me autorices.

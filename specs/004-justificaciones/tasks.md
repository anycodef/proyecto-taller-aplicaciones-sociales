# Tareas 004 — Justificaciones de ausencias

> Desglose en tareas del [plan 004](plan.md), que implementa la [spec 004](spec.md). Sigue la [constitución](../../docs/constitution.md) y [`AGENTS.md`](../../AGENTS.md). La spec 004 se implementa después de 001, 002 y 003 (no entra en el primer corte).

**Total: 73 tareas** en 9 fases (0 a 8), en orden de dependencia. Ninguna está bloqueada por aclaración (ver más abajo).

## Leyenda y convenciones

| Etiqueta | Significado |
| --- | --- |
| **[Bloqueada por aclaración]** | Depende de una duda `[NECESITA ACLARACIÓN]` de la spec que el plan no cubre con un supuesto. No se empieza hasta resolverla. *No hay ninguna en esta spec.* |
| **[Supuesto A-xx]** | Implementa un supuesto provisional y reversible del plan (§11). Se implementa tal cual. Si el equipo resuelve la duda de otra forma, se corrige primero la spec y luego la constante o regla indicada. |
| **[Prueba manual]** | Parte de la verificación ocurre fuera de Jest: un celular real o la medición en campo. El resultado se deja en la descripción del PR. |

- **Por qué no hay tareas bloqueadas.** Cada duda abierta de la spec tiene un supuesto provisional en el plan: A-01 (aviso de revisión), A-02 (familiar directo), A-03 (anticipación), A-04 (registro fuera de plazo), A-05 (revertir una aprobada) y A-06 (tipo y número de imágenes). Las tareas afectadas llevan su etiqueta **[Supuesto A-xx]**. A-01 y A-05 no generan tareas propias: el supuesto es *no* implementar notificaciones ni reversión.
- **Cada tarea dura como máximo 20–30 minutos** y termina con `npm test`, `npm run typecheck` y `npm run lint` en verde (principio 4). `npm test` ejecuta los proyectos Jest de la raíz y de `api/` (plan 001, F0-2). Los tests de contrato y de almacén necesitan PostgreSQL y Azurite levantados con `docker compose up -d`.
- **Test primero.** El test va en la misma tarea que la lógica que verifica y cita el requisito en su nombre (`RF-4xx: …`).
- **Rutas.** Los adaptadores de cliente que importan Expo van en `src/plataforma/justificaciones/`, según la convención que fija el plan 001 (§ estructura del cliente). El plan 004 §8 los ubica en `src/features/` y prevé adaptarse a 001. Las reglas puras van en `src/lib/justificaciones/` y la API en `api/src/modulos/justificaciones/`.
- **Migraciones.** Se crean con la skill `nueva-migracion` y llevan la numeración global de 001, o el bloque `04xx` si 001 no la fija (A-10). Una migración aplicada no se edita.
- **Dependencias con otras specs.** Ninguna tiene aún `tasks.md`, así que se citan como `TNNN (fase o pieza del plan NNN)`.

---

## Fase 0 — Prerrequisitos y decisiones pendientes

- [ ] **T004-01** Justificar en la spec las dependencias de API y de pruebas
  - RF: RNF-403, RF-407
  - Depende de: T001 (F0-2: Jest y scripts `test` y `typecheck`)
  - Hecho cuando: `spec.md` tiene una sección «Dependencias» con `@azure/storage-blob`, `@azure/identity` y la imagen Docker de Azurite. Cada una indica para qué sirve, la alternativa descartada (D-402, D-410), que su costo es 0 y que no se instala en la app. El equipo la aprueba en un PR revisado (A-09, principio 1). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-02** Justificar en la spec las dependencias de la app
  - RF: RF-402, RNF-402, RNF-404, RF-410
  - Depende de: T004-01
  - Hecho cuando: la sección «Dependencias» de `spec.md` incluye `expo-image-picker` (cámara y galería, también en web), `expo-image-manipulator` (D-403), `expo-file-system` (borrar temporales, RNF-404) y `expo-image` con `cachePolicy="none"` (D-410). Cada una tiene su enlace a la documentación del SDK 57 y la alternativa descartada, y el equipo la aprueba en un PR revisado. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-03** Registrar el ADR «Evidencias solo en línea» y corregir el C4
  - RF: RNF-404, RNF-405, RNF-402
  - Depende de: T001 (F0-2: Jest y scripts)
  - Hecho cuando: hay un ADR nuevo en `docs/adr/`, creado con `npm run adr:new`, que recoge D-401 y D-403 y reemplaza lo que decía sobre fotos `20260914-estrategia-de-sincronizacion-offline-first.md` (A-08). En `docs/diagrams/arquitectura-c4.dsl` ya no aparece «Almacena justificante temporal» y la compresión figura en el cliente. `npm run adr:build` termina sin errores. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 1 — Dominio puro (`src/lib/justificaciones/`)

- [ ] **T004-04** Crear `tipos.ts` y `causas.ts` con la lista cerrada de causas **[Supuesto A-02, A-03]**
  - RF: RF-402, RF-404
  - Depende de: T001 (F0-2: regla ESLint que prohíbe importar React, React Native y Expo en `src/lib`)
  - Hecho cuando: pasan `causas.test.ts › RF-402: la lista de causas es exactamente salud_nino, familiar_directo y evento_escolar`, `RF-402: rechaza una causa fuera de la lista (viaje)` y `RF-404: solo evento_escolar permite justificación anticipada`. La etiqueta visible de `familiar_directo` es «Enfermedad o fallecimiento de un familiar directo». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-05** Implementar `plazo.ts` (fecha límite y vigencia) **[Supuesto A-11, A-12]**
  - RF: RF-405
  - Depende de: T004-04
  - Hecho cuando: pasan `plazo.test.ts › RF-405: el plazo vence al final del día calendario en America/Lima`, `RF-405: un minuto después del límite el plazo ya no está vigente`, `RF-405: rechaza un plazo fuera de 1 a 60 días` y `RF-405: el plazo por defecto es 7 días`. La hora `ahora` llega como parámetro y no se agrega ninguna dependencia. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-06** Implementar `revisar` y `estadoVisible` en `estados.ts` **[Supuesto A-05]**
  - RF: RF-408, RF-410
  - Depende de: T004-04
  - Hecho cuando: pasan `estados.test.ts › RF-408: solo se revisa una justificación pendiente`, `RF-408: rechazar sin motivo lanza error`, `RF-408: la revisión registra quién y cuándo` y `RF-410: estadoVisible devuelve pendiente, aprobada, rechazada o sin_efecto`. Aprobar y rechazar son estados finales (A-05). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-07** Implementar `dejarSinEfecto` y `restaurarEfecto` en `estados.ts`
  - RF: RF-407
  - Depende de: T004-06
  - Hecho cuando: pasan `estados.test.ts › RF-407: corregida a presente queda sin efecto y se conserva` y `RF-407: si la ausencia vuelve a ausente se restaura el efecto`, y el estado de revisión no cambia en ninguno de los dos casos. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-08** Implementar `ausenciasJustificables` en `justificables.ts`
  - RF: RF-401, RF-405, RF-408
  - Depende de: T004-05, T004-06
  - Hecho cuando: pasan `justificables.test.ts › RF-401: misa, catequesis y actividad obligatoria son justificables`, `RF-405: una ausencia con plazo vencido ya no es justificable`, `RF-401: no ofrece una ausencia con justificación pendiente o aprobada` y `RF-408: una rechazada con plazo vigente vuelve a ofrecerse`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-09** Implementar `agruparPorDomingo` y `sesionesAnticipables` **[Supuesto A-03, A-13]**
  - RF: RF-401, RF-404
  - Depende de: T004-08
  - Hecho cuando: pasan `justificables.test.ts › RF-401: misa y catequesis del mismo domingo se muestran en una fila`, `RF-404: ofrece las sesiones futuras del ciclo que no tienen justificación` y `RF-404: no ofrece como anticipables sesiones pasadas ni de otro ciclo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-10** Implementar `evidencia.ts` (validación de metadatos) **[Supuesto A-06]**
  - RF: RF-402, RNF-402, RNF-403
  - Depende de: T004-04
  - Hecho cuando: pasan `evidencia.test.ts › RNF-402: rechaza un archivo de más de 307 200 bytes`, `RNF-403: rechaza un content-type distinto de image/jpeg` y `RF-402: exige entre 1 y 3 fotos`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-11** Implementar `validarLote` en `lote.ts` **[Supuesto A-04]**
  - RF: RF-402, RF-403, RF-404, RF-405, RF-406
  - Depende de: T004-08, T004-09, T004-10
  - Hecho cuando: pasan los tests de `lote.test.ts`:
    - `RF-402: rechaza un lote sin foto`;
    - `RF-402: rechaza una causa no listada`;
    - `RF-403: rechaza ausencias de un niño que no es hijo del apoderado`;
    - `RF-404: rechaza una anticipada con causa distinta de evento escolar`;
    - `RF-405: la coordinación tampoco puede justificar una ausencia vencida`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-12** Implementar `expandirLote` en `lote.ts`
  - RF: RF-403, RF-406, RF-407
  - Depende de: T004-11
  - Hecho cuando: pasan `lote.test.ts › RF-403: un lote de tres fechas crea tres justificaciones con la misma evidencia`, `RF-403: una evidencia, una justificación por niño (hermanos)`, `RF-406: el canal coordinación lleva registrada_por y registrada_en` y `RF-407: cada justificación queda ligada a niño, sesión, fecha y tipo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-13** Implementar `efectos.ts` para los consumidores de 003, 006 y 007 **[Supuesto A-13]**
  - RF: RF-409
  - Depende de: T004-07
  - Hecho cuando: pasan los tests de `efectos.test.ts`:
    - `RF-409: una aprobada de esa fecha deja la falta justificada`;
    - `RF-409: una pendiente, rechazada o sin efecto no justifica la falta`;
    - `RF-409: una ausencia a misa aprobada no cuenta en contra para la aptitud`;
    - `RF-409: estadoParaRiesgo devuelve aprobada, pendiente, rechazada o ninguna`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-14** Implementar `puedeJustificar`, `puedeRegistrarEnNombre` y `puedeRevisar` en `permisos.ts`
  - RF: RF-401, RF-406, RF-408
  - Depende de: T004-04, T001 (F1: `contexto-acceso` y `matriz-permisos`), T001 (F2: delegación `0103`)
  - Hecho cuando: pasan `permisos.test.ts › RF-408: solo la coordinación o un delegado vigente puede revisar`, `RF-408: supervisión no puede revisar`, `RF-408: un delegado con la delegación vencida no puede revisar`, `RF-406: solo la coordinación o un delegado registra en nombre de un apoderado` y `RF-401: un apoderado solo justifica a sus hijos`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-15** Implementar `puedeVerEstado` y `puedeVerEvidencia` y agregar las filas de 004 a la matriz de 001
  - RF: RF-410, RNF-403
  - Depende de: T004-14
  - Hecho cuando: `matriz-permisos.ts` tiene `justificacion:revisar`, `justificacion:registrar-en-nombre` y `justificacion:configurar-plazo`, y `justificacion:leer` y `evidencia:leer` con los alcances del plan. Pasan los tests de `permisos.test.ts`:
    - `RF-410: un catequista de otro grupo no ve estado ni evidencia`;
    - `RF-410: la familia ve el estado pero no la evidencia`;
    - `RF-410: supervisión y catequista del grupo ven la evidencia`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-16** Implementar `compresion.ts` (plan iterativo de compresión)
  - RF: RNF-402
  - Depende de: T004-10
  - Hecho cuando: pasan `compresion.test.ts › RNF-402: el plan inicial limita el lado mayor a 1600 px con calidad 0,7`, `RNF-402: siguienteIntento baja la calidad a 0,55 y 0,4 y luego el lado a 1280 y 1024` y `RNF-402: el plan de compresión termina bajo 300 KB o falla en 5 intentos`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-17** Retirar `Justificacion` y `ResultadoOcr` de `src/lib/domain/modelo.ts`
  - RF: RF-407
  - Depende de: T004-04
  - Hecho cuando: `modelo.ts` reexporta los tipos de `src/lib/justificaciones/tipos.ts`, la búsqueda de `ResultadoOcr` en `src/` no encuentra nada y ningún import queda roto. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 2 — Migraciones y repositorios PostgreSQL

- [ ] **T004-18** Crear la migración `NNNN_justificaciones_plazo_ciclo.sql`
  - RF: RF-405
  - Depende de: T004-05, T008 (Fase 0: M1, tabla `ciclo`), T001 (F0-3: runner de migraciones y `docker-compose.yml`), T001 (F0-6: skill `nueva-migracion`)
  - Hecho cuando: la migración crea `justificacion_plazos` y se aplica limpia sobre una base vacía en Docker. Pasa `contrato-plazo.test.ts › RF-405: dias_plazo fuera de 1 a 60 es rechazado por la restricción`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-19** Crear la migración `NNNN_justificaciones_evidencias.sql` (`evidencias` y `evidencia_archivos`) **[Supuesto A-06]**
  - RF: RF-402, RF-407, RNF-402, RNF-403
  - Depende de: T004-18
  - Hecho cuando: pasan `contrato-evidencias.test.ts › RNF-402: evidencia_archivos rechaza bytes mayores de 307200`, `RF-402: orden fuera de 1 a 3 es rechazado` y `RNF-403: una evidencia nace en estado reservada`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-20** Crear la migración `NNNN_justificaciones_base.sql` (`justificaciones` y `justificacion_eventos`)
  - RF: RF-403, RF-406, RF-407, RF-408
  - Depende de: T004-19, T002 (Fase 1: migraciones M-201 a M-204 de catequizandos), T003 (Fase 1: migración `0302_sesiones.sql`)
  - Hecho cuando: pasan `contrato-justificaciones.test.ts › RF-406: el canal coordinación exige registrada_por`, `RF-408: rechazada exige motivo_rechazo`, `RF-408: una revisada exige revisada_por` y `RF-408: dos justificaciones de la misma ausencia se aceptan` (no hay unicidad por niño y sesión). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-21** Crear la migración `NNNN_justificaciones_sin_borrado.sql`
  - RF: RF-407
  - Depende de: T004-20
  - Hecho cuando: pasan los tests de `contrato-sin-borrado.test.ts`:
    - `RF-407: borrar una justificación falla por trigger`;
    - `RF-407: borrar un evento o una evidencia falla`;
    - `RF-407: el rol de la aplicación no tiene DELETE`;
    - `RF-407: una evidencia solo pasa a eliminada mediante marcar_evidencia_eliminada con motivo`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-22** Definir los puertos de dominio e implementar `repositorio-evidencias-pg.ts`
  - RF: RF-402, RNF-403
  - Depende de: T004-21
  - Hecho cuando: `dominio/puertos.ts` declara `RepositorioJustificaciones`, `RepositorioEvidencias` y `AlmacenEvidencias`. Pasan los tests de contrato `RNF-403: reservar y confirmar una evidencia con sus archivos`, `RNF-403: listarHuerfanas devuelve solo las reservas no confirmadas de más de 24 h` y `RNF-403: cuenta las reservas de una cuenta en la última hora`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-23** Implementar `insertarLote` idempotente en `repositorio-justificaciones-pg.ts`
  - RF: RF-403, RF-406, RF-407
  - Depende de: T004-22, T004-12
  - Hecho cuando: pasan `contrato-justificaciones.test.ts › RF-403: reinsertar el mismo lote es idempotente`, `RF-403: si falla una inserción del lote no queda ninguna` y `RF-407: cada justificación insertada tiene su evento creada`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-24** Implementar en el repositorio la revisión, «sin efecto» y la restauración
  - RF: RF-407, RF-408
  - Depende de: T004-23, T004-07
  - Hecho cuando: pasan `contrato-justificaciones.test.ts › RF-408: revisar guarda revisada_por, revisada_en y su evento`, `RF-407: marcar sin efecto conserva la fila y registra el evento sin_efecto` y `RF-407: restaurar registra efecto_restaurado`. Cada escritura actualiza `actualizado_en`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-25** Implementar las consultas del repositorio (bandeja, perfil, familia y cambios)
  - RF: RF-403, RF-408, RF-410
  - Depende de: T004-24
  - Hecho cuando: pasan los tests de `contrato-justificaciones.test.ts`:
    - `RF-408: las pendientes del ciclo salen agrupadas por lote`;
    - `RF-408: la consulta marca las ausencias con más de una justificación`;
    - `RF-410: listarPorApoderado devuelve solo las de sus hijos`;
    - `RF-410: cambiosDesde devuelve solo filas con actualizado_en posterior`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-26** Implementar `obtenerPlazo` y `definirPlazo` en el repositorio **[Supuesto A-11]**
  - RF: RF-405
  - Depende de: T004-18, T004-22
  - Hecho cuando: pasan `contrato-plazo.test.ts › RF-405: obtenerPlazo devuelve 7 si el ciclo no lo definió` y `RF-405: definirPlazo guarda definido_por y definido_en`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 3 — Blob Storage, infraestructura y Azurite

- [ ] **T004-27** Instalar `@azure/storage-blob` y `@azure/identity` en `api/` y añadir Azurite a `docker-compose.yml`
  - RF: RNF-403
  - Depende de: T004-01, T001 (F0-3: esqueleto de `api/` y `docker-compose.yml`)
  - Hecho cuando: `npm ls @azure/storage-blob @azure/identity --prefix api` muestra versiones fijas. Tras `docker compose up -d azurite`, el puerto 10000 responde y un test de humo crea y borra un contenedor. La app de `src/` no importa ninguno de los dos paquetes. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-28** Crear `infra/modulos/evidencias.bicep` (contenedor privado, roles, CORS y CSP)
  - RF: RF-401, RF-407, RNF-403
  - Depende de: T004-27, T001 (F0-4: `almacenamiento.bicep` y Static Web Apps)
  - Hecho cuando: el módulo cumple lo siguiente:
    - el contenedor `evidencias` tiene `publicAccess: None`, sin versionado ni eliminación temporal;
    - la identidad de la Function App tiene `Storage Blob Data Contributor` sobre el contenedor y `Storage Blob Delegator` sobre la cuenta;
    - CORS permite `PUT` y `GET` solo desde el dominio de Static Web Apps;
    - la CSP de Static Web Apps permite el endpoint Blob en `img-src` y `connect-src`.

    `az bicep build --file infra/main.bicep` termina sin advertencias y `az deployment group what-if` lo confirma. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-29** Implementar en `almacen-evidencias-blob.ts` la SAS de subida (solo crear, 5 min)
  - RF: RF-402, RNF-403
  - Depende de: T004-27, T004-22
  - Hecho cuando: pasan los tests de almacén contra Azurite `RNF-403: la SAS de subida no permite sobrescribir`, `RNF-403: la SAS vencida es rechazada` y `RNF-403: el blob se nombra {cicloId}/{evidenciaId}/{orden}.jpg`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-30** Separar la credencial de SAS: de usuario delegado en Azure y de cuenta solo en pruebas
  - RF: RNF-403
  - Depende de: T004-29
  - Hecho cuando: la fábrica del almacén usa `ManagedIdentityCredential` y `getUserDelegationKey` fuera del modo de pruebas. Pasa `almacen-credencial.test.ts › RNF-403: en Azure se usa SAS de usuario delegado y nunca la clave de cuenta`, y ninguna configuración de producción lee una clave de cuenta. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-31** Implementar en el almacén la inspección, la SAS de lectura y el borrado
  - RF: RF-407, RF-410, RNF-402, RNF-403
  - Depende de: T004-30
  - Hecho cuando: pasan los tests de almacén contra Azurite `RNF-402: la inspección detecta un blob de más de 300 KB o sin firma JPEG`, `RNF-403: la SAS de lectura solo permite r, expira en 5 min y fuerza Cache-Control no-store` y `RF-407: borrar elimina todos los archivos de una evidencia`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 4 — Functions de familia

- [ ] **T004-32** Implementar `listar-justificables.ts` y `GET /familia/ausencias-justificables`
  - RF: RF-401, RF-405, RF-408
  - Depende de: T004-08, T004-25, T004-26, T003 (Fase 1: `consultarAusencias`), T001 (F1: `conAcceso` y entrada por enlace de familia), T002 (Fase 1: `alcanceFamilia`), T008 (Fase 0: `GET /ciclos/abierto`), T005 (sesiones de actividades obligatorias vía RF-313 de 003)
  - Hecho cuando: pasan los tests HTTP `RF-401: devuelve las ausencias justificables de los hijos con niño, fecha y sesión`, `RF-405: una ausencia vencida no aparece como justificable`, `RF-401: sin token responde 401` y `RF-401: un catequista recibe 403`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-33** Implementar `GET /familia/sesiones-anticipables`
  - RF: RF-404
  - Depende de: T004-09, T004-32, T003 (Fase 1: sesiones futuras del ciclo creadas por `generarSesionesDominicales`)
  - Hecho cuando: pasan los tests HTTP `RF-404: devuelve las sesiones futuras de los hijos que no tienen justificación` y `RF-404: otra familia no ve las sesiones de un niño ajeno`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-34** Implementar `reservar-evidencia.ts` y `POST /evidencias/reservas` **[Supuesto A-06]**
  - RF: RF-402, RNF-402, RNF-403
  - Depende de: T004-10, T004-15, T004-29
  - Hecho cuando: pasan los tests HTTP:
    - `RNF-402: una reserva con un archivo declarado de más de 300 KB responde 400`;
    - `RF-402: una reserva con más de 3 archivos responde 400`;
    - `RNF-403: devuelve una SAS de solo crear y 5 min por archivo`;
    - `RNF-403: un catequista recibe 403`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-35** Limitar las reservas y los lotes en APIM, con respaldo en la Function
  - RF: RNF-403
  - Depende de: T004-34, T004-22, T001 (F0-4: política base de APIM)
  - Hecho cuando: la política de APIM limita `POST /evidencias/reservas` y `POST /justificaciones/lotes` a 10 por minuto por `sub`. Pasa `RNF-403: la reserva 21 de una cuenta en una hora responde 429` (respaldo en la Function, contado en `evidencias`). `az bicep build` termina sin errores. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-36** Implementar el servicio `crear-lote.ts` (verificar los blobs, insertar y confirmar)
  - RF: RF-402, RF-403, RF-404, RF-407, RNF-402
  - Depende de: T004-11, T004-12, T004-23, T004-31
  - Hecho cuando: pasan los tests del servicio con dobles:
    - `RF-402: rechaza una causa no listada`;
    - `RNF-402: un blob de más de 300 KB o sin firma JPEG invalida el lote y se borra`;
    - `RF-403: una evidencia, tres justificaciones ligadas a sus fechas`;
    - `RF-407: al crear el lote la evidencia pasa a confirmada`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-37** Exponer `POST /justificaciones/lotes` para la familia
  - RF: RF-401, RF-402, RF-403, RF-404, RF-407, RF-408
  - Depende de: T004-36, T004-15, T008 (Fase 0: rechazo de escrituras con el ciclo cerrado)
  - Hecho cuando: pasan los tests HTTP:
    - `RF-403: reenviar el mismo loteId devuelve el mismo resultado`;
    - `RF-401: un apoderado que justifica a un niño ajeno recibe 403`;
    - `RF-404: una anticipada con causa evento_escolar responde 201`;
    - `RF-408: con el ciclo cerrado responde 409`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-38** Implementar `GET /familia/justificaciones` **[Supuesto A-01, A-14]**
  - RF: RF-410, RF-406
  - Depende de: T004-25, T004-15
  - Hecho cuando: pasan los tests HTTP:
    - `RF-410: la familia ve el estado y el motivo de rechazo`;
    - `RF-410: la familia no obtiene URL de evidencia`;
    - `RF-410: una enviada por otro apoderado se etiqueta «otro apoderado» sin su nombre`;
    - `RF-406: una registrada por la coordinación se etiqueta como tal`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 5 — Cliente de la familia (web, sin instalar)

- [ ] **T004-39** Instalar las dependencias de cliente con `npx expo install`
  - RF: RF-402, RNF-402, RNF-404
  - Depende de: T004-02
  - Hecho cuando: `expo-image-picker`, `expo-image-manipulator`, `expo-file-system` y `expo-image` están en `package.json` con versiones del SDK 57. `npx expo install --check` no da advertencias y `npx expo config --type public` muestra el plugin de `expo-image-picker` con el texto de permiso de cámara en español. Antes se consultó https://docs.expo.dev/versions/v57.0.0/. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-40** Implementar `cliente-justificaciones.ts` sobre el cliente HTTP de 001
  - RF: RF-401, RF-402, RF-404, RF-410
  - Depende de: T004-32, T004-33, T004-37, T004-38, T001 (F1: `src/plataforma/api/cliente.ts`)
  - Hecho cuando: pasan los tests con `fetch` simulado `RF-401: pide las ausencias justificables con la sesión de familia` y `RF-402: envía la reserva y el lote con los cuerpos esperados`. El módulo no escribe en ningún almacenamiento. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-41** Implementar el adaptador `comprimir-foto.ts` con `expo-image-manipulator`
  - RF: RNF-402, RNF-404
  - Depende de: T004-16, T004-39
  - Hecho cuando: pasan los tests con el manipulador simulado `RNF-402: comprime de forma iterativa hasta quedar bajo 300 KB`, `RNF-402: falla con aviso tras 5 intentos` y `RNF-404: borra los archivos intermedios`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-42** Implementar el camino feliz de `enviar-justificacion.ts`
  - RF: RF-402, RF-403
  - Depende de: T004-40, T004-41, T001 (F0-1: `expo-crypto`, `randomUUID`)
  - Hecho cuando: pasan los tests `RF-402: reserva, sube cada foto con x-ms-blob-type BlockBlob y crea el lote` y `RF-403: un reintento manual reutiliza evidenciaId, loteId y los ids de justificación`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-43** Manejar en `enviar-justificacion.ts` la falta de conexión, los fallos y la limpieza de temporales
  - RF: RNF-404
  - Depende de: T004-42, T003 (Fase 1: `@react-native-community/netinfo` instalada y justificada)
  - Hecho cuando: pasan los tests:
    - `RNF-404: sin conexión avisa y borra los temporales sin escribir en almacenamiento`, con espías sobre WatermelonDB, `localStorage`, SecureStore y AsyncStorage;
    - `RNF-404: un fallo de subida muestra el mismo aviso y no deja cola`;
    - `RNF-404: en web revoca las URL de objeto`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-44** Crear los componentes `selector-causa.tsx` y `selector-ausencias.tsx`
  - RF: RF-402, RF-403
  - Depende de: T004-04, T004-09
  - Hecho cuando: pasan `RF-402: el selector muestra solo las tres causas como chips` y `RF-403: el selector permite marcar ausencias de varios hijos y fechas`. Los componentes no contienen reglas de negocio. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-45** Convertir `familia.tsx` en `familia/index.tsx` (ausencias primero y «Mis justificaciones»)
  - RF: RF-401, RF-410, RNF-404
  - Depende de: T004-40, T004-44
  - Hecho cuando: pasan `RF-401: la pantalla de familia lista primero las ausencias justificables`, `RF-410: muestra el estado y, si fue rechazada, el motivo` y `RNF-404: sin conexión muestra un aviso y no guarda nada`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-46** Crear la pantalla única `familia/justificar.tsx`
  - RF: RF-402, RF-403, RNF-401
  - Depende de: T004-43, T004-45
  - Hecho cuando: pasan los tests:
    - `RNF-401: el flujo de la familia requiere a lo sumo 4 interacciones`: ausencia ya marcada, causa, foto y Enviar;
    - `RF-402: Enviar está deshabilitado sin causa o sin foto`;
    - `RF-403: se pueden añadir ausencias de otro hijo antes de enviar`.

    En web, la foto se toma con un `input` con captura. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-47** Crear la confirmación `familia/enviada.tsx`
  - RF: RF-402
  - Depende de: T004-46
  - Hecho cuando: pasa `RF-402: confirma la recepción con la lista de ausencias justificadas`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-48** Crear `familia/anticipar.tsx` para eventos escolares
  - RF: RF-404
  - Depende de: T004-46
  - Hecho cuando: pasan `RF-404: solo ofrece la causa evento escolar y pide la foto del comunicado` y `RF-404: lista las sesiones futuras de cada hijo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-49** Probar el flujo de familia en un celular sin la app **[Prueba manual]**
  - RF: RF-401, RNF-401, RNF-402
  - Depende de: T004-47, T004-48, T004-28, T001 (F0-5: despliegue en Static Web Apps)
  - Hecho cuando: un celular Android sin la app instalada abre el enlace de familia en el navegador, ve la ausencia pendiente y envía una justificación con foto. El blob en Azure pesa menos de 300 KB y la consola del navegador no muestra errores de CORS ni de CSP. El tiempo y el tamaño quedan anotados en el PR. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 6 — Coordinación: plazo, bandeja, revisión, evidencia y registro en nombre de

- [ ] **T004-50** Implementar `configurar-plazo.ts` y `GET`/`PUT /ciclos/{cicloId}/plazo-justificacion` **[Supuesto A-11]**
  - RF: RF-405
  - Depende de: T004-26, T004-14, T001 (F1: auditoría `0102`)
  - Hecho cuando: pasan los tests HTTP:
    - `RF-405: la coordinación define el plazo y el cambio queda auditado`;
    - `RF-405: un catequista recibe 403 al definir el plazo`;
    - `RF-405: GET devuelve 7 si no se definió`;
    - `RF-405: un plazo fuera de 1 a 60 responde 400`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-51** Crear la pantalla `coordinacion/justificaciones/plazo.tsx`
  - RF: RF-405
  - Depende de: T004-50
  - Hecho cuando: pasan `RF-405: la pantalla muestra el plazo vigente y guarda uno nuevo` y `RF-405: sin conexión avisa y no guarda nada`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-52** Implementar `bandeja.ts` y `GET /justificaciones/bandeja`
  - RF: RF-408, RF-403
  - Depende de: T004-25, T004-14
  - Hecho cuando: pasan los tests HTTP:
    - `RF-408: reúne las pendientes del ciclo agrupadas por lote`;
    - `RF-408: ambas quedan registradas y la bandeja marca el duplicado`;
    - `RF-408: un catequista recibe 403 en la bandeja`;
    - `RF-408: supervisión ve la bandeja en solo lectura`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-53** Implementar `revisar.ts` y `POST /justificaciones/revisiones`
  - RF: RF-408, RF-403
  - Depende de: T004-52, T004-24, T008 (Fase 0: rechazo de escrituras con el ciclo cerrado)
  - Hecho cuando: pasan los tests HTTP:
    - `RF-408: un catequista recibe 403 al aprobar`;
    - `RF-408: supervisión no puede revisar`;
    - `RF-403: aprueba las justificaciones de un lote juntas o por separado`;
    - `RF-408: rechazar sin motivo responde 400`;
    - `RF-408: un delegado vigente puede aprobar`.

    El servicio llama a un notificador vacío que se completa en T004-66. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-54** Implementar `obtener-evidencia.ts` y `GET /justificaciones/{id}/evidencia`, con auditoría **[Supuesto A-07]**
  - RF: RF-407, RF-410, RNF-403, RNF-405
  - Depende de: T004-31, T004-15, T001 (F1: auditoría `0102`)
  - Hecho cuando: pasan los tests HTTP:
    - `RF-410: un catequista de otro grupo recibe 403 al ver estado y evidencia`;
    - `RF-410: la familia recibe 403`;
    - `RNF-403: cada consulta queda en la auditoría`;
    - `RNF-403: la respuesta lleva Cache-Control no-store`;
    - `RF-407: una evidencia eliminada responde 410 «sin evidencia»`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-55** Implementar `GET /catequizandos/{id}/justificaciones` (historial del perfil)
  - RF: RF-407, RF-410, RF-406
  - Depende de: T004-25, T004-15
  - Hecho cuando: pasan los tests HTTP `RF-407: el perfil lista la ausencia, la causa, la fecha de envío, quién la envió y el canal`, `RF-406: muestra «registrada por la coordinación en nombre de» con quién y cuándo` y `RF-410: un catequista de otro grupo recibe 403`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-56** Habilitar el registro en nombre de un apoderado en la API **[Supuesto A-04]**
  - RF: RF-406
  - Depende de: T004-32, T004-37, T002 (Fase 1: `GET /apoderados` y apoderados del niño)
  - Hecho cuando: existe `GET /coordinacion/catequizandos/{id}/ausencias-justificables` y `POST /justificaciones/lotes` acepta `apoderadoId` con canal coordinación. Pasan los tests HTTP:
    - `RF-406: registrada por la coordinación en nombre de, con quién y cuándo`;
    - `RF-406: un apoderadoId que no es apoderado del niño responde 400`;
    - `RF-406: una ausencia vencida no se puede registrar`;
    - `RF-406: un catequista recibe 403`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-57** Crear el componente `visor-evidencia.tsx` con `expo-image` sin caché
  - RF: RF-410, RNF-403, RNF-405
  - Depende de: T004-39, T004-54
  - Hecho cuando: pasan `RNF-403: el visor usa cachePolicy none y pide una SAS nueva al abrir` y `RNF-405: sin conexión muestra un aviso y no pide la evidencia`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-58** Crear la bandeja `coordinacion/justificaciones/index.tsx` con selección múltiple
  - RF: RF-408, RF-403, RNF-405
  - Depende de: T004-52, T004-53
  - Hecho cuando: pasan `RF-408: la bandeja lista las pendientes por lote`, `RF-403: aprobar varias seleccionadas envía todos los ids en una revisión` y `RNF-405: sin conexión muestra un aviso y no lista nada guardado`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-59** Crear el detalle `coordinacion/justificaciones/[loteId].tsx`
  - RF: RF-408, RF-403, RF-410
  - Depende de: T004-57, T004-58
  - Hecho cuando: pasan `RF-408: rechazar exige escribir un motivo de hasta 280 caracteres`, `RF-403: se puede aprobar solo una ausencia del lote` y `RF-410: muestra la evidencia del lote`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-60** Crear `coordinacion/justificaciones/registrar.tsx`
  - RF: RF-406
  - Depende de: T004-56, T004-43, T004-44
  - Hecho cuando: pasa `RF-406: registra con niño, apoderado, ausencias, causa y foto recibida por otro medio`. La pantalla reutiliza `enviar-justificacion.ts` con canal coordinación y aplica la misma limpieza de temporales (RNF-404). `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 7 — Integración con 001, 002, 003, 006, 007 y 008

- [ ] **T004-61** Implementar `al-cambiar-asistencia.ts` y conectarlo a la corrección de 003
  - RF: RF-407
  - Depende de: T004-24, T003 (Fase 1: corrección RF-309 que invoca el puerto en su transacción)
  - Hecho cuando: pasan los tests `RF-407: una ausencia corregida a presente queda sin efecto y se conserva` y `RF-407: si vuelve a ausente se restaura el efecto`, y la corrección de 003 llama al puerto dentro de su transacción. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-62** Añadir la tabla local `justificaciones_estado` al esquema WatermelonDB
  - RF: RF-410
  - Depende de: T003 (Fase 1: esquema local, pasos de migración y push)
  - Hecho cuando: un paso nuevo de migración local, que solo añade, crea la tabla. Pasan `RF-410: el esquema local de justificaciones no tiene causa, motivo, enviada_por ni evidencia` y `RF-410: el push rechaza cambios a justificaciones_estado`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-63** Implementar `proveedor-pull.ts` en el protocolo de sincronización de 003
  - RF: RF-410, RF-409
  - Depende de: T004-62, T004-25, T004-15
  - Hecho cuando: pasan los tests `RF-410: el catequista recibe solo los estados de sus grupos`, `RF-410: la coordinación recibe todos los del ciclo` y `RF-410: el pull solo envía id, niño, sesión, fecha, tipo y estado visible`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-64** Crear `resumen-justificaciones.tsx` y registrarlo como proveedor del perfil de 002
  - RF: RF-407, RF-410, RNF-405
  - Depende de: T004-63, T004-55, T004-57, T002 (Fase 3: `ProveedorResumenPerfil`)
  - Hecho cuando: pasan `RF-410: el perfil muestra pendiente, aprobada, rechazada o sin efecto sin conexión` y `RNF-405: el detalle y la evidencia piden conexión`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-65** Implementar `ConsultaJustificaciones` y el adaptador real de `FuenteJustificacionesAprobadas` para 003
  - RF: RF-409
  - Depende de: T004-13, T004-25, T004-26, T003 (Fase 2: adaptador real de justificaciones aprobadas)
  - Hecho cuando: pasan los tests `RF-409: con una aprobada de esa fecha faltasDelCiclo marca la falta como justificada` y `RF-409: la consulta expone diasPlazo y estadoParaRiesgo`. El adaptador vacío de 003 queda reemplazado. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-66** Notificar los cambios a 006 y 007 con `alCambiarJustificacion`
  - RF: RF-409
  - Depende de: T004-53, T004-61, T004-65, T006 (Fase 3: lecturas de aptitud), T007 (Fase 3: motor de recálculo)
  - Hecho cuando: pasan los tests `RF-409: aprobar o dejar sin efecto notifica a los suscriptores en proceso` y `RF-409: una ausencia a misa aprobada no cuenta en contra en la aptitud`, este último con la regla de 006. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-67** Implementar `depurar-evidencias.ts` como participante de retención y consentimiento **[Supuesto A-07]**
  - RF: RF-407
  - Depende de: T004-31, T004-22, T001 (F3: motor de retención, retiro de consentimiento y bandeja `borrado_blob_pendiente`), T008 (Fase 5: puerto `eliminarEvidenciasDeCiclo`)
  - Hecho cuando: pasan los tests contra Azurite y Postgres:
    - `RF-407: depurar borra el blob y conserva la justificación`;
    - `RF-407: queda el evento evidencia_eliminada con su motivo`;
    - `RF-407: al retirar el consentimiento de un hermano se elimina la evidencia compartida`;
    - `RF-407: eliminarEvidenciasDeCiclo borra por prefijo de ciclo`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-68** Implementar el temporizador `limpiarEvidenciasHuerfanas` (todos los días a las 03:00 de Lima)
  - RF: RNF-403
  - Depende de: T004-22, T004-31
  - Hecho cuando: con reloj falso pasan `RNF-403: las reservas no confirmadas de más de 24 h se borran y se marcan huerfana` y `RNF-403: la limpieza no toca las evidencias confirmadas`. El cron está en UTC (`0 0 8 * * *`). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-69** Escribir el extremo a extremo del flujo principal (API, Postgres y Azurite)
  - RF: RF-401, RF-402, RF-403, RF-408, RF-409
  - Depende de: T004-37, T004-53, T004-65
  - Hecho cuando: pasa `e2e › RF-409: tras aprobar, la falta deja de contar`. El test recorre justificables, reserva, subida, un lote de tres fechas, la bandeja, la aprobación y `faltaJustificada`, y comprueba que se crean tres justificaciones con la misma evidencia. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-70** Escribir el extremo a extremo de los casos límite
  - RF: RF-405, RF-407, RF-408
  - Depende de: T004-69, T004-61, T001 (F1: revocación de enlace)
  - Hecho cuando: pasan los tests de extremo a extremo:
    - `RF-408: una rechazada con motivo y plazo vigente vuelve a ofrecerse`;
    - `RF-407: una ausencia corregida a presente queda sin efecto y se conserva`;
    - `RF-408: las pendientes de un enlace revocado siguen en la bandeja`;
    - `RF-405: vencido el plazo, la ausencia deja de ofrecerse`.

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 8 — Validación de los criterios de finalización

- [ ] **T004-71** Verificar que cada RF y RNF de la spec 004 tiene un test que lo cita
  - RF: RF-401, RF-402, RF-403, RF-404, RF-405, RF-406, RF-407, RF-408, RF-409, RF-410, RNF-401, RNF-402, RNF-403, RNF-404, RNF-405
  - Depende de: T004-70, T001 (F0-7: `scripts/verificar-cobertura-rf.mjs`)
  - Hecho cuando: `node scripts/verificar-cobertura-rf.mjs` informa 0 requisitos de la spec 004 sin test y queda como paso bloqueante para 004 en `ci.yml`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-72** Verificar en un dispositivo real que no queda evidencia en el celular **[Prueba manual]**
  - RF: RNF-404, RNF-405, RNF-403
  - Depende de: T004-49, T004-60
  - Hecho cuando: se comprueba lo siguiente en un Android de gama baja con build de desarrollo:
    - en modo avión, el envío muestra el aviso y `adb shell run-as <paquete> ls -R cache files` no lista ninguna foto ni archivo del manipulador;
    - la bandeja y el visor sin red muestran el aviso;
    - una SAS de lectura copiada falla con 403 a los 6 minutos.

    Los resultados quedan en el PR. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T004-73** Medir en campo la sencillez del flujo y cerrar los criterios de finalización **[Prueba manual]**
  - RF: RNF-401, RF-401, RF-402, RF-410
  - Depende de: T004-71, T004-72
  - Hecho cuando: al menos 5 apoderados con celulares propios y sin la app abren su enlace y completan una justificación con foto, cada uno en menos de 60 s medidos con cronómetro. Un catequista de otro grupo no ve nada. Cada criterio de finalización de la spec queda marcado como verificado en el PR, con el test o la medición que lo respalda. `npm test`, `npm run typecheck` y `npm run lint` pasan.

---

## Cobertura

| Requisito | Tareas |
| --- | --- |
| RF-401 Ausencias por justificar | T004-08, T004-09, T004-14, T004-28, T004-32, T004-37, T004-40, T004-45, T004-49, T004-69, T004-71, T004-73 |
| RF-402 Contenido de la justificación | T004-02, T004-04, T004-10, T004-11, T004-19, T004-22, T004-29, T004-34, T004-36, T004-37, T004-39, T004-40, T004-42, T004-44, T004-46, T004-47, T004-69, T004-71, T004-73 |
| RF-403 Varias ausencias con una evidencia | T004-11, T004-12, T004-20, T004-23, T004-25, T004-36, T004-37, T004-42, T004-44, T004-46, T004-52, T004-53, T004-58, T004-59, T004-69, T004-71 |
| RF-404 Justificación anticipada | T004-04, T004-09, T004-11, T004-33, T004-36, T004-37, T004-40, T004-48, T004-71 |
| RF-405 Plazo | T004-05, T004-08, T004-11, T004-18, T004-26, T004-32, T004-50, T004-51, T004-70, T004-71 |
| RF-406 Registro en nombre del apoderado | T004-11, T004-12, T004-14, T004-20, T004-23, T004-38, T004-55, T004-56, T004-60, T004-71 |
| RF-407 Vínculo inequívoco con el perfil | T004-01, T004-07, T004-12, T004-17, T004-19, T004-20, T004-21, T004-23, T004-24, T004-28, T004-31, T004-36, T004-37, T004-54, T004-55, T004-61, T004-64, T004-67, T004-70, T004-71 |
| RF-408 Revisión | T004-06, T004-08, T004-14, T004-20, T004-24, T004-25, T004-32, T004-37, T004-52, T004-53, T004-58, T004-59, T004-69, T004-70, T004-71 |
| RF-409 Efectos de la aprobación | T004-13, T004-63, T004-65, T004-66, T004-69, T004-71 |
| RF-410 Visibilidad | T004-02, T004-06, T004-15, T004-25, T004-31, T004-38, T004-40, T004-45, T004-54, T004-55, T004-57, T004-59, T004-62, T004-63, T004-64, T004-71, T004-73 |
| RNF-401 Sencillez | T004-46, T004-49, T004-71, T004-73 |
| RNF-402 Datos mínimos | T004-02, T004-03, T004-10, T004-16, T004-19, T004-31, T004-34, T004-36, T004-39, T004-41, T004-49, T004-71 |
| RNF-403 Evidencia protegida | T004-01, T004-10, T004-15, T004-19, T004-22, T004-27, T004-28, T004-29, T004-30, T004-31, T004-34, T004-35, T004-54, T004-57, T004-68, T004-71, T004-72 |
| RNF-404 Evidencia fuera del celular | T004-02, T004-03, T004-39, T004-41, T004-43, T004-45, T004-71, T004-72 |
| RNF-405 Revisión con conexión | T004-03, T004-54, T004-57, T004-58, T004-64, T004-71, T004-72 |

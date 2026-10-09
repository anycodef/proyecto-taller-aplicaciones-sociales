# Tareas 007 — Riesgo de deserción

Tareas de implementación de [spec.md](spec.md) según [plan.md](plan.md). Cada tarea dura como máximo 20–30 minutos, se entrega en un commit propio (Conventional Commits + registro Agent Trace enlazado a su ID, principio 9) y solo se da por terminada cuando `npm test`, `npm run typecheck` y `npm run lint` pasan (principio 4). Todo nombre de test empieza por el identificador que cubre (`RF-7xx: ...`, `RNF-7xx: ...`).

La spec 007 **no entra en el primer corte**: estas tareas empiezan cuando existen el protocolo de sincronización y el cómputo de falta (plan 003) y el plazo y los estados de justificación (plan 004).

**Dependencias nuevas:** ninguna (plan §2, principio 1). Se usan WatermelonDB, Functions de temporizador y PostgreSQL ya justificados en los planes 001 y 003. Por eso no hay tarea de justificación de dependencias; la T007-60 verifica que `package.json` no cambió.

**Total de tareas:** 67 (2 bloqueadas por aclaración).

## Leyenda

| Etiqueta | Significado |
| --- | --- |
| **[Test primero]** | La tabla de casos se escribe y se revisa antes de la implementación. Para no dejar tests en rojo entre commits (principio 4), la tarea de test entrega la tabla como datos tipados con un test que verifica su completitud; el `test.each` que la ejecuta se activa en la tarea que implementa la regla. |
| **[Supuesto provisional]** | Implementa un supuesto reversible de plan §11.4 sobre una duda `[NECESITA ACLARACIÓN]`; se indica cuál. La tarea no está bloqueada: el supuesto se puede revertir sin cambiar el modelo. |
| **[Bloqueada por aclaración]** | No puede cerrarse hasta que el equipo responda la duda indicada. |
| `TNNN (…)` | Pieza de otra spec cuya tarea aún no tiene ID; se describe entre paréntesis. |

---

## Fase 0 — Contratos con otros planes y C4

- [ ] **T007-01** Conciliar los contratos con el plan 003
  - RF: RF-701, RF-705, RNF-701, RNF-703, RNF-704
  - Depende de: T003 (plan 003 aprobado: `consultarFaltas`, bandeja `eventos_asistencia`, mecanismo de extensión §3.3)
  - Hecho cuando: `plan.md` §5.2 de 007 deja fijado, con visto bueno del dueño de 003, (a) el nombre real de la consulta de faltas (`consultarFaltas` de 003 frente a `obtenerFaltas`), (b) la consulta que entrega los domingos consolidados por niño para la racha, (c) si 007 consume `eventos_asistencia` por `secuencia` o si 003 llama a `marcarRecalculoPendiente` en su transacción, y (d) que las tablas de riesgo se registran con el mecanismo §3.3 de 003 (`src/lib/riesgo/tablas-sincronizadas.ts` + `proveedor-sincronizacion.ts`); `npm test`, `npm run typecheck` y `npm run lint` pasan (sin cambios de código).

- [ ] **T007-02** Conciliar los contratos con los planes 004 y 002
  - RF: RF-701, RF-704, RF-706, RF-707
  - Depende de: T004 (plan 004 aprobado: puerto `ConsultaJustificaciones`, `plazo.ts`), T002 (plan 002 aprobado: `grupoActual`, `apoderadosVinculados`, `marcarInactivo`, `ProveedorResumenPerfil`)
  - Hecho cuando: `plan.md` §5.2 de 007 reemplaza `obtenerJustificacionesPorFecha` y `calcularVencimientoPlazo` por las firmas reales de 004 (`estadoParaRiesgo`, `diasPlazo`, `fechaLimite` o las que se acuerden), confirma que `fechaLimite` (fin del día en `America/Lima`) es compatible con el caso "exactamente en `venceEn` → suma" de §9.1, y fija las firmas de `grupoActual`, `apoderadosVinculados`, `marcarInactivo(tx, id, 'retiro')` y del registro en `ProveedorResumenPerfil`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-03** Conciliar los contratos con los planes 001 y 008
  - RF: RF-703, RF-704, RF-705, RF-706, RF-707, RF-708
  - Depende de: T001 (plan 001 aprobado: matriz de permisos, delegación, auditoría), T008 (plan 008 aprobado: convención C-1 a C-7, `guardia-ciclo.ts`)
  - Hecho cuando: `plan.md` de 007 registra las filas de riesgo que se añaden a la matriz de permisos de 001 (coordinación/delegado, catequista por grupo actual, supervisión y familia sin acceso), el uso de `tienePermisoCoordinacion`, `gruposACargo` y la auditoría de rechazos, el trigger `ciclo_bloquear_si_cerrado` (C-3) en las tablas de riesgo, el filtro de ciclo abierto en los temporizadores (C-5), el borrado de la nota de contacto por la retención de 008 y las firmas de `contarRetirados` y `cicloTieneSaldosDePapel`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-04** Añadir el componente de riesgo al diagrama C4
  - RF: RF-702, RF-707 (D-711)
  - Depende de: T007-01, T007-02
  - Hecho cuando: `docs/diagrams/arquitectura-c4.dsl` contiene el componente "Detección de Riesgo de Deserción" dentro del backend, con relaciones hacia asistencia, justificaciones, catequizandos, sincronización y la base de datos, y la descripción del contenedor ya no dice que el riesgo vive en otro componente; el diff solo toca ese archivo; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 1 — Dominio puro en `src/lib/riesgo/`

- [ ] **T007-05** Crear el vocabulario de riesgo (`tipos.ts`, `index.ts`)
  - RF: RF-702, RF-706
  - Depende de: T001 (F0-2: Jest con `jest-expo`, script `npm test` y regla ESLint de `src/lib`)
  - Hecho cuando: `src/lib/riesgo/tipos.ts` exporta `Paso`, `ResultadoContacto`, `EstadoFalta`, `TipoAlerta`, `MotivoCierre`, `FaltaOrigen` y `EstadoRiesgo` con arreglos constantes de valores; el test `RF-702: los pasos, tipos de alerta y motivos de cierre coinciden con los valores del plan` y `RF-706: el resultado de contacto es una lista cerrada de cinco valores` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-06** Implementar `clasificarFalta` con su tabla de 11 casos
  - RF: RF-701
  - Depende de: T007-05
  - Hecho cuando: `clasificar-falta.test.ts` ejecuta con `test.each` los 11 casos de plan §9.1 (p. ej. `RF-701: vence con justificación pendiente → en_revision`, `RF-701: exactamente en venceEn → suma`, `RF-701: dos apoderados, una rechazada y una pendiente → en_revision`) y todos pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-07** Implementar `contarFaltas` con saldo de papel y faltas de origen
  - RF: RF-701, RF-708, RNF-702
  - Depende de: T007-06
  - Hecho cuando: pasan `RF-701: solo las faltas en estado suma cuentan`, `RF-708: saldo 2 más 1 falta posterior al corte da 3`, `RF-708: una falta con fecha igual o anterior a la fecha de corte se ignora` y `RNF-702: faltasOrigen lista las fechas que suman y una entrada papel con cantidad y fechaCorte`; `pendientesJustificar` cuenta las `pendiente_justificar`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-08** Escribir la tabla de casos de pasos y transiciones **[Test primero]**
  - RF: RF-702, RF-703, RF-704, RF-705, RF-706
  - Depende de: T007-05
  - Hecho cuando: `src/lib/riesgo/__tests__/casos-transiciones.ts` contiene, como datos tipados, los casos de `calcularPaso` de §9.1 (conteo 0, 1, 2, 3 con y sin ficha, 4 con y sin ficha, 7, retirado con cualquier conteo) y las filas T1–T26 y A1–A9 de §9.2 con paso previo, entrada, paso nuevo, alertas que abre y alertas que cierra con su motivo; el test `RF-702: la tabla de transiciones contiene T1–T26 y A1–A9, incluidas las bajadas T10, T13, T16, T19 y T20` pasa; la tabla se revisa en el PR antes de empezar T007-09; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-09** Implementar `calcularPaso`
  - RF: RF-702, RF-703, RF-704
  - Depende de: T007-08
  - Hecho cuando: `pasos.test.ts` ejecuta los casos de `calcularPaso` de la tabla de T007-08 (p. ej. `RF-702: conteo 3 sin ficha → citacion`, `RF-703: conteo 3 con ficha → seguimiento`, `RF-702: conteo 4 sin ficha → alerta_retiro con sinFicha`, `RF-704: retirado con conteo 0 → retirado`) y todos pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-10** Implementar `calcularRacha` y `evaluarPosibleAbandono` **[Supuesto provisional]**
  - RF: RF-705
  - Depende de: T007-05, T007-08
  - Hecho cuando: pasan `RF-705: la racha cuenta domingos consolidados seguidos sin presencia desde el más reciente`, `RF-705: un domingo sin sesiones o no consolidado no corta ni suma la racha` (A9), `RF-705: racha N−1 no marca` (A4), `RF-705: tras un descarte en racha R solo vuelve a marcar en R+N` (A8) y `RF-705: un domingo con justificación aprobada o pendiente no cuenta ni corta la racha` (supuesto del plan sobre racha y justificaciones); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-11** Implementar `transicionar`: subidas, bajadas e idempotencia
  - RF: RF-702
  - Depende de: T007-09
  - Hecho cuando: `transiciones.test.ts` ejecuta las filas T1–T5, T9, T10, T13–T16, T18–T20, T24 y T25 de la tabla (p. ej. `RF-702: T13 citación con conteo 2 baja a contacto, no abre alerta y cierra citación con ya_no_aplica`, `RF-702: T25 recálculo sin cambios no abre ni cierra alertas`) y todas pasan; como máximo una alerta de paso abierta por niño; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-12** Implementar `transicionar`: contactos y fichas
  - RF: RF-703, RF-706
  - Depende de: T007-11
  - Hecho cuando: pasan las filas T6, T7, T8, T11, T12 y T17 (p. ej. `RF-706: T6 contacto registrado cierra la alerta de contacto con atendida_contacto`, `RF-706: T8 contacto anterior a la segunda falta no cierra la alerta`, `RF-703: T11 ficha en citación pasa a seguimiento y cierra con atendida_ficha`, `RF-703: T17 ficha en alerta de retiro actualiza sin_ficha=false sin cerrar`); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-13** Implementar `transicionar`: alerta de posible abandono
  - RF: RF-705, RF-706
  - Depende de: T007-10, T007-11
  - Hecho cuando: pasan las filas A1–A8 (p. ej. `RF-705: A2 racha N con último contacto no_responde abre posible_abandono`, `RF-705: A3 último contacto se_compromete no marca`, `RF-705: A6 contacto justificara cierra posible_abandono con ya_no_aplica`, `RF-705: A7 descarte cierra con descartada`) y la alerta de abandono es independiente de la de paso; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-14** Implementar `transicionar`: retiro confirmado y ningún retiro automático **[Supuesto provisional]**
  - RF: RF-702, RF-704
  - Depende de: T007-12, T007-13
  - Hecho cuando: pasan T21, T22, T23 y T26 (`RF-704: T21 retiro confirmado cierra la alerta de retiro con retiro_confirmado`, `RF-704: T22 retiro cierra también posible_abandono`, `RF-704: T23 retirado sigue retirado aunque el conteo baje` — supuesto de las dudas "¿reincorporación?" y "¿justificación aprobada tras el retiro revierte?" —, `RF-704: T26 cien recálculos con conteo ≥4 nunca producen retirado`) y el test guardián `RF-702: todas las filas de casos-transiciones se ejecutan` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-15** Implementar `evaluarRiesgo` (orquestación pura)
  - RF: RF-701, RF-702, RF-705
  - Depende de: T007-07, T007-09, T007-10
  - Hecho cuando: pasan `RF-702: 2, 3 y 4 faltas vencidas sin justificar dan contacto, citación y alerta de retiro`, `RF-701: una falta dentro de su plazo no suma y se reporta en pendientesJustificar` y `RF-705: evaluarRiesgo marca posibleAbandono con racha N y sin contactos`, con el reloj inyectado como `ahora`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-16** Implementar `validaciones.ts` **[Supuesto provisional]**
  - RF: RF-703, RF-704, RF-705, RF-706, RF-708
  - Depende de: T007-05
  - Hecho cuando: pasan los rechazos de §9.3 con mensaje en español: `RF-706: resultado fuera de la lista se rechaza`, `RF-706: nota de 141 caracteres se rechaza`, `RF-703: ficha con fecha futura se rechaza`, `RF-704: motivo vacío o solo espacios se rechaza`, `RF-708: saldo negativo se rechaza`, `RF-705: N = 0 se rechaza` (rango 1–20, supuesto de la duda "valor inicial de N"); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-17** Implementar `ordenarListaRiesgo` y `alertasPara` **[Supuesto provisional]**
  - RF: RF-707, RNF-702
  - Depende de: T007-05
  - Hecho cuando: pasan `RF-707: la lista ordena alerta de retiro, citación, contacto y seguimiento, con posible abandono arriba`, `RF-707: sin_riesgo (sin abandono) y retirado no aparecen` (supuesto "¿qué pasos aparecen en la lista?"), `RF-707: contacto va a catequista del grupo y coordinación; citación, retiro y abandono solo a coordinación` y `RNF-702: cada entrada conserva sus faltas de origen`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-18** Retirar `SenalRiesgo` de `modelo.ts`
  - RF: RF-702
  - Depende de: T007-15
  - Hecho cuando: `src/lib/domain/modelo.ts` ya no define `SenalRiesgo` ni `nivel: bajo|medio|alto` (fuera de alcance de la spec) y reexporta `EstadoRiesgo` de `@/lib/riesgo`; `grep -rn "SenalRiesgo" src api` no devuelve nada; ningún archivo de `src/lib/riesgo/` importa React, React Native ni Expo (regla ESLint de 001); `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 2 — Migraciones y repositorio PostgreSQL

- [ ] **T007-19** Crear la migración `NNNN_riesgo_registros.sql` **[Supuesto provisional]**
  - RF: RF-703, RF-704, RF-705, RF-706, RF-708
  - Depende de: T007-03, T001 (F0-3: runner `api/scripts/migrar.ts` y PostgreSQL en Docker), T008 (M1: tabla `ciclo` y `ciclo_bloquear_si_cerrado`), T002 (M-201 a M-204: catequizando, apoderado y vínculo), T001 (`0101`: tabla `cuenta`)
  - Hecho cuando: la migración crea `riesgo_parametros` (con `domingos_posible_abandono` por defecto 3, supuesto de la duda "valor inicial de N"), `riesgo_contacto`, `riesgo_ficha_compromiso`, `riesgo_retiro`, `riesgo_saldo_inicial` y `riesgo_descarte_abandono` con los CHECK, UNIQUE e índice parcial de §3.1 y el trigger C-3 en cada una; `npm run migrar` la aplica sobre la BD de Docker; pasan `RF-706: riesgo_contacto rechaza un resultado fuera de la lista`, `RF-704: riesgo_retiro rechaza un motivo de menos de 3 caracteres`, `RF-705: domingos_posible_abandono rechaza 0 y 21` y `RF-703: riesgo_ficha_compromiso no tiene columna de imagen`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-20** Crear la migración `NNNN_riesgo_estado_y_alertas.sql`
  - RF: RF-701, RF-702, RF-705, RF-707, RNF-702
  - Depende de: T007-19
  - Hecho cuando: la migración crea `riesgo_estado` (PK `(ciclo_id, catequizando_id)`, `faltas_origen jsonb`, CHECK de `paso`) y `riesgo_alerta` (CHECK de `tipo` y `motivo_cierre`, índices únicos parciales de alerta de paso abierta y de abandono abierta) con trigger C-3; `npm run migrar` la aplica; pasan `RF-702: riesgo_estado rechaza un paso desconocido` y `RF-702: no se pueden insertar dos alertas de paso abiertas para el mismo niño y ciclo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-21** Crear la migración `NNNN_riesgo_recalculo.sql`
  - RF: RNF-701, RNF-703
  - Depende de: T007-19
  - Hecho cuando: la migración crea `riesgo_recalculo_pendiente` (PK `(ciclo_id, catequizando_id)`) y `riesgo_marca_agua` (PK `ciclo_id`); `npm run migrar` la aplica; la verificación de migraciones inmutables de 001 pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-22** Definir los puertos y el repositorio de contactos y fichas
  - RF: RF-703, RF-706
  - Depende de: T007-19
  - Hecho cuando: `api/src/modulos/riesgo/dominio/puertos.ts` declara `RepositorioRiesgo`, `LectorFaltas` y `LectorJustificaciones`; `repositorio-riesgo-pg.ts` inserta contactos y fichas; en `repositorio-riesgo.contrato.test.ts` pasan `RF-706: insertar dos veces el mismo id de contacto deja un solo registro` y `RF-703: una segunda ficha del mismo niño y ciclo devuelve un conflicto controlado`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-23** Añadir al repositorio retiros, saldos, descartes y parámetros
  - RF: RF-704, RF-705, RF-708
  - Depende de: T007-22
  - Hecho cuando: pasan los tests de contrato `RF-704: un segundo retiro del mismo niño y ciclo devuelve un conflicto controlado`, `RF-708: un saldo nuevo deja el anterior con vigente = false y lo enlaza en reemplaza_a`, `RF-705: los parámetros se guardan con upsert por ciclo` y `RF-705: el descarte guarda racha_al_descartar`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-24** Persistir estado y alertas en una transacción por niño
  - RF: RF-702, RF-705, RNF-702
  - Depende de: T007-20, T007-22
  - Hecho cuando: el repositorio aplica el resultado de `transicionar` (estado, alertas a abrir, cerrar y actualizar) en una sola transacción; pasan `RF-702: guardar estado y alertas es atómico (un fallo no deja estado sin su alerta)` y `RNF-702: la alerta guarda las mismas faltas_origen que el estado`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-25** Implementar la bandeja de recálculo y la marca de agua en el repositorio
  - RF: RNF-701, RNF-703
  - Depende de: T007-21, T007-22
  - Hecho cuando: pasan los tests de contrato `RNF-703: marcar recálculo dos veces para el mismo niño deja una sola fila`, `RNF-701: dos ejecuciones simultáneas no toman el mismo niño (FOR UPDATE SKIP LOCKED)` y `RNF-701: la marca de agua avanza solo al confirmar la transacción`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-26** Exponer `contarRetirados` y `cicloTieneSaldosDePapel` para 008
  - RF: RF-704, RF-708
  - Depende de: T007-23
  - Hecho cuando: el módulo `riesgo` exporta ambas consultas con la firma acordada en T007-03; pasan `RF-704: contarRetirados cuenta solo retiros confirmados del ciclo` y `RF-708: cicloTieneSaldosDePapel es verdadero si hay al menos un saldo vigente`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 3 — Motor de recálculo

- [ ] **T007-27** Implementar `marcarRecalculoPendiente`
  - RF: RNF-703
  - Depende de: T007-25
  - Hecho cuando: `aplicacion/marcar-recalculo.ts` exporta `marcarRecalculoPendiente(tx, cicloId, catequizandoIds, motivo)` que solo ejecuta un `INSERT ... ON CONFLICT DO NOTHING`; pasa `RNF-703: marcarRecalculoPendiente no llama a evaluarRiesgo` (con espía); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-28** Implementar el lector de faltas y domingos consolidados
  - RF: RF-701, RF-705, RNF-704
  - Depende de: T007-01, T007-22, T003 (`consultarFaltas` con el cómputo de falta RF-311 y asistencias consolidadas)
  - Hecho cuando: `infraestructura/lector-faltas.ts` adapta la consulta de 003 a la entrada de `evaluarRiesgo`, incluidas las jornadas (supuesto de 003: 1 falta por fecha, 007 consume la lista tal cual); pasan `RF-701: el lector devuelve domingos sin misa ni catequesis y jornadas sin asistencia como faltas` y `RF-705: el lector entrega los domingos consolidados en orden para la racha`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-29** Implementar el lector de justificaciones y vencimientos
  - RF: RF-701
  - Depende de: T007-02, T007-22, T004 (puerto `ConsultaJustificaciones` y `plazo.ts` con `fechaLimite`, RF-405 y RF-409)
  - Hecho cuando: `infraestructura/lector-justificaciones.ts` entrega, por niño y fecha, las justificaciones y el `venceEn` calculado con la función pura de 004; pasa `RF-701: el lector entrega una justificación aprobada de cualquier sesión de la fecha y su vencimiento`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-30** Implementar el caso de uso `recalcular-riesgo.ts`
  - RF: RF-701, RF-702, RF-705, RNF-704
  - Depende de: T007-14, T007-15, T007-24, T007-28, T007-29, T008 (`guardia-ciclo.ts`: `cicloAbierto`)
  - Hecho cuando: para una lista de niños lee faltas, justificaciones, saldo, ficha, retiro, contactos, descartes y parámetros, corre `evaluarRiesgo` + `transicionar` y persiste por niño; en `recalculo.integracion.test.ts` pasan `RF-702: dos faltas vencidas sin justificar abren la alerta de contacto con sus faltas de origen`, `RF-702: recalcular dos veces no duplica alertas` y `RF-701: un ciclo cerrado no se recalcula`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-31** Seleccionar los niños a recalcular en cada ejecución
  - RF: RNF-701, RF-705
  - Depende de: T007-25, T007-30
  - Hecho cuando: la selección une la bandeja pendiente, los niños con faltas cuyo plazo venció desde `riesgo_marca_agua` y los niños cuyo último domingo quedó consolidado, y luego borra las marcas y avanza la marca de agua; pasa `RNF-701: con el reloj antes del plazo la falta queda pendiente de justificar y tras el plazo el siguiente tick la suma y abre la alerta sin acción manual`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-32** Registrar la Function `riesgoRecalculoTemporizador`
  - RF: RNF-701, RNF-704
  - Depende de: T007-31, T001 (F0-3: esqueleto de Functions v4 e identidad administrada)
  - Hecho cuando: `http/temporizador-recalculo.ts` registra el temporizador `0 */5 * * * *` (UTC) sin pasar por APIM; pasan `RNF-701: el temporizador invoca la selección y el recálculo` y `RNF-701: el temporizador solo procesa el ciclo abierto (C-5)`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-33** Registrar la Function `riesgoReconciliacionNocturna`
  - RF: RNF-701, RF-702
  - Depende de: T007-30
  - Hecho cuando: `http/temporizador-reconciliacion.ts` registra `0 0 7 * * *` (UTC) y recalcula todos los niños activos y retirados del ciclo abierto; pasa `RNF-701: la reconciliación nocturna corrige el estado de un niño cuya marca de recálculo se perdió`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-34** Conectar los cambios de asistencia (003) con la bandeja
  - RF: RNF-703, RF-701, RF-702
  - Depende de: T007-01, T007-27, T003 (procesamiento de marcas en el push, corrección RF-309, carné invalidado RF-303)
  - Hecho cuando: el push de asistencia, la corrección y la invalidación de carné marcan recálculo según el contrato de T007-01 (llamada directa o consumo de `eventos_asistencia`); pasan `RNF-703: el push de asistencia de 50 niños solo inserta marcas y no llama a evaluarRiesgo` y `RNF-703: la duración del push no cambia con el módulo de riesgo activo o inactivo` (diferencia dentro del margen fijado en el test); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-35** Conectar las justificaciones (004) con la bandeja
  - RF: RF-701, RF-702
  - Depende de: T007-27, T007-31, T004 (envío por lotes, revisión, `dejarSinEfecto` y `restaurarEfecto`)
  - Hecho cuando: el envío, la aprobación, el rechazo y el cambio a "sin efecto" marcan recálculo en la misma transacción; pasan `RF-701: aprobar una justificación baja el conteo en el siguiente tick y cierra la alerta que ya no aplica` y `RF-701: rechazar la justificación pendiente de una falta vencida la suma`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-36** Conectar las jornadas (005) y la anulación (002) con la bandeja
  - RF: RF-701, RF-702
  - Depende de: T007-27, T005 (registro de asistencia a jornadas), T002 (anulación de inscripción RF-203)
  - Hecho cuando: registrar o corregir asistencia a una jornada y anular una inscripción marcan recálculo; pasan `RF-701: una jornada sin asistencia suma tras vencer su plazo` y `RF-702: un niño anulado deja de tener alertas abiertas`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-37** Probar el cálculo solo con datos sincronizados
  - RF: RNF-704
  - Depende de: T007-32, T007-34
  - Hecho cuando: en `recalculo.integracion.test.ts` pasa `RNF-704: con la lista de catequesis del grupo sin sincronizar no hay falta ni alerta; al llegar, el tick la calcula; un escaneo de misa tardío baja de paso`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 4 — Sincronización y autorización en el servidor

- [ ] **T007-38** Implementar la autorización del módulo `riesgo`
  - RF: RF-703, RF-704, RF-705, RF-706, RF-707, RF-708
  - Depende de: T007-03, T001 (F2: delegación y `tienePermisoCoordinacion`; matriz de permisos), T002 (`grupoActual` y `gruposACargo`)
  - Hecho cuando: `aplicacion/autorizacion.ts` decide por rol y grupo actual; pasan `RF-706: un catequista registra contactos solo de niños de sus grupos actuales`, `RF-703: solo coordinación o delegado vigente registra fichas`, `RF-704: un delegado vencido no puede confirmar retiros` y `RF-707: supervisión y familia no acceden a riesgo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-39** Declarar las tablas sincronizadas de riesgo
  - RF: RF-707, RNF-704
  - Depende de: T007-01, T007-05, T003 (§3.3: `registro-tablas.ts` y `DefinicionTablaSincronizada`)
  - Hecho cuando: `src/lib/riesgo/tablas-sincronizadas.ts` declara las 8 tablas de plan §3.2 con su sentido y alcance y se registran en `registro-tablas.ts`; pasan `RNF-704: estados_riesgo y alertas_riesgo son solo pull`, `RF-707: retiros, saldos y parámetros tienen alcance solo coordinación` y el test existente `Principio 7: ninguna tabla sincronizada contiene columnas restringidas` (si `nota` coincide con la lista prohibida, se resuelve con 003 antes de cerrar); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-40** Implementar el push de `contactos_riesgo`
  - RF: RF-706
  - Depende de: T007-16, T007-22, T007-27, T007-38, T007-39, T002 (`apoderadosVinculados`)
  - Hecho cuando: el manejador valida con `validaciones.ts`, fuerza `contactado_por` al usuario del token, inserta con `ON CONFLICT (id) DO NOTHING` y marca recálculo; en `manejadores-sincronizacion.http.test.ts` pasan `RF-706: contactado_por falsificado se reemplaza por el usuario del token`, `RF-706: un apoderado no vinculado al niño se rechaza por registro` y `RF-706: el contacto guarda a cuál de los dos apoderados se contactó`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-41** Implementar el push de `fichas_compromiso_riesgo`
  - RF: RF-703
  - Depende de: T007-40
  - Hecho cuando: pasan `RF-703: la coordinación registra la ficha con fecha, apoderado y quién la registró`, `RF-703: una segunda ficha del niño en el ciclo se rechaza con aviso` y `RF-703: un catequista no puede registrar fichas`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-42** Implementar el push de `retiros_riesgo`
  - RF: RF-704
  - Depende de: T007-23, T007-40, T002 (`marcarInactivo`)
  - Hecho cuando: el manejador valida el motivo, inserta, llama a `catequizandos.marcarInactivo(tx, id, 'retiro')` en la misma transacción y marca recálculo; pasan `RF-704: un retiro sin motivo se rechaza`, `RF-704: el retiro confirmado inactiva al niño en la misma transacción y registra quién y cuándo` y `RF-704: un retiro duplicado conserva el primero y rechaza el segundo con aviso`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-43** Implementar el push de `saldos_iniciales_riesgo`
  - RF: RF-708
  - Depende de: T007-23, T007-40
  - Hecho cuando: pasan `RF-708: el saldo se guarda marcado como cargado desde papel con quién y cuándo`, `RF-708: un saldo nuevo deja el anterior no vigente y marca recálculo` y `RF-708: un catequista no puede cargar saldos`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-44** Implementar el push de descartes de abandono y de parámetros
  - RF: RF-705
  - Depende de: T007-23, T007-40
  - Hecho cuando: pasan `RF-705: el descarte fija racha_al_descartar con el valor del servidor y marca recálculo`, `RF-705: cambiar N marca recálculo de todo el ciclo` y `RF-705: N fuera de 1–20 se rechaza`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-45** Implementar el pull de riesgo con alcance por grupo actual
  - RF: RF-707, RNF-704
  - Depende de: T007-24, T007-38, T007-39
  - Hecho cuando: el proveedor de pull filtra las 8 tablas según §3.2 usando el grupo actual del niño; pasan `RF-707: la coordinación recibe los estados de todos los grupos y el catequista solo los de sus grupos`, `RF-707: tras un cambio de grupo la alerta abierta llega al nuevo catequista y deja de llegar al anterior` y `RF-707: supervisión y familia no reciben ninguna tabla de riesgo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-46** Completar la matriz HTTP rol × tabla y los rechazos auditados
  - RF: RF-703, RF-704, RF-705, RF-706, RF-707, RF-708
  - Depende de: T007-41, T007-42, T007-43, T007-44, T007-45, T001 (auditoría de denegaciones), T008 (fase 1: `clasificarRegistroEntrante` en el push)
  - Hecho cuando: `manejadores-sincronizacion.http.test.ts` recorre coordinación, delegado vigente, delegado vencido, catequista (su grupo y otro grupo), supervisión y familia × {contactos, fichas, retiros, saldos, descartes, parámetros} con la aceptación o rechazo de §5.1; pasan `RF-707: todo rechazo por alcance queda en la auditoría` y `RF-704: un retiro de un ciclo cerrado se descarta (RF-802)`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 5 — Cliente (WatermelonDB y pantallas)

- [ ] **T007-47** Añadir las tablas y modelos de riesgo al almacén local
  - RF: RF-707, RNF-704
  - Depende de: T007-39, T003 (`src/datos/local/migraciones.ts` y modelos), T008 (C-6: `ciclo_id` en tablas locales)
  - Hecho cuando: hay un paso nuevo en `src/datos/local/migraciones.ts` que crea las 8 tablas con `ciclo_id` indexado, sube `schemaVersion` y añade sus modelos en `src/datos/local/modelos/`; pasan `RF-707: el esquema local incluye las tablas de riesgo con ciclo_id indexado` y `RNF-704: los modelos de estados_riesgo y alertas_riesgo no permiten escritura local`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-48** Crear los componentes `insignia-paso` y `lista-faltas-origen`
  - RF: RF-702, RF-708, RNF-702
  - Depende de: T007-05
  - Hecho cuando: `src/components/riesgo/insignia-paso.tsx` muestra el paso con la marca "sin ficha firmada" cuando aplica y `lista-faltas-origen.tsx` lista fechas y la entrada "N cargadas desde papel"; pasan `RF-702: la insignia de alerta de retiro sin ficha muestra "sin ficha firmada"` y `RNF-702: la lista muestra cada falta que originó la alerta y las cargadas desde papel`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-49** Crear la pantalla de lista de riesgo (`src/app/riesgo/index.tsx`)
  - RF: RF-701, RF-702, RF-705, RF-707, RNF-702, RNF-704
  - Depende de: T007-17, T007-47, T007-48
  - Hecho cuando: la pantalla lee con consultas reactivas de WatermelonDB, ordena con `ordenarListaRiesgo`, muestra "posible abandono" arriba, faltas de origen, "N pendientes de justificar" y "Calculado el <fecha y hora>", y la coordinación filtra por grupo; pasan `RF-707: la lista muestra las secciones en el orden de ordenarListaRiesgo` y `RNF-704: la lista muestra la fecha del último cálculo del servidor`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-50** Añadir el indicador de alertas nuevas desde la última visita **[Supuesto provisional]**
  - RF: RF-702, RF-707, RNF-705
  - Depende de: T007-49
  - Hecho cuando: la lista marca las alertas abiertas después de la última visita guardada como preferencia local del dispositivo (almacén local existente, sin dependencias nuevas), supuesto D-709 de la duda "¿cómo se enteran sin abrir el sistema?"; pasa `RF-702: una alerta abierta después de la última visita se marca como nueva`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-51** Crear la pantalla de detalle del niño (`riesgo/[catequizandoId]/index.tsx`)
  - RF: RF-701, RF-702, RF-703, RF-706, RF-708, RNF-702
  - Depende de: T007-47, T007-48
  - Hecho cuando: muestra paso, alerta abierta e historial, faltas con su estado (pendiente de justificar, en revisión, justificada, suma, cargadas desde papel), contactos y ficha, y los botones según el rol; pasan `RF-701: el detalle muestra una falta en plazo como "pendiente de justificar"` y `RF-702: el catequista no ve los botones de ficha ni de retiro`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-52** Crear la pantalla de registro de contacto
  - RF: RF-706
  - Depende de: T007-16, T007-51
  - Hecho cuando: `contacto.tsx` permite elegir apoderado (si hay dos), fecha (hoy por defecto), uno de los 5 resultados y una nota con contador de 140 y el aviso "No escribas datos de salud ni situaciones familiares"; guarda en WatermelonDB con UUID del dispositivo y muestra "Pendiente de envío" sin cambiar el paso local; pasan `RF-706: la nota no admite más de 140 caracteres` y `RF-706: guardar el contacto no cambia el paso mostrado hasta el siguiente pull`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-53** Crear la pantalla de ficha de compromiso
  - RF: RF-703
  - Depende de: T007-16, T007-51
  - Hecho cuando: `ficha.tsx` pide apoderado que firmó y fecha, sin cámara ni adjuntos, y guarda localmente; pasan `RF-703: la pantalla de ficha no ofrece adjuntar imágenes` y `RF-703: una fecha futura muestra el error de validaciones.ts`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-54** Crear la pantalla de confirmación de retiro
  - RF: RF-704, RF-705
  - Depende de: T007-16, T007-51
  - Hecho cuando: `retiro.tsx` exige motivo y una segunda confirmación explícita ("Retirar a <nombre>"), es accesible desde la alerta de retiro, desde "Confirmar retiro" de posible abandono y desde el detalle, y muestra la fecha del último cálculo; pasan `RF-704: el botón Confirmar no se habilita sin motivo` y `RF-704: sin la segunda confirmación no se guarda el retiro`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-55** Añadir la acción "Descartar" posible abandono
  - RF: RF-705
  - Depende de: T007-51
  - Hecho cuando: en el detalle, la coordinación puede descartar la marca de posible abandono, lo que crea un registro local en `descartes_abandono_riesgo`; pasan `RF-705: solo la coordinación ve la acción Descartar` y `RF-705: descartar crea un registro pendiente de envío`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-56** Crear la pantalla de saldo inicial desde papel
  - RF: RF-708
  - Depende de: T007-16, T007-47
  - Hecho cuando: `src/app/riesgo/saldo-inicial.tsx` lista la nómina del ciclo con faltas no justificadas (numérico) y "ya firmó ficha" (interruptor) por niño, una fecha de corte única, y muestra "cargado desde papel por <seudónimo> el <fecha>"; pasan `RF-708: el saldo guardado muestra quién lo cargó y cuándo` y `RF-708: un saldo negativo no se guarda`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-57** Crear la pantalla de parámetros de posible abandono
  - RF: RF-705
  - Depende de: T007-16, T007-47
  - Hecho cuando: `src/app/riesgo/parametros.tsx` permite a la coordinación fijar N (1–20) y muestra 3 si no hay valor guardado; pasan `RF-705: N fuera de 1–20 muestra el error de validación` y `RF-705: solo la coordinación accede a parámetros`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-58** Mostrar la tarjeta de riesgo en el perfil del niño
  - RF: RF-702
  - Depende de: T007-48, T007-47, T002 (pantalla de perfil y `ProveedorResumenPerfil`)
  - Hecho cuando: `src/components/riesgo/tarjeta-riesgo.tsx` muestra paso, alerta abierta y enlace a `/riesgo/[catequizandoId]` y se registra en el perfil de 002; pasa `RF-702: el perfil muestra la alerta abierta y enlaza al detalle de riesgo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-59** Enlazar la lista de riesgo desde coordinación
  - RF: RF-707
  - Depende de: T007-49
  - Hecho cuando: `src/app/coordinacion.tsx` reemplaza el pendiente "señal de riesgo" por un acceso a `/riesgo` con el número de alertas abiertas, y el texto de `src/app/index.tsx` deja de mencionar "señales de riesgo"; pasa `RF-707: coordinación muestra el número de alertas abiertas y navega a la lista`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-60** Verificar que no hay mensajería con costo
  - RF: RNF-705
  - Depende de: T007-52, T007-54, T007-59
  - Hecho cuando: pasa `RNF-705: src/app/riesgo, src/components/riesgo y api/src/modulos/riesgo no usan sms:, mailto:, ni APIs de mensajería o notificaciones` (búsqueda estática) y `git diff main -- package.json api/package.json` no añade dependencias; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 6 — Flujo extremo a extremo y cierre

- [ ] **T007-61** Escribir el flujo E2E de pasos, plazos y justificaciones
  - RF: RF-701, RF-702, RF-704, RNF-702
  - Depende de: T007-35, T007-37, T007-46
  - Hecho cuando: en `api/test/riesgo/flujo-riesgo.e2e.test.ts` pasan los criterios 1–4 y 6 de §9.7: `RF-702: 2, 3 y 4 faltas no justificadas llevan a contacto, citación y alerta de retiro`, `RF-701: una falta en plazo no suma y al vencer sin justificación suma`, `RF-701: aprobar una justificación baja el conteo y cierra la alerta que ya no aplica`, `RF-702: la cuarta falta sin ficha genera alerta de retiro "sin ficha firmada"` y `RF-704: ningún niño queda retirado sin un registro de retiro con motivo de coordinación`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-62** Escribir el flujo E2E de abandono, saldos, contactos y cambio de grupo
  - RF: RF-705, RF-706, RF-707, RF-708
  - Depende de: T007-61
  - Hecho cuando: pasan los criterios 5, 7, 8 y 9 de §9.7: `RF-705: N domingos sin asistencia y contacto no_responde marcan posible abandono`, `RF-708: saldo de papel 3 sin ficha → citación; 2 con ficha + 2 faltas nuevas → alerta de retiro con ficha`, `RF-706: el contacto con uno de dos apoderados guarda cuál` y `RF-707: tras el cambio de grupo el pull del nuevo catequista trae la alerta y el del anterior ya no`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-63** Verificar la cobertura de requisitos de 007
  - RF: RF-701, RF-702, RF-703, RF-704, RF-705, RF-706, RF-707, RF-708, RNF-701, RNF-702, RNF-703, RNF-704, RNF-705
  - Depende de: T007-60, T007-62, T001 (F0-7: `verificar-cobertura-rf.mjs`)
  - Hecho cuando: `node scripts/verificar-cobertura-rf.mjs` (o la ruta que fije 001) informa al menos un test por cada RF-701 a RF-708 y RNF-701 a RNF-705, sin ninguno faltante; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-64** Validar los criterios de finalización en un build de desarrollo
  - RF: RF-701, RF-702, RF-704, RF-705, RF-708, RNF-701, RNF-703
  - Depende de: T007-63, T003 (build de desarrollo EAS con WatermelonDB)
  - Hecho cuando: con datos de prueba sembrados y un Android de desarrollo, la coordinación recorre los 7 criterios de finalización de la spec y la descripción del PR registra cada uno como cumplido, junto con la medición de que la toma de asistencia de un domingo no se hizo más lenta; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-65** Hacer la prueba de campo con la coordinación
  - RF: RF-702, RF-705, RF-706, RF-707
  - Depende de: T007-64
  - Hecho cuando: la coordinación usa la lista de riesgo, registra contactos y revisa una marca de posible abandono con datos reales durante al menos un domingo; la descripción del PR registra si la nota de 140 caracteres se usó con datos de salud o situaciones familiares (riesgo §11.2) y las respuestas obtenidas a las dudas abiertas; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-66** Fijar el valor inicial definitivo de N para posible abandono **[Bloqueada por aclaración]**
  - RF: RF-705
  - Depende de: T007-65
  - Bloqueada por: "Valor inicial de los domingos seguidos para 'posible abandono'" (spec 007, Dudas abiertas). Mientras tanto rige el supuesto de 3 domingos.
  - Hecho cuando: la spec registra el valor acordado; si difiere de 3, una migración nueva (sin editar `NNNN_riesgo_registros.sql`) cambia el valor por defecto y pasa `RF-705: el valor por defecto de domingos_posible_abandono es el acordado en la spec`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T007-67** Confirmar o revertir los demás supuestos provisionales **[Bloqueada por aclaración]**
  - RF: RF-701, RF-702, RF-704, RF-705, RF-706
  - Depende de: T007-65
  - Bloqueada por: las dudas de spec 007 "Jornada en domingo: ¿1 o 2 faltas?", "¿Un niño retirado puede reincorporarse?", "¿Una justificación aprobada después del retiro lo revierte?", "¿Cómo se enteran sin abrir el sistema?", "¿Qué pasa con las alertas abiertas al cerrar el ciclo?" y "¿Otros factores de riesgo deben registrarse?".
  - Hecho cuando: la spec reemplaza cada `[NECESITA ACLARACIÓN]` respondida por un requisito; los supuestos confirmados no cambian código; por cada supuesto revertido se añade a este archivo una tarea nueva con su test (p. ej. cambiar la fila T23 o añadir `riesgo_reincorporacion`); `npm test`, `npm run typecheck` y `npm run lint` pasan.

---

## Cobertura

| Requisito | Tareas |
| --- | --- |
| RF-701 Conteo de faltas | T007-01, T007-02, T007-06, T007-07, T007-15, T007-20, T007-28, T007-29, T007-30, T007-34, T007-35, T007-36, T007-49, T007-51, T007-61, T007-63, T007-64, T007-67 |
| RF-702 Pasos del proceso | T007-04, T007-05, T007-08, T007-09, T007-11, T007-14, T007-15, T007-18, T007-20, T007-24, T007-30, T007-33, T007-34, T007-35, T007-36, T007-48, T007-49, T007-50, T007-51, T007-58, T007-61, T007-63, T007-64, T007-65, T007-67 |
| RF-703 Ficha de compromiso | T007-03, T007-08, T007-09, T007-12, T007-16, T007-19, T007-22, T007-38, T007-41, T007-46, T007-51, T007-53, T007-63 |
| RF-704 Retiro | T007-02, T007-03, T007-08, T007-09, T007-14, T007-16, T007-19, T007-23, T007-26, T007-38, T007-42, T007-46, T007-54, T007-61, T007-63, T007-64, T007-67 |
| RF-705 Posible abandono | T007-01, T007-03, T007-08, T007-10, T007-13, T007-15, T007-16, T007-19, T007-20, T007-23, T007-24, T007-28, T007-30, T007-31, T007-38, T007-44, T007-46, T007-49, T007-54, T007-55, T007-57, T007-62, T007-63, T007-64, T007-65, T007-66, T007-67 |
| RF-706 Registro de contactos | T007-02, T007-03, T007-05, T007-08, T007-12, T007-13, T007-16, T007-19, T007-22, T007-38, T007-40, T007-46, T007-51, T007-52, T007-62, T007-63, T007-65, T007-67 |
| RF-707 Lista de riesgo | T007-02, T007-03, T007-04, T007-17, T007-20, T007-38, T007-39, T007-45, T007-46, T007-47, T007-49, T007-50, T007-59, T007-62, T007-63, T007-65 |
| RF-708 Saldo inicial desde papel | T007-03, T007-07, T007-16, T007-19, T007-23, T007-26, T007-38, T007-43, T007-46, T007-48, T007-51, T007-56, T007-62, T007-63, T007-64 |
| RNF-701 Alerta oportuna | T007-01, T007-21, T007-25, T007-31, T007-32, T007-33, T007-63, T007-64 |
| RNF-702 Reglas explicables | T007-07, T007-17, T007-20, T007-24, T007-48, T007-49, T007-51, T007-61, T007-63 |
| RNF-703 Fuera del camino crítico | T007-01, T007-21, T007-25, T007-27, T007-34, T007-63, T007-64 |
| RNF-704 Sin alertas falsas sin conexión | T007-01, T007-28, T007-30, T007-32, T007-37, T007-39, T007-45, T007-47, T007-49, T007-63 |
| RNF-705 Costo cero | T007-50, T007-60, T007-63 |

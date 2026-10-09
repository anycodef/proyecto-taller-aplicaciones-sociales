# 008 — Historial de ciclos · Tareas

> Implementa [`spec.md`](spec.md) según [`plan.md`](plan.md). Si una tarea choca con la spec o el plan, se corrige primero el documento (principio 2) y después la tarea.
> **Total: 98 tareas** (T008-01 a T008-98) · **22 de primer corte** · **12 bloqueadas por aclaración**.

## Leyenda

| Etiqueta | Significado |
| --- | --- |
| **[Primer corte]** | Fase 0 del plan: tabla `ciclo`, trigger de congelamiento, convención `ciclo_id`, abrir ciclo y consultar el ciclo abierto. Las necesitan 002 y 003 en el primer corte. |
| **[Bloqueada por aclaración]** | Implementa directamente el supuesto provisional de una duda `[NECESITA ACLARACIÓN]` (spec §Dudas abiertas, plan §11, A-1 a A-13). Se puede programar con el supuesto, que es reversible, pero no se marca `[x]` hasta que el equipo resuelva la duda o acepte el supuesto. Las tareas que dependen de una tarea bloqueada esperan a que se desbloquee. |
| `TNNN (…)` | Pieza de otra spec. Esas specs aún no tienen `tasks.md`; se cita la fase o pieza de su `plan.md`. |
| RF / RNF | Requisitos de [`spec.md`](spec.md) que la tarea cubre. |

## Convenciones de estas tareas

- **Cierre de cada tarea.** Un commit Conventional Commits con su registro Agent Trace (principio 9). Ninguna tarea termina con un test en rojo, omitido o borrado; `npm test`, `npm run typecheck` y `npm run lint` pasan siempre (principio 4).
- **Nombres de tests.** Empiezan por el RF o RNF que verifican (`RF-801: …`). Dominio en `src/lib/ciclos/__tests__/`; API (unidad, contrato con PostgreSQL en Docker y HTTP) en `api/src/modulos/ciclos/__tests__/` (plan 008 §8; si la configuración de Jest de 001 fija `api/test/<tipo>/ciclos/`, se usa esa); extremo a extremo en `api/test/e2e/ciclos/`. Las pantallas delegan en componentes de `src/components/ciclos/`, que se prueban con `@testing-library/react-native` en `src/components/ciclos/__tests__/` para no crear rutas de prueba dentro de `src/app/`.
- **Rutas.** Las pantallas van en el grupo `src/app/(equipo)/` del plan 001 §6.1 (la URL no cambia). `coordinacion.tsx` es `src/app/(equipo)/coordinacion.tsx` cuando 001 lo mueva.
- **Sin dependencias nuevas** (plan §2, principio 1). 008 usa solo lo que justifican 001 (`pg`, `zod`, `jose`, `jest`, `ts-jest`, `jest-expo`, `@testing-library/react-native`, `expo-crypto`) y 003 (`@nozbe/watermelondb`, `@react-native-community/netinfo`). Por eso no hay tarea de justificación de dependencias en esta spec.
- **Migraciones.** `0002_ciclo_base.sql` (M1, justo después de `0001_base.sql` y antes de cualquier tabla operativa), `0801_ciclo_cuentas.sql` (FK a `cuenta`, que nace en `0101`), `0802_ciclos_cierre.sql` (M2), `0803_ciclos_constancia.sql` (M3) y `0804_ciclos_retencion.sql` (M4). M1 y M3 se escriben en dos tareas consecutivas cada una (T008-05/06 y T008-46/47). Eso no edita una migración aplicada (principio 6) solo si ambas tareas se fusionan juntas, antes de aplicarse en cualquier BD persistente; hasta entonces solo corren en las BD efímeras de los tests (plan 001 §9.1).
- **Operaciones solo en línea** (D-810). Las pantallas de 008 muestran «Necesitas conexión para esta acción» sin red y no encolan nada.

## Fase 0 — Primer corte: tabla `ciclo`, congelamiento y apertura (RF-801)

- [ ] **T008-01** Conciliar con el plan 001 el congelamiento, el cierre y la retención **[Primer corte]**
  - RF: RF-802, RF-803, RF-805, RF-807, RF-808
  - Depende de: —
  - Hecho cuando: los planes 008 y 001 describen lo mismo, con el visto bueno del dueño de 001, en estos cuatro puntos. (a) El mecanismo de excepción C-4: `SET LOCAL sigecat.contexto` en 008 §3.1 frente a `SET LOCAL ROLE sigecat_retencion` en 001 §3.1. (b) El límite por cuenta de `GET /constancias` y `GET /reinscripciones/candidatos`: APIM Consumo no ofrece `rate-limit-by-key` (001 §5.3), así que va en la Function; hay que decidir dónde se guarda el contador. (c) Las firmas de `terminarDelegacionesVigentes(tx, en)`, `suspenderEnlacesFamiliaPorCierre(tx, cicloId)` y `reactivarEnlacesFamilia(tx, apoderadoIds)`; hoy 001 §5.4 expone `terminarDelegacionesVigentes()` y `revocarEnlacesFamilia(cuentaIds)`. (d) Cómo llegan las evidencias del ciclo al motor: `eliminarEvidenciasDeCiclo` en 008 §5.4 frente a la bandeja `borrado_blob_pendiente` en 001 D-110. No hay cambios de código; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-02** Definir el tipo `Ciclo` y validar la apertura **[Primer corte]**
  - RF: RF-801
  - Depende de: T001 (F0-2: Jest, scripts `test`/`typecheck` y regla ESLint de `src/lib`)
  - Hecho cuando: `src/lib/ciclos/ciclo.ts` exporta `Ciclo`, `EstadoCiclo` y `validarAperturaCiclo`. En `ciclo.test.ts` pasan `RF-801: rechaza abrir un ciclo si ya hay uno abierto`, `RF-801: rechaza fecha de fin anterior o igual a la de inicio` y `RF-801: exige el nombre del ciclo`. El archivo no importa React, React Native ni Expo, porque lo prohíbe la regla ESLint. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-03** Implementar la transición de estado y la regla de registros locales **[Primer corte]**
  - RF: RF-801, RF-802, RF-803
  - Depende de: T008-02
  - Hecho cuando: `transicionCiclo` y `puedeCrearRegistrosLocales` están en `ciclo.ts` y pasan `RF-803: reabrir un ciclo cerrado siempre se rechaza`, `RF-802: cerrar un ciclo ya cerrado es un no-op` y `RF-801: sin ciclo abierto local no se pueden crear registros`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-04** Sustituir `CicloCatequetico` de `src/lib/domain/modelo.ts` por `Ciclo` **[Primer corte]**
  - RF: RF-801
  - Depende de: T008-02
  - Hecho cuando: `modelo.ts` ya no define `CicloCatequetico` ni `asistenciasRequeridas`. El plan 006 §3.3 asigna ese retiro a 008 y sustituye el campo por `UmbralesAptitud`. Los usos restantes importan `Ciclo` de `@/lib/ciclos/ciclo`, y `grep -r "CicloCatequetico" src` no devuelve nada. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-05** Crear `0002_ciclo_base.sql` con la tabla `ciclo`, el índice de ciclo abierto y el trigger de transición **[Primer corte]**
  - RF: RF-801, RF-803
  - Depende de: T001 (F0-3: esqueleto de `api/`, runner de migraciones, `0001_base.sql` y PostgreSQL en Docker)
  - Hecho cuando: la migración crea `ciclo` con las columnas y los `CHECK` del plan §3.2. `abierto_por` y `cerrado_por` quedan como `uuid` sin FK, porque `cuenta` nace en `0101` (ver T008-07). Crea también `ux_ciclo_un_abierto` y el trigger `ciclo_transicion_valida`. Pasan `RF-801: el índice único impide dos ciclos abiertos en transacciones concurrentes`, `RF-803: el trigger de transición impide volver a abierto` y `RF-803: un ciclo cerrado solo admite cambiar depurado_en y no se puede borrar`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-06** Añadir a `0002_ciclo_base.sql` la función `ciclo_bloquear_si_cerrado()` **[Primer corte]**
  - RF: RF-802, RF-803, RF-808
  - Depende de: T008-01, T008-05
  - Hecho cuando: la función usa el mecanismo de excepción acordado en T008-01. Contra una tabla operativa de ejemplo que se crea solo dentro del test, pasan tres tests: `RF-803: el trigger rechaza INSERT, UPDATE y DELETE en una tabla operativa de ejemplo de un ciclo cerrado` (SQLSTATE `SG801`), `RF-803: con el ciclo abierto la tabla de ejemplo admite escrituras` y `RF-808: los contextos de retención y de retiro de consentimiento pueden escribir en un ciclo cerrado; cualquier otro valor no`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-07** Añadir las FK de `ciclo` hacia `cuenta` en `0801_ciclo_cuentas.sql` **[Primer corte]**
  - RF: RF-801
  - Depende de: T008-06, T001 (F1: `0101_cuentas_y_credenciales.sql`)
  - Hecho cuando: `abierto_por` y `cerrado_por` referencian `cuenta(id)`. Pasa `RF-801: un ciclo no puede registrar como autor una cuenta inexistente`. El runner aplica `0001 → 0002 → 0101 → … → 0801` desde cero sin error. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-08** Escribir el test de esquema que exige el trigger de congelamiento en toda tabla operativa **[Primer corte]**
  - RF: RF-801, RF-802, RF-803
  - Depende de: T008-06
  - Hecho cuando: `convencion-ciclo.test.ts` recorre `information_schema` y pasa `RF-802: toda tabla con ciclo_id tiene el trigger t_<tabla>_ciclo_cerrado y un índice que empieza por ciclo_id`. Excepciones: `sacramento_recibido`, `registro_descartado_cierre` e `indicador_ciclo` (plan §11), además de `retencion_ciclo_paso`, que es una tabla de control de 008 y no operativa (C-1). El test falla con una tabla con `ciclo_id` y sin trigger creada solo para la prueba. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-09** Publicar la convención `ciclo_id` (C-1 a C-7) para los demás planes **[Primer corte]**
  - RF: RF-801, RF-802
  - Depende de: T008-08, T001 (F0-6: skill `nueva-migracion`)
  - Hecho cuando: la skill `nueva-migracion` incluye la plantilla de tabla operativa (columna `ciclo_id`, índice y trigger), y una tabla generada con ella pasa el test de T008-08 (principio 11). Queda abierta la propuesta de texto de C-1 a C-7 para `AGENTS.md` (principio 10), que no se fusiona sin la aprobación del equipo. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-10** Implementar `ciclo-repositorio-pg.ts` **[Primer corte]**
  - RF: RF-801
  - Depende de: T008-07
  - Hecho cuando: el repositorio expone `insertar` (idempotente por `id`), `obtenerPorId`, `obtenerAbierto` y `listar`, y pasan los tests de contrato `RF-801: insertar dos veces el mismo id no duplica el ciclo` y `RF-801: obtenerAbierto devuelve null si no hay ciclo abierto`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-11** Exponer el puerto público `guardia-ciclo.ts` **[Primer corte]**
  - RF: RF-801, RF-802
  - Depende de: T008-10
  - Hecho cuando: los módulos 002 a 007 pueden importar `cicloAbierto(tx)` y `asegurarCicloAbierto(tx, cicloId)`; esta última lanza `ciclo_no_abierto`. Pasa `RF-802: asegurarCicloAbierto rechaza un ciclo cerrado o inexistente`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-12** Añadir las acciones de ciclo a la matriz de permisos **[Primer corte]**
  - RF: RF-801
  - Depende de: T001 (F1: `roles.ts` con `supervision`, `matriz-permisos.ts` y `conAcceso`)
  - Hecho cuando: `src/lib/seguridad/matriz-permisos.ts` contiene `ciclo:abrir` (ADM), `ciclo:leer-abierto` (toda cuenta autenticada) y `ciclo:listar` (ADM, COORD, delegado vigente y SUP). Pasan `RF-801: solo administración puede abrir ciclos` y el invariante de 001 `RF-102: supervisión no tiene ninguna acción de escritura`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-13** Implementar el caso de uso `abrir-ciclo.ts` **[Primer corte]**
  - RF: RF-801
  - Depende de: T008-02, T008-10, T001 (0102: servicio de auditoría)
  - Hecho cuando: con repositorios falsos pasan `RF-801: abrir con un id existente devuelve el ciclo sin duplicarlo`, `RF-801: abrir con otro ciclo abierto da ciclo_abierto_existente, también cuando lo detecta el índice` y `RF-801: la apertura queda auditada`. No copia nada del ciclo anterior: supuesto A-1 (D-814), que según el plan no bloquea. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-14** Exponer `POST /ciclos` **[Primer corte]**
  - RF: RF-801
  - Depende de: T008-12, T008-13
  - Hecho cuando: la Function `abrirCiclo` está registrada en `api/src/index.ts`, con `conAcceso` y validación `zod`. Pasan `RF-801: POST /ciclos responde 201 al abrir`, `RF-801: POST /ciclos repetido con el mismo id devuelve 200 sin duplicar`, `RF-801: POST /ciclos con un ciclo abierto responde 409 ciclo_abierto_existente` y `RF-801: POST /ciclos con fechas inválidas responde 400`. Pasa también la matriz de autorización: ADM recibe 2xx; COORD, CAT, FAM y SUP reciben 403. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-15** Exponer `GET /ciclos/abierto` **[Primer corte]**
  - RF: RF-801
  - Depende de: T008-10, T008-12
  - Hecho cuando: la Function `obtenerCicloAbierto` está registrada y pasan `RF-801: GET /ciclos/abierto devuelve el ciclo abierto o null a cualquier cuenta autenticada` y `RF-801: GET /ciclos/abierto sin JWT responde 401`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-16** Exponer `GET /ciclos` **[Primer corte]**
  - RF: RF-801, RF-806
  - Depende de: T008-10, T008-12
  - Hecho cuando: la Function `listarCiclos` está registrada y pasa `RF-801: GET /ciclos lista los ciclos con su estado, fechas y depurado_en`. Matriz de autorización: ADM, COORD, delegado vigente y SUP reciben 200; CAT y FAM reciben 403. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-17** Declarar la tabla local `ciclos` **[Primer corte]**
  - RF: RF-801
  - Depende de: T008-02, T003 (fase 1: mecanismo de extensión del esquema local, plan 003 §3.3)
  - Hecho cuando: `src/lib/ciclos/tablas-sincronizadas.ts` declara `ciclos` (`id`, `nombre`, `fecha_inicio`, `fecha_fin`, `estado`; sentido `pull`), registrada en `registro-tablas.ts` y con su paso en `src/datos/local/migraciones.ts`. Pasan `RF-801: el esquema local incluye la tabla ciclos` y el test de 003 `Principio 7: ninguna tabla sincronizada contiene columnas restringidas`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-18** Implementar el proveedor de sincronización de `ciclos` **[Primer corte]**
  - RF: RF-801, RF-802
  - Depende de: T008-10, T008-17, T003 (fase 1: módulo `sincronizacion`, pull y registro de proveedores)
  - Hecho cuando: `api/src/modulos/ciclos/infraestructura/proveedor-sincronizacion.ts` está registrado y pasan `RF-801: el pull solo baja el ciclo abierto` y `RF-802: si no hay ciclo abierto o el abierto cambió, el pull envía la eliminación del anterior`. Ninguna tabla de constancia, correcciones, `sacramento_recibido` ni indicadores tiene proveedor (principio 7). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-19** Generar las sesiones dominicales al abrir un ciclo **[Primer corte]**
  - RF: RF-801
  - Depende de: T008-13, T003 (fase 1: `generarSesionesDominicales`)
  - Hecho cuando: `abrir-ciclo.ts` invoca `generarSesionesDominicales` al abrir, que es el contrato del plan 003 §5. Pasa `RF-801: abrir un ciclo genera sus domingos una sola vez aunque se repita la petición`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-20** Asignar el `ciclo_id` local y bloquear registros sin ciclo abierto **[Primer corte]**
  - RF: RF-801, RF-802
  - Depende de: T008-03, T008-17, T003 (fase 1: repositorios locales y pantallas de asistencia)
  - Hecho cuando: los repositorios locales de 003 asignan el `ciclo_id` del ciclo abierto local al crear un registro (C-6). Las pantallas de asistencia y evaluación muestran «No hay un ciclo abierto» cuando `puedeCrearRegistrosLocales` es falso. Pasan `RF-801: un registro local nace con el ciclo_id del ciclo abierto` y `RF-801: sin ciclo abierto local la pantalla de asistencia no crea registros`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-21** Crear el cliente HTTP de ciclos **[Primer corte]**
  - RF: RF-801
  - Depende de: T008-14, T008-15, T008-16, T001 (F1: `src/plataforma/api/cliente.ts`)
  - Hecho cuando: `src/plataforma/ciclos/api-ciclos.ts` expone `abrirCiclo`, `obtenerCicloAbierto` y `listarCiclos`. Con un cliente falso pasa `RF-801: abrirCiclo envía un UUID generado en el dispositivo y lo reutiliza al reintentar`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-22** Crear la pantalla «Abrir ciclo» **[Primer corte]**
  - RF: RF-801
  - Depende de: T008-21, T003 (monitor NetInfo), T002 (componente `AvisoSinConexion`)
  - Hecho cuando: `src/app/(equipo)/ciclos/nuevo.tsx` delega en `src/components/ciclos/formulario-apertura.tsx` y solo la ve administración. Pasan `RF-801: si hay un ciclo abierto la pantalla avisa y no deja continuar` y `RF-801: sin conexión la apertura muestra «Necesitas conexión para esta acción» y no encola nada`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 1 — Cierre (RF-802, RF-803)

- [ ] **T008-23** Registrar en la spec la excepción al principio 5 de las operaciones de 008 **[Bloqueada por aclaración: A-5]**
  - RF: RF-802, RF-804, RF-805, RF-807
  - Depende de: —
  - Hecho cuando: el equipo aprueba explícitamente D-810: cierre, sacramentos, constancia y reinscripción funcionan solo con conexión. La excepción queda anotada en `spec.md`, sin crear requisitos nuevos (principio 2). No hay cambios de código; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-24** Implementar `admiteEscritura`
  - RF: RF-802, RF-803
  - Depende de: T008-03
  - Hecho cuando: `src/lib/ciclos/cierre.ts` exporta `admiteEscritura` y pasa `RF-803: con el ciclo cerrado solo se admiten sacramento recibido, corrección de constancia, retención y retiro de consentimiento`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-25** Implementar `clasificarRegistroEntrante` y `debePurgarseLocalmente`
  - RF: RF-802
  - Depende de: T008-24
  - Hecho cuando: pasan `RF-802: un registro de ciclo cerrado se clasifica como descartado; un reintento ya aplicado no` y `RF-802: se purga localmente todo registro de un ciclo distinto del abierto o cuando no hay ciclo abierto`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-26** Implementar `efectosDelCierre` **[Bloqueada por aclaración: A-6]**
  - RF: RF-802
  - Depende de: T008-24
  - Hecho cuando: pasa `RF-802: el cierre termina delegaciones y suspende enlaces de familia sin desactivar cuentas`. Los catequistas no aparecen en los efectos (D-805) y se suspenden todos los enlaces de familia (supuesto A-6, D-806). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-27** Crear `0802_ciclos_cierre.sql` con `registro_descartado_cierre` e `indicador_ciclo`
  - RF: RF-802, RF-806
  - Depende de: T008-08
  - Hecho cuando: las tablas y el índice `(ciclo_id, cuenta_id)` del plan §3.2 existen, e `indicador_ciclo` queda vacía hasta la fase 3. Pasan `RF-802: registro_descartado_cierre guarda solo tabla, id, cuenta y hora, sin el contenido del registro` y `RF-806: indicador_ciclo admite una sola fila por ciclo`. El test de T008-08 sigue en verde. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-28** Añadir al repositorio las operaciones de cierre
  - RF: RF-802
  - Depende de: T008-10, T008-27
  - Hecho cuando: el repositorio expone `bloquearParaCierre` (`FOR UPDATE`), `marcarCerrado` y `registrarDescartados`. Pasan los tests de contrato `RF-802: cerrado_en toma la hora del servidor` y `RF-802: registrarDescartados anota cada registro descartado una sola vez`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-29** Declarar y conectar los puertos de seguridad que usa el cierre
  - RF: RF-802
  - Depende de: T008-01, T008-26, T001 (F2: `0103` delegación), T001 (F4: servicios de cierre)
  - Hecho cuando: `api/src/modulos/ciclos/aplicacion/puertos.ts` declara los puertos acordados en T008-01, con dobles de prueba y un adaptador real hacia `seguridad`. Pasa el test de contrato `RF-802: el adaptador de seguridad termina delegaciones y suspende enlaces dentro de la transacción del cierre`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-30** Implementar el caso de uso `cerrar-ciclo.ts`
  - RF: RF-802, RF-803, RNF-801
  - Depende de: T008-03, T008-28, T008-29
  - Hecho cuando: con puertos falsos pasan cinco tests: `RF-802: el cierre ejecuta en una transacción los pasos del plan §5.3 sin pedir confirmación por lo pendiente`, `RF-802: cerrar un ciclo ya cerrado devuelve el resultado anterior`, `RF-802: el cierre no toca las asignaciones de catequistas ni desactiva cuentas`, `RF-802: si un puerto falla, el cierre se deshace entero` y `RF-802: el cierre queda auditado`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-31** Exponer `POST /ciclos/{cicloId}/cierre`
  - RF: RF-802, RF-803, RNF-801
  - Depende de: T008-30, T008-12
  - Hecho cuando: existe la fila `ciclo:cerrar` (solo ADM) en la matriz de permisos y la Function `cerrarCiclo` está registrada, sin cuerpo y sin parámetro de «forzar». Pasan `RF-802: POST /ciclos/{id}/cierre no pide confirmación de pendientes y responde los efectos`, `RF-802: cerrar dos veces responde 200 sin cambios`, `RF-803: POST /ciclos/{id}/cierre con un parámetro forzar responde 422` y `RF-802: cerrar un ciclo inexistente responde 404`. Pasa la matriz de autorización (solo ADM recibe 2xx) y la respuesta lleva `Cache-Control: no-store`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-32** Comprobar que el cierre congela las justificaciones sin revisar
  - RF: RF-802, RF-803
  - Depende de: T008-31, T004 (migración de `justificaciones` con el trigger C-3)
  - Hecho cuando: pasa `RF-802: una justificación pendiente queda pendiente e inmodificable tras el cierre`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-33** Comprobar que el cierre congela las alertas abiertas y las aptitudes sin decidir
  - RF: RF-802, RF-803
  - Depende de: T008-32, T006 (migraciones de decisiones con el trigger C-3), T007 (migraciones de alertas y temporizadores con el filtro C-5)
  - Hecho cuando: pasan `RF-802: una alerta abierta queda abierta e inmodificable tras el cierre`, `RF-802: una aptitud sin decidir queda sin decidir e inmodificable tras el cierre` y `RF-802: un temporizador que intenta escribir en un ciclo cerrado es rechazado`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-34** Añadir `clasificarLoteEntrante` al puerto `guardia-ciclo`
  - RF: RF-802
  - Depende de: T008-11, T008-25, T008-28
  - Hecho cuando: dentro de la transacción del push, la función toma `SELECT estado FROM ciclo … FOR SHARE` (C-7), clasifica cada registro con `clasificarRegistroEntrante` y anota los descartados. Pasa el test de contrato `RF-802: los registros de un ciclo cerrado se descartan y se anotan sin su contenido`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-35** Integrar el descarte por cierre en el push de 003
  - RF: RF-802
  - Depende de: T008-34, T008-30, T003 (fase 1: push de `sincronizacion`)
  - Hecho cuando: el push responde 200 con `descartados: [{ tabla, id, motivo: 'ciclo_cerrado' }]` (D-804) y suma `descartados_cierre` en la bitácora. Pasan `RF-802: push concurrente con el cierre: lo confirmado antes queda, lo posterior se descarta` y `RF-802: un lote con registros de un ciclo cerrado no falla y lista los descartados`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-36** Comprobar que ningún endpoint HTTP fija el contexto de excepción
  - RF: RF-803, RF-808
  - Depende de: T008-06, T008-31
  - Hecho cuando: pasa `RF-808: el contexto de retención puede anonimizar en un ciclo cerrado y un endpoint HTTP no puede fijar ese contexto`. El test recorre `api/src/**` y solo admite el mecanismo acordado en T008-01 en el manejador de retención y en el retiro de consentimiento. Además invoca un handler real contra un ciclo cerrado y comprueba que recibe `SG801`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-37** Purgar en el celular los datos del ciclo cerrado tras el pull
  - RF: RF-802
  - Depende de: T008-18, T008-25, T003 (orquestador de sincronización y adaptador WatermelonDB en memoria)
  - Hecho cuando: el cliente de sincronización aplica `debePurgarseLocalmente` después de cada pull; los pendientes se envían antes, en el orden push → pull de 003. Pasa `RF-802: tras el cierre, el pull purga los datos locales del ciclo cerrado` (jest-expo). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-38** Avisar al catequista de los registros descartados por cierre **[Bloqueada por aclaración: A-3]**
  - RF: RF-802
  - Depende de: T008-35, T003 (`asistencia/pendientes.tsx` y `ResumenPush`)
  - Hecho cuando: pasa `RF-802: el celular avisa «N registros no se guardaron porque el ciclo ya estaba cerrado»`. Coordinación no recibe el aviso (supuesto A-3, alineado con 003 A-312). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-39** Recalcular la minoría de edad de los catequistas al abrir un ciclo
  - RF: RF-801
  - Depende de: T008-13, T001 (F4: `recalcularMinoria`)
  - Hecho cuando: `abrir-ciclo.ts` llama a `recalcularMinoria(fechaInicio)`, gancho que piden 001 S-05 y §5.4. Pasa `RF-801: abrir un ciclo recalcula la minoría de edad de los catequistas con su fecha de inicio`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-40** Crear la pantalla «Ciclos» y su acceso desde coordinación
  - RF: RF-801
  - Depende de: T008-21, T008-23
  - Hecho cuando: `src/app/(equipo)/ciclos/index.tsx` delega en `src/components/ciclos/lista-ciclos.tsx`, y `coordinacion.tsx` muestra el acceso «Ciclos». Pasan `RF-801: la lista de ciclos muestra estado, fechas y «depurado»` y `RF-801: sin conexión la lista de ciclos muestra «Necesitas conexión para esta acción»`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-41** Crear la pantalla «Cerrar ciclo»
  - RF: RF-802, RF-803
  - Depende de: T008-31, T008-40
  - Hecho cuando: `api-ciclos.ts` añade `cerrarCiclo`, y `src/app/(equipo)/ciclos/[cicloId]/cierre.tsx` (ruta dinámica con `useLocalSearchParams`, SDK 57) delega en `src/components/ciclos/confirmar-cierre.tsx`. Pasan `RF-802: la pantalla de cierre pide una sola confirmación y no lista ni pregunta por pendientes` y `RF-803: la confirmación avisa que el ciclo no se puede reabrir`. Solo administración ve la acción. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 2 — Sacramento recibido y constancia (RF-804, RF-805)

- [ ] **T008-42** Implementar `normalizarNombre` y `coincideBusqueda`
  - RF: RF-805
  - Depende de: T008-02
  - Hecho cuando: `src/lib/ciclos/constancia.ts` exporta las dos funciones y pasa `RF-805: la búsqueda ignora tildes, mayúsculas y orden de espacios y exige fecha exacta`, que incluye ñ → n y diéresis. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-43** Implementar `crearEntradaConstancia`
  - RF: RF-805
  - Depende de: T008-42
  - Hecho cuando: `constancia.ts` exporta `Sacramento`, `CAMPOS_CONSTANCIA` y `crearEntradaConstancia`. Pasan `RF-805: la entrada de constancia contiene exactamente 6 campos`, en el que `nombre_busqueda` cuenta como derivado y no como séptimo dato, y `RF-805: Bautismo y Primera Comunión en el mismo ciclo generan dos entradas`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-44** Implementar `validarSacramentoRecibido` **[Bloqueada por aclaración: A-13]**
  - RF: RF-804
  - Depende de: T008-43
  - Hecho cuando: pasan cuatro tests. `RF-804: se puede marcar el sacramento con el ciclo cerrado`. `RF-804: rechaza marcar a un niño que no está en la lista de aptos`, que cubre el caso límite «apto que no se presenta no entra». `RF-804: la fecha de ceremonia va entre el inicio del ciclo y hoy`. `RF-804: rechaza marcar dos veces el mismo sacramento`. Se usa una sola lista de aptos, en la que a un niño no bautizado se le pueden marcar los dos sacramentos (supuesto A-13). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-45** Implementar `aplicarCorreccion` **[Bloqueada por aclaración: A-11]**
  - RF: RF-805
  - Depende de: T008-43
  - Hecho cuando: pasan `RF-805: corregir sin motivo o sin cambios se rechaza; con motivo genera una corrección por campo con su valor anterior` y `RF-805: el ciclo de una entrada de constancia no es corregible ni la entrada se puede anular` (supuesto A-11). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-46** Crear `0803_ciclos_constancia.sql` con `sacramento_recibido` y `constancia_sacramental`
  - RF: RF-804, RF-805
  - Depende de: T008-07, T008-27
  - Hecho cuando: las dos tablas del plan §3.2 existen. Ninguna lleva trigger de congelamiento, la constancia no tiene FK al perfil (D-807) y su DELETE está prohibido por trigger. Pasan `RF-805: la constancia no se puede borrar ni siquiera en contexto de retención o de retiro de consentimiento`, `RF-804: sacramento_recibido admite inserciones en un ciclo cerrado` y `RF-804: un sacramento no se marca dos veces a la misma persona`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-47** Añadir `constancia_correccion` a `0803_ciclos_constancia.sql`
  - RF: RF-805
  - Depende de: T008-46
  - Hecho cuando: la tabla tiene el `CHECK` de motivo no vacío y un trigger de solo anexar. Pasan `RF-805: constancia_correccion es de solo anexar` y `RF-805: la BD rechaza una corrección sin motivo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-48** Implementar en `constancia-repositorio-pg.ts` el marcado de sacramento recibido
  - RF: RF-804, RF-805
  - Depende de: T008-47
  - Hecho cuando: el repositorio inserta `sacramento_recibido` y su `constancia_sacramental` en la misma transacción, de forma idempotente por `id`. Pasa el test de contrato `RF-804: marcar el sacramento guarda sacramento, fecha de ceremonia, quién y cuándo, y crea la entrada de constancia en la misma transacción`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-49** Implementar la búsqueda de constancia y el listado de sacramentos recibidos
  - RF: RF-804, RF-805
  - Depende de: T008-48
  - Hecho cuando: el repositorio expone `buscar(nombre, fechaNacimiento)`, que filtra la fecha exacta en SQL y el nombre con `coincideBusqueda` en TS (D-808), y `listarSacramentosRecibidos(cicloId)`. Pasan `RF-805: la búsqueda devuelve sacramento y ciclo de cada entrada que coincide` y `RF-804: el listado devuelve las marcas del ciclo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-50** Implementar la corrección de constancia y su historial en el repositorio
  - RF: RF-805
  - Depende de: T008-45, T008-49
  - Hecho cuando: el repositorio expone `corregir`, que actualiza, incrementa `version` e inserta una corrección por campo de forma idempotente por `correccionId`, y `listarCorrecciones`. Pasa `RF-805: corregir conserva el valor anterior, quién y cuándo, e incrementa la versión`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-51** Conectar los puertos de 006 (lista de aptos) y 002 (perfil) para el marcado
  - RF: RF-804, RF-805
  - Depende de: T008-29, T006 (`lista_sacramental` vigente, RF-606), T002 (perfil del catequizando)
  - Hecho cuando: `puertos.ts` declara `listaDeAptos(cicloId)` y `datosConstancia(catequizandoId)`, con dobles de prueba y adaptadores reales. Pasan `RF-804: el puerto de aptos lee la lista vigente de 006 del ciclo` y `RF-805: el puerto de perfil entrega solo nombres, apellidos y fecha de nacimiento`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-52** Implementar el caso de uso `marcar-sacramento-recibido.ts`
  - RF: RF-804, RF-805
  - Depende de: T008-44, T008-50, T008-51
  - Hecho cuando: con dobles de prueba pasan cuatro tests: `RF-804: marcar con el ciclo cerrado se admite`, `RF-804: repetir el mismo id no duplica`, `RF-804: otro id para el mismo niño y sacramento da ya_marcado` y `RF-805: la constancia se crea solo con los 6 campos`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-53** Añadir las acciones de sacramento y constancia a la matriz de permisos **[Bloqueada por aclaración: A-2]**
  - RF: RF-804, RF-805
  - Depende de: T008-12
  - Hecho cuando: la matriz tiene cuatro filas: `sacramento:marcar` (COORD y delegado vigente), `sacramento:leer` (COORD, delegado y SUP), `constancia:leer` (COORD, delegado y SUP) y `constancia:corregir` (COORD y delegado vigente). Secretaría no tiene rol propio (supuesto A-2). Pasa `RF-805: supervisión lee la constancia pero no la corrige ni marca sacramentos`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-54** Exponer `PUT` y `GET /ciclos/{cicloId}/sacramentos-recibidos`
  - RF: RF-804
  - Depende de: T008-52, T008-53
  - Hecho cuando: las Functions `marcarSacramentoRecibido` y `listarSacramentosRecibidos` están registradas. Pasan `RF-804: PUT sacramento repetido es idempotente; dos UUID para el mismo niño y sacramento dan 409`, `RF-804: PUT con el ciclo cerrado responde 201` y `RF-804: PUT de un niño fuera de la lista de aptos responde 422 no_esta_en_lista_de_aptos`. Pasa también la matriz de autorización: SUP recibe 403 al escribir. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-55** Exponer `GET /constancias`
  - RF: RF-805
  - Depende de: T008-49, T008-53
  - Hecho cuando: el caso de uso `buscar-constancia.ts` y la Function `buscarConstancia` están registrados. Pasan `RF-805: GET /constancias sin fecha de nacimiento da 400`, `RF-805: GET /constancias devuelve qué sacramentos recibió y en qué ciclo` y `RF-805: GET /constancias responde [] si no consta`, además de la matriz de autorización. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-56** Limitar las búsquedas por cuenta y desactivar la caché de las respuestas sensibles
  - RF: RF-805
  - Depende de: T008-01, T008-55
  - Hecho cuando: el límite de 30 peticiones por minuto y cuenta usa el mecanismo acordado en T008-01, reutilizable por T008-78. Pasan `RF-805: GET /constancias responde 429 al pasar de 30 peticiones por minuto y cuenta` y `RF-805: las respuestas de /constancias llevan Cache-Control: no-store`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-57** Exponer `PATCH /constancias/{id}`
  - RF: RF-805
  - Depende de: T008-50, T008-53
  - Hecho cuando: el caso de uso `corregir-constancia.ts` y su Function están registrados. Pasan `RF-805: PATCH /constancias/{id} sin motivo responde 422 motivo_requerido`, `RF-805: PATCH /constancias/{id} sin cambios responde 422 sin_cambios` y `RF-805: PATCH repetido con el mismo correccionId responde 200 sin duplicar`. Pasa la matriz de autorización (SUP recibe 403). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-58** Exponer `GET /constancias/{id}/correcciones`
  - RF: RF-805
  - Depende de: T008-57
  - Hecho cuando: la Function `listarCorrecciones` está registrada y pasa `RF-805: GET /constancias/{id}/correcciones devuelve valor anterior, valor nuevo, motivo, autor y fecha`, junto con la matriz de autorización. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-59** Crear la pantalla «Sacramentos recibidos»
  - RF: RF-804
  - Depende de: T008-54, T008-41
  - Hecho cuando: `src/app/(equipo)/ciclos/[cicloId]/sacramentos.tsx` delega en `src/components/ciclos/marcar-sacramentos.tsx`, que muestra la lista de aptos de 006 con la marca «recibió» por sacramento y la fecha de ceremonia. Pasan `RF-804: la pantalla de sacramentos funciona con el ciclo cerrado` y `RF-804: reintentar una marca reutiliza el mismo UUID`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-60** Crear la pantalla de búsqueda de constancia
  - RF: RF-805
  - Depende de: T008-55, T008-40
  - Hecho cuando: `src/app/(equipo)/constancia/index.tsx` delega en `src/components/ciclos/buscar-constancia.tsx`, y `coordinacion.tsx` muestra el acceso «Constancia». Pasan `RF-805: la búsqueda exige nombre y fecha de nacimiento` y `RF-805: sin resultados la pantalla muestra «No consta»`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-61** Crear la pantalla de detalle y corrección de constancia
  - RF: RF-805
  - Depende de: T008-58, T008-60
  - Hecho cuando: `src/app/(equipo)/constancia/[constanciaId].tsx` delega en `src/components/ciclos/detalle-constancia.tsx`. Pasan `RF-805: la corrección no se envía sin motivo`, `RF-805: el detalle muestra el historial de correcciones` y `RF-805: supervisión ve el detalle sin el botón de corregir`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-62** Exigir la cláusula de constancia permanente en el texto de consentimiento **[Bloqueada por aclaración: A-4]**
  - RF: RF-805
  - Depende de: T008-43, T001 (F1b: texto de consentimiento versionado, RF-106)
  - Hecho cuando: el texto redactado por quien designe el equipo (supuesto A-4: la coordinación) está cargado como versión vigente. Pasa `RF-805: el texto de consentimiento vigente informa que los 6 campos de la constancia se conservan sin vencimiento`, que usa `CAMPOS_CONSTANCIA`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 3 — Indicadores de ciclo (RF-806)

- [ ] **T008-63** Implementar `estaActivoEn`
  - RF: RF-806
  - Depende de: T008-02
  - Hecho cuando: `src/lib/ciclos/indicadores.ts` exporta `estaActivoEn` y pasan `RF-806: un niño inscrito a mitad de ciclo no cuenta como activo antes de su inscripción`, `RF-806: un niño dado de baja por retiro o consentimiento retirado deja de contar desde su baja` y `RF-806: un niño anulado nunca cuenta como activo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-64** Implementar `porcentajeAsistencia` **[Bloqueada por aclaración: A-7]**
  - RF: RF-806
  - Depende de: T008-63
  - Hecho cuando: pasan `RF-806: el porcentaje usa presencias sobre activos solo en domingos con esa sesión` (agregado Σ presentes / Σ activos, supuesto A-7) y `RF-806: sin domingos con esa sesión el porcentaje es null`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-65** Implementar `calcularIndicadoresCiclo` **[Bloqueada por aclaración: A-8, A-9]**
  - RF: RF-806
  - Depende de: T008-64
  - Hecho cuando: pasan cuatro tests. `RF-806: los anulados no cuentan como inscritos ni como retirados`. `RF-806: los indicadores marcan saldos cargados desde papel`. `RF-806: aptos cuenta la lista RF-606 si se generó y, si no, las decisiones finales apto` (supuesto A-8). `RF-806: retirados suma los retiros confirmados y los consentimientos retirados` (supuesto A-9). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-66** Declarar los puertos de lectura para indicadores
  - RF: RF-806
  - Depende de: T008-65, T008-29
  - Hecho cuando: `puertos.ts` declara las lecturas de 002 (`ninosActivos`, inscripciones con fechas de alta y baja), 003 (domingos con sesión y presencias), 006 (lista o decisiones y saldos) y 007 (`contarRetirados`, `cicloTieneSaldosDePapel`), con dobles de prueba. Pasa `RF-806: calcularIndicadoresCiclo se alimenta de los puertos sin consultar tablas ajenas`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-67** Implementar `indicadores-consulta-pg.ts`
  - RF: RF-806
  - Depende de: T008-66, T002 (inscripción y `ninosActivos`), T003 (sesiones y asistencia), T006 (lista de aptos y saldos), T007 (`contarRetirados`, `cicloTieneSaldosDePapel`)
  - Hecho cuando: pasa el test de integración `RF-806: la consulta en vivo reproduce los indicadores de un ciclo sembrado`, cuyos valores esperados se calculan a mano. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-68** Guardar la instantánea de indicadores al cerrar
  - RF: RF-806, RF-802
  - Depende de: T008-30, T008-67
  - Hecho cuando: `cerrar-ciclo.ts` ejecuta el paso 2 del plan §5.3 dentro de la transacción. Pasa `RF-806: al cerrar se guarda en indicador_ciclo la instantánea de los datos del servidor en ese instante`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-69** Exponer `GET /ciclos/{cicloId}/indicadores`
  - RF: RF-806
  - Depende de: T008-68, T008-49
  - Hecho cuando: existe la fila `ciclo:indicadores` (COORD, delegado y SUP) en la matriz de permisos, y el caso de uso `obtener-indicadores.ts` y su Function están registrados. Pasan `RF-806: un ciclo cerrado devuelve la instantánea y los sacramentos recibidos contados en vivo desde la constancia`, `RF-806: un ciclo abierto se calcula en vivo` y `RF-806: la respuesta incluye saldosPapel y calculadoEn`. Pasa la matriz de autorización: ADM, CAT y FAM reciben 403. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-70** Crear la pantalla de detalle e indicadores del ciclo
  - RF: RF-806
  - Depende de: T008-69, T008-40
  - Hecho cuando: `src/app/(equipo)/ciclos/[cicloId]/index.tsx` delega en `src/components/ciclos/detalle-ciclo.tsx`. Pasan `RF-806: el detalle muestra inscritos, retirados, porcentajes, aptos y sacramentos recibidos`, `RF-806: el detalle avisa «incluye saldos cargados desde papel» cuando aplica` y `RF-806: administración ve el detalle sin indicadores`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 4 — Reinscripción (RF-807)

- [ ] **T008-71** Implementar `resolverReinscripcion` y `ordenarHistorialPrevio`
  - RF: RF-807
  - Depende de: T008-02
  - Hecho cuando: `src/lib/ciclos/reinscripcion.ts` exporta las dos funciones y pasan `RF-807: un perfil no anonimizado se reutiliza; uno anonimizado da perfil nuevo` y `RF-807: el historial previo se ordena del ciclo más reciente al más antiguo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-72** Declarar y conectar los puertos de 002 y 001 para la reinscripción
  - RF: RF-807
  - Depende de: T008-29, T002 (fase 4: `crearInscripcion(tx, …)` y estado `anonimizado`), T001 (F1b: `registrarConsentimiento`)
  - Hecho cuando: `puertos.ts` declara `crearInscripcion`, `estadoPerfil`, `registrarConsentimiento` y `reactivarEnlacesFamilia` (firma acordada en T008-01), con dobles de prueba y adaptadores reales. Pasa `RF-807: crearInscripcion del puerto crea una fila nueva sobre el perfil existente` (D-813). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-73** Implementar la consulta de candidatos a reinscripción
  - RF: RF-807
  - Depende de: T008-72, T008-10
  - Hecho cuando: pasa el test de contrato `RF-807: los candidatos son perfiles no anonimizados con inscripción en un ciclo cerrado y ninguna en el abierto`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-74** Implementar la consulta del historial previo
  - RF: RF-807
  - Depende de: T008-71, T008-73, T008-49
  - Hecho cuando: `historial-previo.ts` y su consulta devuelven un `ResumenCiclo` por ciclo anterior (ciclo, grupo, asistencia y sacramentos recibidos), ordenado con `ordenarHistorialPrevio`. Pasa `RF-807: el historial previo resume cada ciclo anterior del niño`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-75** Implementar el caso de uso `reinscribir.ts`
  - RF: RF-807
  - Depende de: T008-71, T008-72, T008-11
  - Hecho cuando: con dobles de prueba pasan cinco tests. `RF-807: reinscribir reutiliza el perfil y crea una inscripción en el ciclo abierto`. `RF-807: repetir el mismo inscripcionId no duplica`. `RF-807: reinscribir con el ciclo cerrado da ciclo_no_abierto`. `RF-807: un niño ya inscrito en el ciclo abierto da ya_inscrito`. `RF-807: un perfil anonimizado da perfil_anonimizado`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-76** Pedir la confirmación de consentimiento en la reinscripción **[Bloqueada por aclaración: A-10]**
  - RF: RF-807
  - Depende de: T008-75, T008-62
  - Hecho cuando: pasa `RF-807: la reinscripción registra la confirmación del apoderado con el texto vigente sin volver a digitar datos` (supuesto A-10). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-77** Reactivar los enlaces de familia al reinscribir **[Bloqueada por aclaración: A-6]**
  - RF: RF-807, RF-802
  - Depende de: T008-75, T008-26
  - Hecho cuando: pasan `RF-807: reinscribir a un niño reactiva el enlace suspendido de sus apoderados` y `RF-802: el enlace de una familia que no se reinscribe sigue rechazado como revocado` (supuesto A-6, D-806). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-78** Exponer `GET /reinscripciones/candidatos`
  - RF: RF-807
  - Depende de: T008-73, T008-56
  - Hecho cuando: existe la fila `reinscripcion:gestionar` (COORD y delegado vigente) en la matriz de permisos y la Function está registrada. Pasan `RF-807: GET /reinscripciones/candidatos excluye perfiles anonimizados`, `RF-807: GET /reinscripciones/candidatos responde 429 al pasar de 30 peticiones por minuto y cuenta` y `RF-807: la respuesta lleva Cache-Control: no-store`, además de la matriz de autorización. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-79** Exponer `GET /catequizandos/{id}/historial-ciclos` **[Bloqueada por aclaración: A-12]**
  - RF: RF-807
  - Depende de: T008-74, T008-78
  - Hecho cuando: existe la fila `historial-ciclos:leer` (COORD, delegado y CAT del grupo actual del niño) en la matriz de permisos y la Function está registrada. Pasan `RF-807: el catequista del grupo actual ve el historial previo; otro catequista recibe 404` y `RF-807: supervisión y familia no ven el historial previo` (supuesto A-12). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-80** Exponer `POST /ciclos/{cicloId}/reinscripciones`
  - RF: RF-807
  - Depende de: T008-75, T008-78
  - Hecho cuando: la Function `reinscribir` está registrada. Pasan `RF-807: reinscribir en un ciclo cerrado da 409; un perfil anonimizado da 410`, `RF-807: POST repetido con el mismo inscripcionId responde 200` y `RF-807: un niño ya inscrito responde 409 ya_inscrito`, además de la matriz de autorización. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-81** Crear la pantalla de búsqueda de candidatos a reinscripción
  - RF: RF-807
  - Depende de: T008-78, T008-40
  - Hecho cuando: `src/app/(equipo)/reinscripcion/index.tsx` delega en `src/components/ciclos/candidatos-reinscripcion.tsx`, y `coordinacion.tsx` muestra el acceso «Reinscribir». Pasa `RF-807: si el perfil está anonimizado la pantalla deriva a la inscripción nueva de 002`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-82** Crear la pantalla de historial previo y confirmación de reinscripción
  - RF: RF-807
  - Depende de: T008-79, T008-80, T008-81
  - Hecho cuando: `src/app/(equipo)/reinscripcion/[catequizandoId].tsx` delega en `src/components/ciclos/confirmar-reinscripcion.tsx`. Pasan `RF-807: la confirmación muestra el historial previo y solo pide grupo y consentimiento` y `RF-807: una respuesta 410 lleva a la inscripción nueva de 002`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 5 — Retención y extremo a extremo (RF-808, RNF-801, RNF-802)

- [ ] **T008-83** Implementar `fechaVencimientoRetencion` y `cicloVencido`
  - RF: RF-808
  - Depende de: T008-02, T001 (F3: `src/lib/seguridad/retencion.ts`)
  - Hecho cuando: `src/lib/ciclos/retencion.ts` reutiliza el cálculo de 001 sin duplicarlo y añade `cicloVencido`. Pasan `RF-808: un ciclo vence a los 2 años de su cierre (incluido el 29 de febrero)` y `RF-808: la fecha de cierre se toma en America/Lima`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-84** Declarar `POLITICA_RETENCION_CICLO`
  - RF: RF-808, RNF-802
  - Depende de: T008-83
  - Hecho cuando: pasan `RF-808: la política conserva indicadores y constancia` y `RF-808: la política elimina evidencias y descartados y anonimiza sacramento_recibido y los datos operativos`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-85** Implementar `perfilesAAnonimizar`
  - RF: RF-808
  - Depende de: T008-83
  - Hecho cuando: pasan `RF-808: no se anonimiza un perfil inscrito en un ciclo no vencido` y `RF-808: no se anonimiza un perfil inscrito en el ciclo abierto`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-86** Crear `0804_ciclos_retencion.sql` con `retencion_ciclo_paso`
  - RF: RF-808
  - Depende de: T008-46
  - Hecho cuando: pasa `RF-808: retencion_ciclo_paso no admite dos veces el mismo paso de un ciclo` y el test de T008-08 sigue en verde. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-87** Implementar en `retencion-ciclo-pg.ts` los pasos propios de 008
  - RF: RF-808, RF-805
  - Depende de: T008-86, T008-36
  - Hecho cuando: los pasos corren con el contexto de retención acordado en T008-01 y pasan cuatro tests: `RF-808: el paso sacramento_recibido deja catequizando_id en NULL y la constancia intacta`, `RF-808: el paso descartados borra registro_descartado_cierre del ciclo`, `RF-808: cierre_retencion fija depurado_en en un ciclo cerrado` y `RF-808: un paso ya completado no se repite`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-88** Declarar y conectar los puertos de retención de otros módulos
  - RF: RF-808, RNF-802
  - Depende de: T008-01, T008-29, T004 (borrado de evidencias de un ciclo), T002 (fase 4: `anonimizarCatequizando`), T001 (F3: participantes de retención)
  - Hecho cuando: `puertos.ts` declara el borrado de evidencias, los manejadores operativos de cada módulo y la anonimización de perfiles y apoderados, con dobles de prueba y adaptadores reales según T008-01. Pasa `RF-808: el puerto de evidencias recibe el cicloId y devuelve las referencias borradas`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-89** Implementar el manejador `retencion-ciclo.ts`
  - RF: RF-808, RNF-801, RNF-802
  - Depende de: T008-84, T008-85, T008-87, T008-88
  - Hecho cuando: con dobles de prueba pasan `RF-808: la retención ejecuta en orden los 6 pasos del plan §5.4 y se reanuda tras un fallo sin repetir pasos`, `RF-808: los perfiles se anonimizan en lotes y solo si perfilesAAnonimizar los incluye` y `RNF-802: la retención elimina las evidencias del ciclo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-90** Registrar el manejador en el motor de retención de 001
  - RF: RF-808, RNF-801
  - Depende de: T008-89, T001 (F3: motor de retención y temporizador `retencionDiaria`)
  - Hecho cuando: pasan `RF-808: retencionDiaria procesa un ciclo cerrado hace 2 años con depurado_en nulo`, `RF-808: un ciclo cerrado hace 2 años menos 1 día no se toca` y `RNF-801: la retención corre desde el temporizador sin intervención técnica`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-91** Preparar el arnés extremo a extremo de 008
  - RF: RF-801
  - Depende de: T008-90, T008-82, T008-70
  - Hecho cuando: `api/test/e2e/ciclos/` tiene BD desde cero con todas las migraciones, reloj inyectable, fábricas de cuentas por rol y Azurite o un doble del puerto de 004. Pasa `RF-801: el arnés E2E abre un ciclo contra la API real`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-92** Escribir el extremo a extremo «ciclo completo», parte 1: de la apertura al cierre
  - RF: RF-801, RF-802, RF-803, RF-804
  - Depende de: T008-91, T008-35
  - Hecho cuando: pasa `RF-801..RF-808: ciclo completo` hasta este punto. Abre el ciclo A, inscribe, registra asistencia, marca aptos y cierra A. Un push tardío se descarta (caso límite «catequista que no envió»). La Primera Comunión se marca con fecha posterior al cierre (caso límite «ceremonia posterior»). Un intento de modificar un registro de A se rechaza. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-93** Ampliar el extremo a extremo «ciclo completo», parte 2: constancia y reinscripción
  - RF: RF-805, RF-806, RF-807
  - Depende de: T008-92
  - Hecho cuando: el mismo test sigue en verde con más pasos. La búsqueda por nombre y fecha devuelve el sacramento y el ciclo A. El nombre se corrige con motivo y traza (caso límite «nombre mal escrito»). Los indicadores de A muestran la instantánea. Se abre el ciclo B y se reinscribe un niño de A, que ve su historial. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-94** Completar el extremo a extremo «ciclo completo», parte 3: retención
  - RF: RF-808, RNF-801, RNF-802
  - Depende de: T008-93
  - Hecho cuando: el test avanza el reloj 2 años desde el cierre de A y comprueba que los datos personales de A quedan anonimizados, sus evidencias se borran, los indicadores y la constancia quedan intactos y el perfil reinscrito en B no se anonimiza. Pasan también `RNF-801: el ciclo se cierra y se depura sin pasos fuera de la app` y `RNF-802: tras la retención no quedan evidencias del ciclo en Blob`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-95** Escribir el extremo a extremo de retiro de consentimiento después del sacramento
  - RF: RF-805, RF-808
  - Depende de: T008-91, T008-52, T001 (F3: retiro de consentimiento con el motor)
  - Hecho cuando: pasa `RF-805: retiro de consentimiento después del sacramento conserva solo la constancia`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-96** Escribir el extremo a extremo de búsqueda de una persona anonimizada
  - RF: RF-805, RF-808
  - Depende de: T008-94
  - Hecho cuando: pasa `RF-805: una persona anonimizada solo aparece en la constancia`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-97** Escribir el extremo a extremo del niño que vuelve 3 años después
  - RF: RF-807, RF-808
  - Depende de: T008-94
  - Hecho cuando: pasa `RF-807: un niño que vuelve 3 años después se inscribe como perfil nuevo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T008-98** Verificar la cobertura de requisitos y el costo cero
  - RF: RNF-801, RNF-802
  - Depende de: T008-94, T008-95, T008-96, T008-97, T001 (F0-7: `scripts/verificar-cobertura-rf.mjs`)
  - Hecho cuando: `node scripts/verificar-cobertura-rf.mjs` encuentra al menos un test por cada RF-801 a RF-808, RNF-801 y RNF-802. `git diff` de `infra/` desde el inicio de 008 no añade recursos de Azure (RNF-802, plan §11). `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Cobertura

| Requisito | Tareas |
| --- | --- |
| RF-801 Ciclos | T008-02, T008-03, T008-04, T008-05, T008-07, T008-08, T008-09, T008-10, T008-11, T008-12, T008-13, T008-14, T008-15, T008-16, T008-17, T008-18, T008-19, T008-20, T008-21, T008-22, T008-39, T008-40, T008-91, T008-92 |
| RF-802 Cierre de ciclo | T008-01, T008-03, T008-06, T008-08, T008-09, T008-11, T008-18, T008-20, T008-23, T008-24, T008-25, T008-26, T008-27, T008-28, T008-29, T008-30, T008-31, T008-32, T008-33, T008-34, T008-35, T008-37, T008-38, T008-41, T008-68, T008-77, T008-92 |
| RF-803 Excepciones al cierre | T008-01, T008-03, T008-05, T008-06, T008-08, T008-24, T008-30, T008-31, T008-32, T008-33, T008-36, T008-41, T008-92 |
| RF-804 Sacramento recibido | T008-23, T008-44, T008-46, T008-48, T008-49, T008-51, T008-52, T008-53, T008-54, T008-59, T008-92 |
| RF-805 Constancia sacramental | T008-01, T008-23, T008-42, T008-43, T008-45, T008-46, T008-47, T008-48, T008-49, T008-50, T008-51, T008-52, T008-53, T008-55, T008-56, T008-57, T008-58, T008-60, T008-61, T008-62, T008-87, T008-93, T008-95, T008-96 |
| RF-806 Indicadores de ciclo | T008-16, T008-27, T008-63, T008-64, T008-65, T008-66, T008-67, T008-68, T008-69, T008-70, T008-93 |
| RF-807 Reinscripción | T008-01, T008-23, T008-71, T008-72, T008-73, T008-74, T008-75, T008-76, T008-77, T008-78, T008-79, T008-80, T008-81, T008-82, T008-93, T008-97 |
| RF-808 Retención | T008-01, T008-06, T008-36, T008-83, T008-84, T008-85, T008-86, T008-87, T008-88, T008-89, T008-90, T008-94, T008-95, T008-96, T008-97 |
| RNF-801 Sin mantenimiento | T008-30, T008-31, T008-89, T008-90, T008-94, T008-98 |
| RNF-802 Costo cero | T008-84, T008-88, T008-89, T008-94, T008-98 |

Casos límite de la spec → tareas: modificar un registro de un ciclo cerrado (T008-06, T008-92); ceremonia posterior al cierre (T008-44, T008-92); apto que no se presenta (T008-44); Bautismo y Primera Comunión en el mismo ciclo (T008-43); cierre con justificaciones sin revisar (T008-32); catequista que no envió (T008-35, T008-92); consentimiento retirado tras el sacramento (T008-95); persona anonimizada (T008-96); niño que vuelve 3 años después (T008-97); nombre mal escrito (T008-45, T008-93).

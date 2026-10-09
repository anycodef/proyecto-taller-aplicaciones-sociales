# 003 — Asistencia dominical: tareas

> Tareas para implementar [spec.md](spec.md) según [plan.md](plan.md). Las rige la [constitución](../../docs/constitution.md) y [AGENTS.md](../../AGENTS.md). Si una tarea contradice la spec o el plan, prevalecen ellos y se corrige primero la tarea.

**Total: 113 tareas.** Todas son de primer corte (113). Bloqueadas por aclaración: 6 (T003-102, T003-103, T003-104, T003-105, T003-106 y T003-112). Condicionales de plan B: 2 (T003-06 y T003-07).

## Leyenda y reglas comunes

| Etiqueta | Significado |
| --- | --- |
| **[Primer corte]** | Forma parte del primer corte del proyecto. Por indicación del equipo, toda la spec 003 es primer corte, incluidas las tareas de la sección «Fase 2», que se ejecutan en cuanto las specs 004 y 005 entreguen las piezas de las que dependen. |
| **[Bloqueada por aclaración]** | Depende de una duda `[NECESITA ACLARACIÓN]` de la spec (supuestos A-301, A-303, A-304 o A-305 del plan, §11). La tarea indica cuál. Las demás tareas avanzan con el supuesto provisional del plan. |
| **[Plan B]** | Solo se ejecuta si la prueba técnica de la fase 0 (T003-05) descarta WatermelonDB. En ese caso, las tareas T003-67 a T003-73 se rehacen sobre `expo-sqlite` con el mismo protocolo de `src/lib/sincronizacion/protocolo.ts`. |

- Cada tarea dura como máximo 20–30 minutos de trabajo y se cierra en un commit (Conventional Commits) con su registro Agent Trace (principio 9).
- Test primero: el test que verifica la lógica va en la misma tarea o en la inmediatamente anterior. Cada nombre de test empieza por su identificador (`RF-3xx: ...`, `RNF-3xx: ...`).
- Identificadores, tablas y archivos en español, sin tildes ni `ñ`; textos visibles con tildes (principio 8, AGENTS.md).
- Las reglas de negocio viven en `src/lib/` como TS puro (principio 3). WatermelonDB, NetInfo y la cámara solo en `src/datos/` y `src/app/`.
- Ninguna dependencia se instala antes de la tarea que la justifica en `spec.md` (principio 1).
- Las dependencias de otras specs se citan como «TNNN (pieza)», porque esas specs todavía no tienen `tasks.md`; la pieza indicada sale de su `plan.md` (001: fase F0/F1; 002: fase 1; 004, 005 y 008: fases indicadas).

---

## Fase 0 — Prueba técnica y acuerdos (bloquea el resto)

- [ ] **T003-01** Justificar en la spec las dependencias de la prueba técnica **[Primer corte]**
  - RF: RF-302, RF-307, RNF-302, RNF-305
  - Depende de: T001 (F0-2: Jest en la raíz y en `api/`, scripts `test` y `typecheck`)
  - Hecho cuando: `spec.md` tiene una sección «Dependencias» que justifica, con motivo, alternativa descartada y versión compatible con Expo SDK 57: `@nozbe/watermelondb` (almacén local fijado en el C4), su plugin de configuración de Expo y el plugin de decoradores de Babel si los requiere, `expo-camera` (lectura QR, D-308), `expo-dev-client` (build de desarrollo de la prueba) y `expo-sqlite` (plan B, R-301); el equipo la aprueba; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-02** Generar un build de desarrollo con WatermelonDB (JSI) sobre React Native 0.86 **[Primer corte]**
  - RF: RF-307, RNF-302, RNF-305
  - Depende de: T003-01
  - Hecho cuando: en la rama `prueba/watermelondb`, `eas build --profile development --platform android` termina sin errores; la app arranca con la nueva arquitectura en el Android de referencia (Android 10, 2 GB de RAM) y una pantalla de prueba escribe y lee 1 000 filas con el adaptador SQLite JSI en menos de 1 s; el resultado y las versiones exactas quedan en `specs/003-asistencia-dominical/prueba-tecnica.md`; `npm test`, `npm run typecheck` y `npm run lint` pasan en la rama.

- [ ] **T003-03** Probar `synchronize()` de WatermelonDB contra un servidor simulado **[Primer corte]**
  - RF: RF-307, RNF-302
  - Depende de: T003-02
  - Hecho cuando: en el build de desarrollo, un ciclo pull → escritura sin red → push contra un stub local deja las filas con `_status = 'synced'`; un pull con `experimentalStrategy: 'replacement'` elimina las filas fuera de alcance; un pull con `migration` (de `migrationsEnabledAtVersion`) entrega una tabla nueva completa; los tres resultados quedan en `prueba-tecnica.md`; `npm test`, `npm run typecheck` y `npm run lint` pasan en la rama.

- [ ] **T003-04** Medir la lectura QR de `CameraView` con poca luz en gama baja **[Primer corte]**
  - RF: RF-302, RNF-305
  - Depende de: T003-02
  - Hecho cuando: con `CameraView` en modo continuo, `barcodeTypes: ['qr']` y linterna, en el Android de referencia, 20 carnés de prueba con formato `SGC1:<uuid>:<emision>` (corrección de error Q, QR ≥ 3 cm) leídos con < 50 lux dan ≥ 95 % de lecturas y confirmación visible en < 1 s; la medición queda en `prueba-tecnica.md`; `npm test`, `npm run typecheck` y `npm run lint` pasan en la rama.

- [ ] **T003-05** Registrar el veredicto de la prueba técnica (WatermelonDB o plan B) **[Primer corte]**
  - RF: RF-307, RNF-302, RNF-305
  - Depende de: T003-03, T003-04
  - Hecho cuando: `prueba-tecnica.md` tiene un veredicto explícito (sigue WatermelonDB / pasa a plan B) contra tres criterios: build con JSI correcto, ciclo de sincronización correcto y lectura QR ≥ 95 %; si el veredicto es plan B, se activan T003-06 y T003-07; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-06** Prototipar el almacén local con `expo-sqlite` y control de cambios propio **[Primer corte]** **[Plan B]**
  - RF: RF-307, RNF-302
  - Depende de: T003-05 (veredicto «plan B»)
  - Hecho cuando: en el build de desarrollo, una tabla `expo-sqlite` con columnas `_status` y `_changed` registra creaciones sin red y una consulta devuelve las filas pendientes; 1 000 filas se escriben y leen en < 1 s; `prueba-tecnica.md` lista qué tareas de la fase 1.5 cambian; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-07** Prototipar el motor pull/push del plan B con el mismo protocolo **[Primer corte]** **[Plan B]**
  - RF: RF-307, RNF-302
  - Depende de: T003-06
  - Hecho cuando: el prototipo envía y recibe `CambiosPorTabla` con el formato de `protocolo.ts` contra el stub de T003-03, un reenvío del mismo lote no duplica filas y un pull de reemplazo borra lo que salió de alcance; resultado en `prueba-tecnica.md`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-08** Acordar con los planes 001, 002 y 008 las convenciones compartidas **[Primer corte]**
  - RF: RF-307, RNF-303
  - Depende de: T001 (F0-3: esqueleto de `api/`, Docker y runner de migraciones), T003-01
  - Hecho cuando: queda escrito y aceptado por los responsables de cada spec (en `prueba-tecnica.md` y, si cambia el plan, en `plan.md`): numeración `03NN` según la convención `SSNN` del plan 001; configuración de Jest en la raíz y en `api/`; valores únicos de pool `pg` y escalado (D-314 del plan 003 frente a D-111 del plan 001); nombre real de las tablas de nómina del plan 002 (`catequizando`, `grupo`, `inscripcion`, `carne_emision`); si `listas_asistencia`, `marcas_asistencia`, `correcciones_asistencia` y `asistencias` llevan `ciclo_id` y el trigger de congelamiento (convenciones C-1 y C-3 del plan 008); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-09** Escribir el ADR «Protocolo de sincronización por marcas inmutables» **[Primer corte]**
  - RF: RF-303, RF-307, RF-308
  - Depende de: T003-05, T003-08
  - Hecho cuando: `npm run adr:new` crea en `docs/adr/` el ADR que recoge D-301, D-304 y D-307 y refina el ADR 002 (incluido el riesgo R-302 de cifrado), y `npm run adr:build` termina sin errores; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 1.1 — Dominio puro (`src/lib/asistencia/` y `src/lib/sincronizacion/`)

- [ ] **T003-10** Extender la regla ESLint de `src/lib/**` a las librerías de esta spec **[Primer corte]**
  - RF: RF-307 (principio 3)
  - Depende de: T001 (F0-2: regla `no-restricted-imports` de `src/lib`)
  - Hecho cuando: la regla bloquea también `@nozbe/*` y `@react-native-community/*`; un archivo temporal en `src/lib/` que importa `@nozbe/watermelondb` hace fallar `npm run lint` (verificado y revertido); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-11** Justificar en la spec `uuid`, `expo-crypto` y `@react-native-community/netinfo` **[Primer corte]**
  - RF: RF-301, RF-307, RNF-302
  - Depende de: T003-01
  - Hecho cuando: la sección «Dependencias» de `spec.md` justifica `uuid` (solo v5, JS puro, ids deterministas de sesión, asistencia y aviso, D-302), `expo-crypto` (`randomUUID` como generador de ids en el dispositivo, principio 6) y `@react-native-community/netinfo` (detección de reconexión, D-316), con alternativa descartada; el equipo la aprueba; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-12** Definir los tipos del dominio en `asistencia/tipos.ts` **[Primer corte]**
  - RF: RF-301, RF-302, RF-306, RF-309, RF-311
  - Depende de: T003-10
  - Hecho cuando: existen `Sesion`, `MarcaAsistencia`, `ListaAsistencia`, `Correccion`, `AsistenciaConsolidada`, `ParametrosAsistencia`, `Falta` y `EstadoEnSesion = 'presente' | 'ausente' | 'sin_registro' | 'pendiente' | 'no_aplica'` con los campos de la §3 del plan; `npm run typecheck` los compila; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-13** Mover `esperaReintento` al orquestador y retirar el código heredado **[Primer corte]**
  - RF: RF-307
  - Depende de: T003-12
  - Hecho cuando: `esperaReintento` vive en `src/lib/sincronizacion/orquestador.ts` con el test `RF-307: esperaReintento crece exponencialmente con tope de 5 minutos`; se eliminan `src/lib/offline/cola-sincronizacion.ts` y los tipos `SesionCatequesis`, `EstadoAsistencia` y `RegistroAsistencia` de `src/lib/domain/modelo.ts`; `rg "cola-sincronizacion|RegistroAsistencia|EstadoAsistencia" src` no devuelve nada; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-14** Implementar `domingosDelCiclo` e `idSesion` (UUID v5) **[Primer corte]**
  - RF: RF-301, RF-313
  - Depende de: T003-11, T003-12
  - Hecho cuando: se instala `uuid` y pasan `RF-301: domingosDelCiclo genera misa y catequesis por domingo`, `RF-301: idSesion es determinista para el mismo ciclo, fecha y tipo` y `RF-313: idSesion distingue dos actividades de la misma fecha por actividadId`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-15** Implementar `ventanaDe`, `sesionEnCurso` y `finDelDomingo` **[Primer corte]**
  - RF: RF-302, RF-305, RF-309, RF-313
  - Depende de: T003-14
  - Hecho cuando: pasan `RF-302: ventanaDe usa la ventana propia de la sesión o, si es nula, 07:30–09:30 de Lima`, `RF-309: finDelDomingo es las 23:59:59 del domingo en America/Lima`, `RF-313: la ventana de una actividad es todo el día salvo que la sesión fije otra` (A-309) y `RF-305: sesionEnCurso devuelve nada fuera de toda ventana`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-16** Implementar `estimarDesfase`, `horaEfectiva` y `dentroDeVentana` **[Primer corte]**
  - RF: RF-302, RF-309
  - Depende de: T003-12
  - Hecho cuando: pasan `RF-302: con desfase estimado, la ventana se evalúa con la hora efectiva` (celular adelantado y atrasado) y `RF-302: dentroDeVentana acepta hasta 10 minutos de tolerancia de reloj`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-17** Implementar `interpretarCodigoQr` y `resolverCarne` **[Primer corte]**
  - RF: RF-302, RF-303
  - Depende de: T003-12, T002 (`src/lib/catequizandos/carne.ts`: `interpretarCodigoCarne`, D-202)
  - Hecho cuando: pasan `RF-302: interpretarCodigoQr solo acepta SGC1:<uuid>:<emision> y no extrae otros datos`, `RF-303: resolverCarne devuelve valido, inactivo o desconocido contra la nómina` y `RF-303: un código de carné reemplazado se resuelve como desconocido`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-18** Implementar las reglas de `asistencia/autorizacion.ts` **[Primer corte]**
  - RF: RF-301, RF-302, RF-304, RF-306, RNF-307
  - Depende de: T003-12, T001 (roles efectivos y `matriz-permisos.ts`)
  - Hecho cuando: pasan `RF-302: solo una cuenta con rol catequista y sesión iniciada puede escanear` (A-311), `RNF-307: puedeVerNombreAlEscanear es falso para un niño de otro grupo`, `RF-304: el registro manual solo se permite con niños de los grupos propios`, `RF-306: cualquier catequista puede pasar la lista de cualquier grupo` y `RF-301: solo la coordinación configura sesiones`; ningún archivo de la spec 003 usa `puedeRegistrarAsistencia` de `roles.ts` y se deja constancia al plan 001 para retirarla; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-19** Implementar `procesarEscaneo`: ventana, doble escaneo y escaneo discreto **[Primer corte]**
  - RF: RF-302, RNF-307
  - Depende de: T003-15, T003-16, T003-17, T003-18
  - Hecho cuando: pasan `RF-302: escaneo dentro de la ventana registra presente con su hora`, `RF-302: el segundo escaneo del mismo carné responde ya_registrado y no crea una marca`, `RF-302: escaneo de otro grupo devuelve mostrarNombre=false`, `RF-302: un escaneo fuera de la ventana responde fuera_de_ventana` y `RF-302: la marca lleva hora del dispositivo, desfase y registrador`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-20** Completar `procesarEscaneo` con y sin conexión y para actividades **[Primer corte]**
  - RF: RF-303, RF-313
  - Depende de: T003-19
  - Hecho cuando: pasan `RF-303: con red, un código inactivo se rechaza al instante`, `RF-303: sin red, un código desconocido queda pendiente_validacion con codigo_leido y sin catequizando` y `RF-313: una actividad se registra por escaneo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-21** Implementar `abrirLista`, `alternar` y `confirmarLista` **[Primer corte]**
  - RF: RF-306, RF-313, RNF-301
  - Depende de: T003-12, T003-18
  - Hecho cuando: pasan `RF-306: la lista abre con todos presentes`, `RF-306: un toque marca ausente y otro lo devuelve a presente`, `RF-306: al confirmar se crean marcas para todo el grupo con hora y catequista`, `RNF-301: la lista de 25 niños se confirma con un toque por ausente y uno para confirmar` y `RF-313: una actividad se registra por lista`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-22** Implementar `consolidar` sobre marcas aceptadas **[Primer corte]**
  - RF: RF-302, RF-308
  - Depende de: T003-12
  - Hecho cuando: pasan `RF-308: dos marcas de presencia generan un registro con dos registradores`, `RF-308: presente gana a ausente y se marca conflicto si son de cuentas distintas`, `RF-302: tipo de registro y hora son los de la primera marca presente` y `RF-308: marcas del grupo anterior y del nuevo se consolidan en un solo registro por niño`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-23** Añadir las correcciones a `consolidar` **[Primer corte]**
  - RF: RF-306, RF-309
  - Depende de: T003-22
  - Hecho cuando: pasan `RF-309: la última corrección manda por recibido_en y desempata por id` y `RF-306: un niño que llega tarde pasa a presente por corrección`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-24** Implementar `validarCorreccion` y `puedeCorregir` **[Primer corte]**
  - RF: RF-306, RF-309
  - Depende de: T003-15, T003-16, T003-18
  - Hecho cuando: pasan `RF-309: el autor corrige antes del fin del domingo y se conserva el valor anterior y la hora`, `RF-309: otro catequista no puede corregir`, `RF-309: después del fin solo corrige la coordinación y con motivo` y `RF-309: una corrección hecha antes del fin del domingo y enviada después se acepta` (por hora efectiva); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-25** Implementar `estadoEnSesion` para misa y actividades por escaneo **[Primer corte]**
  - RF: RF-301, RF-305
  - Depende de: T003-15, T003-16
  - Hecho cuando: pasan `RF-305: al cerrar la ventana, un niño activo sin presencia queda ausente en misa`, `RF-305: antes del cierre queda pendiente`, `RF-305: un niño inactivo en esa fecha queda no_aplica` y `RF-301: una sesión cancelada no genera ausencias`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-26** Implementar `estadoEnSesion` para catequesis **[Primer corte]**
  - RF: RF-301, RF-306
  - Depende de: T003-25
  - Hecho cuando: pasan `RF-306: sin lista confirmada el niño queda sin_registro`, `RF-306: con la lista de su grupo confirmada y sin marca presente queda ausente` (A-310) y `RF-301: presente en misa y ausente en catequesis el mismo domingo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-27** Implementar `faltasDelCiclo` para domingos y justificaciones **[Primer corte]**
  - RF: RF-311
  - Depende de: T003-26
  - Hecho cuando: pasan `RF-311: ausente en misa y catequesis suma una falta`, `RF-311: ausente solo en catequesis no suma falta`, `RF-311: catequesis sin registro no suma`, `RF-311: un domingo con una sola sesión no suma falta` (A-306) y `RF-311: una justificación aprobada de esa fecha deja de contar la falta`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-28** Añadir jornadas a `faltasDelCiclo` e implementar `ausenciasDelCiclo` **[Primer corte]**
  - RF: RF-311, RF-313
  - Depende de: T003-27
  - Hecho cuando: con un predicado `sumaFalta(actividad)` inyectado (en el primer corte, `tipo === 'jornada'` y no cancelada), pasan `RF-311: una jornada sin asistencia suma una falta`, `RF-311: una jornada en domingo cuenta aparte del domingo` (A-307) y `RF-311: ausenciasDelCiclo lista cada sesión ausente con su fecha y tipo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-29** Implementar `detectarMisaSinCatequesis` **[Primer corte]**
  - RF: RF-310
  - Depende de: T003-12
  - Hecho cuando: pasan `RF-310: presente en misa y ausente en la lista genera aviso de revisión cruzada` y `RF-310: sin lista confirmada no se detecta nada`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-30** Implementar `armarReporteMisa` **[Primer corte]**
  - RF: RF-304, RF-312
  - Depende de: T003-22
  - Hecho cuando: pasan `RF-312: el reporte lista presentes con hora del celular, hora del servidor, registrador con identidad operativa y tipo`, `RF-312: muestra presentes frente a activos en la fecha` y `RF-304: el reporte cuenta los registros manuales`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-31** Definir `protocolo.ts` y `contarPendientes` **[Primer corte]**
  - RF: RF-307
  - Depende de: T003-12
  - Hecho cuando: existen `CambiosPorTabla`, `RespuestaPull` y `ResumenPush` y pasa `RF-307: contarPendientes cuenta solo las filas created o updated de la cuenta en sesión`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-32** Definir las tablas sincronizadas de la 003 y su registro **[Primer corte]**
  - RF: RF-307, RNF-306
  - Depende de: T003-31
  - Hecho cuando: `sincronizacion/tablas.ts` define `DefinicionTablaSincronizada`; `asistencia/tablas-sincronizadas.ts` declara `grupos`, `catequizandos`, `parametros_asistencia`, `sesiones`, `listas_asistencia`, `marcas_asistencia`, `correcciones_asistencia` y `asistencias` con sentido, alcance y `registrado_por`/`corregido_por` en las de push; `registro-tablas.ts` las registra; pasa `RF-307: el registro contiene las tablas de la 003 con su sentido y alcance`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-33** Añadir el test de columnas prohibidas **[Primer corte]**
  - RF: RNF-306
  - Depende de: T003-32
  - Hecho cuando: `sincronizacion/columnas-prohibidas.ts` lista `salud`, `condicion`, `neuro`, `documento`, `dni`, `evidencia`, `nota_apoyo`, `fecha_nacimiento` y similares; pasan `Principio 7: ninguna tabla sincronizada contiene columnas restringidas` y `RNF-306: la nómina local solo tiene id, nombres, apellidos, grupo_id, codigo_carne y activo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-34** Implementar `huellaAlcance`, `filtroPull` y `requiereReemplazo` **[Primer corte]**
  - RF: RF-307, RNF-306
  - Depende de: T003-32
  - Hecho cuando: pasan `RNF-306: el filtro de la nómina es global y el de asistencias solo de los grupos propios`, `RNF-306: la coordinación recibe todas las listas y marcas` y `RF-307: un cambio de grupos cambia la huella y exige pull de reemplazo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-35** Implementar `debeSincronizar` en el orquestador **[Primer corte]**
  - RF: RF-307
  - Depende de: T003-13
  - Hecho cuando: pasan `RF-307: al reconectar sincroniza sin acción del usuario`, `RF-307: sincroniza al volver a primer plano, al confirmar una lista y tras un escaneo con red` y `RF-307: no lanza una segunda sincronización mientras otra está en curso`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 1.2 — Migraciones y repositorios PostgreSQL

- [ ] **T003-36** Crear la migración `0300_infraestructura_sincronizacion.sql` **[Primer corte]**
  - RF: RF-307, RNF-303, RNF-304
  - Depende de: T003-08, T001 (F0-3: runner de migraciones con checksum y Postgres en Docker), T002 (migraciones M-201 a M-204 y `v_nomina_ciclo`)
  - Hecho cuando: la migración crea `fijar_actualizado_en()`, añade con `IF NOT EXISTS` `actualizado_en` y `eliminado_en` a las tablas de nómina del plan 002 con su trigger, y crea `bitacora_sincronizacion`; aplicada desde cero en Docker, pasa `RF-307: actualizado_en lo fija el servidor en insert y update`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-37** Crear las migraciones `0301_parametros_asistencia.sql` y `0302_sesiones.sql` **[Primer corte]**
  - RF: RF-301, RF-302, RF-305, RF-309, RF-313
  - Depende de: T003-36, T008 (M1: tabla `ciclo` y `ciclo_bloquear_si_cerrado()`)
  - Hecho cuando: aplicadas en Docker, pasan `RF-302: parametros_asistencia_ciclo trae por defecto 07:30–09:30, 23:59:59 y 10 minutos en America/Lima` y `RF-301: sesiones admite una sola fila por id determinista y guarda cancelada y motivo`; la tabla `sesiones` tiene el trigger de congelamiento del plan 008; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-38** Crear la migración `0303_marcas_asistencia.sql` **[Primer corte]**
  - RF: RF-302, RF-303, RF-304, RF-306, RF-308
  - Depende de: T003-37
  - Hecho cuando: existen `listas_asistencia` y `marcas_asistencia` con el índice (`sesion_id`, `catequizando_id`); pasan `RF-308: marcas_asistencia solo admite inserciones` (UPDATE y DELETE fallan) y `RF-302: recibido_en se fija al primer insert y no cambia`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-39** Crear las migraciones `0304_asistencias.sql` y `0305_correcciones_asistencia.sql` **[Primer corte]**
  - RF: RF-306, RF-308, RF-309, RF-311, RF-312
  - Depende de: T003-38
  - Hecho cuando: pasan `RF-308: asistencias tiene UNIQUE(sesion_id, catequizando_id)` y `RF-309: correcciones_asistencia solo admite inserciones y guarda valor anterior, autor y hora`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-40** Crear las migraciones `0306_avisos_asistencia.sql` y `0307_eventos_asistencia.sql` **[Primer corte]**
  - RF: RF-303, RF-308, RF-309, RF-310, RF-311
  - Depende de: T003-39
  - Hecho cuando: pasan `RF-310: un aviso con el mismo id determinista no se duplica` y `RF-309: eventos_asistencia asigna secuencias crecientes`; `detalle jsonb` no admite claves de la lista de columnas prohibidas (verificado con un CHECK o por el repositorio); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-41** Implementar `RepositorioSesiones` con su batería de contrato **[Primer corte]**
  - RF: RF-301, RF-302, RF-313
  - Depende de: T003-37, T003-14
  - Hecho cuando: la misma batería pasa contra el falso en memoria y contra Postgres en Docker: `RF-301: crear sesiones es idempotente por id`, `RF-301: listar sesiones del ciclo abierto por fecha` y `RF-302: leer los parámetros del ciclo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-42** Implementar `RepositorioMarcas` (marcas y listas) con su contrato **[Primer corte]**
  - RF: RF-302, RF-306, RF-307
  - Depende de: T003-38
  - Hecho cuando: la batería pasa contra el falso y contra Postgres: `RF-307: insertar dos veces la misma marca deja una sola fila`, `RF-306: guardar una lista con sus totales` y `RF-302: listar marcas aceptadas por sesión y niño`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-43** Implementar `RepositorioAsistencias` (consolidado, correcciones y eventos) con su contrato **[Primer corte]**
  - RF: RF-308, RF-309, RF-311, RF-312
  - Depende de: T003-39, T003-40
  - Hecho cuando: la batería pasa contra el falso y contra Postgres: `RF-308: upsert de asistencias por (sesion, niño)`, `RF-309: insertar corrección idempotente por id` y `RF-311: leer asistencias por ciclo y fecha`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-44** Implementar `RepositorioAvisos` con su contrato **[Primer corte]**
  - RF: RF-303, RF-308, RF-310
  - Depende de: T003-40
  - Hecho cuando: la batería pasa contra el falso y contra Postgres: `RF-303: crear aviso idempotente por id`, `RF-310: listar avisos abiertos del ciclo` y `RF-310: atender registra quién y cuándo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-45** Implementar `bitacora-pg.ts` **[Primer corte]**
  - RF: RF-307, RNF-303, RNF-304
  - Depende de: T003-36
  - Hecho cuando: pasa contra Postgres `RNF-304: la bitácora guarda duración, bytes de entrada y salida, aceptados, rechazados y descartados por cierre`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 1.3 — Módulo `sincronizacion` (API)

- [ ] **T003-46** Implementar el caso de uso de pull y el registro de proveedores **[Primer corte]**
  - RF: RF-307, RNF-306
  - Depende de: T003-32, T003-34
  - Hecho cuando: `aplicacion/pull.ts` y `registro-proveedores.ts` funcionan con proveedores falsos y pasan `RF-307: el pull pide cambios con actualizado_en > ultimoPulso - 60 s`, `RF-307: con ultimoPulso nulo o huella distinta responde experimentalStrategy replacement` y `RF-307: con migracion entrega completas las tablas nuevas`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-47** Implementar el proveedor de sincronización de la nómina y los grupos **[Primer corte]**
  - RF: RF-302, RF-304, RF-306, RNF-306
  - Depende de: T003-46, T003-36, T002 (`proveedorNomina`, `gruposACargo` y `v_nomina_ciclo`)
  - Hecho cuando: contra Postgres pasan `RNF-306: el pull de un catequista trae la nómina completa solo con id, nombre, grupo y código` (selección explícita, sin `SELECT *`) y `RF-306: los grupos llegan todos con es_mio calculado por cuenta`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-48** Implementar el pull del proveedor de la 003 **[Primer corte]**
  - RF: RF-301, RF-303, RF-307, RNF-306
  - Depende de: T003-46, T003-41, T003-42, T003-43
  - Hecho cuando: contra Postgres pasan `RNF-306: las asistencias bajan solo de sus grupos`, `RF-303: las marcas rechazadas vuelven a su autor con estado y motivo_rechazo` y `RF-301: las sesiones y los parámetros del ciclo abierto bajan a todos`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-49** Implementar el push transaccional e idempotente **[Primer corte]**
  - RF: RF-307, RF-308
  - Depende de: T003-48
  - Hecho cuando: `aplicacion/push.ts` aplica en una transacción sesiones → listas → marcas → correcciones con `ON CONFLICT (id) DO NOTHING` y pasan `RF-307: reenviar el mismo lote no duplica marcas ni avisos`, `RF-307: un push de 7 días después se acepta sin duplicar` y `RF-307: una fila con autor distinto de la cuenta del token queda rechazada sin fallar el push`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-50** Autorizar cada fila del push por rol y alcance **[Primer corte]**
  - RF: RF-301, RF-304, RF-306, RNF-306
  - Depende de: T003-49, T003-18
  - Hecho cuando: pasan `RF-301: solo la coordinación cambia una sesión (fila rechazada para un catequista)`, `RF-304: el servidor rechaza un registro manual de otro grupo`, `RF-306: un catequista confirma la lista de un grupo que no es suyo` (push aceptado) y `RNF-306: un cambio local en catequizandos, grupos o asistencias se rechaza`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-51** Descartar en el push lo que llega después del cierre del ciclo **[Primer corte]**
  - RF: RF-307
  - Depende de: T003-49, T003-45, T008 (M1: tabla `ciclo`; `clasificarRegistroEntrante` de `cierre.ts` si ya existe)
  - Hecho cuando: el push toma `SELECT estado FROM ciclo ... FOR SHARE` y pasa `RF-307: los registros que llegan después del cierre se descartan y se cuentan en la bitácora` (`ResumenPush.descartadosCierre` y `bitacora_sincronizacion.descartados_cierre` coinciden; no se guarda el contenido); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-52** Rechazar el push de una cuenta o enlace revocados **[Primer corte]**
  - RF: RF-307
  - Depende de: T003-49, T001 (RF-112: rechazo y aviso de pendientes de cuentas revocadas)
  - Hecho cuando: pasa `RF-307: el push de una cuenta revocada responde 401 y no aplica ninguna fila`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-53** Exponer `GET` y `POST /sincronizacion/cambios` **[Primer corte]**
  - RF: RF-302, RF-307
  - Depende de: T003-46, T003-49, T001 (middleware `conAcceso` y JWT de prueba por rol)
  - Hecho cuando: los tests HTTP con `HttpRequest` sintético pasan: `RF-307: /sincronizacion/cambios responde 401 sin token y 403 a familia y supervisión`, `RF-307: catequista y coordinación reciben 200 con changes y timestamp` y `RF-302: la respuesta lleva la cabecera x-hora-servidor`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-54** Comprimir la respuesta y registrar la bitácora de cada sincronización **[Primer corte]**
  - RF: RF-307, RNF-303, RNF-304
  - Depende de: T003-53, T003-45
  - Hecho cuando: pasan `RNF-304: el pull se responde en gzip si el cliente lo acepta` y `RNF-303: cada pull y push escribe una fila de bitácora con duracion_ms y bytes`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-55** Configurar en APIM las políticas de las rutas de sincronización **[Primer corte]**
  - RF: RF-307, RNF-303
  - Depende de: T003-53, T001 (F0-4: Bicep base de APIM)
  - Hecho cuando: el Bicep fija 30 llamadas/min por cuenta, cuerpo máximo de 512 KB en el push y sin CORS para `/sincronizacion/*`; `az bicep build` termina sin errores y el `what-if` contra el entorno de pruebas muestra las tres políticas; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 1.4 — Módulo `asistencia` (API)

- [ ] **T003-56** Implementar `procesar-marcas.ts` con bloqueo y consolidación **[Primer corte]**
  - RF: RF-302, RF-308, RF-309, RF-311
  - Depende de: T003-23, T003-43, T003-49
  - Hecho cuando: por cada par afectado toma `pg_advisory_xact_lock`, recalcula `consolidar()`, hace upsert de `asistencias` e inserta un evento si cambió el valor; pasan contra Postgres `RF-308: pushes concurrentes del mismo niño no duplican` y `RF-309: una corrección que cambia el valor inserta evento_asistencia`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-57** Validar el carné en el push y avisar de los códigos inválidos **[Primer corte]**
  - RF: RF-303
  - Depende de: T003-56, T003-44, T003-17, T002 (`resolverCarne` del servidor)
  - Hecho cuando: pasan `RF-303: un código desconocido sin red se guarda pendiente y al sincronizar se rechaza con aviso`, `RF-303: al sincronizar, un código inválido queda rechazado con aviso y no cuenta como asistencia` y `RF-303: un código de carné reemplazado se rechaza al sincronizar`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-58** Validar en el push la ventana con la hora efectiva **[Primer corte]**
  - RF: RF-302
  - Depende de: T003-56, T003-15, T003-16
  - Hecho cuando: pasan `RF-302: escaneo dentro de la ventana registra presente con hora del celular, hora del servidor y registrador`, `RF-302: con desfase estimado, la ventana se evalúa con la hora efectiva y se guardan ambas horas` y `RF-302: una hora efectiva posterior a recibido_en se rechaza con aviso` (R-303); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-59** Generar avisos de conflicto y de revisión cruzada **[Primer corte]**
  - RF: RF-308, RF-310
  - Depende de: T003-56, T003-29, T003-44
  - Hecho cuando: pasan `RF-308: presente gana, se conservan ambos registradores y se avisa a la coordinación`, `RF-310: confirmar una lista avisa de los niños presentes en misa y ausentes en catequesis`, `RF-310: una marca de misa que llega después de la lista también genera el aviso` y `RF-310: el aviso no se duplica`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-60** Aplicar las correcciones del push con `registrar-correccion.ts` **[Primer corte]**
  - RF: RF-306, RF-309
  - Depende de: T003-56, T003-24
  - Hecho cuando: pasan `RF-309: la coordinación corrige a ausente una presencia en misa con motivo y traza`, `RF-309: una corrección de otro catequista se rechaza con motivo` y `RF-309: después del fin del domingo una corrección sin motivo se rechaza`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-61** Exponer la lectura de la bandeja `eventos_asistencia` **[Primer corte]**
  - RF: RF-309, RF-311
  - Depende de: T003-43
  - Hecho cuando: el servicio interno `leerEventosAsistencia(desdeSecuencia, limite)` pasa `RF-309: leerEventosAsistencia devuelve en orden los eventos posteriores a la secuencia dada` contra Postgres; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-62** Exponer `GET /asistencia/carnes/{codigo}/validacion` **[Primer corte]**
  - RF: RF-302, RF-303, RNF-307
  - Depende de: T003-17, T003-53, T002 (`resolverCarne`)
  - Hecho cuando: pasan `RNF-307: validarCarne no devuelve nombre ni grupo` (el cuerpo solo tiene `estado`), `RF-302: validarCarne exige rol catequista (401 sin token, 403 a familia)` y `RF-303: validarCarne responde inactivo para un niño retirado`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-63** Exponer `GET /asistencia/misas/{fecha}/reporte` **[Primer corte]**
  - RF: RF-304, RF-312
  - Depende de: T003-30, T003-43, T001 (`IdentidadOperativa`), T002 (`ninosActivos`)
  - Hecho cuando: pasan `RF-312: la supervisión puede leer y la familia y el catequista reciben 403`, `RF-312: el reporte muestra el seudónimo de un registrador menor y nunca su nombre real` y `RF-304: el reporte HTTP incluye el número de registros manuales`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-64** Exponer el listado y la atención de avisos de asistencia **[Primer corte]**
  - RF: RF-303, RF-308, RF-310
  - Depende de: T003-44, T001 (`conAcceso`)
  - Hecho cuando: pasan `RF-303: GET /asistencia/avisos responde a la coordinación y da 403 al catequista` y `RF-310: POST /asistencia/avisos/{id}/atencion registra quién y cuándo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-65** Implementar el temporizador `generarSesionesDominicales` **[Primer corte]**
  - RF: RF-301
  - Depende de: T003-41, T003-14, T008 (`GET /ciclos/abierto` o lectura del ciclo abierto)
  - Hecho cuando: pasan `RF-301: generarSesionesDominicales crea misa y catequesis de cada domingo faltante del ciclo abierto` y `RF-301: ejecutarlo dos veces no duplica sesiones`; el disparador queda como temporizador de los lunes a las 03:00 y como función invocable por el plan 008; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-66** Implementar `precalentarDomingo` y acotar pool y escalado **[Primer corte]**
  - RF: RNF-303
  - Depende de: T003-08, T001 (F0-4: Function App en Bicep)
  - Hecho cuando: pasan `RNF-303: precalentarDomingo se programa cada 5 minutos de 7 a 11 los domingos en hora de Lima` y `RNF-303: el pool pg usa el máximo acordado de conexiones por instancia`; el Bicep fija el límite de instancias acordado en T003-08 y `az bicep build` termina sin errores; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 1.5 — Cliente (base local, sincronización y pantallas)

- [ ] **T003-67** Instalar WatermelonDB y su configuración en la rama principal **[Primer corte]**
  - RF: RF-307, RNF-302
  - Depende de: T003-05 (veredicto «sigue WatermelonDB»), T003-01
  - Hecho cuando: `@nozbe/watermelondb`, su plugin de configuración y, si hace falta, el plugin de decoradores de Babel quedan instalados con las versiones de `prueba-tecnica.md`; `npx expo-doctor` no reporta errores y `npx expo prebuild --no-install --platform android` termina; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-68** Crear `base-datos.native.ts` y `base-datos.web.ts` **[Primer corte]**
  - RF: RF-307, RNF-302
  - Depende de: T003-67, T003-11
  - Hecho cuando: se instala `expo-crypto`; la versión nativa crea la base con el adaptador SQLite (JSI) y `setGenerator(() => Crypto.randomUUID())`; la web lanza un error si se usa (D-311); pasan `Principio 6: los ids creados en el dispositivo son UUID v4` y `RF-307: la base local no se inicializa en la web`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-69** Generar el esquema local y la primera migración local **[Primer corte]**
  - RF: RF-306, RF-307
  - Depende de: T003-68, T003-32
  - Hecho cuando: `esquema.ts` se genera desde el registro de tablas y añade la tabla solo local `borradores_lista`, con índice en `codigo_carne`; `migraciones.ts` tiene el paso 1; pasan `RF-307: el esquema local se genera de las definiciones registradas` y `Principio 6: los pasos de migración local publicados no cambian` (huella de los pasos); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-70** Crear los modelos y `repositorio-asistencia.ts` **[Primer corte]**
  - RF: RF-302, RF-304, RF-306, RF-309
  - Depende de: T003-69
  - Hecho cuando: con el adaptador LokiJS en memoria pasan `RF-302: el repositorio busca un niño de la nómina por codigo_carne`, `RF-302: crear una marca guarda registrado_por con la cuenta en sesión` y `RF-309: crear una corrección guarda el valor anterior`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-71** Persistir cada toque de la lista en `borradores_lista` **[Primer corte]**
  - RF: RF-306
  - Depende de: T003-70, T003-21
  - Hecho cuando: con LokiJS pasan `RF-306: el borrador de la lista sobrevive a reabrir la base local` y `RF-306: el borrador no está en ninguna tabla de push`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-72** Implementar `purgarExceptoPendientes(cuentaId)` **[Primer corte]**
  - RF: RF-307, RNF-306
  - Depende de: T003-70
  - Hecho cuando: con LokiJS pasan `RF-307: purgarExceptoPendientes conserva solo los pendientes de la cuenta indicada` y `RNF-306: tras purgar no queda la nómina en el celular`; el plan 001 queda informado de que la operación existe (RNF-102 de 001); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-73** Implementar el motor de sincronización del cliente **[Primer corte]**
  - RF: RF-303, RF-307
  - Depende de: T003-70, T003-31, T003-53, T001 (cliente HTTP autenticado y `alReconectar`, RF-112)
  - Hecho cuando: `motor.ts` llama a `synchronize()` con `migrationsEnabledAtVersion`; con LokiJS y un HTTP falso pasan `RF-307: el motor renueva la sesión, después hace pull y al final push` y `RF-303: el último ResumenPush queda guardado con rechazados y descartados`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-74** Implementar los disparadores de sincronización y el desfase de reloj **[Primer corte]**
  - RF: RF-302, RF-307
  - Depende de: T003-73, T003-35, T003-16, T003-11
  - Hecho cuando: se instala `@react-native-community/netinfo`; con NetInfo y `AppState` simulados pasan `RF-307: al reconectar sincroniza sin acción del usuario`, `RF-307: los reintentos esperan según esperaReintento` y `RF-302: el desfase calculado con x-hora-servidor se guarda en localStorage`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-75** Mostrar el contador reactivo de pendientes **[Primer corte]**
  - RF: RF-307
  - Depende de: T003-70, T003-31
  - Hecho cuando: `datos/sincronizacion/pendientes.ts` y `components/asistencia/contador-pendientes.tsx` pasan `RF-307: el contador muestra los pendientes de la cuenta y baja a 0 tras sincronizar` (jest-expo + Testing Library); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-76** Publicar la skill `nueva-tabla-sincronizada` **[Primer corte]**
  - RF: RF-307
  - Depende de: T003-69, T003-46
  - Hecho cuando: existe `SKILL.md` en la ubicación de skills del proyecto con los 4 pasos de la §3.3 del plan (definición, registro, paso de migración local, proveedor del servidor) y `AGENTS.md` enlaza la convención; un ensayo siguiendo la skill con una tabla de prueba pasa `Principio 7: ninguna tabla sincronizada contiene columnas restringidas` y se revierte; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-77** Crear `asistencia/index.tsx` a partir de `asistencia.tsx` **[Primer corte]**
  - RF: RF-301, RF-306, RF-307
  - Depende de: T003-75, T003-15, T001 (layout por rol y guarda de sesión con PIN)
  - Hecho cuando: `src/app/asistencia.tsx` pasa a `src/app/asistencia/index.tsx`; pasan `RF-301: la pantalla muestra la sesión en curso desde la base local sin red`, `RF-306: los grupos propios aparecen primero y después todos` y `RF-307: la pantalla muestra pendientes y rechazados`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-78** Crear el componente `confirmacion-escaneo` **[Primer corte]**
  - RF: RF-302, RF-303, RNF-307
  - Depende de: T003-19
  - Hecho cuando: pasan `RNF-307: escanear a un niño de otro grupo muestra «Registrado» sin su nombre`, `RF-302: un niño de sus grupos muestra su nombre en un banner verde a pantalla completa`, `RF-302: muestra «Ya estaba registrado»` y `RF-303: muestra «Carné no válido»`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-79** Crear `asistencia/escanear.tsx` con `CameraView` **[Primer corte]**
  - RF: RF-302, RNF-305
  - Depende de: T003-78, T003-05, T003-01
  - Hecho cuando: se instala `expo-camera` (consultando la documentación de SDK 57); la pantalla usa `useCameraPermissions`, `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`, `enableTorch` y desmonta la cámara al perder el foco; pasan `RNF-305: escanear.tsx muestra el control de linterna y solicita solo QR` y `RF-302: el mismo código leído dentro de 2 s se ignora`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-80** Conectar el escaneo con la base local sin esperar la red **[Primer corte]**
  - RF: RF-302, RF-303, RNF-302, RNF-307
  - Depende de: T003-79, T003-70, T003-74, T003-20, T003-62
  - Hecho cuando: al leer un código se llama a `procesarEscaneo`, se escribe la marca, se muestra la confirmación con `Vibration` y se dispara la sincronización aparte; la consulta a `validarCarne` solo ocurre con red y código ausente de la nómina; pasan `RF-302: el camino del escaneo no espera la red` (con un HTTP que nunca responde, la confirmación aparece en < 1 s) y `RNF-302: sin red el escaneo guarda la marca pendiente`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-81** Crear `asistencia/manual.tsx` **[Primer corte]**
  - RF: RF-304
  - Depende de: T003-70, T003-18
  - Hecho cuando: pasan `RF-304: la búsqueda manual solo ofrece niños de los grupos propios` y `RF-304: registro manual de un niño inscrito ese día queda marcado como manual`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-82** Crear `asistencia/lista/[grupoId].tsx` con presentes por defecto **[Primer corte]**
  - RF: RF-306, RNF-301, RNF-306
  - Depende de: T003-71
  - Hecho cuando: con `fila-catequizando.tsx`, pasan `RF-306: la pantalla abre la lista con todos presentes y un toque marca ausente` y `RNF-306: sin red se abre la lista de otro grupo con la nómina local`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-83** Confirmar la lista en una transacción local **[Primer corte]**
  - RF: RF-306, RF-307, RNF-301
  - Depende de: T003-82, T003-74
  - Hecho cuando: pasan `RF-306: confirmar crea la lista y las marcas y borra el borrador en una sola transacción`, `RF-306: un catequista confirma desde la app la lista de un grupo que no es suyo` y `RF-307: confirmar la lista dispara la sincronización`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-84** Crear `asistencia/pendientes.tsx` **[Primer corte]**
  - RF: RF-303, RF-307
  - Depende de: T003-75, T003-73
  - Hecho cuando: pasan `RF-307: la pantalla muestra pendientes y la hora de la última sincronización`, `RF-303: la pantalla de pendientes muestra los rechazados con su motivo` y `RF-307: muestra los descartados por cierre del último resumen` (A-312); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-85** Crear `asistencia/correccion/[sesionId]/[catequizandoId].tsx` **[Primer corte]**
  - RF: RF-306, RF-309
  - Depende de: T003-70, T003-24
  - Hecho cuando: pasan `RF-309: la pantalla muestra el valor actual y el anterior`, `RF-309: la pantalla exige motivo a la coordinación después del fin del domingo` y `RF-309: otro catequista no ve la acción de corregir`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-86** Crear `coordinacion/sesiones.tsx` **[Primer corte]**
  - RF: RF-301
  - Depende de: T003-70, T003-18
  - Hecho cuando: pasan `RF-301: la coordinación marca un domingo sin misa con motivo y queda pendiente de envío`, `RF-301: la coordinación cambia la ventana de un domingo` y `RF-301: un catequista no ve la pantalla`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-87** Crear `coordinacion/avisos-asistencia.tsx` **[Primer corte]**
  - RF: RF-303, RF-308, RF-310
  - Depende de: T003-64, T001 (cliente HTTP autenticado)
  - Hecho cuando: pasan `RF-310: la pantalla lista los avisos por tipo y marca uno como atendido` y `RF-303: sin red la pantalla indica que requiere conexión`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-88** Crear `reportes/misa/[fecha].tsx` **[Primer corte]**
  - RF: RF-304, RF-312
  - Depende de: T003-63
  - Hecho cuando: pasan `RF-312: la pantalla muestra presentes frente a activos con hora, registrador y tipo`, `RF-304: la pantalla muestra cuántos registros fueron manuales` y `RF-312: sin red indica que requiere conexión`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 1.6 — Cómputo de falta (RF-311)

- [ ] **T003-89** Definir los puertos de justificaciones e inscripciones con sus adaptadores de primer corte **[Primer corte]**
  - RF: RF-305, RF-311
  - Depende de: T003-27, T002 (`FuenteInscripciones`: periodos activos y grupo en una fecha)
  - Hecho cuando: existen `FuenteJustificacionesAprobadas` con un adaptador vacío y uno falso, y el adaptador de `FuenteInscripciones` del plan 002; pasan `RF-311: con el adaptador vacío ninguna falta queda justificada` y `RF-305: un niño inscrito después de la fecha queda no_aplica según FuenteInscripciones`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-90** Implementar `consultarAusencias` y `consultarFaltas` **[Primer corte]**
  - RF: RF-305, RF-311
  - Depende de: T003-89, T003-28, T003-43
  - Hecho cuando: contra Postgres pasan `RF-311: consultarFaltas aplica faltasDelCiclo a los datos del servidor`, `RF-311: con el adaptador falso, una justificación aprobada de esa fecha deja de contar la falta` y `RF-305: consultarAusencias devuelve las ausencias en misa al cerrar la ventana`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 1.7 — Actividades obligatorias (RF-313)

- [ ] **T003-91** Implementar el puerto `crearSesionActividad` **[Primer corte]**
  - RF: RF-301, RF-313
  - Depende de: T003-41, T003-14, T005 (migración `0505_actividades_obligatorias.sql`, tabla mínima de actividades)
  - Hecho cuando: pasan `RF-313: crearSesionActividad crea una sesión de tipo actividad con id determinista` y `RF-313: llamarlo dos veces no duplica la sesión`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-92** Registrar actividades desde la app por escaneo o lista **[Primer corte]**
  - RF: RF-313
  - Depende de: T003-91, T003-80, T003-83
  - Hecho cuando: pasan `RF-313: una actividad en curso aparece en asistencia/index`, `RF-313: una actividad se registra por escaneo desde la app` y `RF-313: la lista con ?sesionId registra la asistencia a la actividad`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-93** Implementar `consultarCumplimientoActividad` **[Primer corte]**
  - RF: RF-313
  - Depende de: T003-91, T003-43
  - Hecho cuando: contra Postgres pasa `RF-313: la asistencia a la actividad se expone como cumplimiento con quién la registró`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 1.8 — Verificación: extremo a extremo, carga y campo

- [ ] **T003-94** Montar el arnés extremo a extremo y probar un domingo completo sin red **[Primer corte]**
  - RF: RF-307, RNF-302
  - Depende de: T003-73, T003-57, T003-58, T003-59, T003-60
  - Hecho cuando: en `api/pruebas/e2e`, dos «celulares» (motor real con LokiJS) sin red registran escaneos, manuales, listas y correcciones de un domingo, reconectan y pasa `RF-307: e2e domingo completo sin red llega íntegro` (mismo número de marcas en el servidor que en los celulares, 0 duplicados); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-95** Verificar extremo a extremo el flujo sin red, los avisos y el reporte **[Primer corte]**
  - RF: RF-303, RF-312, RNF-302, RNF-307
  - Depende de: T003-94, T003-63
  - Hecho cuando: pasan `RNF-302: e2e escaneo, manual, lista y corrección con el adaptador de red caído`, `RF-303: e2e un código inválido escaneado sin conexión llega como aviso y no como asistencia` y `RF-312: e2e el reporte de misa coincide con los escaneos y cuenta los manuales`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-96** Medir el volumen de datos de un domingo de un grupo **[Primer corte]**
  - RF: RNF-304
  - Depende de: T003-94, T003-54
  - Hecho cuando: pasa `RNF-304: push + pull de un domingo completo de un grupo de 25 niños pesa < 100 KB sin comprimir` (bytes medidos en la bitácora; el valor obtenido se anota en `prueba-tecnica.md`); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-97** Probar 50 clientes concurrentes contra las Functions locales **[Primer corte]**
  - RF: RNF-303, RF-308
  - Depende de: T003-94
  - Hecho cuando: pasa `RNF-303: 50 clientes concurrentes sin errores ni duplicados` (50 push y pull simultáneos sobre los mismos niños: 0 respuestas 5xx, 0 filas duplicadas en `asistencias`); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-98** Ejecutar la carga del pico dominical con k6 en Azure **[Primer corte]**
  - RF: RNF-303
  - Depende de: T003-97, T003-55, T003-66
  - Hecho cuando: `api/pruebas/carga/pico-dominical.k6.js` corre 50 usuarios virtuales durante 30 min contra el entorno de pruebas con p95 del push < 2 s y 0 errores 5xx; el informe de k6 se guarda junto al script; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-99** Medir en laboratorio la lectura QR con la app final en gama baja **[Primer corte]**
  - RF: RF-302, RNF-305
  - Depende de: T003-80, T002 (hoja imprimible de carnés)
  - Hecho cuando: en el Android de referencia (Android 10, 2 GB de RAM), con la app del primer corte, 20 carnés impresos leídos con < 50 lux y linterna dan ≥ 95 % de lecturas con confirmación en < 1 s; resultado anotado en `prueba-tecnica.md`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-100** Escribir el protocolo de la prueba de campo **[Primer corte]**
  - RF: RF-306, RF-307, RNF-301, RNF-302, RNF-303, RNF-304, RNF-307
  - Depende de: T003-95
  - Hecho cuando: `specs/003-asistencia-dominical/prueba-campo.md` describe cómo verificar cada criterio de finalización de la spec (modo avión, cronómetro, escaneo de otro grupo, lista de otro grupo, reporte por la supervisión, código inválido) y las consultas a `bitacora_sincronizacion` y `listas_asistencia`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-101** Cronometrar la línea base de la lista en papel **[Primer corte]**
  - RF: RNF-301
  - Depende de: T003-100
  - Hecho cuando: se cronometra en al menos 3 grupos el pase de lista en papel actual y el tiempo por niño queda anotado en `prueba-campo.md` como línea base (respuesta propuesta para la duda A-304); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-102** Fijar la ventana de misa y el fin del domingo definitivos **[Primer corte]** **[Bloqueada por aclaración]**
  - RF: RF-302, RF-305, RF-309
  - Depende de: T003-37
  - Bloqueo: dudas de la spec «Ventana de la misa» (A-301) y «fin del domingo» (A-305).
  - Hecho cuando: la coordinación confirma los valores; si difieren de 07:30–09:30 y 23:59:59, se cargan en `parametros_asistencia_ciclo` del ciclo abierto (sin tocar código) y el test `RF-302: ventanaDe usa los parámetros del ciclo` sigue en verde; la spec registra la respuesta; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-103** Imprimir y entregar los carnés del grupo piloto **[Primer corte]** **[Bloqueada por aclaración]**
  - RF: RF-302
  - Depende de: T002 (hoja imprimible de carnés)
  - Bloqueo: duda de la spec «¿Quién imprime y entrega los carnés y quién asume su costo?» (A-303).
  - Hecho cuando: cada niño del grupo piloto tiene su carné impreso y probado con un escaneo de la app; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-104** Ejecutar la prueba de campo de un domingo completo **[Primer corte]** **[Bloqueada por aclaración]**
  - RF: RF-302, RF-303, RF-306, RF-307, RF-311, RF-312, RNF-302, RNF-307
  - Depende de: T003-100, T003-103, T003-99
  - Bloqueo: A-303 (carnés), a través de T003-103.
  - Hecho cuando: siguiendo `prueba-campo.md`, un grupo registra misa y catequesis en modo avión y todos sus registros llegan al servidor al reconectar (0 pérdidas, 0 duplicados); un escaneo de otro grupo muestra solo «Registrado»; un catequista pasa la lista de un grupo ajeno; un código inválido llega como aviso; la supervisión consulta el reporte sin ayuda de la coordinación; un niño ausente en misa y catequesis suma una falta y ausente en una sola no; resultados en `prueba-campo.md`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-105** Medir en campo el tiempo de la lista frente al papel **[Primer corte]** **[Bloqueada por aclaración]**
  - RF: RNF-301
  - Depende de: T003-101, T003-104
  - Bloqueo: duda de la spec «¿Cuánto tiempo toma hoy pasar lista en papel?» (A-304); la meta solo se fija cuando el equipo acepta la línea base de T003-101.
  - Hecho cuando: la mediana de `confirmada_en - abierta_en` por grupo es < 2 min y el tiempo medido por niño (lista y escaneo) es menor que la línea base en papel; resultado en `prueba-campo.md`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-106** Medir en campo la latencia del pico y los datos móviles **[Primer corte]** **[Bloqueada por aclaración]**
  - RF: RNF-303, RNF-304
  - Depende de: T003-104
  - Bloqueo: A-303 (carnés), a través de T003-104.
  - Hecho cuando: en la bitácora del domingo de prueba, el p95 de `duracion_ms` del push es < 2 s y la suma de `bytes_entrada + bytes_salida` por cuenta y domingo es < 100 KB; resultado en `prueba-campo.md`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 2 — Integración con las demás specs

- [ ] **T003-107** Conectar el adaptador real de justificaciones aprobadas **[Primer corte]**
  - RF: RF-311
  - Depende de: T003-90, T004 (puerto `ConsultaJustificaciones.faltaJustificada`)
  - Hecho cuando: el adaptador vacío se reemplaza por uno sobre el puerto del plan 004 y pasa `RF-311: una justificación aprobada en 004 deja de contar la falta` (integración con Postgres); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-108** Invocar `alCambiarAsistencia` de 004 en la transacción de consolidación **[Primer corte]**
  - RF: RF-309, RF-311
  - Depende de: T003-56, T004 (puerto `alCambiarAsistencia`)
  - Hecho cuando: pasa `RF-309: una corrección a presente deja sin efecto la justificación de esa ausencia y volver a ausente la restaura` (en la misma transacción); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-109** Usar `actividadSumaFalta` del plan 005 en `faltasDelCiclo` **[Primer corte]**
  - RF: RF-311, RF-313
  - Depende de: T003-28, T005 (`src/lib/actividades/falta-actividad.ts`)
  - Hecho cuando: el predicado inyectado de primer corte se sustituye por `actividadSumaFalta` y siguen pasando `RF-311: una jornada sin asistencia suma una falta` y `RF-311: un retiro sin asistencia no suma falta`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-110** Exponer `GET /asistencia/catequizandos/{id}/domingos` **[Primer corte]**
  - RF: RF-301, RF-311
  - Depende de: T003-90, T001 (`conAcceso` y enlace de familia), T002 (`alcanceFamilia`)
  - Hecho cuando: pasan `HU-306: la familia ve misa y catequesis solo de sus hijos; de otro niño recibe 403` y `HU-306: a la familia no se le muestra registrador ni horas` (A-313); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-111** Crear `familia/asistencia/[catequizandoId].tsx` en la web **[Primer corte]**
  - RF: RF-301
  - Depende de: T003-110
  - Hecho cuando: pasa `HU-306: la pantalla web muestra por domingo presente o ausente en misa y catequesis, de solo lectura`; `npm run web` abre la pantalla sin inicializar WatermelonDB; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-112** Decidir con los datos de campo si hace falta sincronizar en segundo plano **[Primer corte]** **[Bloqueada por aclaración]**
  - RF: RF-307
  - Depende de: T003-104
  - Bloqueo: A-303 (carnés), a través de T003-104, porque la decisión necesita los datos de la prueba de campo.
  - Hecho cuando: con la bitácora de campo se calcula el tiempo entre `hora_dispositivo` y `recibido_en`; si algún registro tardó más de 24 h, se abre una nueva spec o un cambio de spec para `expo-background-task` (D-316); si no, la decisión de mantener la sincronización con la app abierta queda en el ADR de T003-09; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T003-113** Evaluar el cifrado de la base local **[Primer corte]**
  - RF: RNF-306
  - Depende de: T003-67, T003-09
  - Hecho cuando: un ADR registra si se adopta SQLCipher u otra opción para el almacén local (R-302), con su impacto en dependencias y rendimiento en gama baja; si se adopta, la dependencia queda pendiente de justificar en la spec antes de instalarla; `npm run adr:build` termina sin errores; `npm test`, `npm run typecheck` y `npm run lint` pasan.

---

## Cobertura

Cada requisito de la spec y las tareas que lo implementan o verifican. La última columna señala las tareas con el test principal o la medición con umbral.

| Requisito | Tareas | Verificación principal |
| --- | --- | --- |
| RF-301 | T003-11, T003-12, T003-14, T003-18, T003-25, T003-26, T003-37, T003-41, T003-48, T003-50, T003-65, T003-77, T003-86, T003-91, T003-110, T003-111 | T003-14, T003-25, T003-26, T003-50, T003-65, T003-86 |
| RF-302 | T003-01, T003-04, T003-12, T003-15, T003-16, T003-17, T003-18, T003-19, T003-22, T003-37, T003-38, T003-41, T003-42, T003-47, T003-53, T003-56, T003-58, T003-62, T003-70, T003-74, T003-78, T003-79, T003-80, T003-99, T003-102, T003-103, T003-104 | T003-19, T003-58, T003-80 (< 1 s), T003-99 |
| RF-303 | T003-09, T003-17, T003-20, T003-38, T003-40, T003-44, T003-48, T003-57, T003-62, T003-64, T003-73, T003-78, T003-80, T003-84, T003-87, T003-95, T003-104 | T003-20, T003-57, T003-95 |
| RF-304 | T003-18, T003-30, T003-38, T003-47, T003-50, T003-63, T003-70, T003-81, T003-88 | T003-50, T003-63, T003-81 |
| RF-305 | T003-15, T003-25, T003-37, T003-89, T003-90, T003-102 | T003-25, T003-90 |
| RF-306 | T003-12, T003-18, T003-21, T003-23, T003-24, T003-26, T003-38, T003-39, T003-42, T003-47, T003-50, T003-60, T003-69, T003-70, T003-71, T003-77, T003-82, T003-83, T003-85, T003-100, T003-104 | T003-21, T003-50, T003-71, T003-83 |
| RF-307 | T003-01, T003-02, T003-03, T003-05, T003-06, T003-07, T003-08, T003-09, T003-10, T003-11, T003-13, T003-31, T003-32, T003-34, T003-35, T003-36, T003-42, T003-45, T003-46, T003-48, T003-49, T003-51, T003-52, T003-53, T003-54, T003-55, T003-67, T003-68, T003-69, T003-72, T003-73, T003-74, T003-75, T003-76, T003-77, T003-83, T003-84, T003-94, T003-100, T003-104, T003-112 | T003-49, T003-51, T003-74, T003-94 |
| RF-308 | T003-09, T003-22, T003-38, T003-39, T003-40, T003-43, T003-44, T003-49, T003-56, T003-59, T003-64, T003-87, T003-97 | T003-22, T003-56, T003-59, T003-97 |
| RF-309 | T003-12, T003-15, T003-16, T003-23, T003-24, T003-37, T003-39, T003-40, T003-43, T003-56, T003-60, T003-61, T003-70, T003-85, T003-102, T003-108 | T003-24, T003-56, T003-60 |
| RF-310 | T003-29, T003-40, T003-44, T003-59, T003-64, T003-87 | T003-29, T003-59 |
| RF-311 | T003-12, T003-27, T003-28, T003-39, T003-40, T003-43, T003-56, T003-61, T003-89, T003-90, T003-104, T003-107, T003-108, T003-109, T003-110 | T003-27, T003-28, T003-90, T003-107 |
| RF-312 | T003-30, T003-39, T003-43, T003-63, T003-88, T003-95, T003-104 | T003-30, T003-63, T003-95 |
| RF-313 | T003-14, T003-15, T003-20, T003-21, T003-28, T003-37, T003-41, T003-91, T003-92, T003-93, T003-109 | T003-20, T003-21, T003-91, T003-93 |
| RNF-301 | T003-21, T003-82, T003-83, T003-100, T003-101, T003-105 | T003-21 (toques); T003-105 (mediana < 2 min y < papel) |
| RNF-302 | T003-01, T003-02, T003-03, T003-05, T003-06, T003-07, T003-11, T003-67, T003-68, T003-80, T003-94, T003-95, T003-100, T003-104 | T003-94, T003-95; T003-104 (modo avión) |
| RNF-303 | T003-08, T003-36, T003-45, T003-54, T003-55, T003-66, T003-97, T003-98, T003-100, T003-106 | T003-97 (50 clientes, 0 errores); T003-98 (k6 p95 < 2 s); T003-106 |
| RNF-304 | T003-36, T003-45, T003-54, T003-96, T003-100, T003-106 | T003-96 (< 100 KB); T003-106 (campo < 100 KB) |
| RNF-305 | T003-01, T003-02, T003-04, T003-05, T003-79, T003-99 | T003-04, T003-99 (≥ 95 % con < 50 lux, < 1 s) |
| RNF-306 | T003-32, T003-33, T003-34, T003-46, T003-47, T003-48, T003-50, T003-72, T003-82, T003-113 | T003-33, T003-34, T003-47, T003-82 |
| RNF-307 | T003-18, T003-19, T003-62, T003-78, T003-80, T003-95, T003-100, T003-104 | T003-19, T003-62, T003-78, T003-104 |
| HU-306 (consulta de la familia) | T003-110, T003-111 | T003-110 |

Ningún RF ni RNF de la spec queda sin tareas: RF-301 a RF-313 y RNF-301 a RNF-307 tienen al menos una tarea con test que cita su identificador, y los RNF medibles tienen además una tarea de medición con umbral.

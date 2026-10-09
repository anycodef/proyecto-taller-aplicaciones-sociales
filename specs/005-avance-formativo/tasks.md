# Tareas 005 — Avance formativo

> Tareas de implementación de [spec.md](spec.md) según [plan.md](plan.md). Respetan [la constitución](../../docs/constitution.md) y [AGENTS.md](../../AGENTS.md).

**Total de tareas:** 76 · **[Primer corte]:** 8 · **[Bloqueada por aclaración]:** 3

## Leyenda y convenciones

- `- [ ]` pendiente · `- [x]` hecha.
- **[Primer corte]**: la necesita el plan 003 para RF-313 ("RF-313 con la tabla mínima `actividades` del plan 005") y para el cómputo de falta por jornada (RF-311). El resto de la spec 005 no entra en el primer corte.
- **[Bloqueada por aclaración]**: no puede darse por terminada hasta que la coordinación responda la duda `[NECESITA ACLARACIÓN]` indicada. Las tareas que solo aplican un supuesto provisional y reversible del plan (S-1 a S-14) **no** están bloqueadas: citan el supuesto en el nombre del test y se ajustan si la respuesta lo contradice.
- **Depende de**: `T005-NN` son tareas de este archivo. Las demás specs aún no tienen `tasks.md`, así que se citan como `TNNN (pieza)`.
- **Tests**: cada test cita su RF o RNF en el nombre. Los de dominio van en `src/lib/<modulo>/__tests__/*.test.ts` (jest-expo); los de API, en `api/test/` (Jest + `ts-jest`, plan 001 D-115). `npm test` corre la app, la API y la integración con PostgreSQL en Docker (plan 001).
- **Cierre de cada tarea**: `npm test`, `npm run typecheck` y `npm run lint` pasan, sin tests omitidos ni debilitados. Un commit por tarea (Conventional Commits) con su registro Agent Trace enlazado al ID de la tarea (principio 9).
- **Dependencias nuevas**: ninguna. Compartir usa `Share` del núcleo de React Native (D-507), la huella usa `node:crypto` (incluido en Node) y WatermelonDB, `pg`, Jest y `expo-crypto` ya los justifican los planes 001 y 003. Por eso no hay tarea de justificación en la spec (principio 1). Si una tarea descubre que necesita una dependencia, se detiene y se añade antes una tarea que la justifique en `spec.md`.
- **Migraciones**: numeración provisional `05NN` (supuesto S-11). Toda tabla operativa lleva `ciclo_id` y el trigger de congelamiento del plan 008 (C-3), y las sincronizables llevan las columnas de control del plan 003 (`0300`). Una migración aplicada no se edita: los cambios posteriores van en migraciones aditivas.

## Fase 0 — Aporte al primer corte (actividades mínimas para RF-313)

- [ ] **T005-01** Acordar con el plan 003 el contrato entre actividad y sesión **[Primer corte]**
  - RF: RF-504, RNF-503
  - Depende de: T003 (modelo de `sesiones`, migración `0302_sesiones.sql`)
  - Hecho cuando: el plan 005 (§3.1, D-505) y el plan 003 (§3.1, §11) describen lo mismo en tres puntos que hoy difieren: (1) el nombre de la tabla (`actividad_obligatoria` en 005, `actividades` en 003); (2) la dirección del vínculo (`actividad_obligatoria.sesion_id` con `UNIQUE` en 005, `sesiones.actividad_id` en 003); (3) cómo nace el id de la sesión (UUID del dispositivo en D-505, UUID v5 determinista en D-302). También se fija la firma del puerto `crearSesionActividad`. El cambio queda en un commit `docs:` que solo toca los dos `plan.md`, y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-02** Definir los tipos y la validación de actividades obligatorias **[Primer corte]**
  - RF: RF-504
  - Depende de: T005-01, T001 (Jest y `npm test`)
  - Hecho cuando: existen `src/lib/actividades/tipos.ts` y `catalogo-actividades.ts` (`TIPOS_ACTIVIDAD` con los seis tipos y `validarActividad`) sin importar React, React Native ni Expo. Pasa el test `RF-504: valida nombre no vacío, tipo entre los seis permitidos y fecha`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-03** Implementar la regla de qué actividad suma falta **[Primer corte]**
  - RF: RF-504
  - Depende de: T005-02
  - Hecho cuando: `src/lib/actividades/falta-actividad.ts` exporta `actividadSumaFalta(actividad)` y pasan `RF-504: solo la jornada suma falta (supuesto S-5)` y `RF-504: una jornada cancelada no suma falta`. Queda lista para que la importe `faltasDelCiclo` del plan 003 (RF-311). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-04** Crear la migración `0505_actividades_obligatorias.sql` **[Primer corte]**
  - RF: RF-504, RNF-503
  - Depende de: T005-01, T008 (tabla `ciclo` y `ciclo_bloquear_si_cerrado()`), T001 (runner de migraciones y PostgreSQL en Docker)
  - Hecho cuando: la migración crea `actividad_obligatoria` y `cambio_actividad` (inmutable) con las columnas del plan §3.1, ajustadas al contrato de T005-01, más el trigger de congelamiento por ciclo. Pasan los tests de integración `RF-504: actividad_obligatoria exige sesion_id único` y `RNF-503: no existe tabla de cumplimiento de actividades` (inspección del esquema). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-05** Crear el módulo API `actividades` con su repositorio **[Primer corte]**
  - RF: RF-504
  - Depende de: T005-04
  - Hecho cuando: existen `api/src/modulos/actividades/dominio/indice.ts` (reexporta `src/lib/actividades`) y `infraestructura/repositorio-actividades-pg.ts`, con una implementación en memoria. La misma batería de contrato pasa contra ambas: `RF-504: el repositorio guarda una actividad y la lee por id y por ciclo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-06** Añadir las acciones de actividades a la matriz de permisos **[Primer corte]**
  - RF: RF-504
  - Depende de: T001 (`src/lib/seguridad/matriz-permisos.ts`)
  - Hecho cuando: la matriz tiene `actividad:gestionar` (coordinación y delegado) y `actividad:leer_cumplimiento` (coordinación: ciclo; catequista: sus grupos), y pasa `RF-504: solo la coordinación y su delegado gestionan actividades`. El PR lo revisa el dueño de seguridad (plan 001). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-07** Declarar la tabla local `actividades_obligatorias` **[Primer corte]**
  - RF: RF-504
  - Depende de: T005-02, T003 (mecanismo de extensión del esquema local, §3.3)
  - Hecho cuando: `src/lib/actividades/tablas-sincronizadas.ts` declara la tabla (pull por ciclo abierto; push solo coordinación), queda registrada en `src/lib/sincronizacion/registro-tablas.ts` y tiene un paso nuevo en `src/datos/local/migraciones.ts` con `schemaVersion` incrementado. Siguen en verde `Principio 7: ninguna tabla sincronizada contiene columnas restringidas` y pasa `RF-504: actividades_obligatorias baja por ciclo y solo la coordinación la sube`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-08** Sincronizar la creación de actividades y su sesión de asistencia **[Primer corte]**
  - RF: RF-504, RNF-503
  - Depende de: T005-05, T005-06, T005-07, T003 (puerto `crearSesionActividad` y registro de proveedores de sincronización)
  - Hecho cuando: `api/src/modulos/actividades/infraestructura/manejadores-sync.ts` atiende el pull (ciclo abierto) y el `create` de coordinación con `validarActividad`, e invoca `crearSesionActividad` en la misma transacción. Pasan `RF-504: crear actividad crea la sesión del plan 003 con el mismo sesion_id` y `RF-504: push de actividad por catequista se rechaza con el mecanismo del plan 003`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 1 — Dominio puro de oraciones

- [ ] **T005-09** Definir los tipos del seguimiento y validar el catálogo de oraciones
  - RF: RF-501
  - Depende de: T001 (Jest y `npm test`)
  - Hecho cuando: existen `src/lib/seguimiento/tipos.ts` (con `EstadoOracion = 'sabe' | 'aun_no' | 'sin_evaluar'`, sin valor "atrasada") y `catalogo-oraciones.ts` con `validarCatalogoOraciones`. Pasan `RF-501: rechaza catálogo con orden repetido, fuera de 1..10 o más de 10 oraciones` y `RF-501: rechaza mes sugerido fuera de 3..12`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-10** Impedir que se elimine una oración con historial
  - RF: RF-501
  - Depende de: T005-09
  - Hecho cuando: `puedeEliminarOracion(oracion, tieneEvaluaciones)` está en `catalogo-oraciones.ts` y pasa `RF-501: no permite eliminar una oración con evaluaciones`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-11** Calcular el valor efectivo y la evaluación vigente
  - RF: RF-502, RF-506
  - Depende de: T005-09
  - Hecho cuando: `src/lib/seguimiento/historial-evaluaciones.ts` exporta `valorEfectivo` y `evaluacionVigente`, genéricas para oraciones y doctrina. Pasan `RF-506: el valor efectivo es el último de la cadena de correcciones` y `RF-502: dos evaluaciones distintas, prevalece la más reciente (supuesto S-3)` (con desempate por `recibidoEn` y luego por `id`). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-12** Calcular el estado de una oración sin vencimientos
  - RF: RF-501, RF-502
  - Depende de: T005-11
  - Hecho cuando: `estadoOracion(historial, correcciones)` está en `src/lib/seguimiento/oraciones.ts` y no recibe la fecha actual. Pasan `RF-501: ninguna oración resulta atrasada pase el mes sugerido`, `RF-502: marca sabe antes del mes sugerido`, `RF-502: acepta evaluar en un día distinto del domingo de la evaluación del grupo` y `RF-502: sabe → aún no deja estado aún no y conserva ambas en el historial`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-13** Resumir las oraciones sabidas y las que faltan
  - RF: RF-502, RF-505
  - Depende de: T005-12
  - Hecho cuando: `resumenOraciones` y `contarOracionesSabidas` están en `oraciones.ts`. Pasan `RF-502: resumen cuenta sabidas sobre 10 y lista las faltantes en orden`, `RF-502: niño inscrito tarde tiene 10 oraciones y ninguna atrasada` y `RF-502: las pendientes se conservan tras cambiar de grupo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-14** Decidir quién puede evaluar
  - RF: RF-506
  - Depende de: T005-09, T001 (`SesionUsuario` y roles efectivos), T003 (tipo de la lista de catequesis confirmada por usuario y día)
  - Hecho cuando: `src/lib/seguimiento/permisos-evaluacion.ts` exporta `puedeEvaluar`. Pasan `RF-506: catequista del grupo evalúa; reemplazante solo el día de su lista confirmada` (supuesto S-8), `RF-506: coordinación sin rol de catequista del grupo no evalúa (supuesto S-10)` y `RF-506: niño retirado o ciclo cerrado no admite evaluación`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-15** Decidir quién puede corregir y hasta cuándo
  - RF: RF-506
  - Depende de: T005-14, T003 (`finDelDomingo` y parámetros del ciclo), T001 (delegación de coordinación)
  - Hecho cuando: `puedeCorregir` importa `finDelDomingo` del plan 003 sin duplicarla (D-511). Pasan `RF-506: evaluador corrige hasta el fin del día; después solo coordinación con motivo`, `RF-506: coordinación corrige durante el domingo solo con motivo (supuesto S-10)` y `RF-506: niño retirado no admite corrección`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 2 — Persistencia y sincronización de oraciones

- [ ] **T005-16** Añadir las acciones de seguimiento a la matriz de permisos
  - RF: RF-501, RF-505, RF-506
  - Depende de: T001 (`matriz-permisos.ts` y `avance:leer` de RF-103)
  - Hecho cuando: la matriz tiene `oracion:gestionar`, `evaluacion:registrar`, `evaluacion:corregir`, `pendientes:generar` y `pendientes_familia:leer` (alcance `apoderados`). Pasan `RF-506: la matriz concede evaluar a los catequistas del grupo y gestionar el catálogo solo a coordinación y delegado` y `RF-505: la familia solo lee pendientes con alcance de apoderado`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-17** Crear la migración `0501_catalogo_oraciones.sql`
  - RF: RF-501
  - Depende de: T005-09, T008 (tabla `ciclo` y trigger de congelamiento), T001 (runner de migraciones)
  - Hecho cuando: la tabla `oracion` tiene las restricciones del plan y no tiene columna de vencimiento ni de estado. Pasa `RF-501: la tabla oracion rechaza orden fuera de 1..10, mes fuera de 3..12 y orden repetido en el ciclo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-18** Crear la migración `0502_evaluaciones_oracion.sql`
  - RF: RF-502, RF-506
  - Depende de: T005-17, T002 (tablas `catequizando` y `grupo`), T003 (columnas de sincronización `0300`), T001 (rol `sigecat_retencion`)
  - Hecho cuando: `evaluacion_oracion` tiene el trigger que rechaza `UPDATE` y `DELETE` salvo al motor de retención, el índice `(catequizando_id, oracion_id, evaluado_en)` y el trigger de congelamiento por ciclo. Pasa `RF-502: la base rechaza UPDATE y DELETE de evaluacion_oracion salvo el rol de retención`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-19** Crear la migración `0504_correcciones_evaluacion.sql`
  - RF: RF-506
  - Depende de: T005-18
  - Hecho cuando: `correccion_evaluacion` es inmutable y tiene los `CHECK` del plan. `evaluacion_doctrina_id` se crea sin FK porque `0503` llega en la fase 4; la FK la añade T005-41 con una migración aditiva. Pasan `RF-506: corrección de coordinación sin motivo viola la restricción` y `RF-506: correccion_evaluacion exige exactamente una evaluación referida`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-20** Implementar el repositorio del catálogo de oraciones
  - RF: RF-501
  - Depende de: T005-17
  - Hecho cuando: existen `api/src/modulos/seguimiento/dominio/indice.ts` (reexporta `src/lib/seguimiento`) e `infraestructura/repositorio-catalogo-pg.ts` con su versión en memoria. La batería de contrato `RF-501: el repositorio lista el catálogo del ciclo en orden e indica si una oración tiene evaluaciones` pasa contra las dos. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-21** Implementar el repositorio de evaluaciones y correcciones
  - RF: RF-502, RF-506, RNF-502
  - Depende de: T005-18, T005-19, T005-20
  - Hecho cuando: `repositorio-evaluaciones-pg.ts` y su versión en memoria pasan la misma batería: `RF-502: el repositorio rechaza UPDATE y DELETE de evaluacion_oracion`, `RF-502: insertar dos veces el mismo UUID deja un solo registro` y `RF-506: el repositorio devuelve el historial con sus correcciones en orden`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-22** Registrar el participante de retención del avance formativo
  - RF: RF-502, RF-506
  - Depende de: T005-21, T001 (motor de retención y `registrarParticipanteRetencion`)
  - Hecho cuando: el módulo `seguimiento` registra su participante al arrancar. Pasan `RF-502: al retirar el consentimiento se borran las evaluaciones y correcciones del niño (RF-106)` y `RF-502: a los 2 años del cierre se anonimizan las evaluaciones del ciclo (RF-108)`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-23** Declarar las tablas locales de oraciones
  - RF: RF-501, RF-502, RF-506, RNF-502
  - Depende de: T005-09, T003 (mecanismo de extensión del esquema local, §3.3)
  - Hecho cuando: `src/lib/seguimiento/tablas-sincronizadas.ts` declara `oraciones`, `evaluaciones_oracion` y `correcciones_evaluacion` con el sentido y el alcance del plan §3.2, quedan registradas y hay un paso nuevo de migración local con `schemaVersion` incrementado. Siguen en verde `Principio 7: ninguna tabla sincronizada contiene columnas restringidas` y pasa `RNF-502: evaluaciones_oracion y correcciones_evaluacion solo admiten created`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-24** Sincronizar el catálogo de oraciones
  - RF: RF-501
  - Depende de: T005-10, T005-16, T005-20, T005-23, T003 (registro de proveedores y mecanismo de rechazo)
  - Hecho cuando: `api/src/modulos/seguimiento/infraestructura/manejadores-sync.ts` atiende `oraciones`: pull del ciclo abierto y push de coordinación validado con `validarCatalogoOraciones`, con `delete` solo si no hay evaluaciones. Pasan `RF-501: push de catálogo por catequista → 403` y `RF-501: push que deja un catálogo inválido o elimina una oración con evaluaciones se rechaza`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-25** Recibir evaluaciones de oraciones de forma idempotente
  - RF: RF-502, RNF-502
  - Depende de: T005-21, T005-23, T003 (push por proveedor), T008 (descarte de registros que llegan tras el cierre, RF-802)
  - Hecho cuando: el manejador de `evaluaciones_oracion` acepta solo `created`, inserta con `ON CONFLICT (id) DO NOTHING`, fija `recibido_en` y descarta lo que llega con el ciclo cerrado. Pasan `RF-502: push repetido del mismo lote no duplica`, `RF-502: update de una evaluación se rechaza` y `RNF-502: una evaluación hecha sin señal y enviada días después se acepta con su evaluado_en`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-26** Autorizar las evaluaciones en el servidor
  - RF: RF-506, RNF-502
  - Depende de: T005-14, T005-25, T002 (`FuenteInscripciones`: grupo actual y niño activo), T003 (listas confirmadas por usuario y día)
  - Hecho cuando: el manejador aplica `puedeEvaluar` con datos del servidor y rechaza por el protocolo del plan 003, sin pérdidas silenciosas. Pasan `RF-506: push de evaluación de un catequista ajeno al grupo sin lista ese día → rechazado` y `RF-506: push de evaluación del reemplazante con lista confirmada el mismo día → aceptado; al día siguiente → rechazado`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-27** Bajar al celular solo las evaluaciones del alcance propio
  - RF: RF-502, RF-506
  - Depende de: T005-25, T003 (`filtroPull` y `huellaAlcance`)
  - Hecho cuando: el pull de `evaluaciones_oracion` y `correcciones_evaluacion` filtra a los grupos propios (la coordinación ve todo). Pasan `RF-502: el pull de un catequista incluye las evaluaciones de sus grupos` y `RF-506: el pull del reemplazante no incluye evaluaciones de grupos ajenos (D-509)`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-28** Recibir las correcciones de evaluaciones
  - RF: RF-506, RNF-502
  - Depende de: T005-15, T005-21, T005-23, T003 (mecanismo de rechazo con aviso)
  - Hecho cuando: el manejador de `correcciones_evaluacion` acepta solo `created`, aplica `puedeCorregir` con la hora efectiva y exige que `valor_anterior` coincida con el valor efectivo en el servidor. Pasan `RF-506: corrección con valor_anterior desactualizado se rechaza con aviso` y `RF-506: corrección de otro catequista se rechaza; la del evaluador el mismo día se acepta`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 3 — Pantallas de oraciones y flujo sin conexión

- [ ] **T005-29** Modelar la lista de evaluación con un toque por niño
  - RF: RF-502, RNF-501
  - Depende de: T005-13
  - Hecho cuando: `oraciones.ts` exporta `alternarMarca` y `evaluacionesDeLista(borrador, contexto, generarId)`, con el generador de UUID inyectado para que `src/lib` no importe Expo. Pasan `RNF-501: un toque alterna sin marcar → sabe → aún no → sin marcar` y `RNF-501: guardar genera solo las evaluaciones de los niños marcados`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-30** Crear el componente de lista de evaluación
  - RF: RF-502, RNF-501, RNF-502
  - Depende de: T005-29, T005-23, T003 (base local WatermelonDB en el cliente)
  - Hecho cuando: `src/components/avance-formativo/lista-evaluacion.tsx` mantiene el borrador en pantalla y guarda con un solo `database.write` (D-508). Pasa `RNF-501: guardar la lista escribe todas las evaluaciones en una sola transacción local`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-31** Crear la pantalla para elegir la oración a evaluar
  - RF: RF-501, RF-502
  - Depende de: T005-23, T001 (grupo de rutas `(equipo)`)
  - Hecho cuando: `src/app/(equipo)/grupos/[grupoId]/oraciones/index.tsx` lista el catálogo desde la base local. Pasan `RF-501: la pantalla muestra orden y mes sugerido como guía y nunca "atrasada"` y `RF-501: con menos de 10 oraciones avisa "catálogo incompleto" (supuesto S-2)`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-32** Crear la pantalla de evaluación de una oración para el grupo
  - RF: RF-502, RF-506, RNF-501, RNF-502
  - Depende de: T005-14, T005-30, T005-31, T003 (contador de pendientes de envío)
  - Hecho cuando: `src/app/(equipo)/grupos/[grupoId]/oraciones/[oracionId].tsx` usa la lista de evaluación y delega en `puedeEvaluar`. Pasan `RF-506: el catequista del grupo ve el estado vigente y el reemplazante solo la nómina` y `RNF-502: la pantalla muestra el contador de pendientes de envío`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-33** Exponer el avance formativo de un niño (oraciones)
  - RF: RF-502
  - Depende de: T005-13, T005-16, T005-21, T001 (middleware `conAcceso`)
  - Hecho cuando: `seguimientoAvanceNino` (`GET /catequizandos/{id}/avance-formativo`, en `aplicacion/consulta-avance.ts` y `http/avance-nino.ts`) devuelve el resumen de oraciones. Pasan `RF-502: avance-formativo devuelve sabidas sobre 10 y faltantes` y `RF-502: un catequista de otro grupo recibe 403 fuera_de_alcance`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-34** Exponer el historial de una oración
  - RF: RF-502, RF-506
  - Depende de: T005-33
  - Hecho cuando: `seguimientoHistorialOracion` (`GET /catequizandos/{id}/oraciones/{oracionId}/historial`) responde. Pasan `RF-506: el historial incluye evaluaciones y correcciones con valor anterior, autor y fecha` y `RF-506: un catequista de otro grupo recibe 403 en el historial`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-35** Mostrar el resumen de oraciones en el perfil del niño
  - RF: RF-502
  - Depende de: T005-13, T005-23, T002 (`ProveedorResumenPerfil` y pantalla de perfil)
  - Hecho cuando: `src/components/avance-formativo/resumen-avance.tsx` se registra como proveedor del perfil y lee la base local. Pasa `RF-502: el perfil muestra "Sabe X de 10" y las oraciones que faltan con datos locales`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-36** Crear la pantalla de historial y corrección de una evaluación
  - RF: RF-502, RF-506
  - Depende de: T005-15, T005-23
  - Hecho cuando: `src/app/(equipo)/catequizandos/[id]/oraciones/[oracionId].tsx` muestra el historial y crea la fila local de `correcciones_evaluacion`. Pasan `RF-506: "Corregir" solo aparece cuando puedeCorregir lo permite` y `RF-506: la coordinación no puede confirmar una corrección sin motivo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-37** Crear la pantalla del catálogo de oraciones para la coordinación
  - RF: RF-501
  - Depende de: T005-09, T005-23, T001 (grupo de rutas `(coordinacion)`)
  - Hecho cuando: `src/app/(coordinacion)/catalogo/oraciones.tsx` guarda en la base local y valida con `validarCatalogoOraciones`. Pasa `RF-501: el formulario rechaza orden repetido o mes fuera de marzo–diciembre`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-38** Probar la evaluación por lista sin conexión de extremo a extremo
  - RF: RF-502, RNF-501, RNF-502
  - Depende de: T005-24, T005-26, T005-27, T005-28, T005-32, T005-35, T003 (motor de sincronización en el cliente)
  - Hecho cuando: pasa `RNF-502 / RNF-501: catequista sin conexión evalúa una oración para todo su grupo en una lista, reconecta y el perfil muestra X de 10` (cliente con almacén en memoria y API contra PostgreSQL). `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 4 — Doctrina

- [ ] **T005-39** Validar valores contra la escala de doctrina
  - RF: RF-503
  - Depende de: T005-09
  - Hecho cuando: `src/lib/seguimiento/doctrina.ts` exporta `validarValorEnEscala` y `puedeCambiarEscala`. Pasan `RF-503: rechaza valor fuera de la escala de niveles o del rango numérico` y `RF-503: la escala no cambia si ya hay evaluaciones`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-40** Calcular la situación en doctrina
  - RF: RF-503, RF-506
  - Depende de: T005-11, T005-39
  - Hecho cuando: `situacionDoctrina` devuelve el resultado por instrumento sin decidir si "cumple" (eso es del plan 006). Pasan `RF-503: rechaza valor fuera de la escala; situación sin evaluaciones = sinEvaluaciones`, `RF-503: situación por instrumento usa el valor efectivo tras corrección` y `RF-503: un instrumento cancelado no cuenta en la situación`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-41** Crear la migración `0503_doctrina.sql` y la FK pendiente de correcciones
  - RF: RF-503, RF-506
  - Depende de: T005-19, T008 (trigger de congelamiento)
  - Hecho cuando: existen `escala_doctrina`, `instrumento_doctrina` y `evaluacion_doctrina`, esta última inmutable como `evaluacion_oracion`. Una migración aditiva `05NN_fk_correccion_doctrina.sql` añade la FK de `correccion_evaluacion.evaluacion_doctrina_id`. Pasan `RF-503: evaluacion_doctrina exige exactamente un valor` y `RF-503: la base rechaza UPDATE y DELETE de evaluacion_doctrina salvo el rol de retención`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-42** Implementar el repositorio de doctrina y ampliar la retención
  - RF: RF-503
  - Depende de: T005-22, T005-41
  - Hecho cuando: el repositorio en PostgreSQL y en memoria pasa `RF-503: insertar dos veces la misma evaluación de doctrina deja un solo registro`. El participante de retención incluye doctrina y pasa `RF-503: al retirar el consentimiento se borran las evaluaciones de doctrina (RF-106)`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-43** Declarar las tablas locales de doctrina
  - RF: RF-503, RNF-502
  - Depende de: T005-23, T005-39
  - Hecho cuando: `escalas_doctrina`, `instrumentos_doctrina` y `evaluaciones_doctrina` están declaradas y registradas, con un paso nuevo de migración local. Siguen en verde `Principio 7: ninguna tabla sincronizada contiene columnas restringidas` y pasa `RNF-502: evaluaciones_doctrina solo admite created`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-44** Sincronizar la escala y los instrumentos de doctrina
  - RF: RF-503
  - Depende de: T005-16, T005-42, T005-43
  - Hecho cuando: los manejadores de `escalas_doctrina` e `instrumentos_doctrina` aceptan `create` y `update` de coordinación o delegado. Pasan `RF-503: push de escala o instrumento por catequista se rechaza` y `RF-503: cambiar la escala con evaluaciones se rechaza`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-45** Recibir evaluaciones de doctrina y sus correcciones
  - RF: RF-503, RF-506, RNF-502
  - Depende de: T005-26, T005-28, T005-42, T005-43
  - Hecho cuando: el manejador de `evaluaciones_doctrina` (solo `create`, idempotente) aplica `puedeEvaluar` y `validarValorEnEscala`, y el de correcciones acepta también las de doctrina. Pasan `RF-503: push de evaluación de doctrina con valor fuera de la escala se rechaza`, `RF-506: push de evaluación de doctrina de un catequista ajeno sin lista ese día se rechaza` y `RF-506: corrección de doctrina con valor_anterior desactualizado se rechaza`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-46** Crear la pantalla del catálogo de doctrina
  - RF: RF-503
  - Depende de: T005-37, T005-43
  - Hecho cuando: `src/app/(coordinacion)/catalogo/doctrina.tsx` crea la escala y los instrumentos en la base local. Pasa `RF-503: el formulario crea una escala de tres niveles y sus instrumentos periódicos (supuesto S-1)`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-47** Crear la pantalla de evaluación de doctrina para el grupo
  - RF: RF-503, RNF-502
  - Depende de: T005-30, T005-40, T005-43
  - Hecho cuando: `doctrina.ts` exporta `alternarNivel(escala, actual)` y `src/app/(equipo)/grupos/[grupoId]/doctrina/[instrumentoId].tsx` reutiliza la lista de evaluación. Pasan `RF-503: el toque recorre los niveles de la escala y vuelve a sin marcar` y `RNF-502: la lista de doctrina se guarda sin conexión en una sola transacción`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-48** Mostrar la doctrina en el perfil y en el avance formativo
  - RF: RF-503
  - Depende de: T005-33, T005-35, T005-40, T005-45
  - Hecho cuando: `resumen-avance.tsx` y `seguimientoAvanceNino` incluyen la situación en doctrina. Pasan `RF-503: el perfil muestra la situación en doctrina por instrumento` y `RF-503: avance-formativo incluye la situación en doctrina`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-49** Cerrar el método y la escala definitivos de doctrina **[Bloqueada por aclaración]**
  - RF: RF-503
  - Depende de: T005-46, T005-47
  - Bloqueada por: duda 1 de la spec ("¿Cómo se evalúa la doctrina y con qué escala?"), supuesto S-1.
  - Hecho cuando: la coordinación confirma el método y la escala; `spec.md` (RF-503 y dudas) y `plan.md` (S-1) se actualizan sin la marca de aclaración; si el método no encaja en "instrumento + escala" o la escala es numérica, se añade una migración aditiva y se adapta la captura; la escala real queda cargada en el ciclo abierto. Pasa `RF-503: la escala definitiva acepta sus valores y rechaza los demás`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 5 — Actividades obligatorias y cumplimiento

- [ ] **T005-50** Decidir si una actividad se puede reprogramar
  - RF: RF-504
  - Depende de: T005-02
  - Hecho cuando: `puedeReprogramar(actividad, tieneAsistencias)` está en `catalogo-actividades.ts` y pasa `RF-504: reprogramada solo sin asistencias; con asistencias hay que cancelar y crear otra`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-51** Calcular el cumplimiento a partir de la asistencia
  - RF: RF-504, RNF-503
  - Depende de: T005-02, T003 (tipos de asistencia consolidada y registradores), T004 (forma de la justificación aprobada)
  - Hecho cuando: `src/lib/actividades/cumplimiento.ts` exporta `estadoCumplimiento`. Pasan `RF-504: presente en la sesión = cumplida con su registrador` y `RF-504: ausente sin justificar = no cumplida; justificada aprobada = justificada`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-52** Cubrir los casos límite del cumplimiento
  - RF: RF-504
  - Depende de: T005-03, T005-51
  - Hecho cuando: pasan `RF-504: actividad cancelada no se cuenta ni suma falta`, `RF-504: actividad aún no realizada queda pendiente`, `RF-504: actividad anterior a la inscripción = no_aplica (supuesto S-9)` y `RF-504: cada día de una actividad de varios días se cumple por separado (supuesto S-4)`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-53** Vincular en la base la sesión y la actividad
  - RF: RF-504, RNF-503
  - Depende de: T005-01, T005-04, T003 (migración `0302_sesiones.sql`)
  - Hecho cuando: una migración aditiva crea la FK en la dirección acordada en T005-01. Pasa `RF-504: no se puede crear una sesión de tipo actividad con una actividad inexistente`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-54** Cancelar y reprogramar actividades por sincronización
  - RF: RF-504
  - Depende de: T005-08, T005-50, T005-53, T003 (puerto para cancelar o mover la sesión de una actividad)
  - Hecho cuando: el manejador de `actividades_obligatorias` acepta `update` de coordinación, registra `cambio_actividad` y propaga la fecha o el estado a la sesión. Pasan `RF-504: cancelar una actividad registra cambio_actividad y cancela su sesión` y `RF-504: reprogramar una actividad con asistencias se rechaza`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-55** Avisar al riesgo de deserción cuando cambia una jornada
  - RF: RF-504
  - Depende de: T005-54, T007 (`marcarRecalculoPendiente`)
  - Hecho cuando: cancelar o reprogramar una jornada marca el recálculo de los niños afectados en la misma transacción. Pasa `RF-504: cancelar una jornada marca el recálculo de riesgo de los niños afectados`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-56** Exponer el cumplimiento de una actividad
  - RF: RF-504, RNF-503
  - Depende de: T005-06, T005-52, T003 (`consultarCumplimientoActividad`), T004 (`FuenteJustificacionesAprobadas`), T001 (`identidadOperativa`)
  - Hecho cuando: `actividadesCumplimiento` (`GET /actividades/{id}/cumplimiento`, en `aplicacion/consultar-cumplimiento.ts` y `http/cumplimiento.ts`) lee la asistencia sin un segundo registro. Pasan `RF-504: cumplimiento por catequista solo incluye niños de sus grupos` y `RF-504: el cumplimiento muestra quién registró la asistencia con su identidad operativa`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-57** Mostrar las actividades en el perfil y en el avance formativo
  - RF: RF-504
  - Depende de: T005-33, T005-35, T005-52, T003 (tablas locales de sesiones y asistencias)
  - Hecho cuando: `resumen-avance.tsx` calcula el cumplimiento en local y `seguimientoAvanceNino` lo incluye. Pasan `RF-504: el perfil lista actividades cumplidas, no cumplidas y justificadas con quién registró` y `RF-504: avance-formativo incluye las actividades del ciclo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-58** Crear la pantalla de gestión de actividades
  - RF: RF-504
  - Depende de: T005-07, T005-50, T005-54
  - Hecho cuando: `src/app/(coordinacion)/actividades/index.tsx` crea, cancela y reprograma en la base local. Pasan `RF-504: crear una actividad sin conexión la guarda en local con un sesion_id nuevo` y `RF-504: "Reprogramar" se deshabilita si la actividad tiene asistencias`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-59** Crear la pantalla de detalle con quién cumplió
  - RF: RF-504
  - Depende de: T005-56, T005-58
  - Hecho cuando: `src/app/(coordinacion)/actividades/[actividadId].tsx` muestra el cumplimiento (HU-503). Pasa `RF-504: el detalle lista quién cumplió y quién no`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 6 — Oraciones pendientes

- [ ] **T005-60** Construir la lista de pendientes de un grupo
  - RF: RF-505
  - Depende de: T005-13
  - Hecho cuando: `src/lib/seguimiento/lista-pendientes.ts` exporta `construirListaPendientes`. Pasan `RF-505: la lista incluye solo niños con pendientes y es determinista` y `RF-505: usa nombres e inicial del apellido y dos iniciales si hay homónimos (supuesto S-14)`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-61** Crear la migración `0506_listas_pendientes.sql` y su repositorio
  - RF: RF-505
  - Depende de: T005-20, T008 (trigger de congelamiento), T001 (runner de migraciones)
  - Hecho cuando: `lista_pendientes_generada` y `repositorio-listas-pg.ts` (con versión en memoria) existen. Pasan `RF-505: lista_pendientes_generada no tiene columnas con datos de niños` y `RF-505: guardar dos veces la misma lista por id deja un solo registro`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-62** Exponer las oraciones pendientes a la familia
  - RF: RF-505
  - Depende de: T005-13, T005-16, T005-21, T001 (enlace de familia y alcance de apoderado), T002 (`vinculo_apoderado`)
  - Hecho cuando: `seguimientoPendientesFamilia` (`GET /familia/hijos/{id}/oraciones-pendientes`) responde. Pasan `RF-505: familia consulta pendientes de un niño que no es su hijo → rechazado sin revelar existencia` y `RF-505: la respuesta de familia solo trae sabidas, total y nombres de oraciones faltantes`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-63** Generar en el servidor la lista para compartir
  - RF: RF-505
  - Depende de: T005-16, T005-21, T005-60, T005-61
  - Hecho cuando: `seguimientoGenerarLista` (`POST /grupos/{grupoId}/listas-oraciones-pendientes`) es idempotente por `id` y calcula `huella_sha256` con `node:crypto`. Pasan `RF-505: generar lista registra quién y cuándo, huella reproducible al corte_en; sin advertenciaAceptada → 400`, `RF-505: repetir la generación con el mismo id no crea otro registro` y `RF-505: la lista coincide con las evaluaciones registradas al corte_en`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-64** Exponer el historial de listas generadas
  - RF: RF-505
  - Depende de: T005-61, T001 (`identidadOperativa`)
  - Hecho cuando: `seguimientoListasGeneradas` (`GET /grupos/{grupoId}/listas-oraciones-pendientes`) responde. Pasan `RF-505: el historial muestra quién generó cada lista (seudónimo si es menor) y cuándo` y `RF-505: un catequista recibe 403 al pedir el historial de listas`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-65** Configurar las políticas de APIM de pendientes
  - RF: RF-505
  - Depende de: T005-62, T005-63, T001 (políticas base de APIM en Bicep)
  - Hecho cuando: la plantilla de APIM del plan 001 aplica `rate-limit-by-key` de 10 llamadas por minuto por `sub` al `POST` de listas y el CORS de Static Web Apps a `GET /familia/...`. La validación de plantillas del plan 001 no da errores y, en el entorno de pruebas, la undécima llamada en un minuto responde 429. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-66** Crear la pantalla de oraciones pendientes para la familia
  - RF: RF-505
  - Depende de: T005-62, T001 (grupo de rutas `(familia)` y sesión web)
  - Hecho cuando: `src/app/(familia)/hijos/[id]/oraciones.tsx` (Expo web) consulta en línea (D-512). Pasan `RF-505: la pantalla de familia muestra "Sabe X de 10" y las oraciones que faltan de cada hijo` y `RF-505: sin conexión la pantalla de familia avisa que necesita conexión`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-67** Crear la pantalla para generar y compartir la lista del grupo
  - RF: RF-505
  - Depende de: T005-63, T005-64
  - Hecho cuando: `src/app/(coordinacion)/grupos/[grupoId]/pendientes.tsx` muestra la advertencia de exposición (S-6), genera la lista, la comparte con `Share.share({ message })` (en web, Web Share o texto seleccionable) y muestra el historial. Pasan `RF-505: no se puede generar sin aceptar la advertencia`, `RF-505: sin conexión la pantalla avisa que exige conexión y no genera` y `RF-505: compartir usa el texto devuelto por el servidor`. `package.json` no tiene dependencias nuevas (D-507). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-68** Confirmar la exposición de la lista por grupo antes de habilitarla **[Bloqueada por aclaración]**
  - RF: RF-505
  - Depende de: T005-67
  - Bloqueada por: duda 6 de la spec (la lista expone el avance de cada niño a todos los padres del grupo y queda fuera del control de acceso y la retención), supuesto S-6.
  - Hecho cuando: la coordinación acepta por escrito la exposición y el texto de la advertencia, y `spec.md` registra la decisión sin la marca de aclaración. Si no la acepta, se desactiva `seguimientoGenerarLista` y se oculta la pantalla. Pasa `RF-505: la advertencia muestra el texto aprobado por la coordinación` (o, si se rechaza, `RF-505: generar lista responde 404 cuando la función está desactivada`). `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 7 — Integración con el plan 006, extremo a extremo y prueba de campo

- [ ] **T005-69** Exponer el puerto `ConsultaAvanceFormativo` al plan 006
  - RF: RF-502, RF-503
  - Depende de: T005-21, T005-42, T006 (contrato del puerto)
  - Hecho cuando: `oracionesSabidas(catequizandoIds)` y `situacionDoctrina(catequizandoIds)` están disponibles como llamada interna. Pasan `RF-502: ConsultaAvanceFormativo devuelve las mismas oraciones sabidas que el resumen del perfil` y `RF-503: ConsultaAvanceFormativo devuelve la situación en doctrina por niño`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-70** Notificar el recálculo de aptitud al aplicar evaluaciones o correcciones
  - RF: RF-506
  - Depende de: T005-25, T005-28, T005-45, T006 (observador de recálculo)
  - Hecho cuando: el push de evaluaciones y correcciones notifica al observador del plan 006 (RF-603). Pasa `RF-506: aplicar una evaluación o una corrección notifica el recálculo de aptitud del niño`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-71** Probar que la asistencia a una actividad cuenta como cumplida
  - RF: RF-504, RNF-503
  - Depende de: T005-56, T005-57, T003 (registro de asistencia a actividades, RF-313)
  - Hecho cuando: pasa el test extremo a extremo `RNF-503: asistencia registrada en una actividad aparece como cumplida sin otro registro`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-72** Probar que faltar a una jornada suma una falta
  - RF: RF-504
  - Depende de: T005-03, T005-54, T003 (`faltasDelCiclo`, RF-311)
  - Hecho cuando: pasa `RF-504: inasistencia no justificada a una jornada suma una falta en el cómputo del plan 003`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-73** Probar que la lista y la vista de familia coinciden con las evaluaciones
  - RF: RF-505
  - Depende de: T005-63, T005-66
  - Hecho cuando: pasa `RF-505: la lista del grupo coincide con las evaluaciones y el apoderado ve solo las de su hijo`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-74** Cargar el catálogo real de las 10 oraciones **[Bloqueada por aclaración]**
  - RF: RF-501
  - Depende de: T005-37
  - Bloqueada por: duda 2 de la spec ("¿Cuáles son las 10 oraciones y su orden?"), supuesto S-2.
  - Hecho cuando: la coordinación confirma nombres, orden y mes sugerido; `spec.md` registra la respuesta sin la marca de aclaración; el catálogo del ciclo abierto queda cargado desde la pantalla de coordinación y la pantalla de evaluación ya no muestra "catálogo incompleto". `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-75** Hacer la prueba de campo de la evaluación por lista
  - RF: RNF-501
  - Depende de: T005-38, T005-74
  - Hecho cuando: un catequista evalúa una oración para su grupo real con la lista, se cronometra frente a la práctica actual y queda constancia (fecha, grupo, número de niños, tiempos y observaciones) donde el plan 003 guarde sus pruebas de campo. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T005-76** Verificar la cobertura de requisitos de la spec 005
  - RF: RF-501, RF-502, RF-503, RF-504, RF-505, RF-506, RNF-501, RNF-502, RNF-503
  - Depende de: T005-01 a T005-75
  - Hecho cuando: `npm test -- -t "<id>"` encuentra al menos un test en verde para cada uno de los nueve identificadores, y la matriz §10 del plan coincide con los tests reales (si no, se corrige primero el plan). `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Cobertura

| Requisito | Tareas |
| --- | --- |
| RF-501 | T005-09, T005-10, T005-12, T005-16, T005-17, T005-20, T005-23, T005-24, T005-31, T005-37, T005-74 |
| RF-502 | T005-11, T005-12, T005-13, T005-18, T005-21, T005-22, T005-23, T005-25, T005-27, T005-29, T005-30, T005-31, T005-32, T005-33, T005-34, T005-35, T005-36, T005-38, T005-69 |
| RF-503 | T005-39, T005-40, T005-41, T005-42, T005-43, T005-44, T005-45, T005-46, T005-47, T005-48, T005-49, T005-69 |
| RF-504 | T005-01, T005-02, T005-03, T005-04, T005-05, T005-06, T005-07, T005-08, T005-50, T005-51, T005-52, T005-53, T005-54, T005-55, T005-56, T005-57, T005-58, T005-59, T005-71, T005-72 |
| RF-505 | T005-13, T005-16, T005-60, T005-61, T005-62, T005-63, T005-64, T005-65, T005-66, T005-67, T005-68, T005-73 |
| RF-506 | T005-11, T005-14, T005-15, T005-16, T005-18, T005-19, T005-21, T005-22, T005-23, T005-26, T005-27, T005-28, T005-32, T005-34, T005-36, T005-40, T005-41, T005-45, T005-70 |
| RNF-501 | T005-29, T005-30, T005-32, T005-38, T005-75 |
| RNF-502 | T005-21, T005-23, T005-25, T005-26, T005-28, T005-30, T005-32, T005-38, T005-43, T005-45, T005-47 |
| RNF-503 | T005-01, T005-04, T005-08, T005-51, T005-53, T005-56, T005-71 |

Además, T005-76 verifica todos los requisitos de la tabla.

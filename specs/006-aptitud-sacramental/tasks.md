# Tareas 006 — Aptitud sacramental

> Tareas para implementar [spec.md](spec.md) según [plan.md](plan.md). Reglas: [constitución](../../docs/constitution.md) y [AGENTS.md](../../AGENTS.md).
> Esta spec no entra en el primer corte. Su fase 1 (dominio puro) solo necesita la configuración de Jest del plan 001 y puede adelantarse.

**Total: 76 tareas, de las cuales 4 están bloqueadas por aclaración.**

## Leyenda

- `- [ ]` pendiente · `- [x]` hecha.
- **[Bloqueada por aclaración]**: la tarea depende de una duda `[NECESITA ACLARACIÓN]` de la spec que el plan no puede resolver con un supuesto. No se empieza hasta que el equipo responda la duda y la spec se actualice. Al lado se indica la duda.
- **Supuesto S-n**: la tarea aplica un supuesto provisional y reversible del plan (§11). No está bloqueada.
- **Dependencias de otras specs**: se citan como `TNNN-XX` cuando su `tasks.md` ya numera la pieza. Si no, se citan como `TNNN (pieza)`, con la pieza que nombra su plan (001 y 008 aún no tienen `tasks.md`).
- **Tamaño**: cada tarea es de 20 a 30 minutos como máximo. Cada una termina con sus tests en verde y con `npm test`, `npm run typecheck` y `npm run lint` pasando (principio 4). Las tareas de dominio escriben primero el test, que empieza en rojo, y después la implementación.
- **Nombres de tests**: cada test cita el requisito que verifica (`RF-6xx: …`, `RNF-6xx: …`).
- **Dependencias nuevas**: ninguna (plan §2, principio 1). Se usan WatermelonDB y NetInfo, que justifica el plan 003; `jest-expo` y `@testing-library/react-native`, que justifica el plan 001; y `Share`, que viene en el núcleo de React Native. Si una tarea llegara a necesitar otra dependencia, primero va una tarea que la justifique en la spec.
- **Rutas del cliente**: las pantallas `aptitud/*` van dentro del grupo de rutas que fije el plan 001 (p. ej. `(equipo)`). La vista de familia va en `(familia)`.
- **Expo**: antes de usar una API de Expo o React Native (NetInfo, `Share`), consulta https://docs.expo.dev/versions/v57.0.0/.

## Fase 1 — Dominio puro (`src/lib/sacramental/`)

- [ ] **T006-01** Crear los tipos del dominio sacramental
  - RF: RF-601, RF-602, RF-603
  - Depende de: T001 (Jest y scripts `test`/`typecheck`, F0-2), T001 (regla ESLint que prohíbe importar React/RN/Expo en `src/lib`, F0-2)
  - Hecho cuando: `src/lib/sacramental/tipos.ts` exporta `UmbralesAptitud`, `CriterioDoctrina` (unión con la variante provisional `porcentaje_logrado`), `EstadoDimension`, `SituacionDoctrina`, `ResultadoPropuesta`, `CodigoRegla`, `DimensionesNino` y `Propuesta`, además de los tipos de entrada (misa, evaluación de oración, evaluación de doctrina, saldo, niño de la nómina) y las constantes `RESULTADOS_PROPUESTA` y `CODIGOS_REGLA`. Pasa el test `__tests__/tipos.test.ts` «RF-603: los resultados posibles son exactamente apto, no_apto, a_revisar y sin_propuesta». `npm test`, `npm run typecheck` y `npm run lint` pasan, y el lint no encuentra importaciones de React, RN ni Expo.

- [ ] **T006-02** Escribir el test exhaustivo de la regla y declarar `TABLA_REGLA`
  - RF: RNF-602, RF-601
  - Depende de: T006-01
  - Hecho cuando: primero se escribe `__tests__/regla-aptitud.tabla.test.ts`, que empieza en rojo. Genera el producto cartesiano misa (3) × oraciones (3) × doctrina (4) = 36 entradas. Después se declara en `regla-aptitud.ts` la tabla `TABLA_REGLA` de 12 filas más la condición R0, y la función `buscarFila`. Pasan «RNF-602: cada una de las 36 combinaciones da exactamente un resultado definido» y «RF-601: toda combinación con algún sin_umbral da sin_propuesta (R0)». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-03** Implementar `proponerAptitud` con el test de las 12 combinaciones
  - RF: RF-603, RNF-602
  - Depende de: T006-02
  - Hecho cuando: el test `test.each(TABLA_ESPERADA)` de `__tests__/regla-aptitud.test.ts` copia la tabla del plan §4 y pasa con las 12 filas. Incluye «RF-603: misa C, oraciones N, doctrina S ⇒ a_revisar (R5)», «RF-603: misa C, oraciones N, doctrina N ⇒ no_apto (R3)» y «RF-603: sin misa ⇒ no_apto aunque cumpla oraciones y doctrina (R1)». La fila 3 se nombra «RF-603 (supuesto S-1): misa C, oraciones C, doctrina S ⇒ apto (R2)». R0 se evalúa antes que el resto. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-04** Fijar la fila 3 de la regla según la aclaración **[Bloqueada por aclaración]** (RF-603 se contradice para «misa C + oraciones C + doctrina sin evaluación»: una viñeta dice «apto, cumpla o no doctrina» y otra dice «sin evaluación ⇒ a revisar». El plan lo trata como S-1 / D-604)
  - RF: RF-603, RNF-602
  - Depende de: T006-03
  - Hecho cuando: el equipo resolvió la duda en `spec.md`, y la fila 3 de `TABLA_REGLA` y de `TABLA_ESPERADA` refleja la respuesta. El test de esa fila cambia su nombre y deja de citar S-1. El test exhaustivo de T006-02 sigue pasando. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-05** Explicar la propuesta con la regla y los valores de cada dimensión
  - RF: RNF-601
  - Depende de: T006-03
  - Hecho cuando: `explicarPropuesta(propuesta)` en `regla-aptitud.ts` devuelve, para cada dimensión, su estado, su valor, su umbral y un texto (p. ej. «Misa: 2 de 3 ausencias no justificadas»), además del texto de la regla aplicada. Pasan «RNF-601: las 36 combinaciones traen la regla aplicada y el valor de las tres dimensiones» y «RNF-601: la explicación indica qué dimensiones cumple y cuáles no». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-06** Validar umbrales y elegir la versión vigente
  - RF: RF-601
  - Depende de: T006-01
  - Hecho cuando: `umbrales.ts` exporta `validarUmbrales`, `umbralesCompletos` y `umbralVigente`. Pasan estos tests:
    - «RF-601: ninguno de los 7 subconjuntos con algún umbral faltante está completo»
    - «RF-601: rechaza un máximo de ausencias negativo o no entero y un mínimo de oraciones fuera de 0..10»
    - «RF-601: rechaza un criterio de doctrina de tipo desconocido o con mínimo fuera de 0..100»
    - «RF-601: la versión vigente es la de mayor fijado_en, con desempate por recibido_en»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-07** Calcular la dimensión misa: conteo base
  - RF: RF-602
  - Depende de: T006-01
  - Hecho cuando: `calcularMisa(entrada, umbrales)` en `dimension-misa.ts` devuelve `{ ausenciasSistema, ausenciasPapel, total, maximo, estado }`. Pasan estos tests:
    - «RF-602: una ausencia con justificación aprobada no cuenta»
    - «RF-602: una ausencia con justificación pendiente, rechazada o sin efecto sí cuenta»
    - «RF-602: un domingo sin misa no cuenta»
    - «RF-602: una misa con la ventana abierta no cuenta»
    - «RF-602: cumple con total igual al máximo y no cumple con máximo + 1»
    - «RF-602: sin máximo fijado el estado es sin_umbral y el conteo sigue visible»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-08** Calcular la dimensión misa: fechas de inicio y saldo desde papel
  - RF: RF-602, RF-605
  - Depende de: T006-07
  - Hecho cuando: el cálculo de misa cuenta desde `max(inicio del ciclo, fecha_inscripcion, fecha_corte)` y suma `saldo.ausencias_misa`. Pasan estos tests:
    - «RF-602: un niño inscrito a mitad del ciclo solo cuenta las misas desde su inscripción»
    - «RF-605: el saldo desde papel se suma a las ausencias del sistema»
    - «RF-605: las misas anteriores a la fecha de corte del saldo se ignoran»
    - «RF-602: asistir a misa en otro horario cuenta como ausencia sin justificación»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-09** Calcular la dimensión oraciones sin saldo
  - RF: RF-602
  - Depende de: T006-01
  - Hecho cuando: `calcularOraciones(evaluaciones, null, catalogo, umbrales)` en `dimension-oraciones.ts` devuelve `{ sabidas, faltantes, minimo, estado }`, y para cada oración manda la evaluación vigente más reciente. Pasan estos tests:
    - «RF-602: cumple oraciones con sabidas igual al mínimo»
    - «RF-602: un "aún no" posterior deja de contar la oración»
    - «RF-602: nunca cuenta más de 10 oraciones ni oraciones fuera del catálogo»
    - «RF-602: lista las oraciones que faltan»
    - «RF-602: sin mínimo fijado el estado es sin_umbral»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-10** Sumar el saldo desde papel a la dimensión oraciones
  - RF: RF-605, RF-602
  - Depende de: T006-09
  - Hecho cuando: el saldo cuenta como una evaluación «sabe» con fecha `fecha_corte` (D-605). Pasan estos tests:
    - «RF-605: el saldo y el sistema no cuentan dos veces la misma oración»
    - «RF-605: un "aún no" del sistema posterior al saldo resta la oración»
    - «RF-605: si el saldo y el sistema tienen la misma fecha, gana la evaluación del sistema»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-11** Calcular la situación en doctrina con criterio enchufable (supuesto S-2)
  - RF: RF-602, RF-603
  - Depende de: T006-01
  - Hecho cuando: `calcularDoctrina(evaluaciones, criterio)` en `dimension-doctrina.ts` devuelve `{ logradas, total, situacion }`. Pasan estos tests:
    - «RF-602: sin criterio de doctrina la situación es sin_umbral»
    - «RF-603: sin ninguna evaluación de doctrina la situación es sin_evaluacion y no no_cumple»
    - «RF-602 (supuesto S-2): con un mínimo de 70 %, 7 de 10 logradas cumple y 6 de 10 no cumple»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-12** Validar el saldo inicial y elegir el vigente
  - RF: RF-605
  - Depende de: T006-01
  - Hecho cuando: `saldo-inicial.ts` exporta `validarSaldo` y `saldoVigente`. Pasan estos tests:
    - «RF-605: rechaza ausencias negativas»
    - «RF-605: rechaza oraciones fuera del catálogo o repetidas»
    - «RF-605: rechaza una fecha de corte fuera del ciclo»
    - «RF-605: el saldo vigente es el último cargado por niño y ciclo»
    - «RF-605: el saldo conserva origen papel, quién lo cargó y cuándo»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-13** Evaluar a un niño: tres dimensiones más propuesta
  - RF: RF-601, RF-602, RF-603
  - Depende de: T006-03, T006-06, T006-08, T006-10, T006-11
  - Hecho cuando: `evaluarNino(datos, umbrales)` en `tablero.ts` combina las tres dimensiones y `proponerAptitud`. Pasan estos tests:
    - «RF-601: con cualquiera de los 7 subconjuntos de umbrales faltantes la propuesta es sin_propuesta y las tres dimensiones siguen visibles»
    - «RF-603: un cambio de umbral recalcula la propuesta del mismo niño»
    - «RF-603: un cambio en un dato de cualquier dimensión recalcula la propuesta»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-14** Construir el tablero de un grupo
  - RF: RF-602, RF-603
  - Depende de: T006-13
  - Hecho cuando: `construirTablero(nomina, datos, umbrales)` agrega por niño y filtra por grupo. Pasan estos tests:
    - «RF-603: un niño retirado o anulado no aparece en el tablero»
    - «RF-602: un cambio de grupo no altera las dimensiones del niño»
    - «RF-603: un niño no bautizado se evalúa con la misma regla»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-15** Declarar el puerto `RepositorioAptitud`
  - RF: RF-601, RF-604, RF-605, RF-606
  - Depende de: T006-01
  - Hecho cuando: `puertos.ts` declara `RepositorioAptitud` con estas operaciones: guardar y listar versiones de umbral, saldos, decisiones, cierres, listas y comparticiones, y leer los datos de entrada del tablero. Se compila sin implementaciones y solo con tipos de `tipos.ts`. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 2 — Servidor: migraciones, repositorio PostgreSQL y `push` de umbral y saldo

- [ ] **T006-16** Crear el módulo `sacramental` en la API, que reexporta el dominio
  - RF: RF-603
  - Depende de: T006-14, T001 (esqueleto de `api/` con esbuild y alias `@/lib`, F0-3)
  - Hecho cuando: existe `api/src/modulos/sacramental/dominio/index.ts`, que reexporta `@/lib/sacramental`. El build de `api/` empaqueta el módulo sin errores. Pasa el test de `api/test/sacramental/dominio.test.ts` «RF-603: el dominio empaquetado en la API propone lo mismo que en el cliente». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-17** Crear la migración `0601_umbral_aptitud.sql`
  - RF: RF-601
  - Depende de: T006-16, T001 (runner de migraciones y `docker-compose`, F0-3), T001 (tabla `cuenta`, 0101), T008 (tabla `ciclo`, M1 de la fase 0)
  - Hecho cuando: antes de aplicar se confirma con el plan 001 la numeración `06NN` (supuesto S-11). La migración crea la tabla con sus checks y el índice `(ciclo_id, fijado_en desc)`, y se aplica en PostgreSQL de Docker. Pasan los tests de integración «RF-601: la base rechaza min_oraciones 11 y max_ausencias_misa -1» y «RF-601: umbral_aptitud es solo de inserción». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-18** Crear la migración `0602_saldo_inicial_aptitud.sql`
  - RF: RF-605
  - Depende de: T006-17, T002 (tabla `catequizando`), T005-17 (tabla `oracion`, 0501)
  - Hecho cuando: la migración se aplica con `origen` por defecto `'papel'` y el índice `(ciclo_id, catequizando_id, cargado_en desc)`. Pasan «RF-605: la base rechaza ausencias_misa negativas» y «RF-605: un saldo nuevo queda con origen papel». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-19** Crear la migración `0603_decision_aptitud.sql`
  - RF: RF-604
  - Depende de: T006-17, T002 (tabla `catequizando`)
  - Hecho cuando: la migración se aplica con el check «resultado = propuesta o motivo no vacío» y el índice `(ciclo_id, catequizando_id, decidido_en desc)`. Pasan «RF-604: la base rechaza una decisión distinta de la propuesta sin motivo» y «RF-604: la base rechaza el resultado a_revisar». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-20** Escribir la suite de contrato e implementar los umbrales en PostgreSQL
  - RF: RF-601
  - Depende de: T006-15, T006-17
  - Hecho cuando: `api/test/sacramental/contrato-repositorio.ts` exporta `probarContratoRepositorioAptitud(fabrica)`. Con `repositorio-aptitud-postgres.ts` pasan «RF-601: guarda versiones de umbral y devuelve la vigente» y «RF-601: reinsertar el mismo UUID no duplica la versión». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-21** Implementar los saldos iniciales en el repositorio PostgreSQL
  - RF: RF-605
  - Depende de: T006-18, T006-20
  - Hecho cuando: el contrato agrega estos tests y pasan contra PostgreSQL: «RF-605: devuelve el saldo vigente por niño y ciclo» y «RF-605: reinsertar el mismo UUID no duplica el saldo». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-22** Agregar las acciones de aptitud a la matriz de permisos
  - RF: RF-601, RF-602, RF-604, RF-605, RF-606
  - Depende de: T001 (`matriz-permisos` y rol `supervision`, F1), T001 (delegación vigente `delegacionVigente`, F2)
  - Hecho cuando: la matriz de 001 tiene las filas `aptitud:*` de esta spec: ver tablero, ver detalle, ver decisiones, fijar umbrales, cargar saldo, decidir, cerrar, compartir, ver listas y ver dimensiones de familia. Pasan estos tests:
    - «RF-604: solo coordinación y su delegado vigente pueden decidir»
    - «RF-601: solo coordinación y su delegado vigente fijan umbrales»
    - «RF-606: supervisión puede ver listas pero no cerrar ni compartir»
    - «RF-602: el catequista ve el tablero solo de sus grupos»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-23** Declarar las tablas sincronizadas de umbrales y saldos
  - RF: RF-601, RF-605, RNF-603
  - Depende de: T006-01, T003-32 (tablas sincronizadas y `registro-tablas.ts`, §3.3 pasos 1 y 2)
  - Hecho cuando: `src/lib/sacramental/tablas-sincronizadas.ts` declara `umbrales_aptitud` y `saldos_iniciales_aptitud` con sus columnas, sentido y alcance (plan §3.2), y se registran en `src/lib/sincronizacion/registro-tablas.ts`. El test «Principio 7: ninguna tabla sincronizada contiene columnas restringidas» del plan 003 sigue pasando. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-24** Implementar el manejador `push` de `umbral_aptitud`
  - RF: RF-601
  - Depende de: T006-20, T006-22, T006-23, T003-46 (registro de proveedores), T003-49 (push transaccional e idempotente), T003-51 (descarte tras el cierre del ciclo), T008 (cierre de ciclo, fase 1), T001 (aviso a coordinación por rechazo, RF-112)
  - Hecho cuando: `infraestructura/manejadores-sincronizacion.ts` queda registrado en `registro-proveedores.ts`. Pasan estos tests de `api/`:
    - «RF-601: un umbral válido de coordinación se guarda una sola vez aunque se reintente»
    - «RF-601: un umbral enviado por catequista, supervisión o familia se rechaza en ese registro»
    - «RF-601: un umbral inválido se rechaza con motivo y genera aviso»
    - «RF-601: un umbral que llega después del cierre del ciclo se descarta»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-25** Implementar el manejador `push` de `saldo_inicial_aptitud`
  - RF: RF-605
  - Depende de: T006-12, T006-21, T006-24
  - Hecho cuando: pasan estos tests:
    - «RF-605: un saldo válido de coordinación o del delegado se guarda con quién y cuándo»
    - «RF-605: un saldo con oraciones fuera del catálogo se rechaza con motivo»
    - «RF-605: un saldo enviado por catequista se rechaza»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 3 — Lecturas, tablero sin conexión y pantallas

- [ ] **T006-26** Implementar el `pull` de umbrales y saldos por rol y alcance
  - RF: RF-601, RF-605, RNF-603
  - Depende de: T006-24, T006-25
  - Hecho cuando: pasan estos tests:
    - «RNF-603: el pull baja los umbrales a catequista, coordinación y delegado»
    - «RF-605: el catequista recibe solo los saldos de sus grupos»
    - «RF-601: supervisión y familia no reciben tablas de aptitud por sincronización» (supuesto S-12)

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-27** Armar los datos del tablero en el servidor a partir de los puertos de otras specs
  - RF: RF-602, RF-605
  - Depende de: T006-14, T006-21, T002 (nómina con `fecha_inscripcion`, `estado` y `bautizado`), T003-90 (`consultarAusencias` de misa y `hay_misa`), T004-65 (puerto `ConsultaJustificaciones.ausenciaMisaJustificada`), T005-69 (puerto `ConsultaAvanceFormativo.oracionesSabidas`), T008 (ciclo abierto, fase 0)
  - Hecho cuando: `aplicacion/datos-aptitud.ts` arma la entrada del dominio a partir de puertos falsos. Las evaluaciones de doctrina llegan vacías hasta T006-45, porque sin criterio la situación es `sin_umbral`. Pasan estos tests:
    - «RF-602: marca como justificada la ausencia que 004 informa aprobada»
    - «RF-602: excluye los domingos sin misa que informa 003»
    - «RF-605: incluye el saldo vigente del niño»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-28** Implementar el caso de uso `consultar-tablero` en el servidor
  - RF: RF-601, RF-602, RF-603, RNF-601
  - Depende de: T006-20, T006-27
  - Hecho cuando: `aplicacion/consultar-tablero.ts` deriva las propuestas al leer (D-601). Pasan estos tests:
    - «RF-601: tras una nueva versión de umbral el tablero usa la vigente»
    - «RNF-601: cada fila trae la regla aplicada y los valores de las tres dimensiones»
    - «RF-603: un niño retirado no aparece»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-29** Exponer la Function `sacramentalTablero`
  - RF: RF-602, RF-603, RNF-601
  - Depende de: T006-22, T006-28, T001 (middleware `conAcceso`, F1)
  - Hecho cuando: `GET /sacramental/ciclos/{cicloId}/tablero?grupoId=` responde así:
    - 200 a coordinación para cualquier grupo
    - 200 a catequista para su grupo y 403 para otro grupo
    - 200 a supervisión
    - 403 a familia

    Todas las respuestas llevan `Cache-Control: no-store`. Pasan los tests HTTP «RF-602: matriz de roles del tablero» y «RF-602: un catequista de otro grupo recibe 403». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-30** Exponer la Function `sacramentalDetalle` (dimensiones y propuesta)
  - RF: RF-602, RF-603, RNF-601
  - Depende de: T006-29
  - Hecho cuando: `GET /sacramental/catequizandos/{id}/aptitud` devuelve las dimensiones, la propuesta y la explicación. Responde 200 a coordinación, a supervisión y al catequista del grupo del niño, 403 al catequista de otro grupo y 403 a familia. Pasa «RF-602: el detalle muestra ausencias frente al máximo, oraciones frente al mínimo y situación en doctrina». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-31** Exponer la Function `sacramentalFamilia`
  - RF: RF-602
  - Depende de: T006-22, T006-28, T001 (enlace de familia y contexto de apoderado, F1)
  - Hecho cuando: `GET /sacramental/familia/aptitud` devuelve solo las tres dimensiones de los hijos de la familia, cada una con su valor. Pasan estos tests:
    - «RF-602: la familia ve las tres dimensiones de sus hijos con su valor»
    - «RF-602: la respuesta de familia no incluye propuesta ni decisión»
    - «RF-602: otro rol recibe 403 en el endpoint de familia»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-32** Exponer la Function `sacramentalUmbrales`
  - RF: RF-601
  - Depende de: T006-20, T006-22
  - Hecho cuando: `GET /sacramental/ciclos/{cicloId}/umbrales` devuelve la versión vigente y el historial a coordinación y a supervisión, solo la vigente al catequista, y 403 a familia. Pasa «RF-601: el historial muestra cada cambio con quién, cuándo y motivo». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-33** Agregar las tablas locales de umbrales y saldos al esquema WatermelonDB
  - RF: RF-601, RF-605, RNF-603
  - Depende de: T006-23, T003-69 (esquema local generado y `migraciones.ts`, §3.3 paso 3)
  - Hecho cuando: hay un paso nuevo en `migraciones.ts` (no se edita ninguno publicado), sube `schemaVersion` y existen los modelos de `umbrales_aptitud` y `saldos_iniciales_aptitud`. Pasa «RNF-603: el esquema local incluye umbrales_aptitud y saldos_iniciales_aptitud». El test de principio 7 del plan 003 sigue pasando. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-34** Implementar el repositorio local de umbrales y saldos
  - RF: RF-601, RF-605, RNF-603
  - Depende de: T006-21, T006-33, T003 (adaptador de pruebas de WatermelonDB)
  - Hecho cuando: `src/datos/sacramental/repositorio-aptitud-local.ts` implementa umbrales y saldos con UUID generado en el dispositivo. La suite `probarContratoRepositorioAptitud` de T006-20 y T006-21 pasa también contra WatermelonDB. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-35** Leer en el repositorio local los datos que consume el tablero
  - RF: RF-602, RNF-603
  - Depende de: T006-34, T003 (tablas locales `catequizandos`, `sesiones` y `asistencias`), T004-62 (tabla local `justificaciones_estado`, sin evidencia), T005-23 (tablas locales de oraciones), T008 (tabla local `ciclos`)
  - Hecho cuando: el repositorio local arma la misma entrada que T006-27 y no lee causa ni evidencia de las justificaciones. Pasa «RNF-603: con la base local poblada se arman los datos de un grupo sin red». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-36** Escribir el test de paridad entre servidor y celular
  - RF: RNF-603, RF-603
  - Depende de: T006-27, T006-35
  - Hecho cuando: se carga el mismo conjunto de datos en PostgreSQL y en WatermelonDB, y pasa «RNF-603: el mismo conjunto de datos produce el mismo tablero en el servidor y en el celular». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-37** Observar el tablero local para que se recalcule solo
  - RF: RF-601, RF-603, RNF-603
  - Depende de: T006-35
  - Hecho cuando: `observarTablero(grupoId)` emite un tablero nuevo cuando cambia cualquier tabla que consume. Pasan «RF-603: al guardar una evaluación de oración local el tablero observado se recalcula» y «RF-601: al guardar una nueva versión de umbral local se recalculan todas las propuestas». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-38** Crear los componentes `fila-dimensiones` y `explicacion-propuesta`
  - RF: RF-602, RNF-601
  - Depende de: T006-05
  - Hecho cuando: `src/components/aptitud/fila-dimensiones.tsx` y `explicacion-propuesta.tsx` solo presentan lo que devuelve `explicarPropuesta`. Pasan los tests con Testing Library «RNF-601: la explicación muestra qué dimensiones cumple, cuáles no y sus valores» y «RF-602: la fila muestra ausencias/máximo, oraciones/mínimo y doctrina». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-39** Crear la pantalla del tablero `aptitud/index.tsx`
  - RF: RF-602, RF-603, RNF-603
  - Depende de: T006-37, T006-38, T001 (layouts y guardas por rol), T003-75 (contador reactivo de pendientes), T003 (NetInfo y hora de última sincronización)
  - Hecho cuando: la pantalla muestra, por grupo, a cada niño con sus tres dimensiones, la propuesta y la regla en texto. Pasa «RNF-603: sin red y con base local, el tablero del grupo se muestra con "datos sincronizados hasta…"», con NetInfo simulado sin red. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-40** Crear la pantalla de detalle `aptitud/[catequizandoId].tsx` (solo lectura)
  - RF: RF-602, RF-603, RNF-601
  - Depende de: T006-30, T006-39
  - Hecho cuando: en el celular el detalle se lee de la base local, y en la web la supervisión lo lee en línea con `sacramentalDetalle`. Pasa «RF-602: el detalle explica cada dimensión, p. ej. "cumple misa: 2 de 3 ausencias"». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-41** Agregar la sección de aptitud en la vista web de familia
  - RF: RF-602
  - Depende de: T006-31, T006-38, T001 (grupo de rutas `(familia)`)
  - Hecho cuando: la sección muestra en línea las tres dimensiones de cada hijo, sin propuesta ni decisión (supuesto S-12). Pasa «RF-602: la familia ve las tres dimensiones de su hijo sin la propuesta». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-42** Previsualizar el efecto de un cambio de umbrales
  - RF: RF-601
  - Depende de: T006-14
  - Hecho cuando: `previsualizarCambioUmbrales(datos, umbralesActuales, umbralesNuevos, decisionesVigentes)` en `umbrales.ts` cuenta cuántas propuestas cambian y cuántas decisiones quedan afectadas. Pasan «RF-601: la vista previa cuenta las propuestas que cambian con los umbrales nuevos» y «RF-601: la vista previa cuenta las decisiones afectadas». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-43** Crear la pantalla `aptitud/umbrales.tsx` (máximo de ausencias y mínimo de oraciones)
  - RF: RF-601
  - Depende de: T006-34, T006-42, T001 (layouts y guardas por rol)
  - Hecho cuando: la coordinación y el delegado fijan o cambian el máximo y el mínimo, con motivo opcional y vista previa. No hay valores por defecto (supuesto S-6). Pasan «RF-601: guardar umbrales sin red crea una versión local pendiente de envío» y «RF-601: la pantalla muestra la vista previa antes de confirmar». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-44** Habilitar el criterio de doctrina en `aptitud/umbrales.tsx` **[Bloqueada por aclaración]** (criterio para que un niño «cumpla» doctrina, que depende del método de evaluación pendiente en la spec 005. Supuesto S-2: la coordinación no lo fija hasta que se aclare)
  - RF: RF-601, RF-602
  - Depende de: T006-11, T006-43
  - Hecho cuando: el criterio confirmado está en la spec. Si no es `porcentaje_logrado`, la nueva variante de `CriterioDoctrina` tiene sus tests en `dimension-doctrina.test.ts`. La pantalla permite fijarlo y pasa «RF-601: al fijar el criterio de doctrina, las propuestas dejan de ser sin_propuesta». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-45** Normalizar las evaluaciones de doctrina de 005 a «logrado / no logrado» **[Bloqueada por aclaración]** (criterio de doctrina de esta spec y método o escala de evaluación de doctrina de la spec 005)
  - RF: RF-602, RF-603
  - Depende de: T006-27, T006-35, T005-40 (`situacionDoctrina`), T005-49 (método y escala definitivos de doctrina, bloqueada en 005), T005-69 (puerto `ConsultaAvanceFormativo.situacionDoctrina`)
  - Hecho cuando: los adaptadores del servidor (T006-27) y del celular (T006-35) entregan las evaluaciones de doctrina normalizadas según la escala confirmada. Pasan «RF-602: una evaluación de doctrina de 005 se normaliza según la escala acordada» y el test de paridad de T006-36 con evaluaciones de doctrina. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 4 — Decisiones y avisos

- [ ] **T006-46** Validar una decisión de aptitud
  - RF: RF-604
  - Depende de: T006-03
  - Hecho cuando: `validarDecision(propuesta, resultado, motivo)` en `decision.ts` cumple D-607. Pasan estos tests:
    - «RF-604: una decisión distinta de la propuesta sin motivo es inválida»
    - «RF-604: decidir sobre a_revisar exige motivo»
    - «RF-604: no se puede decidir con sin_propuesta»
    - «RF-604: un motivo solo con espacios cuenta como vacío»
    - «RF-604: confirmar la propuesta no exige motivo»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-47** Elegir la decisión vigente y detectar conflictos
  - RF: RF-604
  - Depende de: T006-46
  - Hecho cuando: `decisionVigente` y `detectarConflicto` en `decision.ts` aplican el supuesto S-7. Pasan «RF-604: la vigente es la de mayor decidido_en, con desempate por recibido_en», «RF-604: dos decisiones con la misma decisión anterior y distinto resultado son un conflicto» y «RF-604: el historial conserva todas las decisiones». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-48** Derivar los avisos de aptitud
  - RF: RF-604, RF-601
  - Depende de: T006-14, T006-47
  - Hecho cuando: `avisosDeAptitud(decisionesVigentes, propuestasActuales)` en `avisos.ts` incluye las dimensiones de antes y de ahora. Pasan estos tests:
    - «RF-604: una justificación aprobada después de decidir genera aviso y no cambia la decisión»
    - «RF-601: un cambio de umbral genera avisos solo para las decisiones afectadas»
    - «RF-604: un conflicto entre coordinación y delegado genera aviso»
    - «RF-604: confirmar con la propuesta actual resuelve el aviso»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-49** Implementar las decisiones en el repositorio PostgreSQL
  - RF: RF-604
  - Depende de: T006-19, T006-20, T006-47
  - Hecho cuando: el contrato agrega estos tests y pasan contra PostgreSQL: «RF-604: devuelve la decisión vigente y el historial completo» y «RF-604: reinsertar el mismo UUID no duplica la decisión». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-50** Declarar la tabla sincronizada de decisiones e implementar su `push`
  - RF: RF-604
  - Depende de: T006-22, T006-24, T006-46, T006-49
  - Hecho cuando: `decisiones_aptitud` está declarada y registrada (plan 003, §3.3). El manejador valida contra `propuesta_al_decidir`. Pasan estos tests:
    - «RF-604: una decisión distinta de la propuesta sin motivo se rechaza en el push y genera aviso a coordinación»
    - «RF-604: una decisión enviada por supervisión o catequista se rechaza»
    - «RF-604: el delegado vigente puede decidir y con la delegación vencida se rechaza»
    - «RF-604: la decisión guarda quién, cuándo, la propuesta vista y el motivo»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-51** Implementar el `pull` de decisiones solo para coordinación y delegado
  - RF: RF-604
  - Depende de: T006-26, T006-50
  - Hecho cuando: pasan «RF-604: las decisiones no bajan al celular del catequista» y «RF-604: coordinación y delegado reciben las decisiones de todos los grupos» (D-613). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-52** Exponer la Function `sacramentalAvisos`
  - RF: RF-604
  - Depende de: T006-28, T006-48, T006-49
  - Hecho cuando: `GET /sacramental/ciclos/{cicloId}/avisos` responde 200 a coordinación y al delegado, y 403 a catequista, supervisión y familia. Pasa «RF-604: aprobar una justificación después de decidir hace aparecer el aviso sin cambiar la decisión». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-53** Agregar decisiones e historial a `sacramentalDetalle`
  - RF: RF-604
  - Depende de: T006-30, T006-49
  - Hecho cuando: pasan «RF-604: coordinación y supervisión ven las decisiones con quién, cuándo y motivo» y «RF-604: el catequista ve dimensiones y propuesta pero no decisiones» (supuesto S-10). `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-54** Agregar las decisiones al esquema y al repositorio locales
  - RF: RF-604, RNF-603
  - Depende de: T006-34, T006-50
  - Hecho cuando: hay un paso nuevo en `migraciones.ts` y el modelo `decisiones_aptitud`. El repositorio local guarda las decisiones con UUID, `propuesta_al_decidir` y `decision_anterior_id`. La parte de decisiones del contrato pasa contra WatermelonDB. `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-55** Agregar el formulario de decisión y la acción Confirmar/Cambiar al detalle
  - RF: RF-604
  - Depende de: T006-40, T006-54
  - Hecho cuando: `src/components/aptitud/formulario-decision.tsx` se muestra solo a coordinación y al delegado, y avisa que no se anoten datos de salud en el motivo. Pasan «RF-604: no se puede guardar una decisión distinta de la propuesta sin motivo» y «RF-604: sin red, confirmar deja la decisión pendiente de envío con la propuesta vista». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-56** Crear la pantalla `aptitud/avisos.tsx` y la insignia en el tablero
  - RF: RF-604, RF-601
  - Depende de: T006-39, T006-48, T006-54
  - Hecho cuando: los avisos se derivan localmente. Pasan estos tests:
    - «RF-604: tras un cambio de datos posterior a la decisión, avisos muestra antes y ahora sin cambiar la decisión»
    - «RF-604: confirmar desde el aviso lo resuelve»
    - «RF-601: un cambio de umbral muestra las decisiones afectadas»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 5 — Saldo inicial desde papel

- [ ] **T006-57** Crear la pantalla `aptitud/saldo-inicial.tsx`
  - RF: RF-605
  - Depende de: T006-12, T006-34
  - Hecho cuando: por cada niño se cargan las ausencias, las oraciones sabidas (un toque por oración) y la fecha de corte. Pasan «RF-605: guardar un saldo sin red crea un registro local con origen papel, quién y cuándo», «RF-605: corregir un saldo crea una nueva versión con reemplaza_a» y «RF-605: el formulario muestra los errores de validarSaldo». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-58** Mostrar la marca «incluye saldo cargado desde papel»
  - RF: RF-605, RNF-601
  - Depende de: T006-30, T006-40, T006-57
  - Hecho cuando: el tablero, el detalle local y `sacramentalDetalle` indican si el valor incluye un saldo desde papel, quién lo cargó y cuándo. Pasa «RF-605: el detalle indica que el valor incluye saldo cargado desde papel, por quién y cuándo». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-59** Comprobar en el servidor que el saldo se suma a las dimensiones
  - RF: RF-605
  - Depende de: T006-25, T006-28
  - Hecho cuando: pasa el test de integración con PostgreSQL «RF-605: el tablero del servidor suma el saldo vigente a las ausencias y oraciones registradas después del corte». `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 6 — Cierre de decisiones, lista para el sacramento y compartir

- [ ] **T006-60** Validar el cierre de decisiones
  - RF: RF-606
  - Depende de: T006-47, T006-48
  - Hecho cuando: `validarCierre(nomina, decisiones, avisos)` en `lista.ts` aplica el supuesto S-9. Pasan «RF-606: no se cierra con un niño activo sin decisión», «RF-606: no se cierra con avisos o conflictos abiertos» y «RF-606: un retirado no bloquea el cierre». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-61** Generar la lista de aptos con sus sacramentos
  - RF: RF-606
  - Depende de: T006-60
  - Hecho cuando: `generarLista` y `sacramentosARecibir` en `lista.ts` aplican D-611 y el supuesto S-5. Pasan estos tests:
    - «RF-606: la lista contiene exactamente las decisiones vigentes apto»
    - «RF-606: un no bautizado recibe bautismo y primera comunión»
    - «RF-606: cada ítem resume las tres dimensiones y si incluye saldo desde papel»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-62** Generar el texto que se comparte con secretaría
  - RF: RF-606
  - Depende de: T006-61
  - Hecho cuando: `textoCompartible(lista)` aplica el supuesto S-8. Pasan «RF-606: el texto compartible lleva nombre, grupo y sacramentos» y «RF-606: el texto compartible no incluye dimensiones, motivos ni datos restringidos». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-63** Crear la migración `0604_lista_sacramental.sql`
  - RF: RF-606
  - Depende de: T006-19
  - Hecho cuando: se aplican `cierre_decisiones_aptitud`, `lista_sacramental` (con `unique (ciclo_id, version)`), `lista_sacramental_item` (por referencia, sin nombres) y `comparticion_lista_sacramental`. Pasa «RF-606: la base rechaza dos listas con la misma versión en un ciclo». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-64** Procesar el cierre en el servidor y versionar la lista
  - RF: RF-606
  - Depende de: T006-49, T006-61, T006-63
  - Hecho cuando: `aplicacion/procesar-cierre.ts` y el repositorio PostgreSQL de listas trabajan en una sola transacción: validan con los datos del servidor, generan la lista v+1, marcan la anterior como no vigente y dejan el cierre `aplicado` o `rechazado`. Pasan «RF-606: un cierre válido genera la lista v+1 y marca la anterior no vigente» y «RF-606: un cierre con niños sin decisión queda rechazado con motivo». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-65** Sincronizar el cierre de decisiones
  - RF: RF-606
  - Depende de: T006-50, T006-64
  - Hecho cuando: `cierres_decisiones_aptitud` está declarada y registrada, y tiene manejadores `push` y `pull` (el `estado` lo actualiza el servidor). Pasan «RF-606: el cierre enviado desde el celular queda aplicado y baja con su estado» y «RF-606: un cierre enviado por supervisión se rechaza». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-66** Sincronizar las comparticiones de la lista
  - RF: RF-606
  - Depende de: T006-65
  - Hecho cuando: `comparticiones_lista` está declarada (solo `push`) y tiene su manejador. Pasan «RF-606: la compartición se registra con quién, cuándo y medio» y «RF-606: no se puede compartir una lista inexistente». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-67** Exponer la Function `sacramentalListas`
  - RF: RF-606
  - Depende de: T006-22, T006-64
  - Hecho cuando: `GET /sacramental/ciclos/{cicloId}/listas` y `/listas/vigente` responden 200 a coordinación, al delegado y a supervisión, y 403 a catequista y familia. Pasan «RF-606: supervisión lee la lista vigente con su propia cuenta» y «RF-606: la lista coincide con las decisiones apto vigentes». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-68** Exponer los puertos que consume la spec 008
  - RF: RF-605, RF-606
  - Depende de: T006-21, T006-64
  - Hecho cuando: el módulo exporta `listaVigente(cicloId)`, `contarAptos(cicloId)` y `cicloTieneSaldosDesdePapel(cicloId)`. Pasan «RF-606: la lista vigente queda disponible para la constancia del ciclo (008)» y «RF-605: el ciclo informa si tiene saldos desde papel». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-69** Registrar el participante de retención de las tablas de aptitud
  - RF: RF-606
  - Depende de: T006-63, T001 (motor de retención y registro de participantes, F3), T008 (manejador de retención del ciclo, fase 5)
  - Hecho cuando: el manejador anonimiza `lista_sacramental_item` y borra los motivos de las decisiones en los ciclos vencidos. Pasa «RF-606: la retención anonimiza los ítems de la lista y conserva los conteos para la constancia de 008». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-70** Agregar los cierres y las comparticiones al esquema y al repositorio locales
  - RF: RF-606, RNF-603
  - Depende de: T006-33, T006-65, T006-66
  - Hecho cuando: hay un paso nuevo en `migraciones.ts` con `cierres_decisiones_aptitud` y `comparticiones_lista`, y el repositorio local los crea con UUID. Pasa «RF-606: cerrar decisiones sin red crea un cierre local pendiente de envío». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-71** Crear la pantalla `aptitud/lista.tsx`
  - RF: RF-606
  - Depende de: T006-60, T006-67, T006-70
  - Hecho cuando: la pantalla muestra la validación previa, el botón «Cerrar decisiones» (con estado «pendiente de envío» o «lista generada vN») y la lista vigente. La supervisión la ve en línea. Pasan «RF-606: el botón de cierre muestra por qué no se puede cerrar» y «RF-606: supervisión ve la lista en solo lectura». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-72** Compartir la lista con secretaría
  - RF: RF-606
  - Depende de: T006-62, T006-71
  - Hecho cuando: antes de empezar se consulta en la documentación de Expo SDK 57 cómo funciona `Share` en Android y en la web. La pantalla usa `Share` de React Native (en la web, Web Share o copiar) con `textoCompartible` y registra la compartición localmente (D-612). Pasa «RF-606: compartir abre Share con el texto mínimo y registra la compartición». `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Fase 7 — Extremo a extremo y criterios de finalización

- [ ] **T006-73** Escribir el E2E de decisiones y avisos (criterios 3 y 4)
  - RF: RF-601, RF-603, RF-604
  - Depende de: T006-50, T006-52, T006-56
  - Hecho cuando: el test E2E con API y PostgreSQL usa un umbral completo de prueba y niños sin evaluaciones de doctrina (filas no ambiguas: R1 y R5). Pasan estos tests:
    - «RF-604: una decisión distinta de la propuesta no puede guardarse sin motivo»
    - «RF-604: aprobar una justificación después de decidir genera aviso y no cambia la decisión»
    - «RF-601: cambiar un umbral a mitad del ciclo recalcula y avisa de las decisiones afectadas»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-74** Escribir el E2E de saldo, cierre y lista (criterios 5 y 6)
  - RF: RF-605, RF-606
  - Depende de: T006-59, T006-67, T006-68, T006-73
  - Hecho cuando: pasan estos tests:
    - «RF-605: un saldo cargado desde papel se suma a las dimensiones y queda marcado»
    - «RF-606: la lista final coincide con las decisiones registradas, la supervisión la ve y la spec 008 la lee del ciclo»

    `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-75** Escribir el E2E de las ocho combinaciones con doctrina real (criterios 1 y 2) **[Bloqueada por aclaración]** (criterio de doctrina, normalización de 005 y contradicción de RF-603 sobre niños sin evaluación de doctrina)
  - RF: RF-602, RF-603, RNF-602
  - Depende de: T006-04, T006-44, T006-45, T006-74
  - Hecho cuando: con asistencias, justificaciones, oraciones y evaluaciones de doctrina reales pasan «RF-603: las ocho combinaciones de misa, oraciones y doctrina producen la propuesta de la regla» y «RF-603: un niño sin misa queda no apto aunque cumpla oraciones y doctrina». `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T006-76** Verificar la cobertura de requisitos de la spec
  - RF: RF-601, RF-602, RF-603, RF-604, RF-605, RF-606, RNF-601, RNF-602, RNF-603
  - Depende de: T006-74, T001 (`verificar-cobertura-rf.mjs`, F0-7)
  - Hecho cuando: `node scripts/verificar-cobertura-rf.mjs` (ruta del plan 001) informa al menos un test por cada RF-601 a RF-606 y RNF-601 a RNF-603. La tabla de cobertura de este archivo coincide con lo implementado. Los criterios de finalización 3 a 6 están verificados, y los 1 y 2 quedan pendientes solo de T006-75. `npm test`, `npm run typecheck` y `npm run lint` pasan.

## Cobertura

| Requisito | Tareas |
| --- | --- |
| RF-601 Umbrales | T006-01, T006-02, T006-06, T006-13, T006-15, T006-17, T006-20, T006-22, T006-23, T006-24, T006-26, T006-28, T006-32, T006-33, T006-34, T006-37, T006-42, T006-43, T006-44, T006-48, T006-56, T006-73, T006-76 |
| RF-602 Dimensiones | T006-01, T006-07, T006-08, T006-09, T006-10, T006-11, T006-13, T006-14, T006-22, T006-27, T006-28, T006-29, T006-30, T006-31, T006-35, T006-38, T006-39, T006-40, T006-41, T006-44, T006-45, T006-75, T006-76 |
| RF-603 Propuesta de aptitud | T006-01, T006-03, T006-04, T006-11, T006-13, T006-14, T006-16, T006-28, T006-29, T006-30, T006-36, T006-37, T006-39, T006-40, T006-45, T006-73, T006-75, T006-76 |
| RF-604 Decisión final | T006-15, T006-19, T006-22, T006-46, T006-47, T006-48, T006-49, T006-50, T006-51, T006-52, T006-53, T006-54, T006-55, T006-56, T006-73, T006-76 |
| RF-605 Saldo inicial desde papel | T006-08, T006-10, T006-12, T006-15, T006-18, T006-21, T006-22, T006-23, T006-25, T006-26, T006-27, T006-33, T006-34, T006-57, T006-58, T006-59, T006-68, T006-74, T006-76 |
| RF-606 Lista para el sacramento | T006-15, T006-22, T006-60, T006-61, T006-62, T006-63, T006-64, T006-65, T006-66, T006-67, T006-68, T006-69, T006-70, T006-71, T006-72, T006-74, T006-76 |
| RNF-601 Cálculo explicable | T006-05, T006-28, T006-29, T006-30, T006-38, T006-40, T006-58, T006-76 |
| RNF-602 Regla completa | T006-02, T006-03, T006-04, T006-75, T006-76 |
| RNF-603 Disponible sin conexión | T006-23, T006-26, T006-33, T006-34, T006-35, T006-36, T006-37, T006-39, T006-54, T006-70, T006-76 |

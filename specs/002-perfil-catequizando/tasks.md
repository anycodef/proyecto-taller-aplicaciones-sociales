# Tareas 002 — Perfil e inscripción del catequizando

> Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)
> Si una tarea contradice la spec, manda la spec (principio 2). Cada tarea se hace en un commit propio con su registro Agent Trace (principio 9).

**Leyenda**
- **Acuerdo 2026-10-11:** backend de fases 1–4 incluido; C-01–C-13 aceptados. Etiquetas de aclaración son históricas, no bloqueo de aprobación; tareas, UI y verificaciones físicas siguen pendientes hasta evidencia. Administración ONLINE, sin persistencia/cola local.
- **[Primer corte]**: entra en el primer corte (niños y grupos con lo mínimo para la asistencia, nómina sincronizable y carné QR; sin documentos ni salud).
- **[Bloqueada por aclaración: C-xx]**: no se empieza hasta que el equipo responda la duda indicada de la §11 del plan. Las tareas que dependen de una bloqueada esperan a que se desbloquee.
- "Supuesto C-xx": la tarea se implementa con el supuesto provisional de la §11 del plan, que es reversible; no bloquea.
- `TNNN (…)`: pieza de otra spec que todavía no tiene `tasks.md`; se cita por la fase de su plan.
- Cada test se nombra con su requisito (`RF-2xx: …`, `RNF-2xx: …`, `RF-302: …`).
- Rutas de pantallas: van bajo los grupos `(equipo)` y `(familia)` del plan 001 §6.1; la URL no cambia.

**Total: 108 tareas** (106 históricas más T002-107/108; 60 etiquetas históricas de primer corte). No hay decisiones backend bloqueadas por aclaración.

---

## Fase 1 — Primer corte

### 1.0 Preparación

- [ ] **T002-01** Justificar en la spec las dependencias del carné **[Primer corte]**
  - RF: RF-302 (003)
  - Depende de: —
  - Hecho cuando: `spec.md` tiene una sección "Dependencias" aprobada por el equipo que justifica `react-native-svg`, `expo-print` y `qrcode-generator` (para qué sirven, alternativas descartadas de D-210 y soporte Android, iOS y web comprobado en la documentación de Expo v57); queda decidido cómo se comparte el PDF en nativo (con `Print.printAsync({ html })` o justificando también `expo-sharing`, ver Notas); no se toca código, y `npm run typecheck`, `npm run lint` y `npm test` (si T001 F0-2 ya lo creó) pasan.

- [ ] **T002-02** Registrar la excepción "inscribir solo en línea" y confirmar el consentimiento presencial **[Primer corte]** **[Bloqueada por aclaración: C-01, C-08]**
  - RF: RF-202
  - Depende de: —
  - Hecho cuando: el equipo respondió C-01 y C-08; existe un ADR en `docs/adr/` (creado con `npm run adr:new`) en estado aceptado que registra que la inscripción y la escritura de datos restringidos son solo en línea como excepción al principio 5; la respuesta a C-08 queda anotada en la §11 del plan; y `npm run typecheck`, `npm run lint` y `npm test` (si existe) pasan.

- [ ] **T002-03** Crear el módulo `src/lib/catequizandos/` con `modelo.ts` **[Primer corte]**
  - RF: RF-201, RF-205, RF-206
  - Depende de: T001 (F0-2: Jest con `jest-expo`, `npm test` y regla ESLint de pureza de `src/lib`), T001 (F1: `src/lib/seguridad/` con `Consentimiento` movido)
  - Hecho cuando: `modelo.ts` define `Catequizando`, `Apoderado`, `VinculoApoderado`, `Inscripcion`, `AsignacionGrupo`, `Grupo`, `DocumentoInscripcion`, `CondicionCatequizando` y `CarneEmision`; `src/lib/domain/modelo.ts` reexporta los tipos nuevos en lugar de `Catequizando`, `Grupo` y `DatosRestringidos`, marcados `@deprecated`; pasa `RF-201: src/lib/catequizandos no importa react, react-native ni expo`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

### 1.1 Dominio puro

- [ ] **T002-04** Implementar `edad.ts` **[Primer corte]**
  - RF: RF-202
  - Depende de: T002-03
  - Hecho cuando: `edadEnFecha`, `edadAlInicioDelCiclo` y `estaEnRangoCatequesis` pasan `RF-202: la edad se calcula al inicio del ciclo y un niño que cumple 14 sigue en su grupo`, `RF-202: usa la fecha de inicio del ciclo, no la de inscripción`, `RF-202: edadEnFecha no suma el año antes del día del cumpleaños` y `RF-202: el rango de catequesis acepta de 8 a 13 y rechaza 7 y 14`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-05** Implementar `inscripcion.ts` (`CAMPOS_OBLIGATORIOS` y `validarInscripcion`) **[Primer corte]**
  - RF: RF-202, RNF-201
  - Depende de: T002-04
  - Hecho cuando: pasan `RF-202: sin un dato obligatorio se bloquea`, `RF-202: sin un apoderado con medio de contacto se bloquea`, `RF-202: sin consentimiento se bloquea`, `RF-202: edad fuera de 8 a 13 sin confirmar genera advertencia y confirmada no` y `RNF-201: los campos obligatorios son exactamente los de RF-202` (sexo obligatorio, supuesto C-07); y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-06** Implementar `duplicados.ts` (`normalizarTexto` y `claveDuplicado`) **[Primer corte]**
  - RF: RF-201
  - Depende de: T002-03
  - Hecho cuando: pasan `RF-201: normalizarTexto quita tildes, mayúsculas y espacios repetidos`, `RF-201: claveDuplicado coincide para "José  Pérez" y "jose perez" con la misma fecha` y `RF-201: claveDuplicado difiere si cambia la fecha de nacimiento` (supuesto C-02, D-203); y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-07** Implementar la sugerencia de grupos en `grupos.ts` **[Primer corte]**
  - RF: RF-206
  - Depende de: T002-04
  - Hecho cuando: `modalidadHabitual` y `sugerirGrupos` pasan `RF-206: sugiere los grupos mixtos de 8 a 10 años y los de 11 a 13 por sexo`, `RF-206: con dos grupos de 8 años se sugieren ambos` y `RF-206: no sugiere grupos cerrados`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-08** Implementar el aviso de grupo sin catequista y la regla de cierre en `grupos.ts` **[Primer corte]**
  - RF: RF-206
  - Depende de: T002-07
  - Hecho cuando: `gruposSinCatequista` y `puedeCerrarGrupo` pasan `RF-206: avisa de un grupo sin catequista` y `RF-206: no se cierra un grupo con niños activos` (supuesto C-11); y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-09** Implementar la validación de vínculos en `apoderados.ts` **[Primer corte]**
  - RF: RF-207
  - Depende de: T002-03
  - Hecho cuando: `RELACIONES` y `validarVinculo` pasan `RF-207: acepta la relación otro_familiar con detalle "abuela"`, `RF-207: acepta tutor` y `RF-207: rechaza una relación fuera de la lista`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-10** Implementar la codificación del carné en `carne.ts` **[Primer corte]**
  - RF: RF-302 (003)
  - Depende de: T002-03
  - Hecho cuando: `codificarCarne` e `interpretarCodigoCarne` pasan `RF-302: el QR solo contiene SGC1, el uuid y la emisión`, `RF-302: un código mal formado se interpreta como inválido` e `RF-302: interpretar lo codificado devuelve el mismo id y emisión` (supuesto C-13, D-202); y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-11** Instalar `qrcode-generator` e implementar `matrizQr` y `svgDeMatriz` **[Primer corte]**
  - RF: RF-302 (003)
  - Depende de: T002-01, T002-10
  - Hecho cuando: `qrcode-generator` figura en `package.json` con versión exacta; pasan `RF-302: matrizQr es cuadrada, determinista y usa corrección M` y `RF-302: svgDeMatriz pinta un módulo por cada celda oscura`; el test de pureza de T002-03 sigue en verde; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-12** Implementar `autorizacion.ts` sobre el contexto de acceso de 001 **[Primer corte]**
  - RF: RF-201, RF-202, RF-205
  - Depende de: T002-03, T001 (F1: `roles`, `contexto-acceso` y `autorizacion` en `src/lib/seguridad/`)
  - Hecho cuando: `puedeGestionarInscripciones`, `camposDePerfilVisibles` y `puedeVerCondiciones` pasan `RF-202: solo COORD o un delegado vigente gestiona inscripciones`, `RF-205: solo COORD y CAT(g) ven condiciones`, `RF-201: FAM(n) ve nombre, edad, grupo y documentos, sin condiciones ni historial` y `RF-201: SUP no accede al perfil` (supuesto C-09); y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-13** Agregar las acciones de 002 a la matriz de permisos de 001 **[Primer corte]**
  - RF: RF-202, RF-205, RF-206
  - Depende de: T002-12, T001 (F1: `matriz-permisos.ts`)
  - Hecho cuando: la matriz tiene `inscripcion:gestionar`, `perfil:leer`, `grupo:gestionar`, `grupo:leer`, `carne:emitir`, `apoderado:buscar`, `documento:leer`, `documento:gestionar`, `condicion:leer` y `condicion:gestionar`; pasan `RF-202: inscripcion:gestionar solo se concede a coordinación` y `RF-205: condicion:leer da alcance ciclo a COORD y grupos a CAT`, además de la invariante de 001 de que SUP no escribe; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-14** Definir `contratos.ts` de la fase 1 **[Primer corte]**
  - RF: RF-201, RF-202, RF-206, RF-207, RF-302 (003)
  - Depende de: T002-05, T002-10
  - Hecho cuando: `contratos.ts` tipa la petición y la respuesta de `POST /inscripciones` (con `posible_duplicado`, `sin_consentimiento` y `edad_fuera_de_rango_sin_confirmar`), confirmar duplicado, grupos, sugerencias, asignación, `GET /apoderados`, perfil básico y carné; un uso de cada contrato compila desde `src/` y desde `api/`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

### 1.2 Migraciones (bloque 02, convención del plan 001 §3.1)

- [ ] **T002-15** Escribir `0201_crear_catequizando_y_apoderado.sql` (M-201) **[Primer corte]**
  - RF: RF-201, RF-202, RF-207
  - Depende de: T002-03, T001 (F0-3: runner de migraciones y BD de pruebas), T001 (F1: `0101_cuentas_y_credenciales.sql`), T001 (F1b: `0104_consentimiento.sql`)
  - Hecho cuando: la migración crea `catequizando`, `apoderado` y `vinculo_apoderado` como en la §3.1 del plan (sin columna de DNI), otorga los GRANT a `sigecat_api` y agrega las FK `consentimiento.catequizando_id` y `consentimiento.apoderado_id`; pasan `RF-201: catequizando no tiene columna de documento de identidad`, `RF-207: un solo vínculo vigente por niño y apoderado` y `RF-207: un apoderado puede vincularse a varios niños`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-16** Escribir `0202_crear_grupos.sql` (M-202) **[Primer corte]**
  - RF: RF-206
  - Depende de: T002-15, T008-05, T008-06
  - Hecho cuando: la migración crea `grupo` (con el trigger de congelamiento C-3 del plan 008) y `grupo_catequista`; pasan `RF-206: no hay dos grupos abiertos con el mismo nombre en un ciclo` y `RF-206: edad_minima no puede superar edad_maxima`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-17** Escribir `0203_crear_inscripcion_y_asignacion.sql` (M-203) **[Primer corte]**
  - RF: RF-202, RF-203, RF-206
  - Depende de: T002-16
  - Hecho cuando: la migración crea `inscripcion` (con el trigger C-3) y `asignacion_grupo` con sus índices únicos parciales; pasan `RF-202: no hay inscripción sin consentimiento_id`, `RF-203: tras anular se admite otra inscripción vigente en el mismo ciclo (BD)` y `RF-206: una sola asignación vigente por inscripción`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-18** Escribir `0204_crear_carne_emision.sql` (M-204) con la vista de nómina **[Primer corte]**
  - RF: RF-201, RF-302 (003), RNF-204
  - Depende de: T002-17
  - Hecho cuando: la migración crea `carne_emision`, la vista `v_nomina_ciclo` (va aquí porque usa la emisión; ver Notas) y los triggers que actualizan `catequizando.actualizado_en` al cambiar inscripción, asignación o carné; pasan `RF-302: una sola emisión vigente por niño`, `RF-201: v_nomina_ciclo solo lista niños vigentes con inscripción vigente y asignación abierta en el ciclo abierto` y `RF-201: cambiar la asignación actualiza catequizando.actualizado_en`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

### 1.3 Repositorios PostgreSQL

- [ ] **T002-19** Crear los módulos de la API y `repositorio-catequizandos-pg.ts` **[Primer corte]**
  - RF: RF-201
  - Depende de: T002-18, T001 (F0-3: esqueleto de `api/` con `compartido/bd`)
  - Hecho cuando: existen `api/src/modulos/inscripciones/` y `api/src/modulos/catequizandos/` con `dominio/puertos.ts`, registrados en `api/src/index.ts`; el repositorio crea perfiles idempotentes por UUID, busca por `clave_duplicado` y lee por id; pasan `RF-201: crear el mismo perfil dos veces con el mismo UUID no lo duplica` y `RF-201: la búsqueda por clave ignora perfiles con clave NULL`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-20** Implementar `repositorio-apoderados-pg.ts` **[Primer corte]**
  - RF: RF-207
  - Depende de: T002-19
  - Hecho cuando: crea apoderados y vínculos idempotentes por UUID, busca por nombre o contacto y lista los vínculos vigentes de un niño; pasan `RF-207: un niño puede tener varios apoderados y un apoderado varios niños` y `RF-207: la búsqueda encuentra por apellido y por teléfono`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-21** Implementar `repositorio-grupos-pg.ts` **[Primer corte]**
  - RF: RF-206
  - Depende de: T002-19
  - Hecho cuando: crea, renombra y cierra grupos, reemplaza catequistas con vigencia y cuenta niños activos por grupo; pasan `RF-206: el conteo de un grupo solo incluye niños activos` y `RF-206: reemplazar catequistas cierra las asignaciones anteriores con hasta`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-22** Implementar `repositorio-inscripciones-pg.ts` **[Primer corte]**
  - RF: RF-202, RF-206
  - Depende de: T002-20, T002-21
  - Hecho cuando: crea inscripción y asignación idempotentes por UUID y cambia de grupo cerrando la asignación vigente; pasan `RF-202: reintentar la inscripción con el mismo UUID no crea filas nuevas` y `RF-206: el cambio de grupo conserva la asignación anterior con hasta`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-23** Implementar `repositorio-carnes-pg.ts` **[Primer corte]**
  - RF: RF-302 (003)
  - Depende de: T002-19
  - Hecho cuando: emite la primera emisión y reemite invalidando la vigente en una sola transacción; pasan `RF-302: reemitir invalida la emisión anterior (BD)` y `RF-302: la emisión es correlativa por niño`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

### 1.4 Interfaces en proceso y nómina sincronizable

- [ ] **T002-24** Implementar `gruposACargo` y `alcanceFamilia` y conectarlos al middleware de 001 **[Primer corte]**
  - RF: RF-205, RF-206, RF-207
  - Depende de: T002-21, T002-22, T001 (F1: middleware `conAcceso`)
  - Hecho cuando: el paso 2 de `conAcceso` usa ambos puertos; pasan `RF-206: gruposACargo solo devuelve grupos con catequista vigente en el ciclo indicado` y `RF-207: alcanceFamilia solo incluye niños con vínculo vigente`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-25** Implementar `ninosActivos(cicloId, fecha)` **[Primer corte]**
  - RF: RF-201
  - Depende de: T002-22
  - Hecho cuando: pasa `RF-201: ninosActivos excluye inscripciones anuladas y niños sin asignación en esa fecha`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-26** Implementar `resolverCarne(codigo)` para la asistencia de 003 **[Primer corte]**
  - RF: RF-302 (003)
  - Depende de: T002-10, T002-23
  - Hecho cuando: `resolver-carne.ts` pasa `RF-302: resolverCarne devuelve catequizandoId, grupoId, activo y emisionVigente`, `RF-302: un carné de una emisión anterior se resuelve con emisionVigente=false` y `RF-302: un código mal formado no consulta la BD`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-27** Implementar `proveedorNomina.cambiosDesde` para la sincronización de 003 **[Primer corte]**
  - RF: RF-201, RF-206, RNF-203, RNF-204
  - Depende de: T002-18, T002-24, T003-31, T003-34
  - Hecho cuando: la interfaz en proceso que consume el proveedor de T003-47 devuelve `catequizandos` (`nombres`, `apellidos`, `grupo_id` y el dato del carné) y `grupos` (`nombre`, `ciclo_id`, `estado`) con selección explícita desde `v_nomina_ciclo`, manda en `deleted` a los niños que salen de la nómina y la nómina completa si cambia el alcance; pasan `RNF-203: el pull de nómina no contiene condiciones, documentos ni fecha de nacimiento`, `RF-206: un niño que cambia de grupo llega con el grupo nuevo` y `RNF-204: un cambio de alcance devuelve la nómina completa`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-28** Verificar las tablas locales `catequizandos` y `grupos` que declara 003 **[Primer corte]**
  - RF: RNF-203, RNF-204
  - Depende de: T002-27, T003-32, T003-33, T003-69
  - Hecho cuando: las definiciones de T003-32 coinciden con las columnas de la §3.2 del plan 002 (con el nombre del dato del carné ya alineado, ver Notas), son de solo pull y no hay otra tabla local de 002; pasan `RNF-203: el esquema local no tiene tablas de condiciones ni de documentos` y el test de 003 `Principio 7: ninguna tabla sincronizada contiene columnas restringidas`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-29** Rechazar en el push los cambios locales de la nómina **[Primer corte]**
  - RF: RF-202, RNF-203
  - Depende de: T002-28, T003-49, T003-50
  - Hecho cuando: pasa `RF-202: el push rechaza cambios locales en catequizandos y grupos`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

### 1.5 API

- [ ] **T002-30** Crear y renombrar grupos (`POST /grupos`, `PATCH /grupos/{id}`) **[Primer corte]**
  - RF: RF-206
  - Depende de: T002-08, T002-13, T002-21, T002-24
  - Hecho cuando: `gestionar-grupos.ts` y `http/grupos.ts` responden 201 al crear (200 al repetir el UUID), 200 al renombrar o ajustar rango y modalidad, y 422 si el rango es inválido; pasan `RF-206: COORD crea y renombra grupos` y `RF-206: CAT, FAM, SUP y sin token no gestionan grupos`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-31** Cerrar grupos y asignar catequistas (`POST /grupos/{id}/cerrar`, `PUT /grupos/{id}/catequistas`) **[Primer corte]**
  - RF: RF-206
  - Depende de: T002-30
  - Hecho cuando: cerrar responde 409 si el grupo tiene niños activos (supuesto C-11) y 200 si no; pasan `RF-206: COORD cierra un grupo vacío`, `RF-206: no se cierra un grupo con niños activos (409)` y `RF-206: COORD reemplaza los catequistas de un grupo`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-32** Listar grupos del ciclo (`GET /ciclos/{cicloId}/grupos`) **[Primer corte]**
  - RF: RF-206
  - Depende de: T002-31
  - Hecho cuando: COORD recibe todos los grupos con su total de niños y `sinCatequista`, y CAT solo los suyos; pasan `RF-206: avisa de un grupo sin catequista (HTTP)` y `RF-206: CAT solo ve sus grupos`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-33** Sugerir grupos con su total (`POST /grupos/sugerencias`) **[Primer corte]**
  - RF: RF-206
  - Depende de: T002-07, T002-32
  - Hecho cuando: con `{ fechaNacimiento, sexo }` calcula la edad al inicio del ciclo abierto y pasa `RF-206: con dos grupos de 8 años se sugieren ambos, con su conteo`; los demás roles reciben 403; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-34** Implementar el servicio `inscribir.ts` en una sola transacción **[Primer corte]** **[Bloqueada por aclaración: C-08]**
  - RF: RF-201, RF-202, RF-206, RF-207, RF-302 (003)
  - Depende de: T002-02, T002-05, T002-06, T002-22, T002-23, T001 (F1b: `registrarConsentimiento(tx, datos)`)
  - Hecho cuando: usa `validarInscripcion` y en una transacción registra el consentimiento, crea perfil, apoderados, vínculos, inscripción, asignación y la emisión 1 del carné (D-214); con puertos falsos pasan `RF-202: la inscripción crea todo en una transacción o nada` y `RF-202: sin consentimiento no se escribe nada`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-35** Exponer `POST /inscripciones` **[Primer corte]**
  - RF: RF-202
  - Depende de: T002-13, T002-14, T002-34
  - Hecho cuando: `http/inscripciones.ts` valida con `zod` y responde 201, 200 al reintentar el mismo UUID, 422 `sin_consentimiento` y 422 `edad_fuera_de_rango_sin_confirmar`; pasan `RF-202: COORD inscribe y recibe 201`, `RF-202: CAT y FAM reciben 403`, `RF-202: sin consentimiento responde 422` y `RF-202: edad fuera de 8 a 13 sin confirmar responde 422` (el delegado se cubre en T002-79); y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-36** Responder 409 de posible duplicado con referencia opaca **[Primer corte]**
  - RF: RF-201
  - Depende de: T002-06, T002-35
  - Hecho cuando: si `claveDuplicado` coincide con un perfil no anonimizado y no viene `duplicadoDescartado`, responde 409 `posible_duplicado` con una `referencia` opaca y de vida corta, sin dependencia nueva; pasa `RF-201: el 409 de posible duplicado no contiene nombres, fechas ni el id`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-37** Exponer `POST /inscripciones/duplicados/confirmar` **[Primer corte]**
  - RF: RF-201
  - Depende de: T002-36
  - Hecho cuando: con `esElMismo=true` devuelve el resumen y el `catequizandoId` y con `false` deja continuar con `duplicado_descartado=true`; pasan `RF-201: los datos del perfil solo se ven tras confirmar`, `RF-201: el duplicado confirmado reutiliza el perfil y crea una inscripción nueva`, `RF-201: un niño tiene un solo perfil entre ciclos` y `RF-201: una referencia vencida o ajena responde 403 sin datos`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-38** Inscribir con un apoderado existente (hermanos) **[Primer corte]**
  - RF: RF-207
  - Depende de: T002-35
  - Hecho cuando: `POST /inscripciones` acepta `apoderadoId` existente; pasan `RF-207: un apoderado existente se vincula a un segundo niño sin duplicarse` y `RF-207: se inscribe un niño con dos apoderados`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-39** Exponer `GET /apoderados?q=` con límite por llamante **[Primer corte]**
  - RF: RF-207
  - Depende de: T002-13, T002-20
  - Hecho cuando: solo COORD; el límite por llamante se implementa en la Function (APIM Consumo no lo permite, plan 001 §5.3); pasan `RF-207: COORD busca apoderados por nombre o contacto`, `RF-207: CAT y FAM reciben 403 al buscar apoderados` y `RF-207: superar el límite por llamante responde 429`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-40** Asignar o cambiar de grupo (`PUT /inscripciones/{id}/grupo`) **[Primer corte]**
  - RF: RF-206
  - Depende de: T002-07, T002-22, T002-35
  - Hecho cuando: cierra la asignación vigente, abre otra y marca `fuera_de_sugerencia` con motivo opcional; pasan `RF-206: se puede asignar un grupo distinto del sugerido` y `RF-206: el cambio de grupo conserva el historial y el catequista nuevo ve al niño`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-41** Exponer el perfil básico (`GET /catequizandos/{id}/perfil`) **[Primer corte]**
  - RF: RF-201, RF-206, RF-207
  - Depende de: T002-12, T002-24, T002-40
  - Hecho cuando: `consultar-perfil.ts` y `http/perfil.ts` devuelven nombre, edad, grupo, historial de grupos y apoderados según `camposDePerfilVisibles`, con `Cache-Control: no-store`; pasan `RF-201: el perfil muestra nombre, edad, grupo y apoderados`, `RF-201: CAT de otro grupo y FAM ajena reciben 403 sin revelar si existe` y `RF-201: SUP recibe 403 en el perfil` (supuesto C-09); y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-42** Exponer el carné individual y su reemisión **[Primer corte]**
  - RF: RF-302 (003)
  - Depende de: T002-10, T002-13, T002-23
  - Hecho cuando: `GET /catequizandos/{id}/carne` devuelve contenido del QR, nombre y grupo y `POST /catequizandos/{id}/carne/reemitir` invalida la emisión anterior; pasan `RF-302: reemitir invalida la emisión anterior` y `RF-302: CAT y FAM reciben 403 en el carné`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-43** Exponer los carnés de un grupo (`GET /grupos/{id}/carnes`) **[Primer corte]**
  - RF: RF-302 (003)
  - Depende de: T002-42
  - Hecho cuando: pasa `RF-302: la hoja de un grupo trae un carné por niño activo y ninguno de anulados ni de otros grupos`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

### 1.6 Cliente

- [ ] **T002-44** Implementar `src/lib/catequizandos/api.ts` **[Primer corte]**
  - RF: RF-201, RF-202, RF-206, RF-207, RF-302 (003)
  - Depende de: T002-14, T001 (F1: cliente HTTP `src/plataforma/api/cliente.ts`)
  - Hecho cuando: expone funciones tipadas de los endpoints de fase 1 con el cliente HTTP inyectado (sin importar Expo ni `@/plataforma`); pasa `RF-202: inscribir envía el UUID generado en el cliente y reintenta con el mismo`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-45** Crear `aviso-sin-conexion.tsx` y el hook de conectividad **[Primer corte]**
  - RF: RF-202, RNF-202
  - Depende de: T001 (F0-2: `@testing-library/react-native`), T003-74
  - Hecho cuando: el componente (o el de 001, si ya existe) se muestra con NetInfo simulado sin red; pasa `RF-202: sin conexión se muestra "Inscribir requiere conexión"`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-46** Construir el paso 1 del asistente (datos del niño) **[Primer corte]**
  - RF: RF-202, RNF-201, RNF-202
  - Depende de: T002-05, T002-45, T001 (F1: grupo de rutas `(equipo)` y guardas)
  - Hecho cuando: `src/app/(equipo)/coordinacion/inscripcion/nueva.tsx` y `formulario-inscripcion.tsx` piden nombres, apellidos, fecha de nacimiento (selector hecho con componentes del núcleo, sin dependencia nueva), sexo y bautizado con un toque, y muestran la advertencia de edad; pasan `RF-202: el paso 1 advierte la edad fuera de rango y exige confirmar` y `RNF-201: el paso 1 solo pide los campos de CAMPOS_OBLIGATORIOS`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-47** Construir el paso 2 del asistente (apoderado nuevo o buscado) **[Primer corte]**
  - RF: RF-202, RF-207
  - Depende de: T002-44, T002-46
  - Hecho cuando: permite dar de alta un apoderado (nombres, apellidos, relación y contacto) o elegir uno con `GET /apoderados`; pasan `RF-207: el paso 2 permite elegir un apoderado existente` y `RF-202: el paso 2 no avanza sin un medio de contacto`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-48** Construir el paso 3 del asistente (consentimiento) **[Primer corte]** **[Bloqueada por aclaración: C-08]**
  - RF: RF-202
  - Depende de: T002-02, T002-47, T001 (F1b: componente `src/components/seguridad/consentimiento.tsx`)
  - Hecho cuando: el paso muestra el componente de 001 y solo avanza con "El apoderado acepta"; pasa `RF-202: sin aceptar el consentimiento no se llega al paso 4`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-49** Construir el paso 4 del asistente (grupo sugerido y envío) **[Primer corte]**
  - RF: RF-201, RF-202, RF-206
  - Depende de: T002-33, T002-35, T002-37, T002-48, T008-15
  - Hecho cuando: `selector-grupo-sugerido.tsx` muestra los grupos sugeridos con su total y deja elegir otro; el envío toma el ciclo abierto, maneja 201, 409 (aviso de posible duplicado sin datos, con "Es el mismo niño" y "Es otro niño") y 422; el borrador solo vive en memoria; pasan `RF-201: el aviso de duplicado no muestra datos del perfil existente` y `RF-206: el paso 4 permite elegir un grupo no sugerido`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-50** Bloquear el asistente sin conexión y verificarlo a 360 px **[Primer corte]**
  - RF: RF-202, RNF-202
  - Depende de: T002-49
  - Hecho cuando: pasan `RF-202: sin conexión el asistente no envía y muestra el aviso` y `RNF-202: el asistente se renderiza a 360 px sin desbordes`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-51** Construir la lista de catequizandos sobre la nómina local **[Primer corte]**
  - RF: RF-201, RNF-204
  - Depende de: T002-28, T002-45
  - Hecho cuando: `src/app/(equipo)/catequizandos/index.tsx` busca en la tabla local `catequizandos` y muestra primero los grupos del catequista; pasa `RNF-204: sin conexión la lista busca por nombre en la nómina local`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-52** Construir la pantalla del perfil básico **[Primer corte]**
  - RF: RF-201, RF-206, RNF-204
  - Depende de: T002-41, T002-44, T002-51
  - Hecho cuando: `src/app/(equipo)/catequizandos/[id]/index.tsx` con conexión muestra nombre, edad, grupo, historial de grupos y apoderados; sin conexión muestra nombre y grupo del almacén local y "Disponible con conexión" en el resto; pasan `RNF-204: sin conexión el perfil muestra nombre y grupo desde el almacén local` y `RF-201: el perfil en línea no guarda nada en el almacén local`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-53** Construir la lista de grupos de coordinación **[Primer corte]**
  - RF: RF-206
  - Depende de: T002-28, T002-32, T002-44
  - Hecho cuando: `src/app/(equipo)/coordinacion/grupos/index.tsx` lista los grupos con su total y el aviso "Sin catequista" con conexión, y los nombres de los grupos locales sin ella; pasa `RF-206: la lista de grupos marca los grupos sin catequista`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-54** Construir las pantallas de crear y editar grupo **[Primer corte]**
  - RF: RF-206
  - Depende de: T002-30, T002-31, T002-53
  - Hecho cuando: `nuevo.tsx` propone rango y modalidad según la regla habitual y `[id].tsx` renombra, ajusta, cierra y asigna catequistas, con la edición desactivada sin conexión; pasan `RF-206: al crear un grupo de 11 años se propone separar por sexo` y `RF-206: sin conexión no se edita un grupo`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-55** Instalar `react-native-svg` y crear `codigo-qr.tsx` y `tarjeta-carne.tsx` **[Primer corte]**
  - RF: RF-302 (003)
  - Depende de: T002-01, T002-11
  - Hecho cuando: `react-native-svg` se instaló con `npx expo install` (versión del SDK 57); `codigo-qr.tsx` pinta `matrizQr` y `tarjeta-carne.tsx` muestra nombre, grupo y QR; pasa `RF-302: codigo-qr pinta tantos módulos oscuros como la matriz`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-56** Construir la pantalla del carné **[Primer corte]**
  - RF: RF-302 (003)
  - Depende de: T002-28, T002-42, T002-55
  - Hecho cuando: `src/app/(equipo)/catequizandos/[id]/carne.tsx` arma el carné desde la nómina local y reemite solo con conexión; pasan `RF-302: sin conexión el carné muestra el código SGC1 de la nómina local` y `RF-302: sin conexión no se puede reemitir`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-57** Generar el HTML de la hoja de carnés en `carne.ts` **[Primer corte]**
  - RF: RF-302 (003)
  - Depende de: T002-11
  - Hecho cuando: la función pura `hojaCarnesHtml(carnes)` usa `svgDeMatriz` y escapa los nombres; pasan `RF-302: la hoja tiene un carné por niño` y `RF-302: la hoja escapa caracteres HTML en los nombres`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-58** Instalar `expo-print` y construir la hoja imprimible por grupo **[Primer corte]**
  - RF: RF-302 (003)
  - Depende de: T002-01, T002-43, T002-57
  - Hecho cuando: `expo-print` se instaló con `npx expo install`; `src/app/(equipo)/coordinacion/grupos/[id]/carnes.tsx` exige conexión y usa `Print.printToFileAsync({ html })` en nativo y `Print.printAsync()` en web, con la API comprobada en la documentación v57; pasa `RF-302: la pantalla de carnés pide la hoja al servidor y la imprime` con `expo-print` simulado; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

### 1.7 Cierre del primer corte

- [ ] **T002-59** Escribir el extremo a extremo reducido de la API **[Primer corte]**
  - RF: RF-201, RF-202, RF-206, RF-302 (003), RNF-204
  - Depende de: T002-26, T002-27, T002-37, T002-38, T002-40, T002-43
  - Hecho cuando: `api/test/integracion/flujo-inscripcion.test.ts` crea dos grupos de 8 años, inscribe dos niños, verifica el pull de nómina, cambia de grupo a uno y resuelve su carné; pasa `RF-206: flujo reducido grupos → inscripción → nómina → carné`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-60** Verificar en campo la digitación y el uso en celular **[Primer corte]**
  - RF: RNF-201, RNF-202
  - Depende de: T002-50, T002-52, T002-56, T002-58
  - Hecho cuando: la lista de verificación de la fase registra, con fecha y responsable, una inscripción cronometrada en menos de 3 minutos (sin contar la lectura del consentimiento) en un celular de gama baja y el flujo completo de inscripción y consulta en un celular de 360 px; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

---

## Fase 2 — Correcciones, documentos y apoderados

### 2.1 Migraciones y dominio

- [ ] **T002-61** Escribir `0205_crear_cambio_inscripcion.sql` (M-205)
  - RF: RF-203
  - Depende de: T002-18
  - Hecho cuando: la migración crea `cambio_inscripcion`, revoca `UPDATE` y `DELETE` a `sigecat_api` y solo deja anonimizar a `sigecat_retencion`; pasa `RF-203: el historial solo admite inserciones`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-62** Escribir `0206_crear_documento_inscripcion.sql` (M-206)
  - RF: RF-204
  - Depende de: T002-61
  - Hecho cuando: la migración crea `documento_inscripcion` sin columnas de archivo; pasan `RF-204: el esquema no tiene columnas de archivo, URL ni bytea`, `RF-204: inválido exige motivo (BD)` y `RF-204: un solo estado por documento e inscripción`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-63** Agregar la FK `aviso_grupo.grupo_id → grupo`
  - RF: RF-206 (dependencia de esquema del RF-103 de 001)
   - Depende de: T002-16, T001-113 (`0107_aviso_grupo.sql`)
  - Hecho cuando: una migración nueva del bloque 02 agrega la FK que el plan 001 §3.1 asigna a 002; pasa `RF-206: un aviso de grupo no puede apuntar a un grupo inexistente`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-64** Implementar `correcciones.ts`
  - RF: RF-203
  - Depende de: T002-07
  - Hecho cuando: `diferenciasCorregibles` y `cambiaGrupoSugerido` pasan `RF-203: diferenciasCorregibles devuelve solo los campos cambiados con valor anterior y nuevo`, `RF-203: un cambio de fecha de nacimiento que saca al niño del rango de su grupo cambia el grupo sugerido` y `RF-203: un cambio que no afecta la edad no avisa`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-65** Implementar los estados iniciales de `documentos.ts`
  - RF: RF-204
  - Depende de: T002-03
  - Hecho cuando: `TIPOS_DOCUMENTO`, `estadosIniciales` y `cuentaComoPendiente` pasan `RF-204: un niño no bautizado arranca con la partida de bautismo en no_aplica`, `RF-204: se crean los cinco documentos` y `RF-204: inválido cuenta como pendiente`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-66** Implementar `aplicarCambioDocumento` con sus transiciones
  - RF: RF-204
  - Depende de: T002-65
  - Hecho cuando: pasan `RF-204: bautismo durante el ciclo: no_aplica→pendiente`, `RF-204: inválido exige motivo y cuenta como pendiente`, `RF-204: pendiente→entregado con fecha posterior al inicio`, `RF-204: la boleta pasa a no_aplica con motivo exonerado y no cuenta como pendiente` (supuesto C-03, D-209) y `RF-204: rechaza transiciones no permitidas` (la ficha de compromiso solo registra estado, supuesto C-05); y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-67** Implementar `efectoDesvinculacion` en `apoderados.ts`
  - RF: RF-207
  - Depende de: T002-09
  - Hecho cuando: pasan `RF-207: con otros vínculos vigentes se quita solo el alcance de ese niño` y `RF-207: sin vínculos restantes se revoca el enlace` (supuesto C-06, D-211); y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-68** Implementar `repositorio-documentos-pg.ts` y el escritor de `cambio_inscripcion`
  - RF: RF-203, RF-204
  - Depende de: T002-19, T002-61, T002-62
  - Hecho cuando: ambos escriben dentro de la transacción recibida; pasan `RF-203: escribir un cambio guarda autor, fecha, valor anterior y nuevo` y `RF-204: actualizar un documento conserva una fila por tipo`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

### 2.2 API

- [ ] **T002-69** Crear los cinco documentos al inscribir
  - RF: RF-204
  - Depende de: T002-35, T002-65, T002-68
  - Hecho cuando: `inscribir.ts` crea los documentos con `estadosIniciales(bautizado)` en la misma transacción; pasa `RF-204: la inscripción de un niño no bautizado crea la partida de bautismo en no_aplica`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-70** Corregir datos del niño (`PATCH /catequizandos/{id}`)
  - RF: RF-203
  - Depende de: T002-41, T002-64, T002-68
  - Hecho cuando: `corregir-catequizando.ts` escribe el historial en la misma transacción, recalcula `clave_duplicado` y devuelve `avisoGrupoSugerido` sin mover al niño; pasan `RF-203: la corrección guarda el valor anterior, el autor y la fecha`, `RF-203: un cambio de fecha de nacimiento avisa del nuevo grupo sin mover al niño` y `RF-203: CAT, FAM y SUP reciben 403 al corregir`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-71** Exponer el historial de correcciones (`GET /catequizandos/{id}/cambios`)
  - RF: RF-203
  - Depende de: T002-70
  - Hecho cuando: solo COORD; pasa `RF-203: el historial muestra al autor con su identidad operativa`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-72** Anular una inscripción (`POST /inscripciones/{id}/anular`)
  - RF: RF-203
  - Depende de: T002-23, T002-27, T002-68
  - Hecho cuando: `anular-inscripcion.ts` exige motivo, marca `anulada`, cierra la asignación, invalida el carné y escribe el cambio sin borrar filas; pasan `RF-203: anular retira al niño del grupo y de la nómina sin borrar sus registros`, `RF-203: un niño anulado sale en deleted del siguiente pull` y `RF-203: después de anular se puede crear otra inscripción vigente en el mismo ciclo`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-73** Cambiar el estado de un documento (`PUT /inscripciones/{id}/documentos/{tipo}`)
  - RF: RF-203, RF-204
  - Depende de: T002-66, T002-68, T002-69
  - Hecho cuando: aplica `aplicarCambioDocumento`, guarda la fecha y `recibido_por`, escribe `cambio_inscripcion` y responde 422 ante una transición inválida; solo COORD; pasan `RF-204: COORD marca un documento como entregado` y `RF-204: marcar inválido sin motivo responde 422`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-74** Consultar los documentos (`GET /inscripciones/{id}/documentos`)
  - RF: RF-204
  - Depende de: T002-24, T002-73
  - Hecho cuando: COORD, CAT(g) y FAM(n) reciben estado, fecha y `recibidoPor` (identidad operativa) con `no-store`; pasan `RF-204: FAM(n) consulta los documentos de su hijo`, `RF-204: FAM ajena y CAT de otro grupo reciben 403` y `RF-204: la respuesta no contiene imágenes ni URL`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-75** Listar documentos pendientes (`GET /ciclos/{cicloId}/documentos-pendientes`)
  - RF: RF-204
  - Depende de: T002-73
  - Hecho cuando: solo COORD; pasan `RF-204: la lista de pendientes incluye los inválidos` y `RF-204: la lista de pendientes se filtra por grupo`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-76** Agregar el estado de documentos al perfil
  - RF: RF-201, RF-204
  - Depende de: T002-41, T002-74
  - Hecho cuando: pasa `RF-201: el perfil muestra nombre, edad, grupo, apoderados y documentos`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-77** Vincular un apoderado (`POST /catequizandos/{id}/apoderados`)
  - RF: RF-207
  - Depende de: T002-39, T002-67, T002-68, T001 (F1: `crearCuentaFamilia` y `emitirEnlace`)
  - Hecho cuando: vincula un apoderado nuevo o existente con su relación, escribe el cambio y, si es nuevo, pide a 001 su cuenta y su enlace; pasan `RF-207: vincular un apoderado nuevo pide a 001 su enlace` y `RF-207: vincular dos veces al mismo apoderado no duplica el vínculo`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-78** Desvincular un apoderado (`DELETE /catequizandos/{id}/apoderados/{apoderadoId}`)
  - RF: RF-207
  - Depende de: T002-77, T001 (F1: `revocarEnlace`)
  - Hecho cuando: cierra el vínculo (`vigente_hasta`, `desvinculado_por`), escribe el cambio y aplica `efectoDesvinculacion`; pasan `RF-207: desvincular llama a 001 para quitar el alcance de ese niño`, `RF-207: sin vínculos restantes se revoca el enlace` y `RF-207: el apoderado desvinculado recibe 403 en el perfil del niño`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-79** Completar la matriz HTTP con delegado vigente y vencido
  - RF: RF-202, RF-203, RF-204, RF-206
  - Depende de: T002-35, T002-70, T002-73, T001 (F2: `0103_delegacion.sql`)
  - Hecho cuando: los tests HTTP de escritura de 002 incluyen delegado vigente (2xx) y delegado vencido o revocado (403); pasa `RF-202: solo COORD o un delegado vigente inscribe`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

### 2.3 Cliente

- [ ] **T002-80** Construir la pantalla de edición
  - RF: RF-202, RF-203
  - Depende de: T002-45, T002-70, T002-71
  - Hecho cuando: `src/app/(equipo)/catequizandos/[id]/editar.tsx` pasa `RF-203: la edición muestra el aviso de grupo sugerido sin mover al niño`, `RF-203: la pantalla muestra el historial de correcciones` y `RF-202: sin conexión la edición está bloqueada`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-81** Agregar la acción de anular inscripción
  - RF: RF-203
  - Depende de: T002-72, T002-80
  - Hecho cuando: la acción pide motivo y confirmación; pasa `RF-203: anular desde la app exige motivo`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-82** Construir la pantalla de documentos
  - RF: RF-204
  - Depende de: T002-45, T002-73, T002-74
  - Hecho cuando: `src/app/(equipo)/catequizandos/[id]/documentos.tsx` muestra los cinco estados con cambio por toque para COORD, pide motivo para inválido, es de solo lectura para CAT(g) y FAM(n) y se bloquea sin conexión; pasan `RF-204: la pantalla muestra los cinco documentos y ninguna imagen` y `RF-204: CAT ve los documentos sin poder cambiarlos`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-83** Construir la pantalla de documentos pendientes
  - RF: RF-204
  - Depende de: T002-75
  - Hecho cuando: `src/app/(equipo)/coordinacion/documentos-pendientes.tsx` pasa `RF-204: la lista de pendientes se filtra por grupo en la app`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-84** Construir la pantalla de apoderados
  - RF: RF-207
  - Depende de: T002-77, T002-78
  - Hecho cuando: `src/app/(equipo)/catequizandos/[id]/apoderados.tsx` se bloquea sin conexión y pasa `RF-207: la pantalla vincula un apoderado existente y desvincula pidiendo confirmación`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-85** Mostrar los documentos pendientes en la vista de familia
  - RF: RF-204
  - Depende de: T002-74, T001 (F1: grupo de rutas `(familia)`)
  - Hecho cuando: la vista de familia (Expo web) tiene la sección "Documentos pendientes" de cada hijo vinculado (HU-206); pasa `RF-204: la familia ve qué documentos de su hijo están pendientes`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-86** Ampliar la pantalla del perfil con documentos y accesos por rol
  - RF: RF-201, RF-204, RF-207
  - Depende de: T002-52, T002-76, T002-82, T002-84
  - Hecho cuando: el perfil enlaza a editar, documentos, apoderados y carné según el rol, y muestra el estado de documentos con conexión; pasa `RF-201: el perfil muestra los cinco documentos con conexión y "Disponible con conexión" sin ella`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

---

## Fase 3 — Condiciones y perfil completo

### 3.1 Migración y dominio

- [ ] **T002-87** Escribir `0207_crear_condicion_catequizando.sql` (M-207)
  - RF: RF-205, RNF-203
  - Depende de: T002-62
  - Hecho cuando: la migración crea `condicion_catequizando` con el CHECK de la lista cerrada y `nota varchar(200)`; pasan `RF-205: la BD rechaza una categoría fuera de la lista` y `RF-205: la BD rechaza una nota de más de 200 caracteres` (supuestos C-04 y C-12); y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-88** Implementar `condiciones.ts`
  - RF: RF-205
  - Depende de: T002-03, T002-87
  - Hecho cuando: `CATEGORIAS_CONDICION`, `LARGO_MAXIMO_NOTA` y `validarCondiciones` pasan `RF-205: rechaza categorías fuera de la lista cerrada`, `RF-205: rechaza una nota de más de 200 caracteres`, `RF-205: rechaza categorías repetidas` y `RF-205: CATEGORIAS_CONDICION coincide con el CHECK de 0207`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-89** Registrar los campos de 002 en el catálogo de datos de 001
  - RF: RF-205, RNF-203
  - Depende de: T002-87, T001 (F3: `catalogo-datos.ts`)
  - Hecho cuando: el `CATALOGO` incluye cada campo personal de 0201 a 0207 con clasificación y finalidad (condiciones y nota como `restringido` con finalidad `formar-grupos`); pasa el test de 001 `RF-107: todo campo personal de las migraciones figura en el catálogo con su finalidad`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-90** Implementar `repositorio-condiciones-pg.ts`
  - RF: RF-205, RF-206
  - Depende de: T002-19, T002-87
  - Hecho cuando: reemplaza la lista de un niño en una transacción y cuenta condiciones por categoría y grupo; pasan `RF-205: reemplazar la lista borra las categorías quitadas` y `RF-206: el conteo por categoría es agregado y no devuelve ids`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

### 3.2 API

- [ ] **T002-91** Registrar condiciones (`PUT /catequizandos/{id}/condiciones`)
  - RF: RF-205
  - Depende de: T002-13, T002-88, T002-90, T001 (F1: `auditar`)
  - Hecho cuando: solo COORD; valida con `validarCondiciones`, audita la escritura y no escribe la lista en los logs; pasan `RF-205: COORD registra condiciones y queda auditado` y `RF-205: CAT y FAM reciben 403 al escribir condiciones`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-92** Consultar condiciones (`GET /catequizandos/{id}/condiciones`)
  - RF: RF-205, RNF-203
  - Depende de: T002-91
  - Hecho cuando: COORD y CAT(g) leen con auditoría (cierre en falla de 001) y `no-store`; pasan `RF-205: CAT de otro grupo y FAM reciben 403`, `RF-205: la lectura queda auditada`, `RNF-203: las condiciones responden con no-store` y `RF-205: los logs de la petición no contienen las condiciones`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-93** Agregar el conteo por categoría a las sugerencias de grupo
  - RF: RF-206
  - Depende de: T002-33, T002-90
  - Hecho cuando: `POST /grupos/sugerencias` devuelve el total y el conteo por categoría de cada grupo, siempre agregado; pasa `RF-206: la sugerencia incluye el total y el conteo por categoría`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-94** Forzar `no-store` en APIM y verificar que no se registran cuerpos
  - RF: RF-204, RF-205, RNF-203
  - Depende de: T002-74, T002-92, T001 (F0-4: Bicep de APIM con políticas base)
  - Hecho cuando: la política de APIM fuerza `Cache-Control: no-store` en `/perfil`, `/condiciones` y `/documentos`, y el diagnóstico guarda 0 bytes de cuerpo en las operaciones de 002; `az bicep build` compila; pasa `RNF-203: perfil, condiciones y documentos responden con no-store`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-95** Verificar RNF-203 con datos restringidos cargados
  - RF: RNF-203
  - Depende de: T002-28, T002-27, T002-92
  - Hecho cuando: con condiciones y documentos registrados pasan `RNF-203: con condiciones y documentos cargados el pull de nómina no los incluye` y `RNF-203: el esquema local no tiene tablas de condiciones ni de documentos`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-96** Definir el puerto `ProveedorResumenPerfil` y componer el perfil
  - RF: RF-201
  - Depende de: T002-41
  - Hecho cuando: `dominio/puertos.ts` define el puerto y su registro (D-212); pasan `RF-201: el perfil omite las secciones sin proveedor` y `RF-201: el perfil incluye el resumen de un proveedor registrado y respeta su alcance`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-97** Integrar los proveedores reales de resumen
  - RF: RF-201
  - Depende de: T002-96, T003 (proveedor de resumen de asistencia para el perfil; ver Notas), T004-64, T005-35, T007-58
  - Hecho cuando: con los proveedores registrados pasa el test de integración `RF-201: el perfil muestra el resumen de asistencia, justificaciones y avance del ciclo actual`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

### 3.3 Cliente

- [ ] **T002-98** Construir la pantalla de condiciones
  - RF: RF-205, RNF-203
  - Depende de: T002-45, T002-92
  - Hecho cuando: `src/app/(equipo)/catequizandos/[id]/condiciones.tsx` muestra casillas de la lista cerrada y la nota con contador de 200, es de solo lectura para CAT(g) y se bloquea sin conexión; pasan `RNF-203: la pantalla de condiciones no escribe en el almacén local` y `RF-205: CAT ve las condiciones sin poder editarlas`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-99** Mostrar los conteos por categoría en el paso 4 del asistente
  - RF: RF-206
  - Depende de: T002-49, T002-93
  - Hecho cuando: pasa `RF-206: el paso 4 muestra cuántos niños hay por categoría en cada grupo sugerido`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-100** Integrar los resúmenes de otras specs en la pantalla del perfil
  - RF: RF-201, RNF-204
  - Depende de: T002-86, T002-97, T004-64, T005-35, T005-48, T005-57, T007-58
  - Hecho cuando: el perfil embebe los componentes de 004, 005 y 007 y, sin conexión, muestra asistencia y avance si están en el almacén local; pasan `RNF-204: sin conexión el perfil muestra asistencia y avance ya sincronizados` y `RF-201: el catequista ve el año completo del niño en el perfil`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-101** Verificar a 360 px las pantallas de las fases 2 y 3
  - RF: RNF-202
  - Depende de: T002-80, T002-82, T002-83, T002-84, T002-98, T002-100
  - Hecho cuando: pasa `RNF-202: editar, documentos, pendientes, apoderados, condiciones y perfil se renderizan a 360 px sin desbordes` y la verificación manual en un celular de 360 px queda registrada en la lista de la fase; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

---

## Fase 4 — Ciclo de vida del dato

- [ ] **T002-102** Implementar `eliminarDatosRestringidos` como participante de retención
  - RF: RF-205, RNF-203
  - Depende de: T002-90, T001 (F3: motor de retención y `registrarParticipanteRetencion`)
   - Hecho cuando: participante `catequizandos` borra condiciones, estados documentales e historial personal; cierra vigencias, invalida carné, anonimiza perfil y lo excluye como inactivo de nómina. Borra/anonimiza apoderado solo sin otros hijos vinculados. Usa transacción del motor con `SET LOCAL ROLE sigecat_retencion` y contexto `retiro_consentimiento`, también en ciclo cerrado. Tests `RF-106: retiro borra estados e historial personal`, `RF-207: retiro de un hijo conserva apoderado de otro hijo`, `RF-205: al retirar el consentimiento se borran las condiciones del niño`, rollback/participantes y checks pasan con evidencia.

- [ ] **T002-103** Implementar `anonimizarCatequizando` al vencer el ciclo
  - RF: RF-201, RF-203
  - Depende de: T002-61, T002-102
   - Hecho cuando: con rol `sigecat_retencion` y contexto `retencion`, ambos SET LOCAL, pone clave duplicado en NULL, anonimiza perfil/historial y marca `estado='anonimizado'`, solo sin inscripción en ciclo no vencido; tests RF-201/RF-203 incluyen rechazo con rol o contexto aislados. Checks pasan con evidencia.

- [ ] **T002-104** Exponer el puerto `crearInscripcion(tx, …)` para la reinscripción de 008
  - RF: RF-201
  - Depende de: T002-34, T002-37, T008-71, T008-72
  - Hecho cuando: el puerto reutiliza el perfil existente y la confirmación de duplicado usa `resolverReinscripcion`; pasan `RF-201: reinscribir en un ciclo nuevo reutiliza el perfil y crea otra inscripción` y `RF-201: un perfil anonimizado no se reutiliza y se crea uno nuevo`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-105** Escribir el extremo a extremo completo de la §9 del plan
  - RF: RF-201, RF-202, RF-203, RF-204, RF-205, RF-206, RF-207, RF-302 (003)
  - Depende de: T002-78, T002-92, T002-103, T002-104
  - Hecho cuando: `flujo-inscripcion.test.ts` recorre crear dos grupos de 8 años → inscribir → duplicado → corregir → documentos → condiciones → cambio de grupo → anular → reinscribir, y verifica el pull de nómina en cada paso; pasa `RF-201: flujo completo de inscripción con nómina verificada en cada paso`; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T002-106** Hacer bloqueante la verificación de cobertura de la spec 002
  - RF: RF-201, RF-202, RF-203, RF-204, RF-205, RF-206, RF-207, RNF-201, RNF-202, RNF-203, RNF-204, RF-302 (003)
  - Depende de: T002-105, T001 (F0-7: `verificar-cobertura-rf.mjs`)
  - Hecho cuando: `verificar-cobertura-rf` en modo bloqueante para 002 informa que cada requisito de la fila RF tiene al menos un test que lo cita; y `npm test`, `npm run typecheck` y `npm run lint` pasan.

---

## Cobertura

| Requisito | Tareas |
| --- | --- |
| RF-201 Perfil único | T002-03, T002-06, T002-12, T002-14, T002-18, T002-19, T002-25, T002-27, T002-34, T002-36, T002-37, T002-41, T002-44, T002-49, T002-51, T002-52, T002-59, T002-76, T002-86, T002-96, T002-97, T002-100, T002-103, T002-104, T002-105, T002-106 |
| RF-202 Inscripción | T002-02, T002-04, T002-05, T002-12, T002-13, T002-14, T002-15, T002-17, T002-22, T002-29, T002-34, T002-35, T002-44, T002-45, T002-46, T002-47, T002-48, T002-49, T002-50, T002-59, T002-79, T002-80, T002-105, T002-106 |
| RF-203 Corrección y anulación | T002-17, T002-61, T002-64, T002-68, T002-70, T002-71, T002-72, T002-73, T002-79, T002-80, T002-81, T002-103, T002-105, T002-106 |
| RF-204 Documentos de inscripción | T002-62, T002-65, T002-66, T002-68, T002-69, T002-73, T002-74, T002-75, T002-76, T002-79, T002-82, T002-83, T002-85, T002-86, T002-94, T002-105, T002-106 |
| RF-205 Condiciones a considerar | T002-03, T002-12, T002-13, T002-24, T002-87, T002-88, T002-89, T002-90, T002-91, T002-92, T002-94, T002-98, T002-102, T002-105, T002-106 |
| RF-206 Grupos | T002-03, T002-07, T002-08, T002-13, T002-14, T002-16, T002-17, T002-21, T002-22, T002-24, T002-27, T002-30, T002-31, T002-32, T002-33, T002-34, T002-40, T002-41, T002-44, T002-49, T002-52, T002-53, T002-54, T002-59, T002-63, T002-79, T002-90, T002-93, T002-99, T002-105, T002-106 |
| RF-207 Apoderados | T002-09, T002-14, T002-15, T002-20, T002-24, T002-34, T002-38, T002-39, T002-41, T002-44, T002-47, T002-67, T002-77, T002-78, T002-84, T002-86, T002-105, T002-106 |
| RNF-201 Mínima digitación | T002-05, T002-46, T002-60, T002-106 |
| RNF-202 Mobile-first | T002-45, T002-46, T002-50, T002-60, T002-101, T002-106 |
| RNF-203 Datos restringidos | T002-27, T002-28, T002-29, T002-87, T002-89, T002-92, T002-94, T002-95, T002-98, T002-102, T002-106 |
| RNF-204 Perfil liviano | T002-18, T002-27, T002-28, T002-51, T002-52, T002-59, T002-100, T002-106 |
| RF-302 de 003 (carné: contenido, emisión, reimpresión y hoja) | T002-01, T002-10, T002-11, T002-14, T002-18, T002-23, T002-26, T002-34, T002-42, T002-43, T002-44, T002-55, T002-56, T002-57, T002-58, T002-59, T002-105, T002-106 |

---

## Notas de coordinación

1. **Numeración de migraciones.** Se usa el bloque `02NN` de la convención del plan 001 §3.1 (`0201` a `0207` para M-201 a M-207; la FK de T002-63 toma el siguiente número libre del bloque). La vista `v_nomina_ciclo` va en `0204` y no en `0203`, como sugiere el plan, porque lee `carne_emision`.
2. **Nómina alineada:** `codigo_carne` derivado de `carne_emision.emision`, más `activo`; tablas SQL `catequizando`/`grupo`, colecciones locales `catequizandos`/`grupos`. T002-27 entrega interfaz; T002-28 comprueba contrato de 003.
3. **Puertos agregados al plan §5.2:** `FuenteInscripciones`, `grupoActual`, `apoderadosVinculados`, `marcarInactivo` y `crearInscripcion`; tareas T002-107/108. No acreditan implementación de 007/008.
4. **Compartir el PDF en nativo.** `Print.printToFileAsync` devuelve un archivo; compartirlo puede exigir `expo-sharing`, que no figura en D-210. T002-01 decide entre justificarlo o usar `Print.printAsync({ html })`.
5. **Selector de fecha.** El asistente no agrega `@react-native-community/datetimepicker`; si el equipo lo prefiere, primero se justifica en la spec.
6. **Resumen:** 003 aporta `resumenAsistencia` en T003-114; T002-97 integra asistencia real. 004/005/007 requieren su evidencia externa, no se sustituyen por resúmenes inventados.
7. **Retiro alineado:** T002-102 aplica plan §5.4 y RF-106 completo; incluye estados documentales aunque no existan archivos. Vencimiento usa rol y contexto `retencion`.
8. **Decisiones aceptadas:** C-01–C-13; cambios futuros requieren actualizar spec/migración, no reabrir aprobación para implementar la decisión vigente.

- [ ] **T002-107** Implementar `FuenteInscripciones` histórica para 003 (RF-201, RF-206, RF-305).
  - Depende de: T002-17, T002-22, T002-25.
  - Hecho cuando: periodos desde/hasta de inscripción/asignación resuelven grupo/actividad en fecha, incluyendo alta tardía, anulación y cambio de grupo, con batería falsa/PostgreSQL; ningún cálculo usa solo grupo actual. Checks con evidencia.
- [ ] **T002-108** Exponer puertos de integración 007/008 (RF-201, RF-207).
  - Depende de: T002-24, T002-78, T002-104.
  - Hecho cuando: `grupoActual`, `apoderadosVinculados`, `marcarInactivo` y `crearInscripcion` tienen contratos con tx/autorización y tests citando RF; se distingue puerto disponible de consumidor externo integrado. Checks con evidencia.

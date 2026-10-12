# 008 — Historial de ciclos · Plan técnico

> El CÓMO de [`spec.md`](spec.md). Si este plan y la spec divergen, se corrige primero la spec (principio 2).
> Las decisiones transversales (stack, Azure, WatermelonDB, identidad, Jest) vienen fijadas; aquí se citan, no se rediscuten.

## 1. Resumen y alcance

**Cubre:** RF-801, RF-802, RF-803, RF-804, RF-805, RF-806, RF-807, RF-808, RNF-801 y RNF-802.

| Pieza que define este plan (dueño: 008) | RF |
| --- | --- |
| Tabla `ciclo`, regla de un solo ciclo abierto, apertura | RF-801 |
| **Convención `ciclo_id`** y congelamiento de tablas operativas (la siguen 001 a 007) | RF-801, RF-802, RF-803 |
| Cierre: congelamiento, efectos sobre delegaciones, enlaces de familia y grupos; qué debe rechazar la sincronización | RF-802 |
| Excepciones al cierre (sacramento recibido, corrección de constancia, retención, retiro de consentimiento) | RF-803 |
| Sacramento recibido y constancia sacramental permanente (búsqueda y corrección) | RF-804, RF-805 |
| Indicadores por ciclo | RF-806 |
| Reinscripción con historial previo | RF-807 |
| Política de retención por ciclo: qué se anonimiza, qué se elimina y qué se conserva | RF-808 |

**Queda fuera** (por la spec o porque lo define otro plan):
- Reabrir un ciclo cerrado, digitalizar ciclos anteriores y emitir certificados (fuera de alcance de la spec).
- Motor de retención (timer, orquestación), delegaciones, enlaces, consentimiento y auditoría: **definido en plan 001**. Aquí solo va el manejador de retención del ciclo.
- Perfil, inscripción, grupos y apoderados: **definido en plan 002**. La reinscripción usa su puerto de inscripción.
- Protocolo de sincronización y esquema WatermelonDB: **definido en plan 003**. Aquí solo se fija qué debe rechazar el push y qué se purga en el celular.
- Borrado físico de evidencias en Blob: **definido en plan 004**. Aquí solo se invoca.
- Lista de aptos (RF-606) y saldos desde papel: **definidos en los planes 006 y 007**. Aquí solo se leen.

## 2. Verificación contra la constitución

| # | Principio | Cómo se cumple en 008 |
| --- | --- | --- |
| 1 | Stack mínimo | Sin dependencias nuevas. Azure Functions, PostgreSQL y el cliente de BD definidos en plan 001. La búsqueda sin tildes se resuelve en TypeScript, sin extensiones `unaccent`/`pg_trgm` (D-808). |
| 2 | La spec manda | Cada RF tiene fila en la matriz (§10) y tests que citan `RF-80x`. Las dudas van como `[NECESITA ACLARACIÓN]` con un supuesto reversible (§11), sin requisitos nuevos. |
| 3 | Lógica sin interfaz | Las reglas de ciclo, cierre, constancia, indicadores, reinscripción y retención viven en `src/lib/ciclos/` como TypeScript puro. La API las importa y esbuild las empaqueta. |
| 4 | Tests en verde | Jest en `src/` y `api/` (configuración en plan 001); `npm test`, `typecheck` y `lint` pasan antes de cada commit. |
| 5 | Offline primero | **Excepción acotada** (D-810): las operaciones de 008 son administrativas y requieren conexión. 008 no registra asistencia. La asistencia sigue siendo offline (plan 003); 008 solo le aporta el `ciclo_id` local. Se marca como `[NECESITA ACLARACIÓN]` (§11, A-5). |
| 6 | Persistencia segura | `ciclo`, `sacramento_recibido`, `constancia_sacramental`, `constancia_correccion` e inscripción reciben un UUID generado en el dispositivo y son idempotentes por UUID. El esquema solo cambia con migraciones `api/migraciones/NNNN_*.sql` que nunca se editan. |
| 7 | Datos de menores | La constancia y los indicadores **nunca** bajan al celular. La constancia guarda solo 6 campos (RF-805). Cada Function autoriza por rol en el servidor. La retención anonimiza a los 2 años y borra las evidencias (RF-808). El congelamiento también se impone en la BD, no solo en la interfaz. |
| 8 | Idioma | Tablas, columnas, archivos e identificadores en español sin tildes ni ñ (`constancia_sacramental`, `cicloVencido`); textos de interfaz en español. |
| 9 | Autoría trazable | Cada tarea de `tasks.md` va en un commit con su registro Agent Trace enlazado a la tarea. |
| 10 | Contexto curado | La convención `ciclo_id` + trigger (§3.1) se propone para `AGENTS.md`, porque la repiten todos los planes. La edición queda pendiente de aprobación; este plan no la hace. |
| 11 | Skills como paquete | Se propone que la skill de migración incluya la plantilla de tabla operativa (columna `ciclo_id`, índice y trigger de congelamiento). |

## 3. Modelo de datos

### 3.1 Convención para todos los planes (dueño: 008)

| Regla | Detalle | RF |
| --- | --- | --- |
| C-1 Toda tabla operativa lleva `ciclo_id` | `ciclo_id uuid NOT NULL REFERENCES ciclo(id)` más un índice que empieza por `ciclo_id`. Es operativa toda tabla cuyo contenido pertenece al año catequético: grupos y su asignación de catequistas, inscripción y documentos (002); sesiones, asistencia y correcciones (003); justificaciones (004); catálogo, evaluaciones y actividades (005); umbrales, decisiones, saldos y lista de aptos (006); alertas, contactos, fichas, retiros y saldos (007). Si una tabla hija tiene padre con ciclo, se recomienda una FK compuesta `(padre_id, ciclo_id)` para que no difieran. | RF-801 |
| C-2 Tablas transversales sin `ciclo_id` | Cuentas, roles, enlaces, delegaciones y auditoría (001); perfil del catequizando, apoderados, vínculo apoderado–niño y condiciones (002); `constancia_sacramental` y `constancia_correccion` (008). | RF-801, RF-805 |
| C-3 Trigger de congelamiento | Toda tabla operativa declara en su migración `CREATE TRIGGER t_<tabla>_ciclo_cerrado BEFORE INSERT OR UPDATE OR DELETE ON <tabla> FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();`. La función la define 008 (§3.2) y rechaza la escritura con `SQLSTATE 'SG801'` si el ciclo de la fila no está abierto. | RF-802, RF-803 |
| C-4 Excepciones al congelamiento | Motor 001 exige **ambos** `SET LOCAL ROLE sigecat_retencion` y `SET LOCAL sigecat.contexto = 'retencion'` o `'retiro_consentimiento'`. Solo caminos internos fijan contexto, nunca desde HTTP. Aplicar en retiro/vencimiento, también ciclo cerrado; RF-804/805 mantienen excepciones particulares | RF-803, RF-808 |
| C-5 Tareas programadas | Toda Function de temporizador de otro módulo (vencimiento de plazos en 004, recálculo de riesgo en 007, aptitud en 006) filtra `ciclo.estado = 'abierto'`. Si no lo hace, el trigger la rechaza. | RF-802 |
| C-6 Almacén local | Toda tabla operativa de WatermelonDB lleva `ciclo_id` (indexada). El celular asigna el `ciclo_id` del ciclo abierto local al crear un registro y no permite crear registros si no hay ciclo abierto. | RF-801, RF-802 |
| C-7 Ciclo en la sincronización | Al aplicar un lote, el push de 003 toma `SELECT estado FROM ciclo WHERE id = $1 FOR SHARE` en la misma transacción, lo que lo serializa con el cierre (D-803), y clasifica cada registro con `clasificarRegistroEntrante` (§4). | RF-802 |

### 3.2 Tablas PostgreSQL de 008

Acuerdo backend 001–003: `0002_ciclo_base.sql` precede operativas sin FK a `cuenta` aún inexistente; `0801_ciclo_cuentas.sql` las agrega tras `0101`. Soporte mínimo/puertos no acredita historial/constancia ni 008 completo. Límites por cuenta en Functions con contador PostgreSQL atómico; APIM global. Cierre sigue revocación/reemisión de 001, nunca reactivar credencial terminada; constancia real se preserva al integrar participante.

La numeración `NNNN` es provisional y la fija el orden de fusión. Restricción: **M1 debe aplicarse justo después de la migración base de 001 y antes de cualquier tabla operativa** (002 `grupo` ya referencia `ciclo`). Con el esquema `SSNN` del plan 001 (bloque = número de spec), M1 se numera como `0002_ciclo_base.sql`, inmediatamente después de `0001_base.sql`, como excepción explícita al bloque 08; el resto de migraciones de esta spec sí usan el bloque `08NN`.

| Migración | Contenido | RF |
| --- | --- | --- |
| **M1** `NNNN_ciclos_base.sql` (fase 0) | Tabla `ciclo`, índice único parcial, trigger de transición, función `ciclo_bloquear_si_cerrado()` | RF-801, RF-802, RF-803 |
| **M2** `NNNN_ciclos_cierre.sql` | `registro_descartado_cierre`, `indicador_ciclo` | RF-802, RF-806 |
| **M3** `NNNN_ciclos_constancia.sql` | `sacramento_recibido`, `constancia_sacramental`, `constancia_correccion` | RF-804, RF-805 |
| **M4** `NNNN_ciclos_retencion.sql` | `retencion_ciclo_paso` | RF-808 |

**`ciclo`** (RF-801, RF-802, RF-803)

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid PK | Generado en el dispositivo |
| `nombre` | text NOT NULL | Ej. «Ciclo 2027» |
| `inicio`, `fin` | date NOT NULL | `CHECK (fin > inicio)`; HTTP serializa `fechaInicio`/`fechaFin`, sync `fecha_inicio`/`fecha_fin` |
| `estado` | text NOT NULL | `CHECK (estado IN ('abierto','cerrado'))` |
| `abierto_por`, `abierto_en` | uuid → cuenta, timestamptz | |
| `cerrado_por`, `cerrado_en` | uuid → cuenta, timestamptz NULL | `cerrado_en` en hora del servidor |
| `depurado_en` | timestamptz NULL | Se fija cuando termina la retención (RF-808) |

- `CREATE UNIQUE INDEX ux_ciclo_un_abierto ON ciclo ((true)) WHERE estado = 'abierto';`: un solo ciclo abierto (RF-801, D-801).
- Trigger `ciclo_transicion_valida`: solo admite `abierto → cerrado`. En un ciclo cerrado solo deja cambiar `depurado_en`, y prohíbe el DELETE (RF-803).
- Función `ciclo_bloquear_si_cerrado()`: lee `NEW.ciclo_id` (u `OLD.ciclo_id` en DELETE) y lanza `SG801` si ciclo no está abierto, salvo `current_user = 'sigecat_retencion'` **y** contexto en `('retencion','retiro_consentimiento')` (C-4).

**`registro_descartado_cierre`** (RF-802). Sirve de traza mínima y no guarda el contenido del registro (minimización).

| `id` uuid PK · `ciclo_id` → ciclo · `tabla` text · `registro_id` uuid · `cuenta_id` uuid · `recibido_en` timestamptz |
| --- |

Índice `(ciclo_id, cuenta_id)`. La retención del ciclo la elimina.

**`indicador_ciclo`** (RF-806). Es una instantánea que se escribe al cerrar (D-809).

| `ciclo_id` PK → ciclo · `inscritos` int · `retirados` int · `asistencia_misa_pct` numeric(5,2) NULL · `asistencia_catequesis_pct` numeric(5,2) NULL · `aptos` int · `ninos_con_saldo_papel_aptitud` int · `ninos_con_saldo_papel_riesgo` int · `calculado_en` timestamptz |
| --- |

«Sacramentos recibidos» no se guarda aquí: se cuenta en vivo desde `constancia_sacramental`, porque puede crecer después del cierre (RF-804).

**`sacramento_recibido`** (RF-804). Es operativo y la retención lo anonimiza.

| Columna | Notas |
| --- | --- |
| `id` uuid PK | Del dispositivo; PUT idempotente |
| `ciclo_id` → ciclo | **Sin** trigger de congelamiento (excepción RF-803) |
| `catequizando_id` uuid NULL → perfil (002) | Pasa a NULL al anonimizar (RF-808) |
| `constancia_id` uuid UNIQUE → constancia_sacramental | |
| `sacramento` text | `CHECK (sacramento IN ('bautismo','primera_comunion'))` |
| `fecha_ceremonia` date | |
| `marcado_por` uuid → cuenta, `marcado_en` timestamptz | Quién y cuándo (RF-804) |

Índice único `(catequizando_id, sacramento) WHERE catequizando_id IS NOT NULL`: un sacramento no se marca dos veces a la misma persona.

**`constancia_sacramental`** (RF-805). Es permanente, **sin FK al perfil** (D-807).

| `id` uuid PK · `ciclo_id` → ciclo · `sacramento` text · `fecha_ceremonia` date · `nombres` text · `apellidos` text · `fecha_nacimiento` date · `nombre_busqueda` text (derivado de nombres + apellidos, normalizado en TS) · `version` int |
| --- |

- Índice `(fecha_nacimiento, nombre_busqueda)`.
- Sin trigger de congelamiento. El DELETE está prohibido por trigger, también en contexto de retención o de retiro de consentimiento.

**`constancia_correccion`** (RF-805). Bitácora de solo anexar: un trigger prohíbe UPDATE y DELETE.

| `id` uuid PK (del dispositivo) · `constancia_id` → constancia_sacramental · `campo` text · `valor_anterior` text · `valor_nuevo` text · `motivo` text `CHECK (length(trim(motivo)) > 0)` · `corregido_por` uuid · `corregido_en` timestamptz |
| --- |

**`retencion_ciclo_paso`** (RF-808). Permite reanudar la retención de forma idempotente.

| `ciclo_id` → ciclo · `paso` text · `filas_afectadas` int · `completado_en` timestamptz · PK `(ciclo_id, paso)` |
| --- |

### 3.3 Almacén local (WatermelonDB; esquema definido en plan 003)

| Tabla local | Columnas | Regla | RF |
| --- | --- | --- | --- |
| `ciclos` | `id`, `nombre`, `fecha_inicio`, `fecha_fin`, `estado` | Solo baja el ciclo abierto. Si no hay ninguno, el pull envía la eliminación del anterior. | RF-801 |
| Tablas operativas (003–007) | `ciclo_id` indexado (C-6) | Tras un pull sin ciclo abierto, o con un ciclo distinto, el cliente purga los registros cuyo `ciclo_id` no es el abierto (`debePurgarseLocalmente`). | RF-802 |

Nunca bajan al celular: `constancia_sacramental`, `constancia_correccion`, `sacramento_recibido`, `indicador_ciclo` ni el historial previo (principio 7, D-810).

## 4. Lógica de dominio en `src/lib/ciclos/`

TypeScript puro, sin React, React Native ni Expo. Firmas ilustrativas:

| Archivo | Función / tipo | Regla | RF |
| --- | --- | --- | --- |
| `ciclo.ts` | `type EstadoCiclo = 'abierto' \| 'cerrado'`; `validarAperturaCiclo(datos, cicloAbierto: Ciclo \| null): Resultado` | Pide nombre, `fecha_fin > fecha_inicio` y que no haya otro abierto | RF-801 |
| `ciclo.ts` | `transicionCiclo(estado, accion: 'cerrar' \| 'reabrir'): Resultado<EstadoCiclo>` | Solo `abierto → cerrado`; `reabrir` siempre se rechaza; cerrar un ciclo cerrado es un no-op idempotente | RF-801, RF-803 |
| `ciclo.ts` | `puedeCrearRegistrosLocales(cicloLocal: Ciclo \| null): boolean` | Sin ciclo abierto no se crea nada | RF-801 |
| `cierre.ts` | `admiteEscritura(estadoCiclo, operacion: TipoOperacion): Resultado` | Con el ciclo cerrado solo pasan `sacramento_recibido`, `correccion_constancia`, `retencion` y `retiro_consentimiento` | RF-802, RF-803 |
| `cierre.ts` | `clasificarRegistroEntrante({ cicloIdRegistro, cicloAbiertoId, yaExiste, sinCambios }): 'aplicar' \| 'ya_aplicado' \| 'descartar_ciclo_cerrado'` | Contrato para el push de 003 (ver §5.2) | RF-802 |
| `cierre.ts` | `debePurgarseLocalmente(cicloIdRegistro, cicloAbiertoId \| null): boolean` | Purga local después del cierre | RF-802 |
| `cierre.ts` | `efectosDelCierre(ciclo, delegacionesVigentes, apoderados): EfectosCierre` | Lista de delegaciones a terminar y enlaces de familia a suspender. Los catequistas no se tocan (D-805). Ninguna cuenta se desactiva. | RF-802 |
| `constancia.ts` | `type Sacramento = 'bautismo' \| 'primera_comunion'`; `validarSacramentoRecibido({ enListaDeAptos, sacramento, fechaCeremonia, ciclo, hoy, yaMarcado })` | El niño está en la lista de aptos (RF-606); la fecha va entre el inicio del ciclo y hoy; no hay marca previa del mismo sacramento. **No** exige que el ciclo esté abierto. | RF-804 |
| `constancia.ts` | `crearEntradaConstancia(perfil, sacramento, fechaCeremonia, cicloId): EntradaConstancia` | Copia **solo** los 6 campos y descarta el resto | RF-805 |
| `constancia.ts` | `normalizarNombre(texto): string` | Minúsculas, sin tildes ni diéresis, ñ → n, espacios colapsados | RF-805 |
| `constancia.ts` | `coincideBusqueda(entrada, consulta: { nombre, fechaNacimiento }): boolean` | Fecha exacta y todos los términos del nombre contenidos en `nombre_busqueda` | RF-805 |
| `constancia.ts` | `aplicarCorreccion(entrada, cambios, motivo, autor, en): { nueva, correcciones[] }` | Exige un motivo no vacío y al menos un cambio real; campos corregibles: nombres, apellidos, fecha de nacimiento, sacramento y fecha de ceremonia; genera una corrección por campo con su valor anterior | RF-805 |
| `indicadores.ts` | `estaActivoEn(inscripcion, fecha): boolean` | Inscrito en o antes de la fecha y sin baja (retiro o consentimiento retirado) antes de ella; los anulados (002 RF-203) nunca cuentan | RF-806 |
| `indicadores.ts` | `porcentajeAsistencia(domingos: { sesionHabilitada, activos, presentes }[]): number \| null` | Σ presentes / Σ activos solo en domingos con esa sesión; `null` si no hubo ninguno | RF-806 |
| `indicadores.ts` | `calcularIndicadoresCiclo(entrada): IndicadoresCiclo` | Inscritos, retirados, % misa, % catequesis, aptos, sacramentos por tipo y marca de saldos desde papel | RF-806 |
| `reinscripcion.ts` | `resolverReinscripcion(perfilPrevio: { anonimizado: boolean } \| null): 'reutilizar' \| 'perfil_nuevo'` | | RF-807 |
| `reinscripcion.ts` | `ordenarHistorialPrevio(resumenes: ResumenCiclo[]): ResumenCiclo[]` | Ciclos anteriores, del más reciente al más antiguo | RF-807 |
| `retencion.ts` | `fechaVencimientoRetencion(cerradoEn): Date`; `cicloVencido(ciclo, hoy): boolean` | `cerrado_en` (fecha en America/Lima) + 2 años; un 29 de febrero vence el 28 de febrero | RF-808 |
| `retencion.ts` | `POLITICA_RETENCION_CICLO` | Tabla declarativa por entidad: `conservar` \| `anonimizar` \| `eliminar` (§5.4) | RF-808 |
| `retencion.ts` | `perfilesAAnonimizar(inscripcionesPorPerfil, ciclosVencidos): string[]` | Solo los perfiles **sin** inscripción en un ciclo no vencido o abierto (respeta RF-201 y RF-807) | RF-808 |

## 5. API (módulo `api/src/modulos/ciclos/`)

### 5.1 Endpoints

Todas las rutas pasan por APIM con el prefijo `/api`. La autenticación (JWT de corta duración) y la resolución de roles y delegación vigente están definidas en plan 001. Cada Function vuelve a comprobar el rol en el servidor (principio 7). Si el recurso queda fuera del alcance de quien lo pide, se responde 404, sin revelar si existe (001 RF-101).

| Function | Método y ruta | Autorización | Respuestas | RF |
| --- | --- | --- | --- | --- |
| `abrirCiclo` | `POST /ciclos` `{ id, nombre, fechaInicio, fechaFin }` | Administración | 201; 200 si el mismo `id` ya existe (idempotente); 409 `ciclo_abierto_existente`; 400 | RF-801 |
| `obtenerCicloAbierto` | `GET /ciclos/abierto` | Cualquier cuenta autenticada | 200 `{ ciclo \| null }` | RF-801 |
| `listarCiclos` | `GET /ciclos` | Administración, coordinación (y delegado), supervisión | 200 con lista y estado | RF-801, RF-806 |
| `cerrarCiclo` | `POST /ciclos/{cicloId}/cierre` (sin cuerpo y sin parámetro de «forzar») | Administración | 200 `{ cerradoEn, efectos: { delegacionesTerminadas, enlacesSuspendidos } }`; 200 también si ya estaba cerrado (no-op); 404 | RF-802, RF-803 |
| `obtenerIndicadores` | `GET /ciclos/{cicloId}/indicadores` | Coordinación (y delegado), supervisión | 200 con indicadores, `saldosPapel` y `calculadoEn`; si el ciclo está abierto se calculan en vivo | RF-806 |
| `listarSacramentosRecibidos` | `GET /ciclos/{cicloId}/sacramentos-recibidos` | Coordinación (y delegado), supervisión | 200 con las marcas que acompañan la lista de aptos de 006 | RF-804 |
| `marcarSacramentoRecibido` | `PUT /ciclos/{cicloId}/sacramentos-recibidos/{id}` `{ catequizandoId, sacramento, fechaCeremonia }` | Coordinación (y delegado vigente) | 201; 200 si se repite el mismo `id`; 409 `ya_marcado`; 422 `no_esta_en_lista_de_aptos`; se admite con el ciclo cerrado | RF-804, RF-805 |
| `buscarConstancia` | `GET /constancias?nombre=&fechaNacimiento=` (ambos obligatorios) | Coordinación (y delegado), supervisión | 200 `[{ id, nombres, apellidos, fechaNacimiento, sacramento, fechaCeremonia, ciclo }]`; `[]` si no consta | RF-805 |
| `corregirConstancia` | `PATCH /constancias/{id}` `{ correccionId, cambios, motivo }` | Coordinación (y delegado vigente) | 200; 200 si se repite el mismo `correccionId`; 422 `motivo_requerido` o `sin_cambios` | RF-805 |
| `listarCorrecciones` | `GET /constancias/{id}/correcciones` | Coordinación (y delegado), supervisión | 200 | RF-805 |
| `buscarCandidatosReinscripcion` | `GET /reinscripciones/candidatos?nombre=` | Coordinación (y delegado) | 200 con perfiles no anonimizados que tienen inscripción en un ciclo cerrado y ninguna en el abierto | RF-807 |
| `obtenerHistorialPrevio` | `GET /catequizandos/{id}/historial-ciclos` | Coordinación (y delegado); catequistas del grupo actual del niño | 200 con un resumen por ciclo anterior | RF-807 |
| `reinscribir` | `POST /ciclos/{cicloId}/reinscripciones` `{ inscripcionId, catequizandoId, grupoId, consentimiento }` | Coordinación (y delegado) | 201; 200 si se repite el mismo `inscripcionId`; 409 `ciclo_no_abierto` o `ya_inscrito`; 410 `perfil_anonimizado` (el cliente pasa a una inscripción nueva de 002) | RF-807 |
| `retencionCiclos` | Manejador registrado en el motor de retención de 001 (temporizador de 001), no HTTP | Identidad del sistema | — | RF-808 |

**Políticas de APIM.** Las políticas globales (CORS, límite de peticiones, validación de origen) están definidas en plan 001. 008 añade:
- `rate-limit-by-key` sobre `GET /constancias` y `GET /reinscripciones/candidatos`: 30 peticiones por minuto y cuenta, para frenar la enumeración de nombres y fechas de nacimiento.
- Sin caché de respuestas en `/ciclos/*/cierre`, `/constancias*` ni `/reinscripciones*`.

### 5.2 Contrato con la sincronización de 003 (RF-802)

Lo que el push de 003 **debe** hacer con cada registro de una tabla operativa:

| Situación al llegar el lote | Resultado | Efecto en el servidor |
| --- | --- | --- |
| `ciclo_id` = ciclo abierto | `aplicar` | Se aplica normalmente |
| El UUID ya existe sin cambios (reintento de algo aplicado antes del cierre) | `ya_aplicado` | No-op; no cuenta como descartado |
| `ciclo_id` de un ciclo cerrado (creación **o** modificación) | `descartar_ciclo_cerrado` | No se aplica; se anota en `registro_descartado_cierre` sin el contenido |
| `ciclo_id` inexistente | Inválido | Lo define el plan 003 |

- El lote **no falla** por los descartados: el push responde 200 con `descartados: [{ tabla, id, motivo: 'ciclo_cerrado' }]` (D-804). Así el cliente no reintenta para siempre.
- El push lee el estado del ciclo con `FOR SHARE` dentro de su transacción (C-7). Lo que llegó antes del cierre queda congelado con el ciclo; lo que llega después se descarta.
- El pull siguiente informa el ciclo abierto (o ninguno), y el cliente purga lo local de otros ciclos (`debePurgarseLocalmente`).
- Esto completa el «sin perder ni duplicar, salvo lo que llegue después del cierre» de 003 RF-307.

### 5.3 Transacción de cierre (RF-802)

Todo ocurre en una sola transacción PostgreSQL. Los puertos de otros módulos reciben la transacción `tx`.
1. `SELECT … FROM ciclo WHERE id = $1 FOR UPDATE`. Si ya está cerrado, se devuelve el resultado anterior (idempotente).
2. Se calcula `indicador_ciclo` con `calcularIndicadoresCiclo` sobre los datos del servidor en ese instante.
3. `UPDATE ciclo SET estado = 'cerrado', cerrado_por, cerrado_en = now()`. A partir de aquí el trigger congela todas las tablas operativas: las justificaciones sin revisar, las alertas abiertas y las aptitudes sin decidir quedan tal cual, sin pedir confirmación.
4. `seguridad.terminarDelegacionesVigentes(tx, en)` (plan 001): fija el fin efectivo en `cerrado_en` y deja traza.
5. `seguridad.suspenderEnlacesFamiliaPorCierre(tx, cicloId)` (plan 001): todo enlace de familia queda rechazado igual que uno revocado (D-806).
6. Catequistas: no se escribe nada. El alcance del catequista se calcula sobre los grupos del **ciclo abierto** (plan 001), así que quedan sin grupo y conservan sus cuentas activas (D-805).
7. Commit. Se audita con el servicio de auditoría de 001.

### 5.4 Política de retención por ciclo (RF-808)

El motor de 001 (timer diario) busca los ciclos con `cicloVencido(ciclo, hoy)` y `depurado_en IS NULL`, e invoca el manejador de 008. Cada paso es idempotente y se registra en `retencion_ciclo_paso`. Corre en lotes para no exceder el tiempo máximo de una Function de consumo. Las transacciones llevan `SET LOCAL sigecat.contexto = 'retencion'`.

| Orden | Paso | Acción | Ejecuta |
| --- | --- | --- | --- |
| 1 | `evidencias` | Eliminar del Blob las evidencias de justificaciones del ciclo y su referencia | Puerto `justificaciones.eliminarEvidenciasDeCiclo(cicloId)` (plan 004) |
| 2 | `operativos` | En tablas con `ciclo_id`, reemplazar `catequizando_id` y `apoderado_id` por un identificador anónimo estable por niño y ciclo, para que los conteos sobrevivan. Borrar textos libres (notas de contacto, motivos con nombres). La firma exacta por tabla la decide cada plan. | Manejador de cada módulo (001 recibe el registro) |
| 3 | `sacramento_recibido` | `catequizando_id = NULL` | 008 |
| 4 | `perfiles` | Anonimizar perfil, condiciones y documentos de los niños de `perfilesAAnonimizar` (sin inscripción en un ciclo no vencido) y de los apoderados que ya no tienen ningún niño vigente; revocar sus enlaces | Puertos de 002 y 001 |
| 5 | `descartados` | Eliminar `registro_descartado_cierre` del ciclo | 008 |
| 6 | `cierre_retencion` | `ciclo.depurado_en = now()` | 008 |

**Se conserva siempre:** `ciclo`, `indicador_ciclo`, `constancia_sacramental` y `constancia_correccion`. La constancia tampoco se toca cuando se retira el consentimiento (001 RF-106), porque no tiene FK al perfil y su DELETE está prohibido.

## 6. Cliente

Rutas de Expo Router en `src/app/` (SDK 57: segmentos dinámicos `[param].tsx` y `useLocalSearchParams`). Si el plan 001 agrupa las rutas por rol, estas se mueven dentro de esos grupos sin cambiar su comportamiento. Todas las pantallas de 008 requieren conexión (D-810): sin red muestran «Necesitas conexión para esta acción» (NetInfo) y no encolan nada.

| Ruta | Pantalla | Rol | Comportamiento | RF |
| --- | --- | --- | --- | --- |
| `src/app/ciclos/index.tsx` | Lista de ciclos (estado, fechas, «depurado») | Administración, coordinación, supervisión | Solo en línea | RF-801 |
| `src/app/ciclos/nuevo.tsx` | Abrir ciclo | Administración | Genera el UUID en el dispositivo; si hay un ciclo abierto, avisa y no deja continuar | RF-801 |
| `src/app/ciclos/[cicloId]/index.tsx` | Detalle e indicadores (aviso «incluye saldos cargados desde papel» si aplica) | Coordinación, supervisión (administración ve el detalle sin indicadores) | Solo en línea | RF-806 |
| `src/app/ciclos/[cicloId]/cierre.tsx` | Cerrar ciclo | Administración | Una sola confirmación de la acción («no se puede reabrir»), **sin** listar ni preguntar por pendientes | RF-802, RF-803 |
| `src/app/ciclos/[cicloId]/sacramentos.tsx` | Lista de aptos de 006 con la marca «recibió» por sacramento y fecha de ceremonia | Coordinación (y delegado) | Funciona con el ciclo cerrado; reintento idempotente por UUID | RF-804 |
| `src/app/constancia/index.tsx` | Búsqueda por nombre y fecha de nacimiento | Coordinación, supervisión | Sin resultados: «No consta» | RF-805 |
| `src/app/constancia/[constanciaId].tsx` | Detalle, corrección con motivo obligatorio e historial de correcciones | Coordinación (corrige), supervisión (lee) | Solo en línea | RF-805 |
| `src/app/reinscripcion/index.tsx` | Buscar candidatos de ciclos anteriores | Coordinación | Si el perfil está anonimizado, deriva a la inscripción nueva de 002 | RF-807 |
| `src/app/reinscripcion/[catequizandoId].tsx` | Historial previo y confirmación (grupo y consentimiento) sin volver a digitar datos | Coordinación | Solo en línea | RF-807 |

**Comportamiento sin conexión en otras pantallas** (implementado en el cliente de sincronización de 003 con reglas de 008):

| Situación | Comportamiento | RF |
| --- | --- | --- |
| No hay ciclo abierto en el almacén local | Las pantallas de asistencia y evaluación muestran «No hay un ciclo abierto» y no crean registros (`puedeCrearRegistrosLocales`) | RF-801 |
| El push devuelve `descartados` | Aviso local en el celular: «N registros no se guardaron porque el ciclo ya estaba cerrado» (supuesto A-3) | RF-802 |
| Un pull trae un ciclo abierto distinto o ninguno | Se purgan los registros locales de otros ciclos | RF-802 |
| `src/app/coordinacion.tsx` (existente) | Se añaden los accesos a «Ciclos», «Constancia» y «Reinscribir» | — |

Familias (Expo web): 008 no añade pantallas. Con el enlace suspendido al cierre, la entrada falla con el mensaje genérico de 001 RF-101.

## 7. Decisiones técnicas

| Id | Decisión | Alternativas descartadas | Justificación | RF |
| --- | --- | --- | --- | --- |
| D-801 | Un solo ciclo abierto mediante un índice único parcial en PostgreSQL, más la validación en dominio | Validar solo en la aplicación; tabla de configuración `ciclo_actual` | El índice resiste dos aperturas concurrentes; la tabla de configuración duplica el estado | RF-801 |
| D-802 | Convención `ciclo_id` en cada tabla operativa más un trigger de congelamiento en la BD | Solo verificar en cada caso de uso; esquema o BD por ciclo; mover a tablas históricas al cerrar | Una sola regla, imposible de olvidar en un endpoint nuevo; sin copias ni infraestructura extra (RNF-801, RNF-802) | RF-801, RF-802, RF-803 |
| D-803 | Cierre en una transacción con `FOR UPDATE` sobre la fila del ciclo; el push toma `FOR SHARE` | Ventana de gracia; decidir por la hora del celular | La spec congela «lo registrado en el servidor en ese momento». La hora del celular no es confiable (caso límite de 003). `FOR SHARE` no bloquea pushes concurrentes en el pico dominical. | RF-802 |
| D-804 | Los registros tardíos se descartan con un 200 y una lista `descartados` | Responder 409 o 422 al lote | Un error haría que WatermelonDB reintentara indefinidamente y bloquearía el resto del lote | RF-802 |
| D-805 | «Catequistas sin grupo» se deriva del alcance sobre el ciclo abierto | Borrar las asignaciones al cerrar | Conserva quién tuvo cada grupo, no escribe nada y las cuentas siguen activas | RF-802 |
| D-806 | Al cerrar se **suspenden** todos los enlaces de familia; la reinscripción de un hijo reactiva el de sus apoderados (provisional, A-6) | Revocar todos y emitir nuevos; esperar un plazo | Al cerrar aún nadie está reinscrito, porque el ciclo nuevo solo se abre después. Suspender equivale a revocar para quien no vuelve y evita reenviar enlaces. | RF-802 |
| D-807 | La constancia es una tabla propia sin FK al perfil: una instantánea de 6 campos más una bitácora de correcciones de solo anexar | Vista sobre el perfil; columnas en el perfil | Sobrevive a la retención y al retiro del consentimiento y cumple «ningún otro dato» | RF-805 |
| D-808 | Búsqueda por fecha exacta más nombre normalizado en TS (columna derivada `nombre_busqueda`) | Extensiones `unaccent`/`pg_trgm`; búsqueda difusa | Sin dependencias ni allowlist en Azure; la regla queda en `src/lib` y se prueba con Jest. La fecha exacta reduce falsos positivos. | RF-805 |
| D-809 | Indicadores: instantánea al cerrar más «sacramentos recibidos» en vivo desde la constancia; ciclo abierto en vivo | Calcular siempre en vivo | Tras anonimizar o retirar consentimientos el recálculo podría variar; la instantánea es barata y estable | RF-806, RF-808 |
| D-810 | Las operaciones de 008 se hacen solo con conexión, idempotentes por UUID del dispositivo | Encolar en WatermelonDB | El cierre es un único evento del servidor; la constancia (nombres y fechas de nacimiento de exalumnos) no debe bajar al celular; marcar sacramentos ocurre sobre todo con el ciclo cerrado, cuando ya no hay datos locales. 002 ya hace la inscripción solo en línea. | RF-802, RF-804, RF-805, RF-807 |
| D-811 | La retención es un manejador de 008 registrado en el motor de 001, por pasos idempotentes y en lotes; los perfiles se anonimizan solo si no tienen ninguna inscripción vigente | Borrar en cascada; anonimizar el perfil aunque siga activo en un ciclo nuevo | Una cascada borraría la constancia y los conteos; anonimizar un perfil activo contradice RF-201 y RF-807 | RF-808 |
| D-812 | Excepción requiere `SET LOCAL ROLE sigecat_retencion` **y** contexto `retencion`/`retiro_consentimiento`, solo motor interno 001 | Desactivar triggers; permitir excepción con solo variable o solo rol | Ambos controles en la misma tx, nunca contexto tomado de HTTP; tests de retiro/vencimiento en ciclo cerrado | RF-803, RF-808 |
| D-813 | La reinscripción es una fila nueva de inscripción (002) sobre el perfil existente | Clonar el perfil | Un perfil único entre ciclos (002 RF-201) da el historial gratis | RF-807 |
| D-814 | Abrir un ciclo no copia nada del anterior (provisional, A-1) | Copiar grupos, catálogo, umbrales, plazo y ventana | Cada módulo ya pide su configuración «al inicio del ciclo» (RF-405, RF-501, RF-601). Añadir una copia después no cambia el esquema, porque todo lleva `ciclo_id`. | RF-801 |

## 8. Estructura de archivos propuesta

```
src/lib/ciclos/
  ciclo.ts                 # RF-801, RF-803
  cierre.ts                # RF-802, RF-803
  constancia.ts            # RF-804, RF-805
  indicadores.ts           # RF-806
  reinscripcion.ts         # RF-807
  retencion.ts             # RF-808
  __tests__/*.test.ts
src/app/
  ciclos/index.tsx · ciclos/nuevo.tsx
  ciclos/[cicloId]/index.tsx · cierre.tsx · sacramentos.tsx
  constancia/index.tsx · constancia/[constanciaId].tsx
  reinscripcion/index.tsx · reinscripcion/[catequizandoId].tsx
api/migraciones/
  NNNN_ciclos_base.sql · NNNN_ciclos_cierre.sql
  NNNN_ciclos_constancia.sql · NNNN_ciclos_retencion.sql
api/src/modulos/ciclos/
  dominio/index.ts                       # reexporta src/lib/ciclos (empaquetado por esbuild)
  aplicacion/
    abrir-ciclo.ts · cerrar-ciclo.ts · marcar-sacramento-recibido.ts
    buscar-constancia.ts · corregir-constancia.ts · obtener-indicadores.ts
    reinscribir.ts · historial-previo.ts · retencion-ciclo.ts
    puertos.ts             # puertos que consume: seguridad, inscripciones, asistencia, sacramental, riesgo, justificaciones
    guardia-ciclo.ts       # puerto PÚBLICO que usan los demás módulos: cicloAbierto(tx), asegurarCicloAbierto(tx, cicloId)
  infraestructura/
    ciclo-repositorio-pg.ts · constancia-repositorio-pg.ts
    indicadores-consulta-pg.ts · retencion-ciclo-pg.ts
  http/
    abrir-ciclo.ts · obtener-ciclo-abierto.ts · listar-ciclos.ts · cerrar-ciclo.ts
    obtener-indicadores.ts · sacramentos-recibidos.ts · constancias.ts
    reinscripciones.ts · historial-ciclos.ts
  __tests__/ (unidad de casos de uso, contrato de repositorios, http)
infra/                     # sin recursos nuevos; las políticas APIM de §5.1 van en el módulo APIM del plan 001
```

## 9. Estrategia de tests

Jest según la configuración del plan 001. Cada nombre de test empieza por su RF. La integración corre contra PostgreSQL local en Docker con todas las migraciones aplicadas.

**Unitarios de dominio (`src/lib/ciclos/__tests__`)**
- `RF-801: rechaza abrir un ciclo si ya hay uno abierto`
- `RF-801: rechaza fecha de fin anterior o igual a la de inicio`
- `RF-801: sin ciclo abierto local no se pueden crear registros`
- `RF-803: reabrir un ciclo cerrado siempre se rechaza`
- `RF-802: cerrar un ciclo ya cerrado es un no-op`
- `RF-802: un registro de ciclo cerrado se clasifica como descartado; un reintento ya aplicado no`
- `RF-802: el cierre termina delegaciones y suspende enlaces de familia sin desactivar cuentas`
- `RF-803: con el ciclo cerrado solo se admiten sacramento recibido, corrección de constancia, retención y retiro de consentimiento`
- `RF-804: se puede marcar el sacramento con el ciclo cerrado`
- `RF-804: rechaza marcar a un niño que no está en la lista de aptos` (caso límite «apto que no se presenta no entra»: sin marca no hay entrada)
- `RF-805: la entrada de constancia contiene exactamente 6 campos`
- `RF-805: Bautismo y Primera Comunión en el mismo ciclo generan dos entradas`
- `RF-805: la búsqueda ignora tildes, mayúsculas y orden de espacios y exige fecha exacta`
- `RF-805: corregir sin motivo o sin cambios se rechaza; con motivo genera una corrección por campo con su valor anterior`
- `RF-806: el porcentaje usa presencias sobre activos solo en domingos con esa sesión`
- `RF-806: un niño inscrito a mitad de ciclo no cuenta como activo antes de su inscripción`
- `RF-806: los anulados no cuentan como inscritos ni como retirados`
- `RF-806: los indicadores marcan saldos cargados desde papel`
- `RF-807: un perfil no anonimizado se reutiliza; uno anonimizado da perfil nuevo`
- `RF-808: un ciclo vence a los 2 años de su cierre (incluido el 29 de febrero)`
- `RF-808: no se anonimiza un perfil inscrito en un ciclo no vencido`
- `RF-808: la política conserva indicadores y constancia`

**Contrato de repositorios y BD (`api/…/__tests__`, PostgreSQL en Docker)**
- `RF-801: el índice único impide dos ciclos abiertos en transacciones concurrentes`
- `RF-803: el trigger rechaza INSERT, UPDATE y DELETE en una tabla operativa de ejemplo de un ciclo cerrado` (caso límite «modificar un registro de un ciclo cerrado»)
- `RF-803: el trigger de transición impide volver a abierto`
- `RF-802: una justificación pendiente queda pendiente e inmodificable tras el cierre` (caso límite «cierre con justificaciones sin revisar»)
- `RF-808: el contexto de retención puede anonimizar en un ciclo cerrado y un endpoint HTTP no puede fijar ese contexto`
- `RF-805: la constancia no se puede borrar ni siquiera en contexto de retención o de retiro de consentimiento`
- `RF-805: constancia_correccion es de solo anexar`
- `RF-802: push concurrente con el cierre: lo confirmado antes queda, lo posterior se descarta`

**HTTP de cada Function** (handler invocado con una petición simulada y un JWT de prueba de 001)
- Una matriz de autorización por endpoint: el rol permitido recibe 2xx; los demás reciben 403 o 404, también supervisión al intentar escribir (`RF-801`, `RF-804`, `RF-805`, `RF-806`, `RF-807`).
- `RF-801: POST /ciclos repetido con el mismo id devuelve 200 sin duplicar`
- `RF-802: POST /ciclos/{id}/cierre no pide confirmación de pendientes y responde los efectos`
- `RF-804: PUT sacramento repetido es idempotente; dos UUID para el mismo niño y sacramento dan 409`
- `RF-805: GET /constancias sin fecha de nacimiento da 400`
- `RF-807: reinscribir en un ciclo cerrado da 409; un perfil anonimizado da 410`

**Extremo a extremo** (API contra PostgreSQL en Docker; reloj inyectable)
1. `RF-801..RF-808: ciclo completo`: abrir el ciclo A, inscribir, registrar asistencia y marcar aptos, y luego cerrar A. Un push tardío de un catequista se descarta (caso límite «catequista que no envió»). Marcar Primera Comunión con fecha posterior al cierre (caso límite «ceremonia posterior»). Buscar por nombre y fecha y obtener el sacramento y el ciclo A. Corregir el nombre con motivo y traza (caso límite «nombre mal escrito»). Abrir el ciclo B, reinscribir a un niño de A y ver su historial. Avanzar el reloj 2 años desde el cierre de A: los datos personales de A quedan anonimizados, sus evidencias se borran (doble de prueba del puerto de 004), los indicadores y la constancia quedan intactos, y el perfil reinscrito en B **no** se anonimiza.
2. `RF-805: retiro de consentimiento después del sacramento conserva solo la constancia` (con el puerto de 001).
3. `RF-805: una persona anonimizada solo aparece en la constancia`.
4. `RF-807: un niño que vuelve 3 años después se inscribe como perfil nuevo`.
5. `RF-802: tras el cierre, el pull purga los datos locales del ciclo cerrado` (prueba del cliente de sincronización con `jest-expo` y un adaptador WatermelonDB en memoria definido en plan 003).

## 10. Matriz de cobertura

| RF / RNF | Componentes | Tests |
| --- | --- | --- |
| RF-801 Ciclos | `ciclo` (M1), `ux_ciclo_un_abierto`, convención C-1 a C-7, `ciclo.ts`, `abrirCiclo`, `obtenerCicloAbierto`, `listarCiclos`, tabla local `ciclos`, `ciclos/nuevo.tsx` | Unitarios RF-801; índice concurrente; HTTP idempotente y autorización |
| RF-802 Cierre | `cerrarCiclo` (§5.3), `cierre.ts`, trigger de congelamiento, contrato del push (§5.2), `registro_descartado_cierre`, puertos de 001, purga local, `ciclos/[cicloId]/cierre.tsx` | Unitarios de clasificación y efectos; push concurrente; justificación pendiente congelada; E2E de push tardío; purga en el cliente |
| RF-803 Excepciones | `ciclo_transicion_valida`, `ciclo_bloquear_si_cerrado`, `admiteEscritura`, D-812 | Trigger rechaza escrituras; no se reabre; contexto de retención no fijable por HTTP |
| RF-804 Sacramento recibido | `sacramento_recibido` (M3), `validarSacramentoRecibido`, `marcarSacramentoRecibido`, `listarSacramentosRecibidos`, `sacramentos.tsx` | Marca con ciclo cerrado; no apto rechazado; idempotencia y 409; E2E de ceremonia posterior |
| RF-805 Constancia | `constancia_sacramental`, `constancia_correccion` (M3), `constancia.ts`, `buscarConstancia`, `corregirConstancia`, `listarCorrecciones`, pantallas `constancia/*`, rate limit de APIM | 6 campos; dos sacramentos; búsqueda normalizada; corrección con motivo; DELETE prohibido; E2E de consentimiento retirado y persona anonimizada |
| RF-806 Indicadores | `indicador_ciclo` (M2), `indicadores.ts`, `obtenerIndicadores`, `indicadores-consulta-pg.ts`, `ciclos/[cicloId]/index.tsx` | Porcentaje sobre activos y domingos con sesión; activos por fecha; anulados; saldos desde papel; instantánea al cierre (E2E) |
| RF-807 Reinscripción | `reinscripcion.ts`, `buscarCandidatosReinscripcion`, `obtenerHistorialPrevio`, `reinscribir`, puerto de 002, pantallas `reinscripcion/*` | Reutilizar o perfil nuevo; 409 y 410; E2E de historial y del niño que vuelve 3 años después |
| RF-808 Retención | `retencion.ts`, `retencion_ciclo_paso` (M4), manejador `retencion-ciclo.ts` registrado en el motor de 001, puerto de evidencias de 004 | Vencimiento a 2 años; perfil activo no anonimizado; política de conservación; E2E de retención |
| RNF-801 Sin mantenimiento | Cierre desde el celular por administración; retención automática del motor de 001; revocación y suspensión dentro del cierre | E2E completo sin pasos manuales fuera de la app |
| RNF-802 Costo cero | Sin recursos nuevos; borrado de evidencias en retención; constancia de pocos KB por año | E2E: evidencias eliminadas tras la retención |

## 11. Dependencias, riesgos, costo y dudas

### Dependencias

| Spec | Qué necesita 008 | Qué aporta 008 |
| --- | --- | --- |
| 001 | Roles (incluida supervisión; hoy `src/lib/domain/roles.ts` no la tiene), delegación vigente, JWT, auditoría; puertos `terminarDelegacionesVigentes`, `suspenderEnlacesFamiliaPorCierre`, `reactivarEnlacesFamilia`; registro de manejadores en el motor de retención; retiro de consentimiento con el contexto `retiro_consentimiento`; alcance del catequista calculado sobre el ciclo abierto | Convención C-4, política de retención por ciclo, preservación de la constancia. **Hace falta un ADR** (de 001) que sustituya el «Servicio de Autenticación externo» del C4 por enlace + PIN propio. |
| 002 | Perfil con marca de anonimizado; puerto `crearInscripcion(tx, …)`; detección de duplicados (RF-201) que invoque `resolverReinscripcion`; fechas de inscripción y baja | Tabla `ciclo` (M1) antes de `grupo`; reglas de reinscripción |
| 003 | Push y pull con `FOR SHARE` y `clasificarRegistroEntrante`; respuesta `descartados`; tabla local `ciclos`; purga; datos de domingos y sesiones para indicadores | Contrato §5.2, convención C-6 |
| 004 | `eliminarEvidenciasDeCiclo(cicloId)`. Se sugiere que la ruta del blob empiece por `cicloId` para borrar por prefijo. | — |
| 006 | Lista de aptos (RF-606) por ciclo; existencia de saldos desde papel | Las marcas de sacramento recibido sobre esa lista |
| 007 | Retiros confirmados por ciclo; saldos desde papel; sus timers filtran el ciclo abierto (C-5) | — |

### Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Uso indebido de la variable `sigecat.contexto` para saltar el congelamiento | Solo se fija en dos rutas de código; un test comprueba que ningún handler HTTP la fija; se audita |
| Un plan olvida el trigger en una tabla operativa | Plantilla en la skill de migración; test de esquema que recorre `information_schema` y exige trigger en toda tabla con `ciclo_id` (salvo `sacramento_recibido`, `registro_descartado_cierre` e `indicador_ciclo`) |
| Choque de numeración de migraciones entre planes paralelos | Numeración provisional; M1 se fusiona primero en la fase 0 |
| La retención excede el tiempo máximo de una Function | Lotes y pasos idempotentes y reanudables (`retencion_ciclo_paso`) |
| Cierre accidental, que es irreversible | Solo administración; una confirmación explícita de irreversibilidad |
| Cierre en pleno pico dominical | `FOR SHARE` no bloquea pushes entre sí; el cierre espera milisegundos |
| Semántica de suspender o reactivar enlaces (A-6) | Encapsulada en los puertos de 001; si se opta por revocar y emitir uno nuevo, solo cambia el puerto |

### Costo en Azure

Sin recursos nuevos. Se apoya en la Function App, PostgreSQL B1ms, Blob y APIM de consumo del plan 001.
- Constancia y correcciones: unas 100 filas por año, de pocos KB.
- Indicadores: una fila por ciclo.
- Cierre y retención: unas pocas ejecuciones al año, dentro del millón gratuito de Functions y de APIM de consumo.
- La retención **reduce** el costo de Blob al borrar evidencias (RNF-802).

Costo incremental estimado: US$ 0.

### Dudas `[NECESITA ACLARACIÓN]` con supuesto provisional

| Id | Duda | Supuesto provisional (reversible) | Bloquea |
| --- | --- | --- | --- |
| A-1 | (spec) ¿Qué se copia del ciclo anterior al abrir uno nuevo? | Nada (D-814); cada módulo pide su configuración. Reversible añadiendo un paso de copia, sin cambiar el esquema. | Fase 0 (no bloquea con el supuesto) |
| A-2 | (spec) ¿Secretaría tiene acceso propio a la constancia? | No; la coordinación consulta y comparte. Reversible: añadir el rol a la autorización de `GET /constancias`. | Fase 2 |
| A-3 | (spec) ¿Se avisa al catequista de los registros descartados? | Sí, con un aviso local en su celular y el conteo; el servidor guarda la traza sin contenido; no se avisa a la coordinación. | Fase 1 |
| A-4 | (spec) ¿Quién redacta el texto del consentimiento sobre la constancia permanente? | La coordinación; el texto y su versión los gestiona 001 (RF-106). 008 solo exige que mencione la conservación sin vencimiento de los 6 campos. | Fase 2 (antes de producción) |
| A-5 | Las operaciones de 008 requieren conexión: ¿se acepta como excepción al principio 5? | Sí, por D-810; requiere la aprobación explícita del equipo para registrarla en la spec. | Fase 1 |
| A-6 | Al cerrar, aún no hay reinscritos: ¿cuándo se revoca el enlace de una familia que no vuelve? | Se suspenden todos al cerrar y se reactivan al reinscribir a un hijo (D-806). | Fase 1 |
| A-7 | ¿El porcentaje de asistencia es el agregado (Σ presentes / Σ activos) o el promedio de porcentajes por domingo? | El agregado. Reversible: una sola función en `indicadores.ts`. | Fase 3 |
| A-8 | ¿«Aptos» en el indicador cuenta la lista RF-606 o las decisiones finales? | La lista RF-606 si se generó; si no, las decisiones finales «apto». | Fase 3 |
| A-9 | ¿«Retirados» incluye los retiros por consentimiento retirado? | Sí (retiro de 007 más inactivo por consentimiento de 001); los anulados no. | Fase 3 |
| A-10 | ¿La reinscripción exige un nuevo consentimiento? | Sí, una confirmación del apoderado con el texto vigente, sin volver a digitar datos (001 RF-106). | Fase 4 |
| A-11 | ¿Se puede anular una entrada de constancia marcada por error (persona equivocada)? | No; solo se corrigen campos con motivo. El ciclo no es corregible. | Fase 2 |
| A-12 | ¿Quién ve el historial previo de un niño reinscrito? | La coordinación (y delegado) y los catequistas de su grupo actual. | Fase 4 |
| A-13 | ¿La lista de aptos es una por sacramento (duda abierta en 006)? | Una sola lista; a un niño no bautizado se le pueden marcar los dos sacramentos. | Fase 2 |

## 12. Orden de implementación por fases

| Fase | Contenido | RF | Requiere |
| --- | --- | --- | --- |
| **0 — Primer corte** | M1 (`ciclo`, índice, transición, `ciclo_bloquear_si_cerrado`); convención C-1 a C-7 publicada para 002 y 003; `ciclo.ts`; `POST /ciclos`, `GET /ciclos/abierto`, `GET /ciclos`; tabla local `ciclos` en el esquema de 003; pantalla `ciclos/nuevo.tsx`; tests RF-801 | RF-801 | Base de 001 (cuentas, roles, enlace + PIN) |
| 1 — Cierre | `cierre.ts`; M2 (`registro_descartado_cierre`; `indicador_ciclo` vacía hasta la fase 3); `POST /ciclos/{id}/cierre`; puertos de 001; contrato del push y purga con 003; pantalla de cierre; tests RF-802 y RF-803 | RF-802, RF-803 | 001 (delegación, enlaces), 003 (sincronización) |
| 2 — Constancia | M3; `constancia.ts`; marcar sacramento, búsqueda, corrección; pantallas `sacramentos.tsx` y `constancia/*`; rate limit de APIM | RF-804, RF-805 | 006 (lista RF-606) |
| 3 — Indicadores | `indicadores.ts`; consulta en vivo e instantánea en el cierre; pantalla de detalle | RF-806 | 003, 006, 007 |
| 4 — Reinscripción | `reinscripcion.ts`; candidatos, historial y reinscripción; reactivación de enlaces | RF-807 | 002, 001 |
| 5 — Retención | `retencion.ts`; M4; manejador en el motor de 001; puerto de evidencias de 004; E2E completo | RF-808, RNF-801, RNF-802 | 001 (motor), 004 (Blob), manejadores de los demás módulos |

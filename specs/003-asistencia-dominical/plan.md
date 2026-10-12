# 003 — Asistencia dominical: plan técnico

> CÓMO implementar [spec.md](spec.md). Lo que aquí contradiga a la spec o a la [constitución](../../docs/constitution.md) es un error del plan.
> Este plan es dueño de: **protocolo de sincronización**, **esquema WatermelonDB** (tablas locales de todos los módulos), **sesiones dominicales** y **cómputo de falta**. Las demás piezas transversales se referencian como «definido en plan NNN».

## 1. Resumen y alcance

**Acuerdo 2026-10-11:** backend completo de todas las fases; D-301–D-316 y A-301–A-313 aceptados. Prueba técnica WatermelonDB/QR bloquea la entrega nativa, no dominio/API. UI, campo y despliegue no se declaran terminados. Contratos estables en [guía frontend](../../docs/backend-contratos.md); pendientes en [seguimiento](../../docs/backend-implementacion.md).

**Cubre:** RF-301 a RF-313 y RNF-301 a RNF-307. Además, HU-306 (consulta de la familia) como lectura en línea.

| Bloque | RF / RNF |
| --- | --- |
| Sesiones dominicales, ventana de misa, domingos sin misa o sin catequesis | RF-301, RF-305 |
| Misa por escaneo, validación del carné, registro manual | RF-302, RF-303, RF-304, RNF-305, RNF-307 |
| Lista de catequesis con presentes por defecto, de cualquier grupo | RF-306, RNF-301, RNF-306 |
| Sincronización sin conexión, concurrencia y corrección | RF-307, RF-308, RF-309, RNF-302, RNF-303, RNF-304 |
| Revisión cruzada, cómputo de falta, reporte de misa, actividades | RF-310, RF-311, RF-312, RF-313 |

**Fuera de este plan:**
- Lo que la spec excluye: biometría, fotos de niños, autorregistro, geolocalización, misas de otra parroquia.
- Enlace, PIN, JWT, roles, delegación, seudónimo y sesión sin conexión: definido en plan 001.
- Contenido, impresión y reimpresión del carné, inscripción, grupos: definido en plan 002.
- Justificaciones y su aprobación: definido en plan 004. Este plan solo consume «justificaciones aprobadas» mediante un puerto.
- Catálogo de actividades obligatorias: definido en plan 005. Aquí solo se registra su asistencia (RF-313).
- Plazos de justificación, pasos de riesgo y aptitud: definidos en los planes 004, 007 y 006. Consumen el cómputo de falta de este plan.
- Apertura y cierre de ciclo: definido en plan 008. Aquí solo se descartan los registros que llegan después del cierre.

## 2. Verificación contra la constitución

| # | Principio | Cómo se cumple |
| --- | --- | --- |
| 1 | Stack mínimo | Expo SDK 57, Functions, APIM, PostgreSQL (definido en plan 001). Dependencias nuevas de este plan: `@nozbe/watermelondb` (almacén local fijado en el C4), `@react-native-community/netinfo` (conectividad, C4), `expo-camera` (lectura QR), `expo-crypto` (`randomUUID` para UUID v4 en el dispositivo) y `uuid` (solo la v5, en JS puro, para ids deterministas). **Acción pendiente:** la constitución exige justificarlas en la spec antes de instalarlas, así que hay que añadir a `spec.md` una nota de dependencias. Este plan no la edita. |
| 2 | La spec manda | La matriz de la §10 asigna al menos un test a cada RF y RNF. Cada nombre de test empieza por su identificador (`RF-308: ...`). |
| 3 | Lógica sin interfaz | Todas las reglas viven en `src/lib/asistencia/` y `src/lib/sincronizacion/` como TS puro. WatermelonDB, NetInfo y la cámara quedan en `src/datos/` y `src/app/`. Se propone la regla ESLint `no-restricted-imports` en `src/lib/**` para bloquear `react`, `react-native`, `expo*` y `@nozbe/*`. |
| 4 | Tests en verde | `npm test` corre Jest en `src/` y en `api/` (configuración definida en plan 001). Ninguna fase cierra con tests en rojo u omitidos. |
| 5 | Offline primero | Escaneo, registro manual, listas, correcciones (también las de la coordinación) y la configuración de sesiones se escriben en WatermelonDB y luego se sincronizan. Los reportes y avisos (RF-303, RF-310, RF-312) son solo lecturas en línea. |
| 6 | Persistencia segura | Los ids se generan en el dispositivo con UUID v4 (`expo-crypto`), configurado como generador de ids de WatermelonDB. Sesiones, asistencias consolidadas y avisos usan UUID v5 deterministas que también se calculan en el dispositivo. PostgreSQL usa migraciones `api/migraciones/03NN_*.sql` y WatermelonDB pasos de migración solo añadidos: ninguno se edita una vez publicado. |
| 7 | Datos de menores | Ninguna tabla local contiene salud, condiciones, documentos ni evidencias; un test recorre todas las definiciones de tablas sincronizadas contra una lista de columnas prohibidas. La nómina global solo lleva id, nombre, grupo y código de carné (RNF-306). Cada Function y cada registro del push se autorizan en el servidor por rol y alcance. El escaneo es discreto (RNF-307). |
| 8 | Idioma | Tablas, columnas, archivos e identificadores en español, sin tildes ni ñ (`correcciones_asistencia`, `hora_dispositivo`). |
| 9 | Autoría trazable | Cada tarea de `tasks.md` se hace en un commit con su registro Agent Trace. |
| 10 | Contexto curado | El plan es la única fuente del CÓMO para la spec 003. Las convenciones que se repitan pasan a `AGENTS.md`. |
| 11 | Skills como paquete | Se propone la skill `nueva-tabla-sincronizada` (`SKILL.md`), con los 4 pasos del mecanismo de extensión de la §3.3, para que los planes 004 a 008 añadan tablas locales sin errores. |

## 3. Modelo de datos

### Acuerdo de integración: lápidas y retiro de consentimiento

Las filas locales de listas, marcas y correcciones incluyen `estado`, `motivo_rechazo` y `recibido_en` para recibir confirmaciones del servidor. El push ignora exclusivamente esos tres campos de respuesta en esas colecciones: WatermelonDB envía la fila raw completa aunque el usuario solo haya cambiado un campo. No pueden alterar la validación, reloj recibido o resultado del servidor y no participan en la huella idempotente. La autoría, valor, sesión, carné y restantes campos de negocio se validan normalmente.

Compatibilidad nativa WatermelonDB: el push descarta `_status` y `_changed` de cada fila antes de validar el esquema de negocio y calcular su huella idempotente; jamás los guarda ni los devuelve en pull. Son metadatos exclusivamente locales, no permisos ni estados de servidor. Los demás campos desconocidos siguen rechazados. Esto cumple el punto 8 del contrato backend oficial: https://watermelondb.dev/docs/Sync/Backend (consultado 2026-10-11).

Contrato/verificador: `esquemaPush = z.preprocess(ignorarMetadatosLocales, z.object(...).strict())`; modelos Zod siguen estrictos sin metadata ni feedback. DTO de entrada permite metadata en las cinco filas; feedback estado/motivo_rechazo/recibido_en solo ListaPush/MarcaPush/CorreccionPush, opcional/writeOnly/ignorado. Outputs independientes conservan whitelist y feedback normal calculado por servidor. Verificador valida listas literales de campos/colecciones y descuenta solo excepciones por schema; autoría nunca se excluye. Ejemplos raw con defaults/reenvío y test PostgreSQL RF-307/RNF-306 comprueban huella, ausencia de metadata, unknown422 y código inválido rechazado pese a estado aceptada enviado.

La migración aditiva `0309_lapidas_sincronizacion.sql` conserva solo colección, UUID de fila anterior, cuenta destinataria, ciclo y fecha de eliminación. No incluye niño, QR, nombres ni contenido de asistencia. Antes de anonimizar identificadores o retirar autoría se encolan las lápidas para los destinatarios anteriores; el pull las entrega aunque la fila anonimizada ya no cumpla su filtro de alcance. Así un retiro posterior a una anulación elimina también los registros ya sincronizados. La bandeja se depura después de la ventana máxima de reconexión.

Un registro pendiente posterior al retiro conserva su rechazo y autor operativo, pero nunca restaura el QR, vínculo al niño retirado ni valores personales. Push y retención bloquean la fila del niño para impedir que una carrera vuelva a introducir datos retirados. Tests RF-106/RF-307 verifican retiro tras anulación, aplicación de lápidas al cliente y pendientes tardíos.

### 3.1 PostgreSQL (`api/migraciones/`)

Las tablas físicas son singulares: `sesion`, `lista_asistencia`, `marca_asistencia`, `asistencia`, `correccion_asistencia`, `aviso_asistencia`, `evento_asistencia`. Los nombres plurales del esquema local/`changes` son colecciones WatermelonDB, no nombres SQL. Cada adaptador hace el mapeo explícito. `catequizando` y `grupo` son las tablas de 002. Todas las piezas de asistencia incluyen `ciclo_id`/guardia de congelamiento según 008; inmutabilidad se exceptúa únicamente por rol de retención **y** contexto `SET LOCAL` del motor.

**Supuesto de numeración:** cada spec usa su centena (`03NN` para la 003), para que los planes escritos en paralelo no choquen. Si el plan 001 define otra convención, estos archivos se renumeran antes de aplicarse; todavía no hay ninguno aplicado.

| Migración | Tabla / objeto | Columnas clave | RF |
| --- | --- | --- | --- |
| `0300_infraestructura_sincronizacion.sql` | función `fijar_actualizado_en()` y convención de columnas | Proyecciones sincronizadas llevan `actualizado_en` servidor y `eliminado_en` lápida. Añadir a `catequizando`/`grupo` de 002 si falta, con trigger y `IF NOT EXISTS` | RF-307 |
| `0300_infraestructura_sincronizacion.sql` | `bitacora_sincronizacion` | `id`, `cuenta_id`, `dispositivo_id`, `operacion` (`pull`/`push`), `recibido_en`, `duracion_ms`, `bytes_entrada`, `bytes_salida`, `aceptados`, `rechazados`, `descartados_cierre`, `version_esquema` | RF-307, RNF-303, RNF-304 |
| `0301_parametros_asistencia.sql` | `parametros_asistencia_ciclo` | `ciclo_id` (PK), `zona_horaria` (`America/Lima`), `ventana_misa_inicio` (`07:30`), `ventana_misa_fin` (`09:30`), `hora_fin_domingo` (`23:59:59`), `tolerancia_reloj_min` (10) | RF-302, RF-305, RF-309 |
| `0302_sesiones.sql` | `sesion` | UUID v5(ciclo, fecha, tipo, actividad), `ciclo_id`, `fecha`, `tipo`, `actividad_id` (FK añadida por 005), `ventana_inicio/fin`, `cancelada`, `motivo_cancelacion`, `actualizado_por` | RF-301, RF-305, RF-313 |
| `0303_marcas_asistencia.sql` | `lista_asistencia` | UUID cliente, `ciclo_id`, `sesion_id`, `grupo_id`, `confirmada_por`, `abierta_en`, `confirmada_en`, `desfase_reloj_ms`, `recibido_en`, `total_presentes/ausentes` | RF-306, RF-313, RNF-301 |
| `0303_marcas_asistencia.sql` | `marca_asistencia` (inmutable) | UUID cliente, `ciclo_id`, `sesion_id`, `catequizando_id` nullable, `codigo_leido`, `valor`, `tipo_registro`, `lista_id`, `registrado_por`, `dispositivo_id`, `hora_dispositivo`, `desfase_reloj_ms`, `recibido_en` fijado al primer insert, `estado`, `motivo_rechazo`; índice sesión/niño | RF-302, RF-303, RF-304, RF-306, RF-308 |
| `0304_asistencias.sql` | `asistencia` (solo servidor) | UUID v5(sesión, niño), `ciclo_id`, `sesion_id`, `catequizando_id`, UNIQUE(sesión, niño), `valor`, `tipo_registro`, `hora_primer_registro`, `recibido_primer_registro`, `corregida`, `conflicto` | RF-302, RF-308, RF-311, RF-312 |
| `0305_correcciones_asistencia.sql` | `correccion_asistencia` (inmutable) | UUID cliente, `ciclo_id`, `sesion_id`, `catequizando_id`, `valor_anterior/nuevo`, `motivo` obligatorio tras domingo, `corregido_por`, `hora_dispositivo`, `desfase_reloj_ms`, `recibido_en`, `estado`, `motivo_rechazo` | RF-306, RF-309 |
| `0306_avisos_asistencia.sql` | `aviso_asistencia` | UUID v5(tipo, sesión, niño/marca), `ciclo_id`, `tipo`, `sesion_id`, `catequizando_id`, `marca_id`, `detalle` sin datos restringidos, `estado`, `atendido_por/en` | RF-303, RF-308, RF-310 |
| `0307_eventos_asistencia.sql` | `evento_asistencia` | `secuencia bigserial`, `tipo`, `ciclo_id`, `catequizando_id`, `fecha`, `creado_en`; consumidores 004/006/007 con cursor/idempotencia | RF-309, RF-311 |

**Lo que no se guarda (D-303):**
- La ausencia en misa (RF-305) y la falta (RF-311) se calculan, no se persisten.
- Las justificaciones aprobadas (plan 004) y los periodos de inscripción y de grupo (plan 002) se leen a través de puertos.

### 3.2 Almacén local (WatermelonDB sobre SQLite, solo en el build nativo)

Soporte transversal actual: `ciclos` solo pull (`id`, `nombre`, `fecha_inicio`, `fecha_fin`, `estado` abierto); `actividades_obligatorias` pull por ciclo y push COORD (`id`, `ciclo_id`, `nombre`, `tipo`, `fecha`, `estado` vigente/cancelada, `creado_por`, `cuenta_id`, `credencial_id`, `dispositivo_id`). 0506 añade autoría/traza, no transporta huella ni tabla `cambio_actividad`. En push updated se permite para actividad y sesión; deleted sigue vacío. Orden de aplicación actividad → sesión → lista → marca → corrección. Los providers/registradores deben conectarse en el arranque real; definición en archivo no acredita arranque/despliegue.

| Tabla local | Dueño del dato | Sentido | Alcance que baja al celular | RF / RNF |
| --- | --- | --- | --- | --- |
| `grupos` | 002 | pull | Todos los grupos del ciclo abierto: `nombre`, `es_mio` (calculado por cuenta) | RF-306 |
| `catequizandos` (nómina) | 002 | pull | **Todos** los niños activos: `nombres`, `apellidos`, `grupo_id`, `codigo_carne`, `activo`. Ningún otro dato. | RNF-306, RF-302, RF-304 |
| `parametros_asistencia` | 003 | pull | Los del ciclo abierto | RF-302, RF-309 |
| `sesiones` | 003 | pull; push solo de la coordinación | Las del ciclo abierto | RF-301, RF-313 |
| `listas_asistencia` | 003 | push y pull | Catequista: las suyas. Coordinación: todas. | RF-306 |
| `marcas_asistencia` | 003 | push y pull | Catequista: las suyas (vuelven con `estado` y `motivo_rechazo`). Coordinación: todas. | RF-302, RF-303, RF-307 |
| `correcciones_asistencia` | 003 | push y pull | Catequista: las de sus grupos. Coordinación: todas. | RF-309 |
| `asistencias` | 003 | solo pull | Catequista: niños de sus grupos. Coordinación: todos. | RF-311, RNF-306 |
| `borradores_lista` | 003 | **solo local**, no se sincroniza | La lista en curso de este celular: un registro por toque | RF-306 (celular que se apaga) |
| `database.localStorage` | 003 | local | `ultimo_pulso`, `huella_alcance`, `desfase_reloj_ms`, `dispositivo_id` | RF-302, RF-307 |

Reglas comunes:
- Cada fila creada en el dispositivo lleva `registrado_por` / `corregido_por` igual a la cuenta en sesión. Así, tras cerrar sesión, lo pendiente solo se envía con esa misma cuenta (RNF-102, definido en plan 001).
- En la web no se inicializa WatermelonDB (D-311).

### 3.3 Mecanismo de extensión del esquema local (para los planes 004 a 008)

Cada plan que necesite una tabla en el celular sigue estos 4 pasos:

1. Declara su `DefinicionTablaSincronizada` en `src/lib/<modulo>/tablas-sincronizadas.ts`: nombre, columnas y tipos, sentido (`pull` / `push` / `ambos`), regla de alcance (`ciclo` / `mis_grupos` / `propias`) y si admite `updated` o solo `created`.
2. La registra en `src/lib/sincronizacion/registro-tablas.ts`.
3. Añade un paso nuevo a `src/datos/local/migraciones.ts` (`createTable` / `addColumns`) y sube `schemaVersion`. Los pasos publicados nunca se editan.
4. Implementa en `api/src/modulos/<modulo>/infraestructura/proveedor-sincronizacion.ts` las operaciones `pull(cuenta, desde, alcance)` y `push(filas, contexto)`, y lo registra en `api/src/modulos/sincronizacion/aplicacion/registro-proveedores.ts`.

Al completarse los pasos:
- El esquema WatermelonDB se **genera** a partir de esas definiciones (`src/datos/local/esquema.ts`). El servidor serializa con la misma lista de columnas, siempre con selección explícita y nunca con `SELECT *`.
- El test `Principio 7: ninguna tabla sincronizada contiene columnas restringidas` falla si una definición incluye nombres de una lista prohibida: `salud`, `condicion`, `neuro`, `documento`, `dni`, `evidencia`, `nota_apoyo`, etc.
- Para los usuarios que ya tienen la app, se usa `migrationsEnabledAtVersion` de `synchronize()`: el pull recibe `migration` y entrega completas las tablas y columnas nuevas.

## 4. Lógica de dominio (`src/lib/`, TS puro)

**Corrección de estado calculado (RF-305, RF-309, A-310):** `Correccion.valorAnterior` admite `presente`, `ausente` y `sin_registro`; `valorNuevo` sigue limitado a `presente`/`ausente`. El servidor compara el valor anterior con `estadoEnSesion`, usando inscripción/grupo históricos, lista aceptada del grupo y hora efectiva de la corrección, no exige una marca materializada para una ausencia calculada o catequesis sin registro. `pendiente` y `no_aplica` no se convierten en ausencias ni admiten corrección. Sin marca propia no hay autorización de catequista antes del fin del domingo; después solo coordinación con motivo. Cuando solo hay correcciones aceptadas, estas bastan para consolidar: manda la última por recibido/id, los registradores son sus autores operativos y la primera corrección de presencia (o la primera si todas son ausencias) aporta horas dispositivo/servidor y tipo `manual`, sin fabricar escaneo ni marca histórica. Si existen marcas se conserva la regla de la primera marca presente. La migración aditiva `0310_correcciones_sin_registro.sql` amplía únicamente el CHECK de `valor_anterior`; no se modifica 0305 aplicada.

| Archivo | Reglas / firmas ilustrativas | RF |
| --- | --- | --- |
| `asistencia/tipos.ts` | `Sesion`, `MarcaAsistencia`, `ListaAsistencia`, `Correccion`, `AsistenciaConsolidada`, `EstadoEnSesion = 'presente' \| 'ausente' \| 'sin_registro' \| 'pendiente' \| 'no_aplica'` | todos |
| `asistencia/sesiones.ts` | `domingosDelCiclo(inicio, fin): string[]`; `idSesion(cicloId, fecha, tipo, actividadId?)` (UUID v5); `ventanaDe(sesion, parametros)`; `sesionEnCurso(sesiones, ahora)`; `finDelDomingo(fecha, parametros)` | RF-301, RF-302, RF-309, RF-313 |
| `asistencia/reloj.ts` | `estimarDesfase(horaServidor, enviadoEn, recibidoEn): number`; `horaEfectiva(horaDispositivo, desfaseMs)`; `dentroDeVentana(horaEfectiva, ventana, toleranciaMin)` | RF-302, RF-309 |
| `asistencia/carne.ts` | `interpretarCodigoQr(texto): { catequizandoId; emision } \| null`, únicamente `SGC1:<uuid>:<emision>`; reutiliza 002. Rechaza UUID suelto, prefijos alternativos y emisión inválida; `resolverCarne` contrasta `codigo_carne` local con emisión vigente | RF-302, RF-303 |
| `asistencia/escaneo.ts` | `procesarEscaneo(ctx): { resultado: 'registrado' \| 'ya_registrado' \| 'pendiente_validacion' \| 'rechazado' \| 'fuera_de_ventana', mostrarNombre: boolean, marca? }`. Con conexión rechaza un código desconocido o inactivo; sin conexión lo guarda como pendiente de validar. | RF-302, RF-303, RNF-307 |
| `asistencia/autorizacion.ts` | `puedeEscanear(cuenta)`; `puedeVerNombreAlEscanear(cuenta, nino)` (solo si es de sus grupos); `puedeRegistrarManual(cuenta, nino)` (solo sus grupos); `puedePasarLista(cuenta, grupo)` (cualquier grupo); `puedeCorregir(cuenta, registro, ahora)`; `puedeConfigurarSesiones(cuenta)`. Se apoya en los roles efectivos del plan 001. | RF-302, RF-304, RF-306, RF-309, RF-301 |
| `asistencia/lista.ts` | `abrirLista(ninosActivosDelGrupo)` (todos presentes); `alternar(borrador, ninoId)`; `confirmarLista(borrador, cuenta, hora) → { lista, marcas[] }` | RF-306, RF-313 |
| `asistencia/consolidacion.ts` | `consolidar(marcasAceptadas, correccionesAceptadas): { valor, tipoRegistro, horaPrimerRegistro, registradores[], conflicto }`. Reglas: (1) si hay correcciones, manda la última (por `recibido_en`, desempate por `id`); (2) si no, `presente` gana a `ausente`; (3) hay `conflicto` si existen marcas presente y ausente de cuentas distintas; (4) el tipo de registro y la hora son los de la primera marca presente. | RF-302, RF-308, RF-309 |
| `asistencia/correccion.ts` | `validarCorreccion(entrada, ahora, parametros)`. Antes del fin del domingo: solo un autor de alguna marca de ese niño y sesión, sin motivo. Después: solo la coordinación, con motivo obligatorio. | RF-306, RF-309 |
| `asistencia/faltas.ts` | `estadoEnSesion(sesion, nino, asistencia?, listaDelGrupoConfirmada, ahora)`: `no_aplica` si la sesión está cancelada o el niño no estaba activo; `pendiente` si la ventana no terminó; en misa y actividades por escaneo, `ausente` sin presencia al cerrar la ventana; en catequesis, `ausente` por marca explícita o si la lista de su grupo está confirmada y él no figura; si no, `sin_registro`. `ausenciasDelCiclo(...)`. `faltasDelCiclo(entrada, justificacionesAprobadas): Falta[]`, donde `Falta = { catequizandoId, fecha, origen: 'domingo' \| 'jornada', sesionIds, justificada }`. | RF-301, RF-305, RF-306, RF-311, RF-313 |
| `asistencia/revision-cruzada.ts` | `detectarMisaSinCatequesis(asistenciasDelDomingo, lista): catequizandoId[]` | RF-310 |
| `asistencia/reporte-misa.ts` | `armarReporteMisa(sesion, asistencias, activosEnFecha, identidadOperativa)`: presentes con hora del celular, hora del servidor, registrador o registradores, tipo; totales presentes / activos; número de registros manuales | RF-304, RF-312 |
| `asistencia/tablas-sincronizadas.ts` | Definiciones de las tablas de la §3.2 propias de la spec 003 | RF-307 |
| `sincronizacion/protocolo.ts` | Transporte HTTP nativo WatermelonDB: `CambiosPorTabla = Record<string, { created, updated, deleted }>`, `RespuestaPull { changes, timestamp, experimentalStrategy?, huellaAlcance }`, push `{ changes }`, `ResumenPush { aceptados, rechazados, descartadosCierre }`; filas snake_case/colecciones plurales. Adaptadores españoles internos opcionales, no frontera obligatoria | RF-307 |
| `sincronizacion/alcance.ts` | `huellaAlcance(cuenta)` (hash de roles efectivos y grupos); `filtroPull(definicion, cuenta)`; `requiereReemplazo(huellaCliente, huellaServidor)` | RF-307, RNF-306 |
| `sincronizacion/orquestador.ts` | `debeSincronizar(evento, estado)` (reconexión, primer plano, después de confirmar una lista o de cada escaneo con red); `esperaReintento(intentos)` (se mueve aquí desde `src/lib/offline/cola-sincronizacion.ts`) | RF-307 |
| `sincronizacion/pendientes.ts` | `contarPendientes(filasLocales, cuentaId)` | RF-307 |

**Supuesto aplicado en `faltasDelCiclo` (RF-311):** hay falta de domingo solo si misa **y** catequesis están en `ausente`. Con una sesión `no_aplica`, `pendiente` o `sin_registro` no hay falta. Una jornada `ausente` es una falta independiente. `justificada` es verdadero si existe una justificación aprobada para ese niño en esa fecha (el puerto del plan 004 la provee).

**Evolución del código existente en main:**
- `src/lib/domain/modelo.ts`: se retiran `SesionCatequesis`, `EstadoAsistencia` (`tardanza` y `justificado` no existen en la spec 003) y `RegistroAsistencia`. Los reemplaza `asistencia/tipos.ts`.
- `src/lib/offline/cola-sincronizacion.ts`: lo reemplaza el control de cambios de WatermelonDB. `esperaReintento` pasa a `sincronizacion/orquestador.ts` y el archivo se elimina.
- `src/lib/domain/roles.ts`: `puedeRegistrarAsistencia` contradice RF-306, que permite pasar lista de cualquier grupo. Este plan deja de usarla y le pide al plan 001 que la retire.

## 5. API (Azure Functions v4, `api/src/modulos/`)

Todas las Functions validan el JWT y los roles efectivos en el propio handler, con el middleware de autorización definido en plan 001 (principio 7), aunque APIM ya lo haya validado. Las políticas base de APIM (validate-jwt, CORS, límites) están definidas en plan 001; aquí solo se indican los valores por ruta.

### 5.1 Módulo `sincronizacion`

Las columnas «APIM» describen límites operacionales: **cada límite por cuenta vive en Functions con contador PostgreSQL atómico compartido**. APIM conserva global/cuerpo/CORS. Excepción HTTP acordada en ADR 015: `changes`, `timestamp`, `experimentalStrategy`, `created`, `updated`, `deleted` se conservan nativos, sin traducción obligatoria; filas snake_case y colecciones plurales. Pull añade `huellaAlcance`; query conserva `ultimoPulso`, `versionEsquema`, `huellaAlcance`, `migracion` (JSON de `{ tablas, columnas? }`). POST actual acepta solo `{ changes }` y no consume `ultimoPulso` de query. Schemas detallados en `api/openapi.json` basados en código, no propuestas.

| Método y ruta | Function | Roles | Autorización y comportamiento | APIM | RF |
| --- | --- | --- | --- | --- | --- |
| `GET /sincronizacion/cambios?ultimoPulso&versionEsquema&huellaAlcance&migracion` | `sincronizacionPull` | catequista, coordinación (incluida la delegada) | Arma `changes` por tabla con el filtro de alcance (§3.2). Usa `actualizado_en > ultimoPulso - 60 s`: el solapamiento cubre transacciones que confirman tarde, y WatermelonDB trata un `created` ya existente como actualización. Si la huella de alcance cambió o `ultimoPulso` es nulo, responde con `experimentalStrategy: 'replacement'`. Agrega la cabecera `x-hora-servidor` y respuesta gzip si el cliente acepta. | 30 llamadas/min por cuenta; sin CORS (solo la app nativa) | RF-307, RNF-304, RNF-306 |
| `POST /sincronizacion/cambios?ultimoPulso` | `sincronizacionPush` | catequista, coordinación | Si la cuenta o el enlace están revocados → 401 (rechazo y aviso definidos en plan 001, RF-112). Si el ciclo está cerrado → descarta todo y lo cuenta en la bitácora (RF-802). Si no, aplica en **una transacción**, en orden: sesiones → listas → marcas → correcciones. Inserta con `ON CONFLICT (id) DO NOTHING`, así que reintentar es idempotente. Valida cada fila: autor = cuenta del token, sesión vigente, ventana, carné, alcance. Un rechazo de negocio **no** falla el push: la fila se guarda con `estado='rechazada'` y `motivo_rechazo`, y genera un aviso. Responde `ResumenPush`. | Cuerpo de 512 KB como máximo; 30 llamadas/min por cuenta | RF-303, RF-307, RF-308 |

### 5.2 Módulo `asistencia`

OpenAPI también cubre soporte transversal de ciclo y catálogo/cumplimiento en `ciclos/http` y `actividades/http`. POST apertura solo ADM; cierre alias `/ciclos/{id}/cerrar` y `/cierre` sin query/cuerpo, efectos auditados/idempotentes. Actividad comparte procesador push; reprogramación sin marcas aceptadas y cancelación con traza. Registro de handlers/providers real se verifica en integración; no sustituye resto de 005/008.

| Método y ruta / disparador | Function | Roles | Autorización | APIM | RF |
| --- | --- | --- | --- | --- | --- |
| `GET /asistencia/carnes/{codigo}/validacion` | `validarCarne` | catequista | Responde solo `{ estado }` (`valido` / `invalido` / `inactivo`), sin nombre ni grupo. El celular lo llama solo si el código no está en la nómina local y hay red. | 120/min por cuenta | RF-303, RNF-307 |
| `GET /asistencia/misas/{fecha}/reporte` | `reporteMisa` | coordinación (incluida la delegada), supervisión | Ve todos los grupos. Muestra a cada registrador con su identidad operativa (seudónimo si es menor, definido en plan 001). | 30/min; CORS al origen de Static Web Apps | RF-304, RF-312 |
| `GET /asistencia/avisos?estado` | `listarAvisosAsistencia` | coordinación | Todo el ciclo | 30/min | RF-303, RF-308, RF-310 |
| `POST /asistencia/avisos/{id}/atencion` | `atenderAvisoAsistencia` | coordinación | Registra quién atendió el aviso y cuándo | 30/min | RF-303, RF-308, RF-310 |
| `GET /asistencia/catequizandos/{id}/domingos` | `asistenciaDeCatequizando` | familia (solo sus hijos), catequista (sus grupos), coordinación, supervisión | Por alcance; a la familia no se le muestra el registrador | 30/min; CORS a Static Web Apps | HU-306, RF-301, RF-311 |
| Temporizador `0 0 8 * * 1` (UTC; lunes 03:00 Lima) | `generarSesionesDominicales` | sistema | Generación idempotente UUID v5; invocable por 008 | — | RF-301 |
| Temporizador `0 */5 12-16 * * 0` (UTC; domingo 07–11 Lima) | `precalentarDomingo` | sistema | Consulta trivial en su grupo; no garantiza mantener caliente el grupo HTTP | — | RNF-303 |

**Servicios internos que consumen otros módulos** (llamadas dentro del proceso, no HTTP):
- `consultarAusencias(cicloId, filtro)`, para el plan 004 (ausencias justificables) y el plan 006 (ausencias a misa).
- `consultarFaltas(cicloId, filtro)`, para el plan 007.
- `consultarCumplimientoActividad(actividadId)`, para el plan 005.
- La bandeja `eventos_asistencia`, para recalcular (planes 004, 006 y 007).
- `resumenAsistencia(catequizandoId, cicloId, contexto, tx)`: proveedor de `ProveedorResumenPerfil` de 002, misma fuente de ausencias/faltas y proyección por rol; FAM sin horas/registradores.

Puertos que este módulo consume:
- `FuenteJustificacionesAprobadas`: plan 004. Adaptador vacío/falso solo para desarrollo aislado; nunca acredita integración real ni ausencia de justificaciones en un despliegue que habilite 004.
- `FuenteInscripciones` (periodos activos y grupo en una fecha) y `ResolutorCarnes`: plan 002.
- `IdentidadOperativa`: plan 001.

**Procesamiento de marcas en el push (`aplicacion/procesar-marcas.ts`):**
1. Por cada par (`sesion_id`, `catequizando_id`) afectado se toma `pg_advisory_xact_lock(hash)` y se recalcula `consolidar()` sobre todas las marcas y correcciones aceptadas.
2. Se hace upsert de `asistencias` y se inserta un `eventos_asistencia` si cambió el valor.
3. Si aparece un conflicto → aviso `conflicto_registro` (RF-308).
4. Si se confirma una lista o llega una marca de misa → `detectarMisaSinCatequesis` → aviso `revision_cruzada` (RF-310).

Los avisos llevan id determinista, así que no se duplican.

## 6. Cliente (Expo Router)

El layout por rol y la protección de rutas con sesión y PIN están definidos en plan 001. `src/app/asistencia.tsx` pasa a ser `src/app/asistencia/index.tsx`.

| Ruta | Rol | Comportamiento | Sin conexión | RF / RNF |
| --- | --- | --- | --- | --- |
| `asistencia/index.tsx` | catequista | Muestra la sesión en curso (misa o actividad dentro de la ventana), los grupos (los suyos primero, luego todos) y un contador de pendientes y rechazados | Sí, todo desde la base local | RF-301, RF-306, RF-307 |
| `asistencia/escanear.tsx` | catequista | `CameraView` con `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}` y `onBarcodeScanned`; botón de linterna (`enableTorch`); permiso con `useCameraPermissions`. Ignora el mismo código durante 2 s. Al leer: `procesarEscaneo` → escritura local → banner verde a pantalla completa con el nombre (si el niño es de sus grupos) o con «Registrado» → `Vibration` de React Native. Muestra «Ya estaba registrado» o «Carné no válido» según el caso. La cámara se desmonta al perder el foco. | Sí: guarda el código y lo valida al sincronizar | RF-302, RF-303, RNF-305, RNF-307 |
| `asistencia/manual.tsx` | catequista | Búsqueda por nombre limitada a los niños de **sus** grupos; crea una marca `tipo_registro='manual'` | Sí | RF-304 |
| `asistencia/lista/[grupoId].tsx` | catequista | Lista de cualquier grupo, con todos presentes; un toque marca ausente. Cada toque se guarda en `borradores_lista`. Al confirmar se crean la lista y las marcas, y el borrador se borra. Sirve también para actividades (`?sesionId`). | Sí | RF-306, RF-313, RNF-301, RNF-306 |
| `asistencia/pendientes.tsx` | catequista | Cuántos registros faltan por enviar, la última sincronización, los rechazados con su motivo y los descartados por cierre (según el último `ResumenPush`) | Sí | RF-303, RF-307 |
| `asistencia/correccion/[sesionId]/[catequizandoId].tsx` | autor (hasta el fin del domingo) o coordinación (después, con motivo) | Muestra el valor actual y el anterior. Crea una fila en `correcciones_asistencia`. | Sí (el servidor valida con la hora efectiva) | RF-306, RF-309 |
| `coordinacion/sesiones.tsx` | coordinación | Calendario de domingos: sin misa o sin catequesis con motivo; cambio de la ventana de un domingo | Sí (push de `sesiones`) | RF-301 |
| `coordinacion/avisos-asistencia.tsx` | coordinación | Avisos de código inválido, rechazo, conflicto y revisión cruzada; marcar como atendido | No: requiere red y lo indica | RF-303, RF-308, RF-310 |
| `reportes/misa/[fecha].tsx` | coordinación, supervisión | Reporte de misa con totales y conteo de registros manuales | No: requiere red | RF-304, RF-312 |
| `familia/asistencia/[catequizandoId].tsx` | familia (web) | Misa y catequesis por domingo, de solo lectura | No (la web siempre trabaja en línea) | HU-306 |

**Capa de datos del cliente (`src/datos/`):**
- `local/base-datos.native.ts`: crea la base con el adaptador SQLite (JSI) y fija `setGenerator(() => Crypto.randomUUID())`.
- `local/base-datos.web.ts`: para la web no crea nada y lanza un error si se usa.
- `local/esquema.ts` y `local/migraciones.ts` (§3.3); `local/modelos/*.ts` (clases `Model`).
- `sincronizacion/motor.ts`: llama a `synchronize({ database, pullChanges, pushChanges, migrationsEnabledAtVersion })` con el cliente HTTP del plan 001. Primero se renueva la sesión (RF-112, plan 001), después el pull y al final el push.
- `sincronizacion/disparadores.ts`: suscripción a NetInfo, a `AppState` (vuelta a primer plano) y al evento de lista confirmada. Reintentos con `esperaReintento`. Calcula el desfase de reloj a partir de `x-hora-servidor`.
- `sincronizacion/pendientes.ts`: consulta reactiva de filas con `_status` en (`created`, `updated`) de las tablas push → contador (RF-307).

**Tiempo de confirmación < 1 s (RF-302):** el camino del escaneo no espera la red. Solo lee la nómina (índice por `codigo_carne`) y escribe una fila; la sincronización se dispara aparte.

## 7. Decisiones técnicas

| Id | Decisión | Alternativas descartadas | Justificación |
| --- | --- | --- | --- |
| D-301 | **Marcas inmutables** (solo se añaden) más un estado **consolidado** que calcula el servidor por (sesión, niño) | Un registro mutable por niño y sesión con «el último en escribir gana»; o resolver conflictos en el cliente | Deja constancia de todos los registradores (RF-308). El push es idempotente por UUID. No hay conflictos de actualización en WatermelonDB (casi todo es `created`). Las correcciones conservan el valor anterior (RF-309). |
| D-302 | **Sesiones con UUID v5 determinista** (ciclo, fecha, tipo, actividad), generadas por un temporizador y también calculables en el celular | UUID aleatorio creado por la coordinación; sesiones por grupo | Un celular sin el último pull puede registrar contra la sesión correcta sin duplicarla. RF-301 define dos asistencias por niño y domingo, no por grupo. |
| D-303 | **Ausencia y falta calculadas** con una función pura compartida por servidor y celular; no se materializan | Materializar faltas con un temporizador al cierre de la ventana; vistas SQL | Los registros que llegan tarde (incluso una semana después), las correcciones y las justificaciones recalculan solas (caso límite «corrección ya usada»). Hay una sola implementación (principio 3). El volumen es mínimo (~100 niños × 40 domingos). |
| D-304 | **Los rechazos de negocio se aceptan en el push y se guardan** con `estado='rechazada'`; vuelven al celular por el pull y generan un aviso | Fallar el push completo (WatermelonDB lo reintentaría para siempre); descartar en silencio | Cumple RF-303 («sin perderlo de forma silenciosa»). Un código inválido no bloquea los demás registros. |
| D-305 | **Tres horas por registro:** la del celular, el desfase estimado en la última sincronización y la de llegada al servidor. La ventana y el fin del domingo se evalúan con la hora efectiva (celular + desfase), con tolerancia | Usar solo la hora del servidor (no sirve sin conexión); usar solo la del celular | Requisito explícito de RF-302 y del caso límite del reloj desfasado. Corrige celulares adelantados o atrasados sin depender de la red al registrar. |
| D-306 | **Definición única de las tablas sincronizadas** en TS puro, de la que salen el esquema WatermelonDB y la serialización del servidor, con un registro por módulo | Esquema escrito a mano en el cliente y en el servidor | Evita divergencias entre 8 módulos y permite el test de columnas prohibidas (principio 7). |
| D-307 | **Alcance del pull:** nómina mínima global más datos operativos de los grupos propios. Si cambia el alcance, pull de reemplazo (`experimentalStrategy: 'replacement'`). | Bajar todo a todos; bajar solo los grupos propios | RNF-306 exige la nómina global para RF-306 sin exponer más de lo necesario. Si un niño cambia de grupo, el reemplazo limpia sus datos operativos del celular anterior. |
| D-308 | **`CameraView` de `expo-camera`** en modo continuo, solo QR, con linterna | `launchScanner` (se cierra tras cada lectura, y en Android depende del escáner de Google Play Services, que puede requerir descarga); `react-native-vision-camera` (dependencia extra) | Escaneo en ráfaga de decenas de carnés, incluido en el SDK 57, con linterna para poca luz (RNF-305). |
| D-309 | **Confirmación visual más vibración** (`Vibration` de React Native); sin sonido en el primer corte | `expo-audio` para un pitido | RF-302 hace opcional el sonido; así no se añade una dependencia. Se reevalúa tras la prueba de campo. |
| D-310 | **El borrador de la lista solo vive en el celular**; se sincroniza la lista confirmada | Sincronizar borradores | RF-306: nada cuenta hasta confirmar. Resiste que el celular se apague y ahorra datos (RNF-304). |
| D-311 | **Web solo en línea**, sin WatermelonDB (familia y reportes) | WatermelonDB con LokiJS en la web | Las familias solo consultan (HU-306) y en la web no se toma asistencia. Así no hay datos de niños en navegadores ajenos. |
| D-312 | **Las correcciones son filas nuevas sincronizadas**, también las de la coordinación | Editar la marca original; endpoint en línea para la coordinación | Traza completa (RF-309) y principio 5 (toda escritura va primero al almacén local). |
| D-313 | **Bandeja de salida `eventos_asistencia`** en PostgreSQL para avisar cambios a 004, 006 y 007 | Llamadas directas entre módulos; Azure Storage Queues | Es duradera, transaccional junto con el cambio de asistencia, cuesta 0 y no añade recursos de Azure. Los consumidores guardan su propia `secuencia`. |
| D-314 | Pool `pg` 3 por proceso, 1 worker, máximo 5 instancias **por grupo** Flex, HTTP concurrency 10, memoria 2048 MB, always-ready 0; timers UTC | Pool 4; supuesto de 5 instancias globales; Premium | Un grupo puede usar 15 conexiones, pero HTTP y timers escalan separados: sumar grupos/auxiliares y medir en despliegue. Precalentar un timer no garantiza calentar HTTP. Azure 2026 permite máximo desde 1 (ADR 014); no prometer costo ni capacidad verificados |
| D-315 | **Validación del carné primero contra la nómina local**; el endpoint solo se usa si el código es desconocido y hay red | Validar siempre en línea | Confirmación en menos de 1 s (RF-302), funciona sin red (RF-303) y casi no consume datos. |
| D-316 | **Sincronización automática con la app abierta** (reconexión, vuelta a primer plano, lista confirmada) | Tarea en segundo plano con `expo-background-task` | RF-307 pide envío «sin intervención», y esto se cumple al abrir la app sin pulsar nada. La tarea en segundo plano queda como opción si la prueba de campo muestra registros que tardan días en enviarse. |

**ADR:** se recomienda un ADR «Protocolo de sincronización por marcas inmutables» (D-301, D-304, D-307) que refine el ADR 002. Reemplazar el «Servicio de Autenticación externo» del C4 por enlace + PIN también requiere un ADR, definido en plan 001.

## 8. Estructura de archivos propuesta

```
src/
  lib/
    asistencia/        tipos, sesiones, reloj, carne, escaneo, autorizacion, lista,
                       consolidacion, correccion, faltas, revision-cruzada,
                       reporte-misa, tablas-sincronizadas  (+ *.test.ts)
    sincronizacion/    protocolo, tablas, registro-tablas, alcance, orquestador,
                       pendientes, columnas-prohibidas      (+ *.test.ts)
  datos/
    local/             base-datos.native.ts, base-datos.web.ts, esquema.ts,
                       migraciones.ts, modelos/*.ts, repositorio-asistencia.ts
    sincronizacion/    motor.ts, disparadores.ts, pendientes.ts
  app/
    asistencia/        index, escanear, manual, pendientes, lista/[grupoId],
                       correccion/[sesionId]/[catequizandoId]
    coordinacion/      sesiones, avisos-asistencia
    reportes/misa/[fecha].tsx
    familia/asistencia/[catequizandoId].tsx
  components/asistencia/  confirmacion-escaneo, fila-catequizando, contador-pendientes
api/
  migraciones/         0300 … 0307 (§3.1)
  src/modulos/
    sincronizacion/    dominio/ aplicacion/{pull,push,registro-proveedores}.ts
                       infraestructura/bitacora-pg.ts  http/cambios.ts
    asistencia/        dominio/ (reexporta src/lib/asistencia + puertos)
                       aplicacion/{procesar-marcas,registrar-correccion,consultar-faltas,
                                   consultar-ausencias,reporte-misa,avisos,generar-sesiones}.ts
                       infraestructura/{repositorio-*-pg.ts,proveedor-sincronizacion.ts,
                                        temporizadores/{generar-sesiones,precalentar-domingo}.ts}
                       http/{validar-carne,reporte-misa,avisos,asistencia-catequizando}.ts
  pruebas/carga/pico-dominical.k6.js
```

## 9. Estrategia de tests

Todos los tests corren con Jest. El nombre de cada uno cita su RF o RNF. Configuración y Postgres en Docker definidos en plan 001.

| Nivel | Qué | Herramienta |
| --- | --- | --- |
| Unitarios de dominio | Todas las funciones de la §4, con tablas de casos | Jest (`src/lib/**`) |
| Contrato de repositorios | Una sola batería por puerto (`RepositorioMarcas`, `RepositorioAsistencias`, `RepositorioSesiones`, `RepositorioAvisos`), que se corre contra el falso en memoria y contra PostgreSQL en Docker | Jest (`api/`) |
| Repositorio local | Modelos y repositorio con el adaptador LokiJS en memoria de WatermelonDB | jest-expo |
| HTTP de cada Function | Handler con un `HttpRequest` sintético y JWT de prueba por rol: 200 / 401 / 403, forma de la respuesta, sin datos de más | Jest (`api/`) |
| Componentes | Escaneo discreto, lista con presentes por defecto, contador de pendientes | jest-expo + `@testing-library/react-native` (la dependencia la fija el plan 001) |
| Extremo a extremo | El motor real de sincronización del cliente (LokiJS) contra los handlers de la API y Postgres en Docker: dos «celulares» sin red registran un domingo completo, reconectan y el reporte coincide | Jest (`api/pruebas/e2e`) |
| Carga | 50 usuarios virtuales con push y pull durante 30 min contra el entorno de pruebas en Azure | k6 (manual, fuera de `npm test`) más un test de Jest con 50 clientes concurrentes contra Functions locales |
| Campo | Criterios de finalización de la spec, con cronómetro y en modo avión | Protocolo manual en `specs/003-asistencia-dominical/prueba-campo.md` (se escribe en `tasks.md`) |

**Casos límite de la spec convertidos en tests:**

| Caso límite | Test |
| --- | --- |
| Llega tarde, dentro de la ventana | `RF-302: escaneo dentro de la ventana registra presente con su hora` |
| Va a misa y no a catequesis | `RF-311: ausente solo en catequesis no suma falta` |
| No va a misa ni a catequesis | `RF-311: ausente en misa y catequesis suma una falta` |
| Escaneado que se va antes de la misa | `RF-309: la coordinación corrige a ausente una presencia en misa con motivo y traza` |
| Carné presentado por un hermano | `RF-310: presente en misa y ausente en la lista genera aviso de revisión cruzada` |
| Carné reimpreso | `RF-303: un código de carné reemplazado se resuelve como desconocido y se rechaza al sincronizar` |
| Catequista que falta | `RF-306: un catequista confirma la lista de un grupo que no es suyo` (dominio + HTTP push) |
| Inscrito el mismo domingo sin carné | `RF-304: registro manual de un niño inscrito ese día queda marcado como manual` |
| Cambio de grupo entre la sincronización y el domingo | `RF-308: marcas del grupo anterior y del nuevo se consolidan en un solo registro por niño` |
| Celular que se apaga a mitad de la lista | `RF-306: el borrador de la lista sobrevive a reabrir la base local` |
| Sin conexión hasta el domingo siguiente | `RF-307: un push de 7 días después se acepta sin duplicar` y `RF-309: una corrección hecha antes del fin del domingo y enviada después se acepta` |
| Reloj desfasado | `RF-302: con desfase estimado, la ventana se evalúa con la hora efectiva y se guardan ambas horas` |
| Domingo sin misa o sin catequesis | `RF-301: una sesión cancelada no genera ausencias` |
| Corrección usada en una justificación o alerta | `RF-309: una corrección que cambia el valor inserta evento_asistencia` |
| Escaneo doble | `RF-302: el segundo escaneo del mismo carné responde ya_registrado y no crea una marca` |
| Dos catequistas, presente y ausente | `RF-308: presente gana, se conservan ambos registradores y se avisa a la coordinación` |
| Push repetido | `RF-307: reenviar el mismo lote no duplica marcas ni avisos` |
| Ciclo cerrado | `RF-307: los registros que llegan después del cierre se descartan y se cuentan en la bitácora` |
| Código inválido sin conexión | `RF-303: un código desconocido sin red se guarda pendiente y al sincronizar se rechaza con aviso` |

## 10. Matriz de cobertura

| Req. | Componentes | Tests principales |
| --- | --- | --- |
| RF-301 | `sesiones.ts`, `faltas.ts`, tabla `sesiones`, `generarSesionesDominicales`, `coordinacion/sesiones.tsx` | `RF-301: domingosDelCiclo genera misa y catequesis por domingo`; `RF-301: una sesión cancelada no genera ausencias`; `RF-301: presente en misa y ausente en catequesis el mismo domingo`; `RF-301: solo la coordinación cambia una sesión (push 403 por fila)` |
| RF-302 | `carne.ts`, `escaneo.ts`, `reloj.ts`, `autorizacion.ts`, `marcas_asistencia`, `escanear.tsx` | `RF-302: escaneo dentro de la ventana registra presente con hora del celular, hora del servidor y registrador`; `RF-302: escaneo de otro grupo devuelve mostrarNombre=false`; `RF-302: segundo escaneo responde ya_registrado`; `RF-302: escanear exige rol catequista (HTTP 403)`; `RF-302: el camino del escaneo no espera la red` |
| RF-303 | `escaneo.ts`, `procesar-marcas.ts`, `validarCarne`, `avisos_asistencia` | `RF-303: con red, un código inactivo se rechaza al instante`; `RF-303: sin red, un código desconocido queda pendiente`; `RF-303: al sincronizar, un código inválido queda rechazado con aviso y no cuenta como asistencia` |
| RF-304 | `autorizacion.ts`, `manual.tsx`, `reporte-misa.ts` | `RF-304: la búsqueda manual solo ofrece niños de los grupos propios`; `RF-304: el servidor rechaza un registro manual de otro grupo`; `RF-304: el reporte cuenta los registros manuales` |
| RF-305 | `faltas.ts` (`estadoEnSesion`) | `RF-305: al cerrar la ventana, un niño activo sin presencia queda ausente en misa`; `RF-305: antes del cierre queda pendiente`; `RF-305: un niño inactivo en esa fecha queda no_aplica` |
| RF-306 | `lista.ts`, `borradores_lista`, `listas_asistencia`, `lista/[grupoId].tsx` | `RF-306: la lista abre con todos presentes`; `RF-306: un toque marca ausente`; `RF-306: al confirmar se crean marcas para todo el grupo con hora y catequista`; `RF-306: sin confirmar no cuenta`; `RF-306: un catequista pasa la lista de otro grupo`; `RF-306: un niño que llega tarde pasa a presente por corrección` |
| RF-307 | `sincronizacion/*`, `motor.ts`, `disparadores.ts`, `sincronizacionPull`/`Push`, `pendientes.tsx` | `RF-307: e2e domingo completo sin red llega íntegro`; `RF-307: reenviar el lote es idempotente`; `RF-307: al reconectar sincroniza sin acción del usuario`; `RF-307: el contador muestra los pendientes de la cuenta`; `RF-307: se descarta lo que llega después del cierre` |
| RF-308 | `consolidacion.ts`, `procesar-marcas.ts` (bloqueo advisory) | `RF-308: dos marcas de presencia generan un registro con dos registradores`; `RF-308: presente gana a ausente y genera aviso`; `RF-308: pushes concurrentes del mismo niño no duplican` (Postgres) |
| RF-309 | `correccion.ts`, `consolidacion.ts`, `correcciones_asistencia`, `correccion/*.tsx` | `RF-309: el autor corrige antes del fin del domingo y se conserva el valor anterior y la hora`; `RF-309: otro catequista no puede corregir`; `RF-309: después del fin solo corrige la coordinación y con motivo`; `RF-309: la corrección inserta evento_asistencia` |
| RF-310 | `revision-cruzada.ts`, `procesar-marcas.ts`, `avisos-asistencia.tsx` | `RF-310: confirmar una lista avisa de los niños presentes en misa y ausentes en catequesis`; `RF-310: una marca de misa que llega después de la lista también genera el aviso`; `RF-310: el aviso no se duplica` |
| RF-311 | `faltas.ts`, `consultar-faltas.ts`, puerto `FuenteJustificacionesAprobadas` | `RF-311: ausente en ambas suma una falta`; `RF-311: ausente en una no suma`; `RF-311: una jornada sin asistencia suma una falta`; `RF-311: una justificación aprobada de esa fecha deja de contar la falta`; `RF-311: catequesis sin registro no suma` |
| RF-312 | `reporte-misa.ts`, `reporteMisa`, `reportes/misa/[fecha].tsx` | `RF-312: el reporte lista presentes con hora, registrador con seudónimo y tipo`; `RF-312: muestra presentes frente a activos en la fecha`; `RF-312: la supervisión puede leer y la familia y el catequista reciben 403` |
| RF-313 | `sesiones.ts` (tipo `actividad`), `lista.ts`, `escaneo.ts`, `consultarCumplimientoActividad` | `RF-313: una actividad se registra por escaneo`; `RF-313: una actividad se registra por lista`; `RF-313: la asistencia a la actividad se expone como cumplimiento` |
| RNF-301 | `listas_asistencia.abierta_en/confirmada_en`, intervalos entre escaneos | `RNF-301: la lista de 25 niños se confirma con un toque por ausente y uno para confirmar`. **Medición en campo:** mediana de `confirmada_en - abierta_en` por grupo < 2 min, comparada con la línea base en papel cronometrada. |
| RNF-302 | Todo el flujo local | `RNF-302: e2e escaneo, manual, lista y corrección con el adaptador de red caído`. **En campo:** domingo completo en modo avión. |
| RNF-303 | D-314, `precalentarDomingo`, `bitacora_sincronizacion.duracion_ms` | `RNF-303: 50 clientes concurrentes sin errores ni duplicados` (Jest). **Carga con k6:** 50 usuarios virtuales en 30 min, p95 de push < 2 s, 0 errores 5xx. **En campo:** p95 de `duracion_ms` en la bitácora. |
| RNF-304 | Alcance del pull, borrador local, gzip, `bitacora_sincronizacion.bytes_*` | `RNF-304: push + pull de un domingo completo de un grupo de 25 niños pesa < 100 KB sin comprimir` (estimado ~25 KB). **En campo:** suma de bytes de la bitácora por cuenta y domingo. |
| RNF-305 | D-308, linterna, consultas indexadas | `RNF-305: escanear.tsx muestra el control de linterna y solicita solo QR`. **Laboratorio:** celular de referencia (Android 10, 2 GB de RAM), 20 carnés con < 50 lux y linterna: ≥ 95 % leídos con confirmación en < 1 s. |
| RNF-306 | `alcance.ts`, tabla local `catequizandos` | `RNF-306: el pull de un catequista trae la nómina completa solo con id, nombre, grupo y código`; `RNF-306: las asistencias bajan solo de sus grupos`; `RNF-306: sin red se abre la lista de otro grupo` |
| RNF-307 | `autorizacion.ts`, `escaneo.ts`, `confirmacion-escaneo.tsx`, `validarCarne` | `RNF-307: escanear a un niño de otro grupo muestra «Registrado» sin su nombre` (componente); `RNF-307: validarCarne no devuelve nombre ni grupo` |
| HU-306 | `asistenciaDeCatequizando`, `familia/asistencia/*` | `HU-306: la familia ve misa y catequesis solo de sus hijos; de otro niño recibe 403` |

## 11. Dependencias, riesgos, costo y dudas

### Dependencias con otras specs

| Spec | Este plan necesita | Este plan entrega |
| --- | --- | --- |
| 001 | JWT, roles efectivos (incluida la delegación), middleware de autorización, sesión sin conexión con PIN (RF-112), rechazo de pendientes de cuentas revocadas, `identidadOperativa`, infraestructura, APIM, Jest y CI | Lista de columnas prohibidas en el celular; borrado local tras cerrar sesión basado en `registrado_por` |
| 002 | SQL `catequizando`/`grupo` con columnas sync; periodos de inscripción/asignación `FuenteInscripciones`, `emision` BD y `ResolutorCarnes` | Colecciones locales `catequizandos`/`grupos`, `codigo_carne` derivado y proveedor sync; `resumenAsistencia` para perfil |
| 004 | `FuenteJustificacionesAprobadas` | `consultarAusencias`, `eventos_asistencia` (deja sin efecto una justificación si la ausencia pasa a presente, RF-407) |
| 005 | Tabla mínima `actividad_obligatoria` (`0505`, id/ciclo/tipo/fecha/estado) y FK `sesion.actividad_id` | Sesiones/`consultarCumplimientoActividad`; no acredita avance 005 completo |
| 006 | — | `consultarAusencias` (misa), `eventos_asistencia` |
| 007 | — | `consultarFaltas`, `eventos_asistencia`, domingos seguidos sin asistencia |
| 008 | Estado del ciclo (abierto o cerrado), la llamada a `generarSesionesDominicales` al abrir un ciclo | Descarte después del cierre, conteo en la bitácora |

### Riesgos

| Riesgo | Prob. / impacto | Mitigación |
| --- | --- | --- |
| R-301 WatermelonDB con Expo SDK 57 / RN 0.86 (solo nueva arquitectura) y plugin de configuración para EAS | Media / alto | Prueba técnica en la fase 0 con un build de desarrollo. Plan B: `expo-sqlite` con el mismo protocolo, porque `src/lib/sincronizacion/protocolo.ts` no depende de la librería. |
| R-302 La base local no se cifra (el ADR 002 lo pide) | Media / medio | Minimización: la base local no guarda datos restringidos y se borra al cerrar sesión (plan 001). Evaluar SQLCipher después del primer corte. |
| R-303 Reloj del celular manipulado para corregir fuera de plazo | Baja / bajo | Desfase estimado en cada sincronización; el servidor rechaza una hora efectiva incoherente con `recibido_en` (posterior a la llegada). |
| R-304 Arranque en frío o conexiones agotadas en el pico | Media / bajo | D-314. El usuario nunca espera a la red. |
| R-305 Lectura QR en gama baja con poca luz | Media / alto | Linterna, solo QR, carné impreso con corrección de error nivel Q y QR ≥ 3 cm (recomendación al plan 002), registro manual de respaldo. |
| R-306 Nómina de todos los niños en cada celular | Cierta / medio | Mandada por RNF-306; solo nombre, grupo y código; escaneo discreto; borrado al cerrar sesión. |

### Costo en Azure (incremental de esta spec)

| Recurso | Consumo estimado | Costo |
| --- | --- | --- |
| Functions (Consumo) | ~50 catequistas × ~10 sincronizaciones × 4 domingos ≈ 2 000 ejecuciones/mes, más ~220 de precalentamiento y 4 de generación de sesiones | 0 (dentro del millón gratuito) |
| APIM Consumo | < 5 000 llamadas/mes | 0 (primer millón gratuito) |
| PostgreSQL B1ms | ~12 000 marcas/año, < 10 MB | 0 adicional (instancia definida en plan 001) |
| Salida de red | < 100 KB por grupo y domingo | 0 |
| Blob | No se usa | 0 |

### Dudas `[NECESITA ACLARACIÓN]` con supuesto provisional

| # | Duda | Supuesto provisional (reversible) | Cómo se revierte |
| --- | --- | --- | --- |
| A-301 | Ventana de la misa (spec) | 07:30–09:30, hora de Lima, como parámetro del ciclo; la coordinación puede cambiarla para un domingo | Cambiar el parámetro o la sesión, sin tocar código |
| A-302 | Contenido del QR (spec, plan 002) | Formato definido en el plan 002 (D-202): `SGC1:<uuid-perfil>:<emision>`, que se guarda como `codigo_carne`. La emisión permite invalidar un carné reimpreso; `resolverCarne` usa `interpretarCodigoCarne` de `src/lib/catequizandos/carne.ts`. | Solo cambia el valor de `codigo_carne`; `resolverCarne` no cambia |
| A-303 | Quién imprime y paga los carnés (spec) | Queda fuera de este plan (plan 002 y la parroquia) | — |
| A-304 | Tiempo actual de pasar lista en papel (spec) | Se cronometra en la primera prueba de campo. Meta provisional: < 2 min por grupo de 25. | Se ajusta la meta de RNF-301 |
| A-305 | Fin del domingo (spec) | 23:59:59 del domingo, hora de Lima (`hora_fin_domingo`) | Cambiar el parámetro |
| A-306 | ¿Es falta faltar a la única sesión de un domingo que tuvo solo una? | No: aplica literalmente RF-311 («ausente en ambas»), lo que favorece al niño | Una bandera en `faltasDelCiclo` |
| A-307 | Jornada en domingo: ¿1 o 2 faltas? (plan 007) | Se cuentan por separado. Si la jornada reemplaza las sesiones, la coordinación marca ese domingo sin misa ni catequesis y solo cuenta la jornada. | Una regla en `faltasDelCiclo` |
| A-308 | Actividades de varios días (plan 005) | Una sesión por actividad y fecha; el cumplimiento lo decide el plan 005 | El plan 005 agrupa las sesiones |
| A-309 | Ventana de las actividades | Todo el día de la actividad, salvo que la coordinación fije otra | Columnas de ventana de la sesión |
| A-310 | Grupo sin lista confirmada | Sus niños quedan `sin_registro` en catequesis, no suman falta y la coordinación puede corregir | Cambiar `estadoEnSesion` |
| A-311 | ¿Quién escanea y pasa lista? | Solo el rol catequista. La coordinación lo hace si además tiene ese rol (cuentas con varios roles, plan 001). | Ampliar `puedeEscanear` |
| A-312 | ¿Se avisa al catequista de los descartes por cierre? (plan 008) | Sí: el resumen del push se muestra en `pendientes.tsx`; no se guarda el contenido | Ocultar el mensaje |
| A-313 | ¿Qué ve la familia? (plan 001) | Presente o ausente en misa y catequesis por domingo, sin registrador ni horas | Cambiar la proyección del endpoint |

## 12. Orden de implementación

El orden histórico de fases no reduce el alcance backend actual. Las pruebas nativas siguen pendientes, pero no bloquean construir API/contratos puros. Integraciones externas 004–008 se entregan como puertos y baterías de contrato; no como módulos completos. La tabla mínima `actividad_obligatoria` de `0505` soporta RF-313, y `0002` + `0801` soportan ciclo/guardia, sin completar avance o historial.

**Fase 0 — prueba técnica (bloquea entrega nativa, no API/dominio):**
1. Build de desarrollo con EAS en un Android de gama baja con WatermelonDB (JSI), el plugin de configuración y `CameraView` leyendo QR con poca luz (R-301, R-305).
2. Acordar con el plan 001 la numeración de migraciones y la configuración de Jest.

**Fase 1 — primer corte (spec 003 completa, con lo mínimo de 001 y 002):**
1. Dominio puro y sus tests: `sesiones`, `reloj`, `carne`, `escaneo`, `autorizacion`, `lista`, `consolidacion`, `correccion`, `faltas`, `revision-cruzada`, `reporte-misa`, `sincronizacion/*`.
2. Migraciones 0300–0307 y repositorios PostgreSQL con sus tests de contrato.
3. Módulo `sincronizacion` (pull y push), con proveedores de la nómina y los grupos mínimos del plan 002 y de las tablas de la 003.
4. Módulo `asistencia`: procesamiento de marcas, avisos, correcciones, `validarCarne`, `reporteMisa` y temporizadores.
5. Cliente: base local, esquema, motor y disparadores, pantallas `asistencia/*`, `coordinacion/sesiones`, `coordinacion/avisos-asistencia` y `reportes/misa`.
6. RF-311 con el adaptador vacío de justificaciones; el comportamiento se prueba con un adaptador falso.
7. RF-313 con `actividad_obligatoria` mínima de `0505`; cumplir backend actual requiere ese soporte, sin declarar avance 005 completo.
8. Test extremo a extremo de un domingo sin red, carga con k6 y prueba de campo (criterios de finalización, RNF-301 a RNF-307).

**Fase 2 — integración con las demás specs:**
- Adaptador real de justificaciones aprobadas (plan 004).
- Consumidores de `eventos_asistencia` (planes 004, 006 y 007).
- FK de `actividad_id` y cumplimiento de actividades (plan 005).
- Vista de la familia (HU-306) en la web.
- Sincronización en segundo plano si la prueba de campo la justifica (D-316).
- Cifrado de la base local (R-302).

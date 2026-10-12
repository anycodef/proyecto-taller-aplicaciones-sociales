# Contratos backend 001–003 para frontend

Contrato del 2026-10-11 para `backend/001-003`, ajustado a DTO/handlers actuales. Fuentes: constitución, specs/planes 001–003 y ADR 011–015. [OpenAPI 3.1](../api/openapi.json) detalla schemas estrictos, métodos, parámetros, cuerpos y estados; [seguimiento](backend-implementacion.md) distingue implementación y evidencia. OpenAPI no acredita endpoints desplegados. Verificación sin dependencias: `node api/scripts/verificar-openapi.mjs`.

## Convenciones

- Base pública `/v1` detrás de APIM, HTTPS. `Authorization: Bearer <jwt>`; clave de suscripción identifica producto, no persona.
- Campos HTTP camelCase español (`catequizandoId`, `identidadOperativa`, `recibidoEn`). Excepción explícita WatermelonDB: claves nativas/filas snake_case según sección sync, sin traducción obligatoria.
- PostgreSQL: tablas singulares y columnas snake_case. Sync: colecciones plurales y filas snake_case, excepción explícita de transporte para WatermelonDB.
- UUID generado en cliente para registros nacidos en app, también administración ONLINE. Reintentos usan el mismo UUID; 201 creación, 200 repetición idempotente según endpoint. IDs de sesión/consolidado/aviso son UUID v5 deterministas según plan 003; no generar otro id al reintentar.
- Fechas civiles `AAAA-MM-DD`; instantes administrativos ISO 8601 con zona. Sync y horas del reporte de misa usan **epoch-ms**, no ISO ni segundos. Reglas dominicales Lima; timers UTC. El frontend no decide autorización con su reloj.
- Cuerpos estrictos: campos desconocidos → 422. Query se valida según cada handler; no asumir rechazo de queries extra donde solo se leen parámetros conocidos. Sin credencial válida → 401 `{ codigo: 'acceso_denegado' }`, genérico. Fuera de alcance → 403 `{ codigo: 'fuera_de_alcance' }`. Renovación conocida terminada → 401 `{ codigo: 'credencial_terminada' }`. 409 dominio, 429 límite por cuenta; no reintentar en bucle inmediato.
- Perfil/condiciones/documentos/identidad real: `Cache-Control: no-store`. Nunca cuerpos, tokens, condiciones o documentos en logs, cachés persistentes o telemetría.

## Política local y acceso

**Administración exclusivamente ONLINE:** inscripción/edición, cuentas/roles, enlaces, delegación, consentimiento, condiciones, grupos/asignaciones/apoderados y estados documentales. Borradores solo en memoria; ni WatermelonDB, SecureStore ni cola de reintento persistente. Sin red el envío queda bloqueado. Asistencia, listas, sesiones operativas y correcciones de asistencia sí nacen en almacén local.

Equipo: enlace + PIN local (4–6 dígitos). `pin`, `pinHash` y contraseña no son campos de autenticación HTTP. SecureStore protege verificador/credencial; cinco fallos bloquean localmente y se reportan cuando hay red. Sesión operativa sin conexión 14 días desde última renovación. Reconexion: renovar → pull → push; cuenta/credencial revocada rechaza pendientes y registra conteo para coordinación. Familia web: token/JWT solo en memoria, sin WatermelonDB.

Cada petición y fila del push vuelve a comprobar cuenta, credencial, roles, delegación y alcance. Una cuenta con varios roles une alcances. SUP nunca escribe. Toda representación del autor usa `identidadOperativa`, nunca identidad real del catequista menor. Identidad real solo en endpoint ADM auditado.

## Seguridad 001

| Método/ruta | Petición/resultado esencial | Acceso |
| --- | --- | --- |
| `POST /acceso/equipo/activar` | `{ token, dispositivoId }` → `{ jwt, tokenRenovacion, ultimaRenovacion, contexto }`; dispositivo distinto → 401 genérico | Canje enlace |
| `POST /acceso/familia/entrar` | `{ token }` → `{ jwt, contexto }` | Canje enlace |
| `POST /acceso/renovar` | `{ tokenRenovacion, dispositivoId, pendientes? }` → sesión renovada y token rotado; acepta anterior para reintento según D-106 | Renovación |
| `POST /acceso/bloqueo` | `{ tokenRenovacion, dispositivoId }` → `{ bloqueada: true }`; nunca PIN | Reporte bloqueo |
| `GET /yo` | Contexto, roles efectivos, `identidadOperativa`, delegación vigente | Autenticado |
| `POST /cuentas`, `GET /cuentas`, `GET /cuentas/{id}` | Alta `{ id, identidadOperativa, esMenor, roles, identidadReal? }`; listados solo identidad operativa | ADM; COORD solo CAT/FAM |
| `PUT /cuentas/{id}/roles`, `POST /cuentas/{id}/desactivar` | Cambios auditados; no quitar/desactivar último ADM | ADM; COORD CAT/FAM |
| `GET /cuentas/{id}/identidad-real` | Lectura restringida auditada | Solo ADM |
| `POST /cuentas/{id}/enlaces` | `{ tipo }` → `{ url }` una vez; reemisión termina anterior | Gestión autorizada |
| `POST /cuentas/{id}/enlaces/revocar` | Revoca credencial vigente, efectiva en siguiente petición | Gestión autorizada |
| `GET /delegaciones`, `POST /delegaciones` | Alta `{ id, delegadoId, desde, hasta }`; no redelegar | ADM/COORD-propia |
| `POST /delegaciones/{id}/revocar` | Revocación auditada | ADM/COORD-propia |
| `GET /consentimientos/texto-vigente` | Texto/version/hash/cláusula constancia | COORD/FAM |
| `POST /consentimientos` | `{ id, catequizandoId, apoderadoId, textoId, canal }`; inscripción lo registra en su transacción | COORD presencial; FAM vinculada por enlace |
| `POST /consentimientos/{id}/retirar` | Retiro y participantes atómicos; borra datos personales, conserva asistencia anonimizada/constancia | COORD/FAM vinculada |
| `GET /auditoria?catequizandoId&desde&hasta` | Eventos con identidad operativa, sin valores restringidos | ADM |
| `POST /avisos`, `POST /avisos/{id}/retirar` | Publicar `{ id, grupoId, texto }`; lectura vía sync `avisos_grupo` | COORD |
| `GET /avisos-coordinacion`, `POST /avisos-coordinacion/{id}/leido` | Rechazos pendientes y estado de lectura | COORD |

Enlaces: `https://<web>/acceso/<equipo|familia>#t=<token>`, solo hash persistido servidor; UI limpia fragmento sin registrarlo. Familia no vence por tiempo; cierre/revocación siguen vigencia de vínculos. JWT equipo 15 min/familia 30 min. Ventana reconexión 60 días aceptada por plan; no permite nuevos registros offline después de 14 días.

## Perfil e inscripción 002

| Método/ruta | Contrato esencial | Acceso |
| --- | --- | --- |
| `POST /inscripciones` | `{ id, nino, apoderados, grupoId, asignacionId, consentimiento?, documentos, edadFueraRangoConfirmada, referenciaDuplicado? }`; DTO exacto abajo | COORD/delegado |
| `POST /inscripciones/duplicados/confirmar` | `{ referencia, esElMismo }`; perfil solo tras confirmar; referencia opaca y temporal, ajena/vencida no revela datos | COORD |
| `PUT /inscripciones/{id}/grupo` | `{ id, grupoId, cambioId, motivo? }` → `{ asignacionId, fueraDeSugerencia? }`; `id` es asignación nueva, sin `desde` cliente | COORD |
| `POST /inscripciones/{id}/anular` | `{ cambioId, motivo }` → `{ inscripcionId, estado: 'anulada' }` | COORD |
| `GET /catequizandos/{id}/perfil` | Nombre/edad/grupo/documentos/apoderados según rol, resúmenes de proveedores disponibles | COORD/CAT(g)/FAM(n); no SUP |
| `PATCH /catequizandos/{id}`, `GET /catequizandos/{id}/cambios` | PATCH `{ datos, cambios: [{ id, campo }], motivo? }` → `{ catequizandoId, avisoGrupoSugerido }`; GET `{ cambios }` | COORD |
| `GET /inscripciones/{id}/documentos` | Estados de cinco documentos, fecha/recibidoPor operativo; ninguna URL/archivo | COORD/CAT(g)/FAM(n) |
| `PUT /inscripciones/{id}/documentos/{tipo}` | `{ cambioId, estado, fechaEstado, motivo? }` → `{ documentoId }`; inválido exige motivo | COORD |
| `GET /ciclos/{cicloId}/documentos-pendientes` | Pendientes e inválidos; filtros por grupo | COORD |
| `GET`, `PUT /catequizandos/{id}/condiciones` | PUT `{ condiciones: [{ id, categoria, nota? }] }` → `{ catequizandoId }`; GET `{ condiciones: [{ id, categoria, nota }] }` | Lectura COORD/CAT(g) |
| `GET /apoderados?q=` | Búsqueda nombre/contacto, contador atómico por cuenta | COORD |
| `POST /catequizandos/{id}/apoderados`, `DELETE /catequizandos/{id}/apoderados/{apoderadoId}` | POST `{ vinculo, cambioId }` → `{ apoderadoId, creado, url? }`; DELETE también lleva cuerpo `{ cambioId, motivo? }` → `{ desvinculado, enlaceRevocado }` | COORD |
| `GET /ciclos/{cicloId}/grupos` | COORD todos/conteos; CAT sus grupos | Según rol |
| `POST /grupos`, `PATCH /grupos/{id}`, `POST /grupos/{id}/cerrar`, `PUT /grupos/{id}/catequistas` | Grupos y vigencias; cerrar con niños activos → 409 | COORD |
| `POST /grupos/sugerencias` | `{ fechaNacimiento, sexo }` → grupos, totales y conteos agregados por categoría | COORD |
| `GET /catequizandos/{id}/carne`, `GET /grupos/{id}/carnes`, `POST /catequizandos/{id}/carne/reemitir` | Código QR, nombre/grupo; reemitir invalida emisión anterior | COORD |

Alta sin consentimiento → 422 `sin_consentimiento`; edad fuera de 8–13 al inicio del ciclo sin confirmación → 422 `edad_fuera_de_rango_sin_confirmar`; posible duplicado → 409 `posible_duplicado` con referencia sin nombres/fecha/id del perfil. No guardar DNI. Boleta exonerada: `no_aplica`/`exonerado`. FAM ve sus documentos, no condiciones ni historial personal.

### DTO de inscripción y familias (código actual)

- `nino`: `{ id, nombres, apellidos, fechaNacimiento, sexo, bautizado }`.
- `apoderados`: 1–10 vínculos, cada uno `{ id, relacion, detalleRelacion?, apoderadoId }` **o** `{ id, relacion, detalleRelacion?, apoderado: { id, nombres, apellidos, tipoContacto, valorContacto, cuentaId, credencialId } }`. Variantes estrictas/excluyentes; contactos nuevos no usan `telefono`/`correo` como campos independientes.
- `documentos`: exactamente cinco `{ id, tipo }` con UUID/tipos distintos: documento_identidad, partida_nacimiento, partida_bautismo, boleta_pago, ficha_compromiso. No archivos, URL ni bytes.
- `consentimiento`: `{ id, apoderadoId, textoId, canal: 'presencial' }`, opcional en validación sintáctica, **obligatorio para éxito**; apoderado vinculado/texto vigente.
- Respuesta 201/200: `{ inscripcionId, catequizandoId, codigoCarne, enlaces: [{ apoderadoId, url }] }`. Reintento devuelve `enlaces: []`; guardar UUIDs de operación, nunca persistir borrador personal.
- Confirmar duplicado false → `{ referencia, duplicadoDescartado: true }`; true → `{ referencia, catequizandoId, perfil }`. Para continuar, enviar `referenciaDuplicado` y UUID del perfil confirmado, no `duplicadoDescartado` en inscripción.
- Reemitir carné exige `{ emisionEsperada }` (0–2147483646), devuelve `Carne`; no body vacío. Crear grupo exige `{ id, cicloId, nombre, edadMinima, edadMaxima, modalidad }`; asignar catequistas `{ asignaciones: [{ id, cuentaId }] }` (hasta 20, ids/cuentas distintos).
- Buscar apoderados exige `q` de 2–100 caracteres, hasta 30 resultados. `LIMITE_BUSQUEDAS_APODERADOS` predeterminado 10/min/cuenta, rango configurado 1–60; configuración inválida 503.

**QR único:** `SGC1:<uuid>:<emision>`. `emision` entero válido de `carne_emision`; local `codigo_carne` contiene la cadena completa. UUID solo/prefijos alternativos/códigos mal formados no se aceptan. Reemisión invalida anterior, también para validación posterior de pendientes offline.

## Asistencia y sincronización 003

| Método/ruta | Resultado/acceso |
| --- | --- |
| `GET /sincronizacion/cambios?ultimoPulso&versionEsquema&huellaAlcance&migracion` | CAT/COORD; claves nativas, filas snake_case, cabecera epoch-ms `x-hora-servidor`, gzip si aceptado |
| `POST /sincronizacion/cambios` | CAT/COORD; `{ changes }` actividad → sesión → lista → marca → corrección; `{ aceptados, rechazados, descartadosCierre }`; handler no consume query `ultimoPulso` |
| `GET /asistencia/carnes/{codigo}/validacion` | CAT; solo `{ estado }` (`valido`, `invalido`, `inactivo`), sin nombre/grupo; codificar parámetro de ruta |
| `GET /asistencia/misas/{fecha}/reporte` | COORD/SUP; presentes, horas dispositivo/servidor, registradores operativos, tipo y totales/manuales |
| `GET /asistencia/avisos?estado`, `POST /asistencia/avisos/{id}/atencion` | COORD; códigos inválidos/rechazos/conflictos/revisión cruzada |
| `GET /asistencia/catequizandos/{id}/domingos` | COORD/SUP/CAT(g)/FAM(n); familia sin horas ni registradores |
| `POST /asistencia/actividades/sesiones` | `{ actividadId }` → 201 `{ sesionId }`; crea sesión determinista de actividad existente |

### Transporte WatermelonDB nativo

En `listas_asistencia`, `marcas_asistencia` y `correcciones_asistencia`, raw envía también `estado`, `motivo_rechazo`, `recibido_en`. OpenAPI los admite opcionales/writeOnly/ignorados **solo en ListaPush/MarcaPush/CorreccionPush**; strings y epoch-ms convencionales, incluyendo estado vacío/recibido cero del cliente. Runtime ignora cualquier valor JSON de esos tres campos antes de Zod/huella y calcula sus propios valores; `estado: 'aceptada'` enviado no aprueba un código inválido. Outputs mantienen feedback normal de servidor, sin writeOnly ni ignorado. Autoría/valor/sesión/carné siguen validados; cualquier otra columna ajena se rechaza. No hay excepción de feedback para actividades/sesiones/envoltorio/deleted.

El push **debe ignorar** `_status` y `_changed` en cada fila de created/updated antes de validar y calcular la huella, conforme al [punto8 oficial WatermelonDB](https://watermelondb.dev/docs/Sync/Backend). OpenAPI los admite opcionales/writeOnly solo en `SesionPush`, `ListaPush`, `MarcaPush`, `CorreccionPush` y `ActividadPush`, como strings convencionales. Runtime los descarta cualquiera sea su valor JSON; nunca los persiste ni devuelve, ni alteran autoría/rechazo/idempotencia. Los restantes desconocidos siguen 422; la excepción no se aplica al envoltorio, deleted, SQL o salidas canónicas. El frontend no debe eliminarlos obligatoriamente. OpenAPI incluye envío nativo y reenvío del mismo UUID/datos con metadata distinta.

Pull HTTP `{ changes, timestamp, experimentalStrategy?, huellaAlcance }`; conjuntos `{ created, updated, deleted }`. Push `{ changes }` admite cinco colecciones: actividades_obligatorias, sesiones, listas_asistencia, marcas_asistencia, correcciones_asistencia. **Claves nativas; ninguna traducción obligatoria.** Adaptadores internos opcionales. Filas snake_case/epoch-ms/civiles según campo. Deleted vacío; updated solo sesiones/actividades. No admite ciclo/nómina/consolidado como escritura ni confía en feedback recibido: esos tres campos se ignoran solo donde se especificó. Estado vigente/cancelada de actividad es dato de negocio **validado**, no feedback. Enum de valor_anterior se mantiene según el Zod actual de corrección; el verificador detecta deriva si el backend amplía sin_registro.

Query pull: `ultimoPulso` epoch-ms no futuro (omitido o texto `null` al iniciar), `versionEsquema=1` única soportada, `huellaAlcance` de última respuesta, `migracion` JSON serializado `{ tablas: string[], columnas?: [{ tabla, columnas: string[] }] }` máximo 8192 caracteres. El cliente pasa envoltorio nativo a su motor y conserva la huella. GET/POST comparten 30/min/cuenta; cuerpo POST ≤524288 bytes. Esquema y ejemplos estrictos en OpenAPI.

Corrección calculada: `CorreccionPush` y `CorreccionPull` admiten `valor_anterior` presente/ausente/sin_registro, alineados con Zod y CHECK aditivo0310 (documentado antes de código). `valor_nuevo` sigue solo presente/ausente. El servidor contrasta estado calculado en fecha/grupo/hora; no exige marca materializada para ausencia o sin_registro. Sin marca propia no habilita corrección de catequista antes de fin del domingo; después COORD con motivo. Consolidado solo con correcciones usa tipo manual y autores/horas de corrección, sin fabricar escaneo histórico. Feedback de salida sigue normal, nunca ignorado/writeOnly; metadata local siempre excluida.

Query del futuro adaptador JSI: `lastPulledAt` → `ultimoPulso`, `schemaVersion` → `versionEsquema`, `migration.tables` → `migracion.tablas` y `migration.columns[{table,columns}]` → `migracion.columnas[{tabla,columnas}]`; serializar objeto a JSON. `migration.from` no se envía: el backend valida tablas/columnas contra registro y no admite `from` en su objeto estricto. Esta adaptación de **query negociada** no traduce cuerpo/respuesta `changes`/`timestamp` ni acredita cliente JSI implementado.

| Colección local/transporte | Tabla física | Sentido/alcance |
| --- | --- | --- |
| `catequizandos` | Proyección `catequizando`/`inscripcion`/`asignacion_grupo`/`carne_emision` | Pull nómina global mínima: `id`, `nombres`, `apellidos`, `grupo_id`, `codigo_carne`, `activo` |
| `grupos` | `grupo` | Pull global: `id`, `nombre`, `ciclo_id`, `estado`, `es_mio` |
| `parametros_asistencia` | `parametros_asistencia_ciclo` | Pull ciclo abierto |
| `sesiones` | `sesion` | Pull global; push solo COORD |
| `listas_asistencia` | `lista_asistencia` | Push; pull propias CAT/todas COORD |
| `marcas_asistencia` | `marca_asistencia` | Creaciones push; pull propias CAT/todas COORD, estado/motivo del servidor |
| `correcciones_asistencia` | `correccion_asistencia` | Creaciones push; pull según grupo/COORD |
| `asistencias` | `asistencia` | Solo pull, grupos propios CAT/todas COORD |
| `avisos_grupo` | `aviso_grupo` | Solo pull por grupos asignados, `autor_visible` operativo |
| `ciclos` | `ciclo` | Solo pull ciclo abierto: `id`, `nombre`, `fecha_inicio`, `fecha_fin`, `estado` |
| `actividades_obligatorias` | `actividad_obligatoria` | Pull del ciclo, push COORD create/update; `id`, `ciclo_id`, `nombre`, `tipo`, `fecha`, `estado`, `creado_por`, `cuenta_id`, `credencial_id`, `dispositivo_id` |

En actividad, `estado` es **vigente/cancelada**, no programada. Metadatos `huella_creacion`, `actualizado_en`, `eliminado_en` y filas de `cambio_actividad` (0506) permanecen en servidor, fuera del DTO sync. Autoría requerida en push; puede ser null en pull de filas anteriores a 0506. El UUID de sesión se calcula por actividad/fecha, no es una columna editable del catálogo.

`borradores_lista` solo local, jamás push. Cada pendiente identifica cuenta/credencial de autor (`cuenta_id`, `credencial_id`) además de los campos de registro de su colección. No confiar en autor/ciclo/horas/estado enviados sin validarlos. Consolidado/recibido_en/estado servidor no son mutaciones arbitrarias del cliente. No sincronizar perfiles completos, apoderados, estados documentales, condiciones, identidad real ni evidencias.

Pull incremental: `actualizado_en > ultimoPulso − 60 s`, sello servidor, reemplazo cuando cambia huella/primer pull, tablas nuevas completas con migración. Lápidas se entregan como ids eliminados. Push UUID idempotente, rechazos de negocio persistidos con aviso, autor ajeno no aceptado, todo descartado después de cierre sin guardar contenido. Cuenta revocada → 401, no aplicar filas. Esquema desconocido/mal formado se rechaza, no se convierte en escritura administrativa.

Límites: sync 30/min/cuenta, validación carné 120/min/cuenta, consultas asistencia 30/min según operación, push ≤512 KB; búsquedas de apoderados con límite específico parametrizado más estricto. Functions usa contador PostgreSQL atómico, APIM global. No repartir presupuesto de cuenta entre instancias.

## Semántica e integración por puertos

### Contratos transversales adicionales del principal

Handlers/DTO transversales ya disponibles en `api/src/modulos/ciclos/` y `actividades/`; OpenAPI incorpora sus operaciones, sin declarar 005/008 completos. La apertura genera sesiones/parámetros idempotentes; catálogo de actividad comparte procesador transaccional con sync.

| Método/ruta | DTO y resultado actual | Alcance |
| --- | --- | --- |
| `GET /ciclos` | `{ ciclos: [{ id, nombre, fechaInicio, fechaFin, estado, abiertoEn, cerradoEn, depuradoEn }] }`; sin filtros | ADM/COORD/SUP |
| `GET /ciclos/abierto` | `{ ciclo: Ciclo \| null }` | Cuenta autenticada |
| `POST /ciclos` | `{ id, nombre, fechaInicio, fechaFin }` → 201/200 `{ ciclo }`; fechas/rango inválidos en dominio 400, sintaxis 422, otro abierto/UUID reutilizado 409 | Solo ADM |
| `POST /ciclos/{id}/cerrar`, `/cierre` | **Sin query y sin cuerpo JSON (ni `{}`)** → `{ cerradoEn, efectos: { delegacionesTerminadas, enlacesRevocados } }`; ambos alias idénticos/idempotentes | Solo ADM |
| `GET /actividades` | `{ actividades: [{ id, cicloId, nombre, tipo, fecha, estado }] }`, ciclo abierto; sin filtros | CAT/COORD |
| `POST /actividades` | `{ id, cicloId, nombre, tipo, fecha, estado? }` (default vigente) → 201/200 `{ actividad }`; comparte reglas de push y sesión equipo/dispositivo | COORD |
| `PATCH /actividades/{id}` | Al menos un campo `{ nombre?, tipo?, fecha?, estado? }` → 200 `{ actividad }`; fecha/tipo con asistencia aceptada 409; no edita ciclo/UUID/creador | COORD |
| `GET /actividades/{id}/cumplimiento` | Arreglo `[{ catequizandoId, sesionId, estado, registradores }]`; estados cumplida/no_cumplida/justificada/pendiente/cancelada/no_aplica | COORD todo; CAT grupos propios |

`ciclos:http` y `actividades:http` tienen cada uno contador compartido 30/min/cuenta entre sus operaciones, además del global APIM. 404 para ciclo/actividad no disponible según ruta. Rechazo de actividad conserva aviso durable y retorna 409 `actividad_rechazada`/`ciclo_no_abierto`; cancelación/reprogramación guarda traza 0506 y cancela sesión anterior. Los puertos reales y su registro de arranque se verifican en la integración, no por existencia de OpenAPI.

### Retención y lápidas de sincronización

RF-106/RF-108 y RF-307: antes de anonimizar autoría o cambiar IDs se captura la audiencia y **el UUID original** en `lapida_sincronizacion` (`0309_lapidas_sincronizacion.sql`), en la misma transacción con rol/contexto de retención. Ledger exclusivamente de metadatos: `tabla` (colección), `fila_id`, `cuenta_id` destinatario nullable, `ciclo_id`, `eliminado_en`. No nombres, QR, motivos, salud, evidencia ni cuerpos. NULL destinatario representa coordinación; autor/catequistas autorizados reciben sus propios IDs eliminados. Pull incorpora `deleted`, quita esos IDs de created/updated y mantiene ventana de 60 días; puerto de purga bajo rol/contexto. No existe endpoint ni colección local del ledger. Timer de purga pertenece al planificador del principal, no a paths de OpenAPI. Esta traza de borrado no acredita despliegue ni reemplaza pruebas de retiro/vencimiento.

- Escaneo/catequesis de cualquier grupo exige rol CAT; manual solo grupos propios; COORD registra si también CAT. Nombre al escanear solo grupos propios, aunque nómina sea global.
- Lista abre presentes pero no cuenta hasta confirmar; cada toque persiste borrador. Antes del fin del domingo corrige autor, después COORD con motivo. Hora efectiva dispositivo + desfase; guardar también recibido servidor.
- Presente gana entre marcas, ambos autores conservados; última corrección aceptada por recibido/id manda. Niño activo/grupo en **fecha de sesión** viene de `FuenteInscripciones`, no del grupo actual.
- Falta de domingo solo si misa y catequesis ausentes; pendiente/sin registro/no aplica no suma. Jornada no justificada cuenta aparte. Cancelada no produce ausencia.
- `resumenAsistencia` registra proveedor del perfil 002 con alcance. 004 aporta justificaciones aprobadas/`alCambiarAsistencia`; 005 catálogo/`actividadSumaFalta`/cumplimiento; 006/007 consumen consultas/eventos; 008 aporta ciclo/guardia/cierre. Tests con falsos acreditan contrato, no módulos externos completos.
- `0002_ciclo_base.sql` + `0801` y `0505` (`actividad_obligatoria` mínima) son soporte transversal; no equivalen a avance 005 ni historial 008 completos.
- Retención usa participantes: borrar condiciones/documentos-estados/historial/apoderado sin otros hijos, perfil anonimizado fuera de operación y asistencia anonimizada. No mostrar nombre/código antiguo en reportes después del retiro; constancia preservada por 008.

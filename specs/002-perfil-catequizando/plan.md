# Plan 002 — Perfil e inscripción del catequizando

> CÓMO implementar la [spec 002](spec.md). Si este plan y la spec divergen, manda la spec (principio 2).
> Notación de alcance usada en todo el plan:
> - **COORD**: coordinación o catequista con delegación vigente (plan 001, RF-104).
> - **CAT(g)**: catequista con el grupo `g` a cargo.
> - **FAM(n)**: apoderado con vínculo vigente con el niño `n`.
> - **SUP**: supervisión.

## 1. Resumen y alcance

**Acuerdo 2026-10-11:** backend de fases 1–4 completo; D-201–D-214 y C-01–C-13 aceptados, con excepción administrativa ONLINE registrada en constitución/ADR 013. Los supuestos históricos son decisiones cerradas; UI, campo, impresión y despliegue requieren evidencia. Véanse [contratos](../../docs/backend-contratos.md) y [seguimiento](../../docs/backend-implementacion.md).

| Cubre | Qué |
| --- | --- |
| RF-201 | Perfil único que se mantiene entre ciclos, vista consolidada y aviso de posible duplicado sin exponer el perfil existente |
| RF-202 | Inscripción solo en línea y solo para COORD, con datos obligatorios, consentimiento y advertencia de edad |
| RF-203 | Corrección con historial (valor anterior, quién y cuándo), aviso de cambio de grupo sugerido y anulación sin borrar registros |
| RF-204 | Estado de los cinco documentos por niño y ciclo, sin imágenes, y lista de pendientes o inválidos |
| RF-205 | Condiciones de una lista cerrada con nota corta, visibles solo para COORD y CAT(g) |
| RF-206 | Grupos por ciclo, sugerencia por edad y sexo con conteos, asignación libre, historial de cambios de grupo y aviso de grupo sin catequista |
| RF-207 | Vínculo niño–apoderado N:M con relación; al desvincular se revoca el enlace (lo hace 001) |
| RNF-201 a RNF-204 | Mínima digitación, mobile-first, datos restringidos solo en línea y perfil liviano sin conexión |
| Pieza transversal asignada a 002 | Carné con código QR: contenido, emisión, reimpresión y hoja imprimible. Es el requisito de origen RF-302 (primer punto) de la spec 003; la lectura del QR y la validación al escanear son de 003 |

**Fuera de este plan:**
- Lo que la spec 002 deja fuera de alcance: copias de documentos, inscripción sin conexión, OCR y cobros.
- Cuenta y enlace del apoderado, consentimiento, auditoría y motor de retención: definidos en plan 001.
- Protocolo de sincronización y esquema WatermelonDB: definidos en plan 003. Aquí solo se aportan las columnas de 002.
- Escaneo del carné: plan 003.
- Tabla `ciclo` y reinscripción entre ciclos (RF-807): definidas en plan 008.
- Resúmenes de asistencia, justificaciones y avance: los aportan los planes 003, 004 y 005 mediante un puerto (D-212).

## 2. Verificación contra la constitución

| # | Principio | Cómo se cumple |
| --- | --- | --- |
| 1 | Stack mínimo | Se usa el stack fijo (Expo SDK 57, Functions v4, PostgreSQL). Hay **tres dependencias nuevas** para el carné: `react-native-svg`, `expo-print` y `qrcode-generator`. Ver D-210. Antes de implementar hay que justificarlas en la spec (tarea T-0 de la fase 1). |
| 2 | La spec manda | La matriz de la §10 cubre cada RF y RNF, y cada test cita su identificador. La divergencia con el C4 está anotada en §11: la relación `cmpInscripciones -> servicioStorage` contradice RF-204. |
| 3 | Lógica sin interfaz | Todas las reglas viven en `src/lib/catequizandos/` como TypeScript puro. La API las importa y esbuild las empaqueta. Las pantallas solo llaman a esas funciones. |
| 4 | Tests en verde | Se siguen la estrategia de §9 y el runner de Jest del plan 001. Ninguna fase se cierra con tests en rojo. |
| 5 | Offline primero | Excepción administrativa ONLINE aprobada: inscripción, edición, grupos, apoderados, documentos, condiciones y consentimiento no se persisten/encolan localmente. Borradores solo en memoria; nómina/grupos/carné operativos se leen desde sync. |
| 6 | Persistencia segura | El cliente genera el UUID de catequizando, inscripción, apoderado, vínculo, grupo, condición y documento, y las escrituras son idempotentes por UUID. Las migraciones M-201 a M-207 son versionadas y nunca se editan. |
| 7 | Datos de menores | Las condiciones nunca entran al almacén local ni a los registros de log, y se responden con `Cache-Control: no-store`. No se guarda el número de DNI (D-201). Toda Function verifica rol y alcance. La autoría se muestra con `identidadOperativa` (001, RF-105). |
| 8 | Idioma | Tablas, columnas, módulos y archivos van en español sin tildes ni `ñ` (`carne_emision`, `ninos`). Los textos de interfaz van con tildes. |
| 9 | Autoría trazable | Cada tarea de `tasks.md` se hace en un commit con su registro Agent Trace. |
| 10 | Contexto curado | El plan no añade requisitos. Las dudas se marcan en §11 con su supuesto provisional. |
| 11 | Skills como paquete | Las migraciones y la verificación usan las skills del repositorio cuando estén publicadas. Ver plan 001. |

## 3. Modelo de datos

### 3.1 PostgreSQL

Migraciones `02NN` según plan 001: M-201–M-207 = `0201`–`0207`; vista de nómina en `0204`, después de carné. `0002_ciclo_base.sql` precede las tablas operativas y `0801` aporta su complemento. Tablas singulares snake_case. UUID cliente en entidades nacidas desde app; solo proyecciones sincronizadas exigen columnas sync. Los periodos `inscripcion.desde/hasta` y `asignacion_grupo.desde/hasta` permiten consultas históricas; alta/anulación/cambio actualizan sus vigencias en la misma transacción.

| Migración | Tabla | Columnas clave y restricciones | RF | Fase |
| --- | --- | --- | --- | --- |
| M-201 `crear_catequizando_y_apoderado` | `catequizando` | `nombres`, `apellidos`, `fecha_nacimiento date`, `sexo CHECK IN ('femenino','masculino')`, `bautizado bool`, `clave_duplicado text NULL` con índice (vale NULL si está anonimizado), `estado CHECK IN ('vigente','inactivo','anonimizado')`, `creado_por → cuenta(001)`, `creado_en`. **Sin** columna de DNI. | RF-201, RF-202 | 1 |
| | `apoderado` | `nombres`, `apellidos`, `tipo_contacto CHECK IN ('telefono','otro')`, `valor_contacto NOT NULL`, `cuenta_id NULL → cuenta(001)` (cuenta y enlace definidos en plan 001) | RF-202, RF-207 | 1 |
| | `vinculo_apoderado` | `catequizando_id`, `apoderado_id`, `relacion CHECK IN ('madre','padre','otro_familiar','tutor')`, `detalle_relacion text NULL` (por ejemplo, "abuela"), `vigente_desde`, `vigente_hasta NULL`, `desvinculado_por NULL`. Índice único parcial `(catequizando_id, apoderado_id) WHERE vigente_hasta IS NULL` | RF-207 | 1 |
| M-202 `crear_grupos` | `grupo` | `ciclo_id → ciclo(008)`, `nombre`, `edad_minima`, `edad_maxima`, `CHECK (edad_minima <= edad_maxima)`, `modalidad CHECK IN ('mixto','femenino','masculino')`, `estado CHECK IN ('abierto','cerrado')`, `cerrado_en`. Índice único parcial `(ciclo_id, lower(nombre)) WHERE estado='abierto'` | RF-206 | 1 |
| | `grupo_catequista` | `grupo_id`, `cuenta_id → cuenta(001)`, `desde`, `hasta NULL` | RF-206 | 1 |
| M-203 `crear_inscripcion_y_asignacion` | `inscripcion` | `catequizando_id`, `ciclo_id → ciclo(008)`, `estado CHECK IN ('vigente','anulada')`, `consentimiento_id NOT NULL → consentimiento(001)`, `edad_al_inicio smallint`, `edad_fuera_rango_confirmada bool`, `duplicado_descartado bool`, `anulada_en`, `anulada_por`, `motivo_anulacion`. Índice único parcial `(catequizando_id, ciclo_id) WHERE estado='vigente'`, para que un niño anulado por error pueda volver a inscribirse | RF-202, RF-203 | 1 |
| | `asignacion_grupo` | `inscripcion_id`, `grupo_id`, `desde`, `hasta NULL`, `asignado_por`, `fuera_de_sugerencia bool`, `motivo NULL`. Índice único parcial `(inscripcion_id) WHERE hasta IS NULL` | RF-206, RF-203 | 1 |
| M-204 (después de `carne_emision`) | vista `v_nomina_ciclo` | `catequizando_id`, `nombres`, `apellidos`, `grupo_id`, `emision` y `actualizado_en`; proveedor deriva `codigo_carne` de los niños activos | RF-201 (nómina, RNF-306 de 003) | 1 |
| M-204 `crear_carne_emision` | `carne_emision` | `catequizando_id`, `emision int`, `emitida_en`, `emitida_por`, `invalidada_en NULL`. Único `(catequizando_id, emision)` e índice único parcial de una emisión vigente por niño | RF-302 (003) | 1 |
| M-205 `crear_cambio_inscripcion` | `cambio_inscripcion` | `catequizando_id`, `entidad CHECK IN ('catequizando','apoderado','vinculo_apoderado','inscripcion','documento_inscripcion','asignacion_grupo')`, `entidad_id`, `campo`, `valor_anterior jsonb`, `valor_nuevo jsonb`, `cambiado_por`, `cambiado_en`, `motivo NULL`. Solo admite inserciones: se revoca `UPDATE` y `DELETE` al rol de la app, y solo el rol de retención del plan 001 puede anonimizar | RF-203 | 2 |
| M-206 `crear_documento_inscripcion` | `documento_inscripcion` | `inscripcion_id`, `tipo CHECK IN ('documento_identidad','partida_nacimiento','partida_bautismo','boleta_pago','ficha_compromiso')`, `estado CHECK IN ('pendiente','entregado','invalido','no_aplica')`, `motivo NULL` (obligatorio si es `invalido`), `fecha_estado date`, `recibido_por NULL`. Único `(inscripcion_id, tipo)`. **Ninguna columna de archivo, URL ni `bytea`** | RF-204 | 2 |
| M-207 `crear_condicion_catequizando` | `condicion_catequizando` | `catequizando_id`, `categoria CHECK IN ('trastorno_espectro_autista','deficit_atencion_hiperactividad','discapacidad_fisica','discapacidad_intelectual','alergia','condicion_medica','otra')`, `nota varchar(200) NULL`, `registrado_por`, `registrado_en`. Único `(catequizando_id, categoria)` | RF-205 | 3 |

**Reglas que cruzan tablas:**
- Un niño está "activo en el ciclo" cuando cumple tres condiciones: tiene una `inscripcion` vigente en el ciclo abierto, una `asignacion_grupo` con `hasta IS NULL` y `catequizando.estado='vigente'`.
- Anular una inscripción (RF-203) hace tres cosas: marca `inscripcion.estado='anulada'`, cierra la asignación vigente e invalida el carné. No borra ninguna fila, y los registros de asistencia y avance siguen apuntando al `catequizando_id`.
- Todo cambio en `inscripcion`, `asignacion_grupo` o `carne_emision` actualiza `catequizando.actualizado_en`. Así el pull incremental del plan 003 ve el cambio en la nómina.

### 3.2 Almacén local (WatermelonDB)

El esquema y la versión los define el plan 003. 002 aporta estas tablas, que en el dispositivo son **de solo lectura**:

| Tabla local | Columnas | Quién la recibe | RF |
| --- | --- | --- | --- |
| `catequizandos` | `id`, `nombres`, `apellidos`, `grupo_id`, `codigo_carne`, `activo`; `codigo_carne` se deriva de `carne_emision.emision` | Todo catequista y COORD: nómina mínima completa | RF-201, RNF-204 (RNF-306 de 003) |
| `grupos` | `id`, `nombre`, `ciclo_id`, `estado`, `es_mio` calculado por cuenta | Todo catequista y COORD | RF-206, RNF-204 |

**No bajan al dispositivo:** fecha de nacimiento, sexo, apoderados, documentos, condiciones ni historial (D-205). El push del plan 003 rechaza cualquier cambio local en estas tablas.

## 4. Lógica de dominio en `src/lib/catequizandos/`

Todo el código es TypeScript puro, sin React, React Native ni Expo. Las firmas son ilustrativas.

| Archivo | Funciones o tipos | RF |
| --- | --- | --- |
| `modelo.ts` | `Catequizando`, `Apoderado`, `VinculoApoderado`, `Inscripcion`, `AsignacionGrupo`, `Grupo`, `DocumentoInscripcion`, `CondicionCatequizando`, `CarneEmision`. **Reemplaza** a `Catequizando`, `Grupo` y `DatosRestringidos` de `src/lib/domain/modelo.ts`: el grupo deja de ser un campo del niño y pasa a ser una asignación con vigencia, y el texto libre de salud se sustituye por la lista cerrada. `modelo.ts` los reexporta mientras dura la transición | RF-201, RF-205, RF-206 |
| `edad.ts` | `edadEnFecha(nacimiento, fecha): number`, `edadAlInicioDelCiclo(nacimiento, inicioCiclo)`, `estaEnRangoCatequesis(edad): boolean` (8 a 13 años) | RF-202 |
| `inscripcion.ts` | `CAMPOS_OBLIGATORIOS`, `validarInscripcion(datos, contexto): { bloqueos: Bloqueo[]; advertencias: Advertencia[] }`. Bloquea si falta un dato obligatorio, si no hay apoderado con contacto o si falta el consentimiento. Advierte si la edad está fuera del rango y no fue confirmada | RF-202 |
| `duplicados.ts` | `normalizarTexto(s)` (minúsculas, sin tildes y con los espacios compactados), `claveDuplicado(nombres, apellidos, fechaNacimiento): string` | RF-201 |
| `correcciones.ts` | `diferenciasCorregibles(anterior, nuevo): CambioCampo[]`, `cambiaGrupoSugerido(grupos, anterior, nuevo, grupoActualId): boolean` | RF-203 |
| `documentos.ts` | `TIPOS_DOCUMENTO`, `estadosIniciales(bautizado)` (la partida de bautismo arranca en `no_aplica` si el niño no está bautizado), `aplicarCambioDocumento(actual, accion): Resultado` con las transiciones permitidas: `pendiente→entregado`, `entregado→invalido` (exige motivo), `invalido→entregado`, `no_aplica→pendiente` (bautismo durante el ciclo) y `pendiente→no_aplica` (exige motivo; incluye `exonerado`, ver C-03). También `cuentaComoPendiente(estado)`, que es verdadero para `pendiente` e `invalido` | RF-204 |
| `condiciones.ts` | `CATEGORIAS_CONDICION` (fuente única de la lista cerrada), `LARGO_MAXIMO_NOTA = 200`, `validarCondiciones(lista)` (categorías válidas y sin repetir, nota dentro del largo) | RF-205 |
| `grupos.ts` | `modalidadHabitual(edad, sexo)` (8, 9 y 10 años mixtos; 11 a 13 por sexo), `sugerirGrupos(edad, sexo, grupos): Grupo[]` (grupos abiertos cuyo rango incluye la edad y cuya modalidad corresponde), `gruposSinCatequista(grupos, asignaciones)`, `puedeCerrarGrupo(cantidadActivos)` (ver C-11) | RF-206 |
| `apoderados.ts` | `RELACIONES`, `validarVinculo`, `efectoDesvinculacion(vinculosVigentesRestantes): 'quitar_alcance_nino' \| 'revocar_enlace'` (ver C-06) | RF-207 |
| `carne.ts` | `codificarCarne(catequizandoId, emision): string` produce `SGC1:<uuid>:<emision>`. `interpretarCodigoCarne(texto): { catequizandoId; emision } \| { invalido: true }`. `matrizQr(texto): boolean[][]` envuelve `qrcode-generator`. `svgDeMatriz(matriz): string` se usa en la hoja imprimible | RF-302 (003) |
| `autorizacion.ts` | `puedeGestionarInscripciones(sesion)`, `camposDePerfilVisibles(sesion, nino): CampoPerfil[]`, `puedeVerCondiciones(sesion, grupoId)`. Se componen sobre `SesionUsuario`, la delegación y la unión de roles del plan 001, que evoluciona `src/lib/domain/roles.ts` | RF-202, RF-205, RF-201 |
| `contratos.ts` | Tipos de petición y respuesta compartidos entre la app y la API | todos |

## 5. API

Los proveedores de resumen reciben la misma `Tx` que la consulta del perfil, además del contexto de acceso. No abren una transacción/pool anidado: con un pool de tres conexiones, tres perfiles simultáneos deben completar sin esperar conexiones que ellos mismos retienen. El alcance operativo se resuelve exclusivamente contra la inscripción y asignación vigentes del ciclo abierto; una asignación histórica no autoriza condiciones actuales.

Los módulos son `api/src/modulos/inscripciones/` y `api/src/modulos/catequizandos/` (D-213). Toda Function usa los siguientes elementos del plan 001:
- el middleware de autenticación (JWT de corta duración);
- la resolución de alcance, que se apoya en `gruposACargo` y `alcanceFamilia`, ambos expuestos por 002;
- el registro de auditoría.

Toda Function rechaza con 403 lo que esté fuera de su alcance, sin revelar si el recurso existe.

### 5.1 Endpoints

| Método y ruta | Módulo | Alcance | Comportamiento | RF | Fase |
| --- | --- | --- | --- | --- | --- |
| `POST /inscripciones` | inscripciones | COORD | Recibe el niño, los apoderados (nuevos o `apoderadoId` existente), el consentimiento, el `grupoId` y las confirmaciones. En una sola transacción registra el consentimiento (servicio de 001), crea el perfil, los vínculos, la inscripción, la asignación, la primera emisión del carné y los documentos iniciales (estos desde la fase 2). Respuestas: 201; 200 si se reintenta con el mismo UUID; 409 `posible_duplicado` con una `referencia` opaca sin datos; 422 `sin_consentimiento`; 422 `edad_fuera_de_rango_sin_confirmar` | RF-201, RF-202, RF-206, RF-207 | 1 |
| `POST /inscripciones/duplicados/confirmar` | inscripciones | COORD | Recibe `{ referencia, esElMismo }`. Si la coordinación confirma que es el mismo niño, recién entonces devuelve el resumen del perfil existente y el `catequizandoId`, para reinscribir reutilizando el perfil. Si no, la inscripción continúa con `duplicado_descartado=true` | RF-201 | 1 |
| `PUT /inscripciones/{id}/grupo` | catequizandos | COORD | Asigna o cambia de grupo. Cierra la asignación vigente y abre otra, y marca `fuera_de_sugerencia` si corresponde | RF-206 | 1 |
| `POST /inscripciones/{id}/anular` | inscripciones | COORD | Exige motivo. Ver §3.1 | RF-203 | 2 |
| `GET /inscripciones/{id}/documentos` | inscripciones | COORD, CAT(g), FAM(n) | Devuelve el estado, la fecha y quién recibió cada documento (`identidadOperativa`) | RF-204 | 2 |
| `PUT /inscripciones/{id}/documentos/{tipo}` | inscripciones | COORD | Aplica `aplicarCambioDocumento` y escribe en `cambio_inscripcion` | RF-204, RF-203 | 2 |
| `GET /ciclos/{cicloId}/documentos-pendientes` | inscripciones | COORD | Lista los niños con algún documento pendiente o inválido | RF-204 | 2 |
| `GET /catequizandos/{id}/perfil` | catequizandos | COORD, CAT(g), FAM(n) | Devuelve nombre, edad, grupo, historial de grupos, apoderados y estado de documentos, más los resúmenes que aporten otros módulos (D-212). Los campos dependen de `camposDePerfilVisibles`. SUP no tiene acceso (C-09) | RF-201, RF-206, RF-207 | 1 (básico), 2 (documentos), 3 (resúmenes) |
| `PATCH /catequizandos/{id}` | catequizandos | COORD | Corrige datos de inscripción, escribe el historial en la misma transacción y devuelve `avisoGrupoSugerido` sin mover al niño | RF-203 | 2 |
| `GET /catequizandos/{id}/cambios` | catequizandos | COORD | Devuelve el historial de correcciones | RF-203 | 2 |
| `GET /catequizandos/{id}/condiciones` | catequizandos | COORD, CAT(g) | Lectura auditada (001, RF-109) con `Cache-Control: no-store` | RF-205 | 3 |
| `PUT /catequizandos/{id}/condiciones` | catequizandos | COORD | Reemplaza la lista y se audita | RF-205 | 3 |
| `GET /apoderados?q=` | catequizandos | COORD | Busca apoderados por nombre o contacto, para vincular hermanos | RF-207 | 1 |
| `POST /catequizandos/{id}/apoderados` | catequizandos | COORD | Vincula un apoderado nuevo o existente con su relación y, si es nuevo, pide a 001 que genere su enlace | RF-207 | 2 |
| `DELETE /catequizandos/{id}/apoderados/{apoderadoId}` | catequizandos | COORD | Cierra el vínculo y llama a 001 según `efectoDesvinculacion` | RF-207 | 2 |
| `GET /ciclos/{cicloId}/grupos` | catequizandos | COORD (todos, con conteos y aviso de grupo sin catequista); CAT (solo los suyos) | | RF-206 | 1 |
| `POST /grupos`, `PATCH /grupos/{id}`, `POST /grupos/{id}/cerrar`, `PUT /grupos/{id}/catequistas` | catequizandos | COORD | Crear, renombrar o ajustar, cerrar (C-11) y asignar catequistas | RF-206 | 1 |
| `POST /grupos/sugerencias` | catequizandos | COORD | Recibe `{ fechaNacimiento, sexo }` y devuelve los grupos sugeridos con el total de niños y, desde la fase 3, el conteo por categoría de condición. Los conteos son agregados y nunca nominales | RF-206 | 1 / 3 |
| `GET /catequizandos/{id}/carne`, `GET /grupos/{id}/carnes`, `POST /catequizandos/{id}/carne/reemitir` | catequizandos | COORD | Devuelven el contenido del QR, el nombre y el grupo para imprimir. Reemitir invalida la emisión anterior | RF-302 (003) | 1 |

### 5.2 Interfaces en proceso para otros módulos

Son llamadas dentro del mismo Function App, no endpoints:

| Interfaz | Consumidor | Propósito |
| --- | --- | --- |
| `proveedorNomina.cambiosDesde(cursor, alcance)` | `sincronizacion` (003) | Pull de `catequizandos` y `grupos`. Si cambia el alcance del usuario, se manda la nómina completa, que pesa unos 10 KB con 100 niños |
| `resolverCarne(codigo): { catequizandoId, grupoId, activo, emisionVigente }` | `asistencia` (003) | Validar el escaneo (RF-303 de 003) |
| `gruposACargo(cuentaId, cicloId)`, `alcanceFamilia(cuentaId)` | `seguridad` (001) | Calcular el alcance de cada petición |
| `eliminarDatosRestringidos(catequizandoId)`, `anonimizarCatequizando(catequizandoId)` | motor de retención y consentimiento (001) | Borrar las condiciones; anular la clave de duplicado, los nombres y el historial (RF-106 y RF-108 de 001; RF-201) |
| `ninosActivos(cicloId, fecha)` | 003, 007, 008 | Total de niños activos por fecha |
| `FuenteInscripciones.periodos(cicloId, catequizandoIds, tx)` | 003 | Periodos de inscripción y asignación, límites desde/hasta, anulación y grupo en la fecha de sesión; no sustituir por el grupo actual |
| `grupoActual`, `apoderadosVinculados`, `marcarInactivo(tx, catequizandoId)` | 007/008 | Puertos de consulta/cambio administrativo con autorización y transacción; integración externa pendiente |
| `crearInscripcion(tx, datos)` | 008 | Reutiliza perfil no anonimizado; puerto backend no acredita flujo completo de reinscripción de 008 |

### 5.3 Políticas de APIM

Se agregan sobre las políticas base del plan 001:
- **Registro de cuerpos desactivado.** En todas las operaciones de 002 el diagnóstico guarda 0 bytes del cuerpo de petición y respuesta, porque contienen datos de menores (principio 7).
- **`Cache-Control: no-store`.** Se fuerza en `/perfil`, `/condiciones` y `/documentos`.
- **Límite de peticiones.** `GET /apoderados` tiene un límite propio por llamante, más estricto que el global, para frenar barridos.

El límite por cuenta se impone en la Function con contador PostgreSQL atómico compartido (429 al excederlo), no en APIM Consumo ni en memoria local de cada instancia. APIM impone el global.

### 5.4 Retiro de consentimiento y retención

Participante `catequizandos` dentro de la transacción del motor de 001, con rol `sigecat_retencion` y contexto `retiro_consentimiento` o `retencion`, ambos `SET LOCAL`. En retiro borra condiciones, estados de `documento_inscripcion` e historial personal de `cambio_inscripcion` (incluidos contactos/valores anteriores); cierra vigencias de inscripción/asignación/vínculos, invalida carné y anonimiza nombres, nacimiento y clave de duplicado. El perfil queda anonimizado y operativamente inactivo, fuera de nómina. Elimina/anonimiza datos de apoderado solo sin otros hijos vinculados y pide a 001 terminar su credencial sin vínculos. 003 preserva asistencia anonimizada; 008 preserva constancia. Al vencer ciclo no anonimiza un perfil o apoderado aún necesario en un ciclo no vencido. Rollback total si falla un participante; blobs por bandeja después del commit.

## 6. Cliente

Las rutas de Expo Router van bajo el grupo de rutas del equipo definido en el plan 001. La conectividad se lee del monitor NetInfo definido en el plan 003. Las pantallas que exigen conexión muestran el componente `AvisoSinConexion` con un texto como "Inscribir requiere conexión" y desactivan el envío.

| Ruta | Rol | Sin conexión | Qué hace | RF |
| --- | --- | --- | --- | --- |
| `src/app/catequizandos/index.tsx` | COORD, CAT | **Funciona** (lee el almacén local) | Busca en la nómina. CAT ve primero sus grupos | RF-201, RNF-204 |
| `src/app/catequizandos/[id]/index.tsx` | COORD, CAT(g), FAM(n) | Parcial | Perfil. Sin conexión muestra nombre y grupo, y la asistencia y el avance si los planes 003 y 005 los tienen en local. Las secciones de apoderados, documentos y condiciones dicen "Disponible con conexión" | RF-201, RF-206, RNF-204 |
| `src/app/coordinacion/inscripcion/nueva.tsx` | COORD | **Bloqueada** | Asistente de cuatro pasos: 1) datos del niño; 2) apoderado (nuevo o buscado); 3) consentimiento (componente de 001); 4) grupo sugerido. Usa fecha con selector, sexo y bautizado con un toque, y el ciclo se toma del ciclo abierto. Muestra el aviso de duplicado y el de edad. El borrador solo vive en memoria | RF-201, RF-202, RF-206, RNF-201, RNF-202 |
| `src/app/catequizandos/[id]/editar.tsx` | COORD | Bloqueada | Corrige datos, muestra el aviso de grupo sugerido y el historial | RF-203 |
| `src/app/catequizandos/[id]/documentos.tsx` | COORD (edita), CAT(g) y FAM(n) (consultan) | Bloqueada | Muestra los cinco estados con cambio por toque y pide motivo para marcar un documento como inválido | RF-204 |
| `src/app/catequizandos/[id]/condiciones.tsx` | COORD (edita), CAT(g) (consulta) | Bloqueada | Lista cerrada con casillas y nota de hasta 200 caracteres. No guarda nada en caché | RF-205, RNF-203 |
| `src/app/catequizandos/[id]/apoderados.tsx` | COORD | Bloqueada | Vincular y desvincular apoderados | RF-207 |
| `src/app/catequizandos/[id]/carne.tsx` | COORD | Funciona si el niño está en la nómina local | Muestra el carné con su QR y permite reemitirlo (con conexión) | RF-302 (003) |
| `src/app/coordinacion/grupos/index.tsx`, `nuevo.tsx`, `[id].tsx` | COORD | Lectura sí, edición no | Grupos con conteos y aviso de "sin catequista". Al crear un grupo, se propone el rango y la modalidad según la regla habitual | RF-206 |
| `src/app/coordinacion/grupos/[id]/carnes.tsx` | COORD | Requiere conexión | Hoja imprimible. En nativo usa `Print.printToFileAsync({ html })` y comparte el PDF. En web renderiza la hoja y llama a `Print.printAsync()`, que en web imprime la página actual | RF-302 (003) |
| `src/app/coordinacion/documentos-pendientes.tsx` | COORD | Bloqueada | Lista de documentos pendientes o inválidos, filtrable por grupo | RF-204 |
| Sección "Documentos pendientes" en la vista de familia (ruta definida en el plan 001, Expo web) | FAM(n) | Solo en línea | Consulta los documentos pendientes | RF-204 (HU-206) |

Componentes en `src/components/catequizandos/`: `formulario-inscripcion.tsx`, `selector-grupo-sugerido.tsx`, `codigo-qr.tsx` (pinta la matriz con `react-native-svg`), `tarjeta-carne.tsx` y `aviso-sin-conexion.tsx`. Si el plan 001 publica un aviso equivalente, se reutiliza el suyo.

## 7. Decisiones técnicas

| Id | Decisión | Alternativas descartadas | Justificación |
| --- | --- | --- | --- |
| D-201 | El identificador del niño es el UUID interno, generado en el dispositivo, y **no se guarda el número de DNI** (supuesto provisional C-01) | DNI como clave; código correlativo legible | El DNI excluye a niños sin documento o con documento extranjero y es un dato restringido. El correlativo exige coordinar con el servidor. Si se decide guardar el DNI, se agrega una tabla restringida aparte con una migración nueva |
| D-202 | El QR contiene `SGC1:<uuid-perfil>:<emision>` | Solo el UUID; token firmado (HMAC); número correlativo | Mantiene el supuesto del UUID del perfil. La emisión permite invalidar un carné reimpreso, que es un caso límite de 003. El prefijo versiona el formato. Un HMAC agranda el QR y no se puede verificar sin conexión sin poner la clave en el celular. Un correlativo se puede adivinar. El código no lleva datos sensibles |
| D-203 | El duplicado se detecta con `claveDuplicado` (nombres, apellidos y fecha de nacimiento normalizados). El 409 devuelve una referencia opaca de vida corta | Búsqueda difusa con `pg_trgm`; comparar por DNI | Cumple "avisar sin mostrar datos". La búsqueda difusa queda como mejora si hay falsos negativos. El DNI no se guarda. Los perfiles anonimizados tienen la clave en NULL y no coinciden, como pide RF-807 de 008 |
| D-204 | La inscripción y la edición son endpoints síncronos y quedan fuera del push de sincronización | Encolar la inscripción sin conexión | La spec lo excluye expresamente. Además, el consentimiento, el control de duplicados y la sugerencia con conteos necesitan al servidor |
| D-205 | Al celular solo baja la nómina (nombres, apellidos, grupo y emisión) y los grupos. La fecha de nacimiento, el sexo, los apoderados y los documentos se consultan en línea | Bajar la edad y los apoderados de los grupos propios; bajar el estado de los documentos | RNF-204 solo pide nombre, grupo, asistencia y avance, y así se minimizan los datos expuestos si se pierde el celular. Con una sola forma de fila para todos no hace falta refrescar columnas cuando cambia el alcance |
| D-206 | El historial de correcciones se escribe de forma explícita desde la capa de aplicación (`diferenciasCorregibles`), en la misma transacción, en la tabla `cambio_inscripcion` | Trigger genérico con `SET LOCAL app.usuario`; reutilizar la auditoría de 001 | Es comprobable con tests unitarios y por campo, y conoce el autor sin depender de variables de sesión. La auditoría de 001 registra accesos a datos restringidos, no valores de inscripción |
| D-207 | La asignación de grupo es una tabla con vigencia (`desde` y `hasta`) | Columna `grupo_id` en la inscripción | RF-206 pide conservar el historial de grupos. Los registros operativos apuntan al niño, así que el catequista nuevo ve todo el historial |
| D-208 | Las condiciones van en su propia tabla, con un CHECK y una constante TypeScript como fuente única de la lista. Nunca se sincronizan ni se registran en logs | Columna `jsonb` en `catequizando`; texto libre | Evita que un listado arrastre las condiciones por accidente, como ya advertía `modelo.ts`. La lista cerrada impide guardar diagnósticos |
| D-209 | La exoneración de pago se registra como `no_aplica` con `motivo='exonerado'` (supuesto C-03) | Estado propio `exonerado`; `entregado` con nota | Respeta los cuatro estados de la spec. Si se decide un estado propio, se migra filtrando por el motivo |
| D-210 | El QR se genera en el cliente con `qrcode-generator` (TypeScript puro, sin dependencias) y se pinta con `react-native-svg`. La hoja imprimible usa `expo-print` | `react-native-qrcode-svg`; PNG generado en el servidor | La matriz se calcula en `src/lib/` y se reutiliza en pantalla y en el HTML imprimible. No hay costo de servidor y funciona sin conexión. Según la documentación del SDK 57, `react-native-svg` y `expo-print` soportan Android, iOS y web. **Hay que justificarlas en la spec antes de implementar (principio 1)** |
| D-211 | Al desvincular a un apoderado se le quita el alcance sobre ese niño. Solo se revoca el enlace si ya no le queda ningún vínculo vigente (supuesto C-06) | Revocar siempre el enlace | Un apoderado con otro hijo inscrito no pierde el acceso legítimo a ese hijo. La revocación la ejecuta el plan 001 |
| D-212 | El perfil se compone con el puerto `ProveedorResumenPerfil`, que registran los planes 003, 004, 005 y 007. Las secciones sin proveedor no se muestran | Que 002 consulte directamente las tablas de otros módulos | Respeta los límites de los módulos del C3 y deja entregar el perfil antes que esas specs |
| D-213 | Hay dos módulos: `inscripciones` (alta, duplicados, anulación y documentos) y `catequizandos` (perfil, correcciones, apoderados, condiciones, grupos, asignación y carné) | Un solo módulo | Sigue los componentes "Gestión de Inscripciones y Documentos" y "Gestión de Catequizandos" del C3 |
| D-214 | El consentimiento se registra en la misma petición y transacción que la inscripción, usando el servicio de 001 (supuesto C-08) | Inscripción en estado "pendiente de consentimiento" | Hoy el apoderado está presente al inscribir. Es un solo paso y no quedan niños a medio inscribir en la nómina |

## 8. Estructura de archivos propuesta

```
api/
  migraciones/NNNN_crear_catequizando_y_apoderado.sql   (M-201 … M-207)
  src/modulos/inscripciones/
    dominio/puertos.ts                    # RepositorioInscripciones, RepositorioDocumentos
    aplicacion/inscribir.ts | confirmar-duplicado.ts | anular-inscripcion.ts
               cambiar-documento.ts | listar-documentos-pendientes.ts
    infraestructura/repositorio-inscripciones-pg.ts | repositorio-documentos-pg.ts
    http/inscripciones.ts | documentos.ts  # registro de Functions v4 (app.http)
  src/modulos/catequizandos/
    dominio/puertos.ts                    # repositorios, ProveedorResumenPerfil
    aplicacion/consultar-perfil.ts | corregir-catequizando.ts | vincular-apoderado.ts
               desvincular-apoderado.ts | registrar-condiciones.ts | consultar-condiciones.ts
               gestionar-grupos.ts | sugerir-grupos.ts | asignar-grupo.ts
               emitir-carne.ts | proveedor-nomina.ts | resolver-carne.ts | retencion.ts
    infraestructura/repositorio-catequizandos-pg.ts | repositorio-apoderados-pg.ts
                    repositorio-grupos-pg.ts | repositorio-condiciones-pg.ts | repositorio-carnes-pg.ts
    http/perfil.ts | apoderados.ts | condiciones.ts | grupos.ts | carnes.ts
  test/integracion/catequizandos/*.test.ts  # contra PostgreSQL en Docker
src/lib/catequizandos/
  modelo.ts edad.ts inscripcion.ts duplicados.ts correcciones.ts documentos.ts
  condiciones.ts grupos.ts apoderados.ts carne.ts autorizacion.ts contratos.ts api.ts
  __tests__/*.test.ts
src/components/catequizandos/  (ver §6)
src/app/catequizandos/…  src/app/coordinacion/{inscripcion,grupos,documentos-pendientes}…
```

`src/lib/catequizandos/api.ts` contiene funciones tipadas sobre el cliente HTTP del plan 001.

## 9. Estrategia de tests

El runner y `npm test` los configura el plan 001. Cada nombre de test empieza con su RF.

| Nivel | Dónde | Qué cubre |
| --- | --- | --- |
| Unitarios de dominio | `src/lib/catequizandos/__tests__` (`jest-expo`) | Todas las funciones de §4, más una prueba de que `src/lib/catequizandos` no importa `react`, `react-native` ni `expo*` |
| Contrato de repositorios | `api/test/integracion` (PostgreSQL en Docker, migraciones aplicadas desde cero) | Índices parciales (una inscripción vigente por ciclo, una asignación vigente, un vínculo vigente, una emisión vigente), anulación sin borrado, `v_nomina_ciclo`, que `cambio_inscripcion` solo admita inserciones, que `documento_inscripcion` no tenga columnas de archivo e idempotencia por UUID |
| HTTP de cada Function | `api/src/modulos/*/http/__tests__` | Matriz de autorización por endpoint: COORD, delegado vigente, delegado vencido, CAT(g), CAT de otro grupo, FAM(n), FAM ajena, SUP y sin token. También los códigos 409 y 422, el encabezado `no-store` y que no queden datos de condiciones en los logs |
| Extremo a extremo (API) | `api/test/integracion/flujo-inscripcion.test.ts` | Crear dos grupos de 8 años → inscribir → duplicado → corregir → documentos → condiciones → cambio de grupo → anular → reinscribir; el pull de nómina se verifica en cada paso |
| Cliente | `src/app/**/__tests__` (`jest-expo`, NetInfo simulado) | Bloqueo sin conexión de inscripción y edición, perfil sin conexión desde un almacén local simulado y contenido del QR del carné |
| Campo (manual) | Lista de verificación de la fase | RNF-201 cronometrado (menos de 3 minutos en un celular de gama baja) y RNF-202 en un celular de 360 px |

### Casos límite de la spec convertidos en tests

| Caso límite | Test |
| --- | --- |
| Niño de 13 que cumple 14 durante el ciclo | `RF-202: la edad se calcula al inicio del ciclo y un niño que cumple 14 sigue en su grupo` |
| Cumpleaños entre el inicio del ciclo y la inscripción | `RF-202: usa la fecha de inicio del ciclo, no la de inscripción` |
| Dos hermanos con el mismo apoderado | `RF-207: un apoderado existente se vincula a un segundo niño sin duplicarse` |
| Apoderado que no es padre ni madre | `RF-207: acepta la relación otro_familiar con detalle "abuela"` y `RF-207: acepta tutor` |
| Reinscripción tras abandonar un ciclo | `RF-201: el duplicado confirmado reutiliza el perfil y crea una inscripción nueva` |
| Documento entregado después de iniciado el ciclo | `RF-204: pendiente→entregado con fecha posterior al inicio` |
| Familia exonerada del pago | `RF-204: la boleta pasa a no_aplica con motivo exonerado y no cuenta como pendiente` |
| Grupo de 8 años con más de 20 niños | `RF-206: con dos grupos de 8 años se sugieren ambos, con su conteo` |
| Inscripción sin señal | `RF-202: sin conexión el asistente no envía y muestra el aviso` |
| Niño anulado por error que luego se inscribe | `RF-203: después de anular se puede crear otra inscripción vigente en el mismo ciclo` |

## 10. Matriz de cobertura

| RF / RNF | Componentes | Tests (prefijo del nombre) |
| --- | --- | --- |
| RF-201 | `duplicados.ts`, `autorizacion.ts`, `inscribir.ts`, `confirmar-duplicado.ts`, `consultar-perfil.ts`, `retencion.ts`, `v_nomina_ciclo`, `catequizandos/[id]/index.tsx` | `RF-201: un niño tiene un solo perfil entre ciclos`; `RF-201: el 409 de posible duplicado no contiene nombres, fechas ni el id`; `RF-201: los datos del perfil solo se ven tras confirmar`; `RF-201: el perfil muestra nombre, edad, grupo, apoderados y documentos`; `RF-201: un perfil anonimizado no se detecta como duplicado` |
| RF-202 | `inscripcion.ts`, `edad.ts`, `inscribir.ts`, `POST /inscripciones`, `inscripcion/nueva.tsx` | `RF-202: solo COORD o un delegado vigente inscribe`; `RF-202: CAT y FAM reciben 403`; `RF-202: sin un dato obligatorio se bloquea`; `RF-202: sin consentimiento responde 422`; `RF-202: edad fuera de 8 a 13 sin confirmar responde 422`; `RF-202: sin conexión no se inscribe y se explica` |
| RF-203 | `correcciones.ts`, `corregir-catequizando.ts`, `anular-inscripcion.ts`, `cambio_inscripcion`, `editar.tsx` | `RF-203: la corrección guarda el valor anterior, el autor y la fecha`; `RF-203: un cambio de fecha de nacimiento avisa del nuevo grupo sin mover al niño`; `RF-203: anular retira al niño del grupo y de la nómina sin borrar sus registros`; `RF-203: el historial solo admite inserciones` |
| RF-204 | `documentos.ts`, `cambiar-documento.ts`, `listar-documentos-pendientes.ts`, `documento_inscripcion`, `documentos.tsx`, `documentos-pendientes.tsx` | `RF-204: un niño no bautizado arranca con la partida de bautismo en no_aplica`; `RF-204: bautismo durante el ciclo: no_aplica→pendiente`; `RF-204: inválido exige motivo y cuenta como pendiente`; `RF-204: el esquema no tiene columnas de archivo`; `RF-204: la lista de pendientes incluye los inválidos`; `RF-204: FAM(n) consulta los documentos de su hijo` |
| RF-205 | `condiciones.ts`, `registrar-condiciones.ts`, `consultar-condiciones.ts`, `condicion_catequizando`, `condiciones.tsx` | `RF-205: rechaza categorías fuera de la lista cerrada`; `RF-205: rechaza una nota de más de 200 caracteres`; `RF-205: CAT de otro grupo y FAM reciben 403`; `RF-205: la lectura queda auditada` |
| RF-206 | `grupos.ts`, `gestionar-grupos.ts`, `sugerir-grupos.ts`, `asignar-grupo.ts`, `asignacion_grupo`, pantallas de grupos | `RF-206: COORD crea, renombra y cierra grupos`; `RF-206: sugiere los grupos mixtos de 8 a 10 años y los de 11 a 13 por sexo`; `RF-206: la sugerencia incluye el total y el conteo por categoría`; `RF-206: se puede asignar un grupo distinto del sugerido`; `RF-206: el cambio de grupo conserva el historial y el catequista nuevo ve al niño`; `RF-206: avisa de un grupo sin catequista` |
| RF-207 | `apoderados.ts`, `vincular-apoderado.ts`, `desvincular-apoderado.ts`, `vinculo_apoderado`, `apoderados.tsx` | `RF-207: un niño puede tener varios apoderados y un apoderado varios niños`; `RF-207: desvincular llama a 001 para quitar el alcance de ese niño`; `RF-207: sin vínculos restantes se revoca el enlace` |
| RF-302 (003, carné) | `carne.ts`, `emitir-carne.ts`, `resolver-carne.ts`, `carne_emision`, `carne.tsx`, `carnes.tsx` | `RF-302: el QR solo contiene SGC1, el uuid y la emisión`; `RF-302: reemitir invalida la emisión anterior`; `RF-302: un código mal formado se interpreta como inválido` |
| RNF-201 | Asistente de 4 pasos, `CAMPOS_OBLIGATORIOS` | `RNF-201: los campos obligatorios son exactamente los de RF-202` y medición en campo de menos de 3 minutos |
| RNF-202 | Pantallas de §6 | `RNF-202: el asistente se renderiza a 360 px sin desbordes` y verificación manual en celular |
| RNF-203 | D-205, D-208, `proveedor-nomina.ts`, políticas de APIM | `RNF-203: el pull de nómina no contiene condiciones, documentos ni fecha de nacimiento`; `RNF-203: el esquema local no tiene tablas de condiciones ni de documentos`; `RNF-203: las condiciones responden con no-store` |
| RNF-204 | `catequizandos/[id]/index.tsx`, tablas locales de §3.2 | `RNF-204: sin conexión el perfil muestra nombre y grupo desde el almacén local` |

## 11. Dependencias, riesgos, costo y dudas

### Dependencias

| Spec | Qué necesita 002 | Primer corte |
| --- | --- | --- |
| 001 | Infraestructura, middleware JWT, alcance y delegación, `cuenta`, `consentimiento` y `registrarConsentimiento`, generación y revocación de enlaces de familia, auditoría (RF-109), motor de retención, `identidadOperativa` y configuración de Jest | Sí, incluido el **consentimiento mínimo** (supuesto C-08) |
| 003 | Protocolo pull y push, esquema WatermelonDB, monitor NetInfo y generador de UUID en el cliente. 003 consume `resolverCarne` y la nómina | Sí |
| 004, 005, 007 | Proveedores de `ProveedorResumenPerfil` | No |
| 008 | Tabla `ciclo` (con `inicio` y el ciclo abierto), RF-807 y cierre de ciclo | La migración mínima de `ciclo` debe adelantarse al primer corte (riesgo R-1) |

### Riesgos

| Id | Riesgo | Mitigación |
| --- | --- | --- |
| R-1 | `ciclo` es de 008 y 008 no entra en el primer corte | Adelantar solo la migración de `ciclo` de 008, o sembrar un ciclo abierto con la semilla del plan 001 |
| R-2 | Colisión de números de migración entre ocho planes escritos en paralelo | Asignar `NNNN` al integrar en `main`, nunca antes |
| R-3 | Falsos negativos de duplicado por errores de tipeo | Normalización en D-203 y, como mejora, `pg_trgm` |
| R-4 | Filtración de condiciones por logs o caché | Políticas de §5.3, `no-store` y tests de logs |
| R-5 | El C4 anterior contradecía RF-204 con carga de partidas/DNI/boletas | Relación eliminada en acuerdo 2026-10-11/ADR 013; build pendiente |
| R-6 | WatermelonDB exige un build de desarrollo con EAS | Ya está asumido en las decisiones fijas. Las pantallas que solo funcionan en línea se prueban con Jest |
| R-7 | Lectura del QR con poca luz en celulares de gama baja (RNF-305 de 003) | El formato `SGC1:` es corto (unos 45 caracteres) y permite usar QR de baja versión con corrección de errores M |

### Costo en Azure

El costo incremental es prácticamente cero:
- Se guardan unos cientos de filas por ciclo en PostgreSQL B1ms, que ya cubre el plan 001.
- Las Functions solo se ejecutan cuando la coordinación inscribe.
- No se usa Blob Storage, porque no se guardan imágenes.
- El QR y el PDF se generan en el celular.

El único costo real es imprimir los carnés en papel (duda C-10).

### Dudas `[NECESITA ACLARACIÓN]`

Cada duda tiene un supuesto provisional explícito y reversible.

| Id | Duda | Supuesto provisional | Cómo se revierte |
| --- | --- | --- | --- |
| C-01 | **[NECESITA ACLARACIÓN]** El principio 5 dice "toda escritura va primero al almacén local", pero RF-202 prohíbe inscribir sin conexión | Lo operativo es offline; inscribir y escribir datos restringidos se hace solo en línea, con respaldo en el principio 7 y en la sección "Fuera de alcance" de la spec. El equipo debe registrar la excepción en la constitución o en un ADR | Si se rechaza, se modifica la spec. El código no cambia mientras la spec mantenga RF-202 |
| C-02 | **[NECESITA ACLARACIÓN]** Identificador del niño, criterio de duplicado y niños sin DNI o con documento extranjero | D-201 y D-203: UUID interno, sin DNI, con clave normalizada | Una migración nueva agrega `documento_identidad_catequizando`, una tabla restringida que solo se consulta en línea, y su clave se suma al criterio de duplicado |
| C-03 | **[NECESITA ACLARACIÓN]** ¿Una familia exonerada cuenta como "boleta entregada"? | `no_aplica` con `motivo='exonerado'` (D-209) | Una migración agrega el estado y convierte las filas con ese motivo |
| C-04 | **[NECESITA ACLARACIÓN]** ¿La lista de categorías de condiciones está completa? | Se usa la lista de la spec tal cual | Una migración modifica el CHECK y se actualiza `CATEGORIAS_CONDICION` |
| C-05 | **[NECESITA ACLARACIÓN]** ¿Qué compromisos incluye la ficha de compromiso? | Solo se registra el estado del documento, sin detalle de compromisos | Se agrega una tabla de compromisos si la coordinación lo pide |
| C-06 | **[NECESITA ACLARACIÓN]** ¿Qué pasa con el enlace de un apoderado desvinculado de un hijo que sigue vinculado a otro? | Se le quita el alcance solo sobre ese niño (D-211) | Se cambia `efectoDesvinculacion` |
| C-07 | **[NECESITA ACLARACIÓN]** ¿Hace falta registrar el sexo de los niños de 8 a 10 años? | Es obligatorio, como dice RF-202 | Una migración vuelve `sexo` nullable y `validarInscripcion` lo exige solo desde los 11 años |
| C-08 | **[NECESITA ACLARACIÓN]** ¿El consentimiento se toma en persona al inscribir y entra en el primer corte? | Sí: se toma en el celular de COORD con el apoderado presente, y 001 entrega el registro mínimo en el primer corte (D-214) | Agregar un estado "pendiente de consentimiento" a `inscripcion` y excluir esas inscripciones de la nómina |
| C-09 | **[NECESITA ACLARACIÓN]** ¿Qué ve la familia (duda de 001)? ¿SUP accede al perfil? | FAM(n) ve nombre, edad, grupo y documentos, pero no condiciones ni historial. SUP no accede al perfil de 002 | Se ajusta `camposDePerfilVisibles` |
| C-10 | **[NECESITA ACLARACIÓN]** ¿Quién imprime los carnés y quién paga (duda de 003)? | La coordinación imprime la hoja por grupo desde la app | Sin impacto en el modelo de datos |
| C-11 | **[NECESITA ACLARACIÓN]** ¿Se puede cerrar un grupo que tiene niños activos? | No: primero hay que reasignarlos (responde 409) | Cambiar `puedeCerrarGrupo` |
| C-12 | **[NECESITA ACLARACIÓN]** ¿Qué largo tiene una nota "corta" de condición? | 200 caracteres | Cambiar la constante y migrar `varchar` |
| C-13 | Contenido del QR (pendiente con el coordinador) | `SGC1:<uuid-perfil>:<emision>` (D-202) | El prefijo `SGC1` permite convivir con un formato `SGC2` |

## 12. Orden de implementación

Todas las fases backend están incluidas en la entrega actual. Las referencias a primer corte son orden histórico, no exclusiones. `ProveedorResumenPerfil` registra `resumenAsistencia` de 003; 004/005/007 requieren proveedores reales y su integración permanece pendiente cuando no estén disponibles.

### Fase 1: primer corte (niños y grupos para la asistencia, sin documentos ni salud)

1. **T-0.** Justificar en la spec las dependencias `react-native-svg`, `expo-print` y `qrcode-generator` (principio 1) y resolver con el equipo C-01 y C-08.
2. Dominio: `modelo.ts`, `edad.ts`, `inscripcion.ts`, `duplicados.ts`, `grupos.ts` (sin conteos por condición), `apoderados.ts` (validación), `carne.ts` y `autorizacion.ts`, con sus tests unitarios.
3. Migraciones M-201 a M-204, más la vista `v_nomina_ciclo`. Requieren `ciclo` (R-1), `cuenta` y `consentimiento` de 001.
4. API:
   - `POST /inscripciones` y `POST /inscripciones/duplicados/confirmar`;
   - CRUD de grupos, `PUT /grupos/{id}/catequistas`, `POST /grupos/sugerencias` (solo con el total) y `PUT /inscripciones/{id}/grupo`;
   - `GET /apoderados`;
   - `GET /catequizandos/{id}/perfil` básico;
   - endpoints del carné;
   - interfaces `proveedorNomina`, `resolverCarne`, `gruposACargo`, `alcanceFamilia` y `ninosActivos`.
5. Cliente: asistente de inscripción, lista de catequizandos, perfil básico, pantallas de grupos, carné y hoja imprimible.
6. Tests de HTTP y de contrato, y extremo a extremo reducido (grupos → inscripción → nómina → carné).

**Cubre en el primer corte:** RF-201 (salvo los resúmenes de otros módulos), RF-202, RF-206 (salvo los conteos por condición), RF-207 (vincular al inscribir y vincular hermanos), RF-302 de 003, RNF-201, RNF-202 y RNF-204.

### Fase 2: correcciones, documentos y apoderados

- M-205 y M-206.
- RF-203 completo: corrección, historial y anulación.
- RF-204 completo, incluida la vista de familia.
- RF-207: vincular y desvincular apoderados después de la inscripción, con enlace y revocación de 001.

### Fase 3: condiciones y perfil completo

- M-207.
- RF-205, con auditoría y las políticas de APIM de §5.3.
- Conteos por categoría en la sugerencia de grupos (RF-206).
- RNF-203 con sus tests.
- `ProveedorResumenPerfil` integrado con 003, 004, 005 y 007 (RF-201 completo).

### Fase 4: ciclo de vida del dato

- `eliminarDatosRestringidos` y `anonimizarCatequizando`, conectados al motor de 001 (RF-106 y RF-108 de 001).
- Reinscripción entre ciclos junto con 008 (RF-807).
- Extremo a extremo completo de §9.

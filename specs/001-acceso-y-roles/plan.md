# Plan 001 — Acceso, roles y protección de datos

> CÓMO implementar la [spec 001](spec.md). Si este plan y la spec divergen, manda la spec (principio 2).
> Este plan es además **dueño de la base transversal**: infraestructura Azure (Bicep), CI, Jest y `npm test`, cuentas, roles, enlace + PIN, sesión sin conexión, delegación, middleware de autorización, auditoría, seudónimo, consentimiento y motor de retención. Los demás planes lo citan como "definido en plan 001".
>
> Notación de alcance:
> - **ADM**: administración. **COORD**: coordinación o cuenta con delegación vigente (RF-104). **COORD-propia**: rol coordinación asignado, sin contar delegaciones.
> - **CAT(g)**: catequista con el grupo `g` asignado. **FAM(n)**: apoderado con vínculo vigente con el niño `n`. **SUP**: supervisión.
> - **EQUIPO**: cualquier cuenta con ADM, COORD, CAT o SUP (entra con enlace + PIN).

---

## 1. Resumen y alcance

**Acuerdo 2026-10-11:** este trabajo cubre backend F0–F4 completo, no solo primer corte. D-101–D-121 y S-01–S-20 están aceptados con los ajustes aquí registrados. Las secciones históricas de dudas contienen la motivación de la decisión; no son bloqueos de aprobación. UI, campo y despliegue se cierran solo con evidencia. Contratos transversales: [guía frontend](../../docs/backend-contratos.md); estado: [seguimiento](../../docs/backend-implementacion.md).

| Cubre | Qué |
| --- | --- |
| RF-101 | Credencial obligatoria en cada petición; rechazo genérico 401 sin revelar existencia; cuenta desactivada rechazada en la siguiente petición |
| RF-102 | Cinco roles, varios por cuenta, unión de alcances; matriz de permisos central; excepciones de asistencia de 003; rechazo y registro de lo que esté fuera de alcance en el servidor |
| RF-103 | Permisos para que CAT(g) lea faltas, justificaciones y avance sin intervención de COORD; avisos de COORD por grupo (módulo `avisos`) |
| RF-104 | Delegación con periodo, vigencia evaluada en cada petición, revocación y registro completo |
| RF-105 | `identidad_operativa` como único nombre visible; identidad real en tabla aparte, legible solo por ADM |
| RF-106 | Texto de consentimiento versionado; registro (quién, cuándo, qué texto) como condición de inscripción; retiro con borrado inmediato a través del motor de retención |
| RF-107 | Catálogo cerrado de datos personales con clasificación y finalidad; datos restringidos solo para COORD y CAT(g); evidencia visible para SUP |
| RF-108 | Motor de retención: temporizador diario que anonimiza ciclos cerrados hace 2 años mediante los participantes que registran los módulos |
| RF-109 | Auditoría solo de inserción, que no deja leer si falla el registro (cierre en falla), para creación, modificación y lectura de datos restringidos y denegaciones |
| RF-110 | Enlace de familia: token de alta entropía, sin vencimiento, revocable, reemisible y compartido con la hoja de compartir del celular |
| RF-111 | Enlace del equipo: activación ligada al celular, PIN de 4 a 6 dígitos, bloqueo tras 5 fallos, revocación y reemisión |
| RF-112 | Desbloqueo con PIN sin conexión durante 14 días, renovación antes del envío, rechazo de pendientes con aviso a COORD y bloqueo de registros al vencer |
| RNF-101 a RNF-105 | Datos restringidos fuera del celular, celular compartido, TLS en todo, costo cero por usuario y administración desde el celular |
| Base transversal | Bicep (APIM Consumo, Function App Flex Consumption, PostgreSQL Flexible B1ms, Blob, Static Web Apps, Key Vault), CI de GitHub Actions, Jest en `src/` y `api/`, runner de migraciones, convenciones de carpetas y rutas |

**Fuera de alcance** (de la spec): biometría, código por SMS, cuentas para niños e integración con la diócesis o la secretaría.

**Fuera de este plan** (otros dueños):
- `catequizando`, `apoderado`, `vinculo_apoderado`, `grupo`, `grupo_catequista`, datos restringidos y su lista de campos: plan 002.
- Protocolo de sincronización, esquema WatermelonDB, NetInfo y purga del almacén local: plan 003. Este plan solo fija qué exige la seguridad de esas piezas.
- Evidencias, SAS y borrado de blobs: plan 004. Este plan solo provee la cuenta de almacenamiento y la bandeja de borrados.
- `ciclo` y cierre (RF-802): plan 008, que llama a los servicios de este plan.
- La pantalla de perfil del niño que compone faltas, justificaciones y avance (RF-103): plan 002, con secciones de 003, 004 y 005. Este plan aporta los permisos.

---

## 2. Verificación contra la constitución

| # | Principio | Cómo se cumple |
| --- | --- | --- |
| 1 | Stack mínimo | Se usa solo el stack fijo: Expo SDK 57, Functions v4, APIM Consumo, PostgreSQL Flexible, Blob y Static Web Apps. Las dependencias nuevas están en la §7.2 (`expo-secure-store`, `expo-crypto`, `jose`, `pg`, `zod`, Jest y otras). Hay que justificarlas en la spec antes de instalarlas (tarea F0-1). |
| 2 | La spec manda | Cada RF y RNF tiene fila en la §10. Los tests se nombran `RF-1xx: …`. Un script de CI lista los RF sin test (§9.6). |
| 3 | Lógica sin interfaz | Las reglas (permisos, sesión local, PIN, delegación, seudónimo, retención y consentimiento) viven en `src/lib/seguridad/` como TS puro. Una regla de ESLint `no-restricted-imports` prohíbe `react`, `react-native`, `expo*` y `@/plataforma` dentro de `src/lib/**`. |
| 4 | Tests en verde | `npm test` corre el cliente, la API y la integración. CI bloquea la fusión si fallan tests, typecheck, lint o la verificación de migraciones. |
| 5 | Offline primero | El PIN se verifica en el celular y la sesión local vale 14 días (RF-112). Registrar asistencia no exige red mientras la sesión local esté vigente. Las escrituras administrativas (cuentas, enlaces, delegación y consentimiento) son en línea, porque las decide el servidor (§6.3). |
| 6 | Persistencia segura | Toda entidad creada desde la app lleva un UUID generado en el dispositivo (`expo-crypto.randomUUID`) y el POST es idempotente por ese UUID. Las migraciones van numeradas por bloque de spec (§3.1) y un checksum en CI impide editar una ya aplicada (D-114). |
| 7 | Datos de menores | Hay un middleware de rol y alcance en cada Function (D-104). `identidad_real` no tiene GRANT de lectura (D-108). Un test cruza el esquema local con el catálogo de restringidos (RNF-101). Las respuestas restringidas van con `no-store` y los logs se redactan. |
| 8 | Idioma | Tablas, columnas, módulos, archivos y recursos Azure van en español y sin tildes (`credencial`, `sesion_renovacion`, `motor-retencion.ts`, `rg-sigecat-prod`). Los textos de interfaz van con tildes. |
| 9 | Autoría trazable | Cada tarea del futuro `tasks.md` se hace en un commit con su registro Agent Trace. CI no lo valida (fuera de alcance), pero la plantilla de PR lo pide. |
| 10 | Contexto curado | El plan no añade requisitos. Las dudas van con supuesto en la §11. `AGENTS.md` se actualiza con los comandos nuevos (`npm test`, `test:rapido`, `migrar`). |
| 11 | Skills como paquete | La fase 0 publica dos skills, `nueva-migracion` (numeración, GRANT y checksum) y `verificacion` (test, typecheck y lint), en la ubicación del marketplace del proyecto. Supuesto S-20. |

---

## 3. Modelo de datos

### 3.1 Convenciones de migración (válidas para los 8 planes)

- **Archivo.** `api/migraciones/SSNN_descripcion.sql`. `SS` es el bloque de la spec (`00` infraestructura, `01` spec 001 … `08` spec 008) y `NN` es el correlativo dentro del bloque. Así ocho planes escritos en paralelo no chocan. Los planes que usaron `NNNN` provisional o M-xxx toman el número de su bloque al integrarse.
- **Orden.** El runner aplica en orden numérico los archivos pendientes, aunque haya otros de número mayor ya aplicados. Para que una base vacía y producción den el mismo resultado:
   - una migración solo referencia tablas de su bloque o de bloques menores, salvo la base transversal `0002_ciclo_base.sql` de 008, que precede las tablas operativas; `0801` agrega su complemento sin redefinir `ciclo`;
  - **una FK hacia una tabla de un bloque mayor la crea la migración del bloque mayor.** Por ejemplo, `consentimiento.catequizando_id → catequizando` la agrega 002.
- **Inmutabilidad.** La tabla `esquema_migracion(version, nombre, checksum_sha256, aplicada_en)` guarda cada migración aplicada. El runner falla si un archivo ya aplicado cambió. CI además falla si un PR modifica o borra un archivo de `api/migraciones/` que ya existe en `main` (D-114).
- **Roles de BD** (creados en `0001`):
  - `sigecat_migrador`: login, dueño de los objetos y de DDL. Lo usa solo CI.
  - `sigecat_api`: login, usado por las Functions. Cada migración otorga explícitamente `SELECT/INSERT/UPDATE/DELETE` a las tablas que crea.
   - `sigecat_retencion`: NOLOGIN. `sigecat_api` es miembro y solo el motor ejecuta `SET LOCAL ROLE sigecat_retencion`, junto con `SET LOCAL sigecat.contexto = 'retiro_consentimiento'` o `'retencion'`. Los triggers de inmutabilidad y congelamiento exigen ambos; se aplican a retiro y vencimiento, dentro de la misma transacción. Ningún handler permite fijar contexto desde entradas HTTP.
- **Nombres en singular** (`cuenta`, `credencial`), como en los planes 002, 005 y 006.
- **UUID.** `id uuid PRIMARY KEY` lo genera el cliente cuando nace en la app. Si nace en el servidor (auditoría, retención), se usa `gen_random_uuid()`. Las columnas de sincronización (`actualizado_en`, etc.) solo están en las tablas que baja la sincronización y se definen en el plan 003.

### 3.2 Tablas PostgreSQL de este plan

| Migración | Tabla | Columnas clave y restricciones | RF | Fase |
| --- | --- | --- | --- | --- |
| `0001_base.sql` | (sin tablas) | Roles de BD, `REVOKE ALL ON SCHEMA public FROM PUBLIC`, `ALTER DEFAULT PRIVILEGES` y zona horaria por defecto `America/Lima` | RNF-103 | 0 |
| `0101_cuentas_y_credenciales.sql` | `cuenta` | `id uuid PK`, `identidad_operativa text NOT NULL` (seudónimo si es menor; si no, el nombre), `es_menor bool NOT NULL` (congelado por ciclo, S-05), `activa bool NOT NULL DEFAULT true`, `creada_por → cuenta NULL` (NULL solo en la cuenta ADM inicial), `creada_en`, `desactivada_en`, `desactivada_por`. Índice único `lower(identidad_operativa) WHERE activa`. **Sin teléfono ni correo** (RNF-104, minimización) | RF-101, RF-105 | 1 |
| | `identidad_real` | `cuenta_id PK → cuenta`, `nombres`, `apellidos`, `fecha_nacimiento date NULL`. **Sin GRANT para `sigecat_api`**: se lee y escribe con las funciones `SECURITY DEFINER` `leer_identidad_real(solicitante, cuenta)` y `guardar_identidad_real(...)`, que comprueban en la BD que el solicitante tiene ADM (D-108). Las cuentas solo de familia no tienen fila: su nombre ya está en `apoderado` (002) | RF-105 | 2 |
| | `rol_cuenta` | PK `(cuenta_id, rol)`, `rol CHECK IN ('administracion','coordinacion','catequista','familia','supervision')`, `asignado_por`, `asignado_en`. Al quitar un rol se borra la fila y queda el evento en la auditoría. Un trigger impide quitar el último ADM activo (S-09) | RF-102 | 1 |
| | `credencial` | `id uuid PK`, `cuenta_id → cuenta`, `tipo CHECK IN ('equipo','familia')`, `token_hash bytea UNIQUE` (SHA-256 del token del enlace), `estado CHECK IN ('emitida','activa','terminada')`, `dispositivo_id uuid NULL` (equipo: se fija al activar), `emitida_por`, `emitida_en`, `activada_en`, `terminada_en`, `terminada_por`, `motivo_fin CHECK IN ('revocacion','reemision','bloqueo_pin','cuenta_desactivada','cierre_ciclo','sin_vinculos')`. Índice único parcial `(cuenta_id, tipo) WHERE estado <> 'terminada'`: un solo enlace vigente por cuenta y tipo | RF-110, RF-111 | 1 |
| | `sesion_renovacion` | `credencial_id PK → credencial` (solo equipo), `hash_actual bytea`, `hash_anterior bytea NULL` (D-106), `ultima_renovacion timestamptz`, `expira_en timestamptz` (`ultima_renovacion + 14 días`) | RF-112 | 1 |
| `0102_auditoria.sql` | `evento_auditoria` | `id uuid DEFAULT gen_random_uuid()`, `ocurrido_en`, `cuenta_id`, `credencial_id`, `delegacion_id NULL`, `accion text` (por ejemplo `restringido:leer`), `recurso_tipo`, `recurso_id uuid NULL`, `catequizando_id uuid NULL`, `resultado CHECK IN ('permitido','denegado')`, `detalle jsonb` (sin valores de datos restringidos). Índices `(ocurrido_en)`, `(catequizando_id, ocurrido_en)`. `sigecat_api` solo tiene `INSERT, SELECT`. Hay una función `purgar_auditoria(antes)` con `SECURITY DEFINER` | RF-109, RF-102 | 1 |
| `0103_delegacion.sql` | `delegacion` | `id uuid PK`, `delegante_id → cuenta`, `delegado_id → cuenta`, `desde timestamptz`, `hasta timestamptz`, `CHECK (hasta > desde)`, `CHECK (delegante_id <> delegado_id)`, `creada_en`, `revocada_en NULL`, `revocada_por NULL`, `terminada_por_cierre bool DEFAULT false`. Índice `(delegado_id, desde, hasta)` | RF-104 | 2 |
| `0104_consentimiento.sql` | `texto_consentimiento` | `id uuid PK`, `version text UNIQUE`, `contenido text`, `contenido_sha256 bytea`, `vigente_desde`, `incluye_clausula_constancia bool NOT NULL CHECK (incluye_clausula_constancia)`. Solo inserción. La versión 1 se siembra en esta misma migración (S-17) | RF-106 | 1 (S-12) |
| | `consentimiento` | `id uuid PK` (cliente), `catequizando_id uuid NOT NULL` (FK que agrega 002), `apoderado_id uuid NOT NULL` (FK que agrega 002), `texto_id → texto_consentimiento`, `otorgado_en`, `canal CHECK IN ('presencial','enlace')`, `registrado_por → cuenta`, `retirado_en NULL`, `retirado_por NULL`, `canal_retiro NULL` | RF-106 | 1 (S-12) |
| `0105_retencion.sql` | `ejecucion_retencion` | `id`, `tipo CHECK IN ('retiro_consentimiento','vencimiento_ciclo')`, `objetivo_id uuid` (niño o ciclo), `iniciada_en`, `completada_en NULL`, `resumen jsonb` (conteos por participante). `UNIQUE (tipo, objetivo_id)` para que sea idempotente | RF-106, RF-108 | 3 |
| | `borrado_blob_pendiente` | `id`, `ejecucion_id → ejecucion_retencion`, `contenedor`, `ruta`, `intentos int`, `ultimo_error`, `creado_en`, `completado_en NULL` (bandeja de salida, D-110) | RF-106, RF-108 | 3 |
| `0107_aviso_grupo.sql` | `aviso_grupo` | `id uuid PK` (cliente), `grupo_id uuid` (FK que agrega 002), `autor_id → cuenta`, `texto text CHECK (length(texto) BETWEEN 1 AND 500)`, `publicado_en`, `retirado_en NULL`, columnas sync de 003; colección local `avisos_grupo` | RF-103 | 2 |
| `0106_aviso_coordinacion.sql` | `aviso_coordinacion` | `id`, `tipo CHECK IN ('pendientes_rechazados')`, `cuenta_relacionada_id`, `cantidad int`, `creado_en`, `leido_en NULL`, `leido_por NULL` | RF-112 | 1 |

Dependencias de esquema con otros planes:
- 002 crea `grupo_catequista.cuenta_id → cuenta` y `apoderado.cuenta_id → cuenta`, y agrega las FK `consentimiento → catequizando/apoderado` y `aviso_grupo → grupo`.
- 008 llama a los servicios de cierre (§5.4).

### 3.3 Almacén local

**WatermelonDB.** El esquema y las migraciones locales son del plan 003. Este plan solo aporta:

| Tabla local | Columnas | Sentido | RF |
| --- | --- | --- | --- |
| `avisos_grupo` | `id`, `grupo_id`, `texto`, `autor_visible` (es la `identidad_operativa` que manda el servidor; nunca el nombre real), `publicado_en` | Solo pull | RF-103, RF-105 |

**Exigencias de seguridad para el esquema local de 003** (las verifica el test `RNF-101` de la §9):
1. Ninguna columna local coincide con un campo `restringido` del catálogo de datos (§4).
2. Todo registro pendiente lleva `cuenta_id` y `credencial_id` del autor (RF-112, RNF-102).
3. Existe la operación `purgarExceptoPendientes(cuentaId)` (RNF-102).

**`expo-secure-store`** (no WatermelonDB, porque son secretos):

| Clave | Contenido | RF |
| --- | --- | --- |
| `sigecat.dispositivo` | `dispositivoId` (UUID generado una vez) | RF-111 |
| `sigecat.cuentas` | Lista de `cuentaId` registradas en este celular | RNF-102 |
| `sigecat.sesion.<cuentaId>` | JSON con `credencialId`, `tokenRenovacion`, `ultimaRenovacionServidor`, `instanteMaximoVisto`, `pinSal`, `pinHash`, `intentosFallidos`, `bloqueada` y `contexto` (roles e ids de grupos y niños, sin nombres). Pesa menos de 2 KB | RF-111, RF-112 |

La copia de seguridad automática de Android debe excluir SecureStore (opción del config plugin de `expo-secure-store`; se verifica en la documentación v57 al implementar).

**Web (familias).** No se persiste nada: ni token ni datos (D-117).

---

## 4. Lógica de dominio en `src/lib/seguridad/` (TS puro)

`src/lib/domain/roles.ts` se **mueve** a `src/lib/seguridad/roles.ts`. Se renombra `admin` a `administracion`, se agrega `supervision` y `SesionUsuario` pasa a ser `ContextoAcceso`. El archivo viejo reexporta lo nuevo con `@deprecated` hasta que ningún plan lo importe. De `src/lib/domain/modelo.ts` se mueven a este módulo `Usuario` (que pasa a ser `Cuenta`, sin `telefono` ni `correo`), `IdentidadReal` y `Consentimiento`. El resto lo mueven sus dueños.

| Archivo | Contenido (firmas ilustrativas) | RF |
| --- | --- | --- |
| `roles.ts` | `ROLES = ['administracion','coordinacion','catequista','familia','supervision'] as const`; `type Rol`; `esRolEquipo(rol)` | RF-102 |
| `contexto-acceso.ts` | `type ContextoAcceso = { cuentaId; credencialId; dispositivoId?; rolesPropios: Rol[]; delegacionVigente?: { id; hasta }; gruposAsignados: string[]; catequizandosApoderados: string[]; esMenor: boolean }`; `rolesEfectivos(ctx): Rol[]` (agrega `coordinacion` si hay una delegación vigente) | RF-102, RF-104 |
| `matriz-permisos.ts` | Tabla declarativa `Accion × Rol → Alcance` con alcances `'ciclo' \| 'grupos' \| 'apoderados' \| 'ninguno'`. Incluye las acciones de todos los módulos (cada plan agrega sus filas por PR que revisa el dueño de seguridad). Ejemplos: `nomina:leer` (CAT: ciclo, solo nombre y grupo), `asistencia:escanear` (CAT: ciclo), `asistencia:pasar-lista` (CAT: ciclo), `restringido:leer` (COORD: ciclo; CAT: grupos), `evidencia:leer` (COORD y SUP: ciclo; CAT: grupos), `justificacion:leer`, `avance:leer`, `aptitud:leer`, `aviso:publicar` (COORD), `cuentas:gestionar` (ADM; COORD solo para CAT y FAM), `roles:asignar-equipo` (ADM), `identidad-real:leer` (ADM), `delegacion:gestionar` (COORD-propia y ADM, S-02), `consentimiento:registrar` y `consentimiento:retirar` | RF-102, RF-103, RF-107 |
| `autorizacion.ts` | `autorizar(ctx, accion, recurso?: { grupoId?; catequizandoId? }): Decision`, con `Decision = { permitido: true; alcance } \| { permitido: false; motivo }`. Une los alcances de todos los roles efectivos. Para FAM compara `catequizandoId`, para CAT compara `grupoId`. **Ninguna acción de escritura se concede a SUP** (invariante con test) | RF-102, RF-107 |
| `delegacion.ts` | `delegacionVigente(delegaciones, ahora)`, `validarNuevaDelegacion({ delegante, delegado, desde, hasta }, ctx)`: exige `hasta > desde`, impide delegarse a sí mismo y la redelegación (S-02). No mira `esMenor` | RF-104 |
| `seudonimo.ts` | `nombreVisible(cuenta): string`, que siempre devuelve `identidad_operativa`. `validarAlta({ esMenor, identidadOperativa })`: si es menor, la identidad operativa es obligatoria y distinta del nombre real. `esMenorAlInicioDeCiclo(fechaNacimiento, inicioCiclo)` (S-05) | RF-105 |
| `enlaces.ts` | `construirUrlEnlace(base, tipo, token)` genera `https://<web>/acceso/<tipo>#t=<token>`. `extraerTokenDeUrl(url)`. `LONGITUD_TOKEN_BYTES = 32` | RF-110, RF-111 |
| `pin.ts` | `validarFormatoPin(pin)` (4 a 6 dígitos). `verificadorPin(pin, sal, hash: (s) => Promise<string>)`, con la función de hash inyectada (en el celular, `expo-crypto`). `INTENTOS_MAXIMOS = 5`. `registrarIntento(estado, correcto): EstadoPin` | RF-111 |
| `sesion-local.ts` | `estadoSesionLocal({ ahoraDispositivo, instanteMaximoVisto, ultimaRenovacion, intentosFallidos, bloqueada }): 'operativa' \| 'requiere-conexion' \| 'bloqueada'`. Vence a los 14 días de la última renovación y usa `max(ahora, instanteMaximoVisto)` para que atrasar el reloj no extienda la sesión. `puedeRegistrarSinConexion(estado)`. `DIAS_SESION_SIN_CONEXION = 14` | RF-112 |
| `reconexion.ts` | `alReconectar(puertos: { renovar; contarPendientes; enviarPendientes; descartarPendientes })` siempre renueva primero. Si la renovación responde `credencial_terminada`, informa el conteo, descarta los pendientes y devuelve `{ rechazados: n }`. Si responde OK, envía los pendientes | RF-112 |
| `cierre-sesion.ts` | `planCierreSesion(cuentaId): Paso[]`: purgar los datos de niños salvo los pendientes de `cuentaId`, borrar el JWT en memoria y conservar la credencial protegida por el PIN (D-118) | RNF-102 |
| `catalogo-datos.ts` | `CATALOGO: { entidad; campo; clasificacion: 'operativo' \| 'restringido' \| 'identidad-equipo'; finalidad: 'formar-grupos' \| 'aptitud' \| 'operacion' \| 'contacto' }[]`. Lo pueblan los planes dueños de cada entidad (002 los campos del niño). `camposRestringidos()` | RF-107, RNF-101 |
| `consentimiento.ts` | `inscripcionTieneConsentimiento(consentimientos)`, que exige al menos uno vigente (S-15). `efectoRetiro(): { borrar: ['restringido','documentos','evidencias','avance']; conservar: ['asistencia-anonimizada','constancia'] }`. `textoCumpleRequisitos(texto)` comprueba la cláusula de constancia | RF-106 |
| `retencion.ts` | `fechaVencimientoRetencion(cierreCiclo)` = cierre + 2 años calendario (29-feb pasa a 28-feb). `ciclosPorAnonimizar(ciclos, hoy, yaEjecutados)`. `DIAS_CONSERVACION_AUDITORIA = 730` (S-08) | RF-108, RF-109 |
| `avisos.ts` (en `src/lib/avisos/`) | `validarAviso(texto)` (1 a 500 caracteres), `avisosVisibles(avisos, ctx)` | RF-103 |

Los tipos de petición y respuesta de la API de seguridad van en `src/lib/seguridad/contratos.ts` y los usan la app y la API.

---

## 5. API

### 5.1 Estructura y middleware

- **Function App** (`api/`, Node 22 LTS, modelo v4, D-111). `api/src/index.ts` registra las Functions de todos los módulos. esbuild empaqueta `api/src` + `src/lib` (alias `@/lib`) en `dist/index.js`.
- **Módulos.** `api/src/modulos/<modulo>/{dominio,aplicacion,infraestructura,http}`. Este plan crea `seguridad` y `avisos`, y la carpeta `api/src/compartido/` (BD, HTTP, configuración, reloj y registro de logs).
- **Middleware `conAcceso`** (`api/src/compartido/http/con-acceso.ts`), que usan **todas** las Functions de todos los módulos:

```ts
// Firma ilustrativa
conAcceso(opciones: { accion: Accion; recurso?: (req) => Promise<RecursoAlcance> },
          manejador: (req, ctx: ContextoAcceso, inv) => Promise<HttpResponseInit>)
```

1. Verifica el JWT (`jose`, HS256, `iss`, `aud` y `exp`; D-105). Si falla, responde 401 `{ codigo: 'acceso_denegado' }`.
2. Carga el `ContextoAcceso` **de la BD en cada petición** con una sola consulta. Comprueba que la cuenta esté activa, que la credencial no esté terminada y que el dispositivo coincida. Trae roles, delegación vigente (con `now()` de la BD), `gruposACargo` y `alcanceFamilia` (puertos de 002). Si algo falla, responde 401 genérico (RF-101, D-104).
3. `autorizar(ctx, accion, recurso)`. Si se deniega, inserta un `evento_auditoria` con `resultado='denegado'` y responde 403 `{ codigo: 'fuera_de_alcance' }` (RF-102, criterio de finalización).
4. Ejecuta el manejador. `auditar(ctx, evento)` está disponible para lecturas y escrituras de datos restringidos. Si el registro de auditoría falla, la petición falla (D-109).
5. Las respuestas que marque el manejador como restringidas salen con `Cache-Control: no-store`. El registrador de logs nunca escribe cuerpos de petición ni de respuesta.

- **Validación de entrada** con `zod` en la capa `http`. Un objeto con campos desconocidos se rechaza con 422 (RF-107).
- **Puertos que expone `seguridad` a otros módulos** (llamadas internas, no HTTP): `auditar`, `registrarConsentimiento(tx, datos)`, `crearCuentaFamilia(tx, apoderadoId)`, `emitirEnlace(cuentaId, tipo)`, `revocarEnlace(cuentaId, motivo)`, `terminarDelegacionesVigentes()`, `revocarEnlacesFamilia(cuentaIds)`, `recalcularMinoria(inicioCiclo)`, `registrarParticipanteRetencion(participante)` y `crearAvisoCoordinacion(tipo, datos)`.

### 5.2 Endpoints

Base pública: `https://<apim>.azure-api.net/v1`. Todas las rutas usan HTTPS (RNF-103).

| Método y ruta | Autorización | Comportamiento | RF | Fase |
| --- | --- | --- | --- | --- |
| `POST /acceso/equipo/activar` | Anónima; el token del enlace va en el cuerpo | Recibe `{ token, dispositivoId }`. Busca por `sha256(token)`. Si la credencial es de tipo equipo, está `emitida` (o `activa` con el mismo `dispositivoId`, para reintentos) y la cuenta está activa, la ata al dispositivo y devuelve `{ jwt (15 min), tokenRenovacion, ultimaRenovacion, contexto }`. En cualquier otro caso responde **401 idéntico** | RF-101, RF-111 | 1 |
| `POST /acceso/familia/entrar` | Anónima | Recibe `{ token }`. Con una credencial de tipo familia no terminada devuelve `{ jwt (30 min), contexto }`. No está atada al dispositivo: un enlace reenviado entra como ese apoderado (caso límite). Si no, 401 idéntico | RF-101, RF-110 | 1 |
| `POST /acceso/renovar` | Anónima; el token de renovación va en el cuerpo | Recibe `{ tokenRenovacion, dispositivoId, pendientes?: number }`. Acepta `hash_actual` o `hash_anterior` (D-106) y rota el token. Si la credencial está terminada o la cuenta desactivada, responde 401 `{ codigo: 'credencial_terminada' }` y, si `pendientes > 0`, crea un `aviso_coordinacion` de tipo `pendientes_rechazados` con la cantidad. Un token vencido se acepta dentro de la ventana de reconexión (S-13) | RF-112, RF-101 | 1 |
| `POST /acceso/bloqueo` | Anónima; token de renovación | El celular lo manda cuando llega al 5.º PIN fallido y tiene red. Termina la credencial con `motivo_fin='bloqueo_pin'`. Si no hay red, el bloqueo local basta (§6.2) | RF-111 | 1 |
| `GET /yo` | Cualquier cuenta | Devuelve el contexto y los roles efectivos, con `identidadOperativa` y la delegación vigente (HTTP camelCase) | RF-102, RF-104 | 1 |
| `POST /cuentas` | ADM; COORD solo para cuentas CAT o FAM | Recibe `{ id, identidadOperativa, esMenor, roles, identidadReal? }`. La identidad real se guarda con `guardar_identidad_real`, a la que COORD puede escribir pero no leer. Es idempotente por `id` | RF-102, RF-105, RNF-105 | 1 |
| `GET /cuentas`, `GET /cuentas/{id}` | ADM; COORD (solo cuentas CAT o FAM) | Siempre muestran la `identidad_operativa` | RF-105 | 1 |
| `GET /cuentas/{id}/identidad-real` | Solo ADM | Lee con `leer_identidad_real` y audita la lectura | RF-105, RF-109 | 2 |
| `PUT /cuentas/{id}/roles` | ADM (todos los roles); COORD (solo `catequista` y `familia`) | Reemplaza el conjunto de roles y lo audita. El trigger impide quitar el último ADM | RF-102 | 1 |
| `POST /cuentas/{id}/desactivar` | ADM; COORD (solo CAT o FAM) | Pone `activa=false`, termina sus credenciales con `motivo_fin='cuenta_desactivada'` y conserva sus registros con el seudónimo | RF-101 | 1 |
| `POST /cuentas/{id}/enlaces` | ADM; COORD (solo CAT o FAM) | Recibe `{ tipo }`. Termina la credencial anterior de ese tipo (`reemision`), crea una nueva y devuelve **una sola vez** `{ url }`. El servidor solo guarda el hash del token | RF-110, RF-111, RNF-104 | 1 |
| `POST /cuentas/{id}/enlaces/revocar` | ADM; COORD (solo CAT o FAM) | Termina la credencial vigente (`revocacion`). Surte efecto en la siguiente petición (paso 2 del middleware) | RF-110, RF-111 | 1 |
| `GET /delegaciones`, `POST /delegaciones` | `delegacion:gestionar` (COORD-propia, ADM) | Recibe `{ id, delegadoId, desde, hasta }`. Es idempotente y se audita | RF-104 | 2 |
| `POST /delegaciones/{id}/revocar` | `delegacion:gestionar` | Fija `revocada_en`. Surte efecto en la siguiente petición del delegado | RF-104 | 2 |
| `GET /consentimientos/texto-vigente` | COORD; FAM | Devuelve la última versión vigente | RF-106 | 1 (S-12) |
| `POST /consentimientos` | COORD (presencial); FAM(n) (por enlace, fase 3) | Recibe `{ id, catequizandoId, apoderadoId, textoId, canal }`. 002 también lo llama en proceso dentro de la transacción de inscripción | RF-106 | 1 (S-12) |
| `POST /consentimientos/{id}/retirar` | COORD; FAM(n) | Marca el retiro y, **en la misma transacción**, ejecuta `motorRetencion.retirarConsentimiento(catequizandoId)`. Los blobs a borrar pasan a la bandeja y se borran justo después del commit | RF-106 | 3 |
| `GET /auditoria?catequizandoId&desde&hasta` | Solo ADM (S-08) | Lista eventos con `nombreVisible` del autor (seudónimo) | RF-109, RF-105 | 3 |
| `POST /avisos` | `aviso:publicar` (COORD) | Recibe `{ id, grupoId, texto }`. Se distribuye a los celulares por el pull de sincronización de 003 | RF-103 | 2 |
| `POST /avisos/{id}/retirar` | COORD | Retira el aviso | RF-103 | 2 |
| `GET /avisos-coordinacion`, `POST /avisos-coordinacion/{id}/leido` | COORD | Avisos del sistema, por ejemplo los pendientes rechazados | RF-112 | 1 |

**Temporizadores** (Functions de temporizador; cron en UTC, Lima = UTC−5):

| Function | Cron | Qué hace | RF | Fase |
| --- | --- | --- | --- | --- |
| `retencionDiaria` | `0 0 8 * * *` (03:00 Lima) | Aplica `ciclosPorAnonimizar` y, para cada ciclo vencido, `motorRetencion.vencerCiclo(cicloId)` en una transacción con `SET LOCAL ROLE sigecat_retencion`. Es idempotente por `ejecucion_retencion` | RF-108 | 3 |
| `borradosPendientes` | `0 */15 * * * *` | Reintenta la bandeja `borrado_blob_pendiente` con el puerto de borrado del plan 004 | RF-106, RF-108 | 3 |
| `purgaAuditoria` | `0 0 9 1 * *` (mensual) | Ejecuta `purgar_auditoria(now() - 730 días)` | RF-109 | 3 |

**Motor de retención** (`api/src/modulos/seguridad/aplicacion/motor-retencion.ts`). Cada módulo registra al arrancar un participante:

```ts
interface ParticipanteRetencion {
  nombre: string;                                   // 'catequizandos', 'justificaciones', ...
  alRetirarConsentimiento(catequizandoId: string, tx: Tx): Promise<{ blobs: RefBlob[] }>;
  alVencerCiclo(cicloId: string, tx: Tx): Promise<{ blobs: RefBlob[] }>;
}
```

El motor:
1. Abre una sola transacción (o usa la del retiro) y fija rol `sigecat_retencion` y contexto `retiro_consentimiento`/`retencion` con `SET LOCAL`, en ambas operaciones.
2. Ejecuta los participantes en orden de registro.
3. Guarda `ejecucion_retencion` con los conteos y encola los blobs.
4. Si algún participante falla, deshace todo.

El participante propio de `seguridad` hace lo siguiente al vencer un ciclo:
- borra `identidad_real` de las cuentas desactivadas que no participan en ciclos posteriores;
- termina las credenciales de familia de los apoderados que se quedan sin vínculos.

Lo que hace cada participante lo define su plan. 002 borra condiciones, estados de documentos e historial personal, cierra inscripción/asignación/vínculos, invalida carné y anonimiza perfil, excluyéndolo como inactivo de nómina. El apoderado se elimina/anonimiza solo si no tiene otros hijos vinculados. 003 conserva asistencia anonimizada y elimina datos personales en códigos/avisos. 004 borra evidencias; 005–008 registran sus participantes cuando se integran; no se afirma que estén implementados. La constancia sacramental se conserva. El agente de seguridad implementa el motor y sus puertos; cada dueño implementa y registra su participante.

### 5.3 APIM (Consumo)

APIM Consumo no ofrece `rate-limit-by-key` (solo `rate-limit` por suscripción); `validate-jwt` y `cors` sí están disponibles en Consumo.

| Política | Ámbito | Detalle | RF |
| --- | --- | --- | --- |
| Un solo API con operaciones comodín | API `sigecat` | Operaciones `GET\|POST\|PUT\|PATCH\|DELETE /*` hacia el backend `https://<func>.azurewebsites.net/api`. Los demás planes no tocan APIM para agregar rutas (D-116) | — |
| `cors` | Global (no a nivel de producto; ver la nota de la documentación sobre la clave de suscripción en encabezado) | Origen permitido: el dominio de Static Web Apps (más `http://localhost:8081` solo en el parámetro de desarrollo). Encabezados `authorization`, `content-type` y `ocp-apim-subscription-key` | RNF-103 |
| `validate-jwt` | API, salvo `POST /acceso/*` (con `<choose>` sobre la ruta) | HS256 con la clave en el valor con nombre `jwt-clave` (referencia a Key Vault). Exige `exp`, `iss=sigecat` y `aud=sigecat-api` y responde 401 genérico. Es un rechazo temprano; la Function vuelve a validar | RF-101 |
| `rate-limit` | Productos `app-movil` y `web-familias` (una clave de suscripción por cliente, que no es secreta) | Tope global por cliente, por ejemplo 1 200 llamadas cada 60 s en la app y 300 en la web (parámetros de Bicep). Protege el costo. Los límites **por llamante** (como el que pide el plan 002 para `GET /apoderados`) **no existen en Consumo** y se implementan en la Function | RNF-104 |
| `set-header x-functions-key` | Global | Usa la clave de host desde Key Vault. Las Functions tienen `authLevel: 'function'`, así que solo APIM puede llamarlas | RF-101 |
| Sin registro de cuerpos | Global | El diagnóstico de APIM guarda 0 bytes de cuerpo | RNF-101 |

### 5.4 Servicios para el cierre de ciclo (los llama el plan 008)

Los límites por cuenta usan contador PostgreSQL compartido con clave `(cuenta_id, operacion, ventana)` e incremento atómico; nunca un contador de memoria por instancia. La Function devuelve 429 al excederlo. APIM mantiene solamente el tope global por cliente/producto.

| Servicio | Efecto | RF de origen |
| --- | --- | --- |
| `terminarDelegacionesVigentes()` | `revocada_en = now()` y `terminada_por_cierre = true` | RF-802 (008), RF-104 |
| `revocarEnlacesFamilia(cuentaIds)` | Termina credenciales con `motivo_fin='cierre_ciclo'` | RF-110, RF-802 |
| `recalcularMinoria(inicioNuevoCiclo)` | Actualiza `es_menor` (S-05) | RF-105 |

---

## 6. Cliente

### 6.1 Convenciones de carpetas y rutas (válidas para todos los planes)

- `src/app/` contiene las rutas. Hay dos grupos de rutas con guardas **solo de presentación** (`Stack.Protected` con `guard`; `redirectTo` exige SDK 58, así que no se usa):
  - `src/app/(equipo)/…`, para cualquier rol de EQUIPO con una sesión local `operativa` o en línea;
  - `src/app/(familia)/…`, para una sesión de familia.
  
  Las URL no incluyen el grupo. Los planes que escribieron `src/app/coordinacion/...` mueven el archivo a `src/app/(equipo)/coordinacion/...` y la URL no cambia. Las rutas actuales `asistencia.tsx`, `coordinacion.tsx` y `familia.tsx` se mueven a su grupo.
- `src/components/<modulo>/` contiene los componentes. `src/plataforma/<modulo>/` contiene los adaptadores que importan Expo o RN (SecureStore, cliente HTTP, NetInfo, repositorios WatermelonDB). `src/lib/<modulo>/` contiene la lógica pura.
- El cliente HTTP (`src/plataforma/api/cliente.ts`, que es el `cmpClienteAPI` del C4) inyecta el JWT y la clave de suscripción. Ante un 401 renueva una vez y reintenta. Si responde `credencial_terminada`, lleva a `acceso/sin-acceso`.

### 6.2 Pantallas

| Ruta | Quién | Sin conexión | Comportamiento | RF |
| --- | --- | --- | --- | --- |
| `src/app/index.tsx` (evoluciona) | Todos | Sí | Sin sesión, muestra "Abre tu enlace personal" (y en Android, "pegar enlace"). Con sesión, redirige al inicio de su rol. En la web sin enlace, muestra el mismo texto | RF-101 |
| `src/app/acceso/equipo.tsx` | Nueva cuenta de EQUIPO | **No** (la activación necesita red) | La abre el App Link `https://<web>/acceso/equipo#t=…`. Lee el token con `expo-linking`, llama a `activar` y pasa a `fijar-pin`. Guarda la credencial en SecureStore **solo después** de fijar el PIN; si la app se cierra antes, reabrir el mismo enlace en el mismo celular vuelve a funcionar (activar es idempotente por `dispositivoId`). Si se abre en un navegador de escritorio o en un celular sin la app, muestra cómo instalarla | RF-111 |
| `src/app/acceso/fijar-pin.tsx` | EQUIPO | Sí | Pide el PIN dos veces (`validarFormatoPin`) y guarda `pinSal` y `pinHash` (D-103) | RF-111 |
| `src/app/acceso/desbloquear.tsx` | EQUIPO | **Sí** | Teclado de PIN y `estadoSesionLocal`. Muestra "Te quedan N días sin conexión". Al 5.º fallo: borra el token de renovación y el verificador, marca `bloqueada`, llama a `/acceso/bloqueo` si hay red y muestra "Pide un enlace nuevo a la coordinación". Si la sesión está en `requiere-conexion`, solo deja consultar y avisa que debe conectarse para registrar | RF-111, RF-112 |
| `src/app/acceso/familia.tsx` | FAM (web, Expo web) | No | Lee `#t=`, llama a `entrar`, borra el fragmento de la URL (`history.replaceState`) y reemplaza la ruta por `(familia)/`. El token del enlace queda solo en memoria para volver a entrar cuando venza el JWT | RF-110 |
| `src/app/acceso/sin-acceso.tsx` | Todos | Sí | Muestra el mismo mensaje genérico para enlace inválido, revocado o cuenta desactivada. Si hubo pendientes rechazados, dice "N registros no pudieron enviarse" | RF-101, RF-112 |
| `src/app/(equipo)/cuentas/index.tsx`, `nueva.tsx`, `[id].tsx` | ADM; COORD (CAT o FAM) | No | Alta (con UUID local), roles, desactivar, **generar o revocar enlace**. El enlace se comparte con `Share.share` del núcleo de RN (WhatsApp u otro canal), sin costo. La identidad real es un campo que se puede escribir pero no leer, salvo para ADM | RF-102, RF-105, RF-110, RF-111, RNF-104, RNF-105 |
| `src/app/(equipo)/delegaciones/index.tsx`, `nueva.tsx` | COORD-propia, ADM | No | Lista las delegaciones vigentes y pasadas, con quién delegó, a quién, el periodo y la revocación. Crea una delegación eligiendo catequista y fechas (`hasta` = fin del día en Lima) y permite revocarla | RF-104, RNF-105 |
| `src/components/seguridad/consentimiento.tsx` | COORD (presencial) | No | Componente que usa el asistente de inscripción de 002: muestra el texto vigente completo y un botón "El apoderado acepta" | RF-106 |
| `src/app/(equipo)/consentimiento/[catequizandoId].tsx` | COORD | No | Muestra el historial de consentimientos y el botón **Retirar consentimiento**, que avisa de forma explícita qué se borra | RF-106 |
| `src/app/(familia)/consentimiento.tsx` | FAM(n) | No | Muestra el consentimiento y permite retirarlo desde el enlace (fase 3) | RF-106 |
| `src/app/(equipo)/avisos/…` | COORD publica; CAT(g) lee | Lectura sí (vienen por sync); publicación no | | RF-103 |
| `src/app/(equipo)/avisos-sistema.tsx` | COORD | No | Muestra "Se rechazaron N registros del celular de <seudónimo>" | RF-112 |
| `src/app/(equipo)/ajustes.tsx` | EQUIPO | Sí | **Cerrar sesión**: llama a `purgarExceptoPendientes(cuentaId)` (003) y borra el JWT. Conserva la credencial y el PIN para que esa misma cuenta pueda volver a entrar con su PIN (D-118) | RNF-102 |
| `src/app/(equipo)/auditoria.tsx` | ADM | No | Consulta de auditoría (fase 3) | RF-109 |

### 6.3 Comportamiento sin conexión

| Situación | Comportamiento | RF |
| --- | --- | --- |
| Abrir la app sin señal, sesión renovada hace menos de 14 días | El PIN desbloquea. Se registra asistencia contra WatermelonDB y cada pendiente lleva `cuenta_id` y `credencial_id` | RF-112 |
| Más de 14 días sin renovar | `requiere-conexion`: se puede consultar lo sincronizado, pero no hacer registros nuevos | RF-112 |
| Vuelve la conexión (evento NetInfo, plan 003) | El orquestador de sincronización de 003 llama **primero** a `alReconectar` (renovar) y después hace push. Si se rechaza, descarta los pendientes de esa cuenta y muestra el aviso | RF-112 |
| Datos restringidos, evidencias, cuentas, delegación y consentimiento | Solo en línea. Se guardan en el estado del componente; nunca en WatermelonDB ni en SecureStore | RNF-101 |
| Otra cuenta entra en el mismo celular | Solo ve y envía sus propios pendientes. Los de la otra cuenta quedan sin mostrarse hasta que esa cuenta vuelva a entrar con su PIN | RNF-102 |

---

## 7. Decisiones técnicas

### 7.1 Decisiones

| Id | Decisión | Alternativas descartadas | Justificación |
| --- | --- | --- | --- |
| D-101 | Identidad propia en el componente "Seguridad y Control de Acceso": enlace + PIN para EQUIPO y solo enlace para FAM (decisión transversal fija). **Requiere un ADR** que reemplace al "Servicio de Autenticación / Correo" externo del C4 | Microsoft Entra External ID; Firebase Auth; Supabase Auth | La spec prohíbe exigir correo y SMS (RF-111, RNF-104). Un proveedor externo añade otro servicio que administrar y obliga a una identidad por correo o teléfono que los catequistas menores no tienen |
| D-102 | El token del enlace tiene 32 bytes aleatorios (`crypto.randomBytes`) en base64url. Solo se guarda su SHA-256. Viaja en el **fragmento** (`#t=`) de la URL | JWT firmado como enlace; código corto numérico; token en la ruta o en la consulta | 256 bits hacen inútil la fuerza bruta aunque APIM Consumo no limite por IP. El hash protege si se filtra la BD. El fragmento no llega a los logs de Static Web Apps ni al `Referer`. Un JWT no se puede revocar sin una lista |
| D-103 | El PIN se verifica **solo en el celular**: sal aleatoria de 16 bytes + SHA-256 (`expo-crypto`), guardado en SecureStore. El servidor nunca recibe el PIN | PIN verificado en el servidor; PBKDF2 con `@noble/hashes`; `requireAuthentication` de SecureStore | RF-112 exige desbloquear sin red. Quien logre leer SecureStore ya tiene el token de renovación, así que una función de derivación lenta no protege más y añadiría una dependencia. `requireAuthentication` usa la biometría o el bloqueo del sistema, y la spec descarta la biometría |
| D-104 | El `ContextoAcceso` se carga de la BD en cada petición, con una consulta indexada | Roles y alcance como claims en el JWT; caché en memoria por instancia | RF-101, RF-104 y RF-111 exigen que la desactivación, la revocación del enlace y la de la delegación surtan efecto "en la siguiente interacción". Con claims haría falta esperar a que venza el JWT. El volumen (unas decenas de usuarios) lo permite |
| D-105 | JWT HS256 (`jose`), de 15 min para EQUIPO y 30 min para FAM. Se valida en APIM (`validate-jwt`) y en la Function. Clave en Key Vault, con `kid` para rotarla | RS256 con un endpoint JWKS; validar solo en la Function | `validate-jwt` acepta claves simétricas en Consumo y corta temprano el tráfico inválido. Validar dos veces es defensa en profundidad. RS256 exige publicar un JWKS sin aportar nada con un solo emisor |
| D-106 | El token de renovación se rota en cada uso y el servidor acepta el **token anterior** hasta que se use el nuevo | Detección estricta de reutilización que revoca todo | En redes intermitentes la respuesta de renovación se pierde a menudo. La detección estricta dejaría bloqueados a los catequistas en plena misa |
| D-107 | Matriz de permisos declarativa y central (`src/lib/seguridad/matriz-permisos.ts`), compartida por la API (que la impone) y la app (que la usa para mostrar u ocultar) | Comprobaciones a mano en cada módulo; Row Level Security de PostgreSQL como mecanismo principal | Un solo lugar donde revisar RF-102 y RF-107 y probar sus invariantes. RLS complica el pool de conexiones y los tests, y los permisos dependen de reglas de 003 (pasar la lista de cualquier grupo) que se expresan mejor en TS |
| D-108 | `identidad_real` va en una tabla sin GRANT para el rol de la API. Se accede solo con funciones `SECURITY DEFINER` que comprueban ADM en la BD | Columnas en `cuenta`; cifrado por columna | RF-105 pide guardarla separada y mostrarla solo a ADM. Si se olvida una comprobación en código, la BD sigue protegiendo. El cifrado por columna exige gestionar claves sin ganancia frente a la falta de GRANT |
| D-109 | La auditoría es una tabla de PostgreSQL solo de inserción. La lectura de un dato restringido falla si no se pudo auditar (cierre en falla) | Logs de Application Insights; auditoría asíncrona en una cola | Los logs tienen muestreo, retención corta y riesgo de datos personales. Una cola añade un servicio. La spec exige registrar cada consulta |
| D-110 | El motor de retención usa un registro de participantes y una transacción única, con una bandeja de salida para blobs (`borrado_blob_pendiente`) | Un temporizador por módulo; `ON DELETE CASCADE` | El retiro del consentimiento debe ser inmediato y atómico entre módulos. El blob no participa en la transacción de la BD, así que se borra después del commit y se reintenta. Como su fila ya no existe, ningún SAS nuevo puede apuntarlo |
| D-111 | Flex Consumption Linux Node 22: pool `pg` 3 **por proceso**, 1 worker, `maximumInstanceCount=5` **por grupo**, concurrencia HTTP 10, 2048 MB, always-ready 0; timers UTC | Y1 heredado; Premium; pool 4; tope global supuesto | HTTP y timers pueden tener grupos separados: 15 conexiones por grupo no son un tope global de la app. Inventariar grupos, conexiones auxiliares, cuota regional y carga en despliegue. Azure 2026 permite máximo desde 1; 5 es válido (ADR 014) |
| D-112 | PostgreSQL 16 en Flexible Server con acceso público, TLS obligatorio y firewall "permitir servicios de Azure". CI abre una regla temporal para su IP al migrar | Acceso privado con VNet y zona DNS privada | Costo y administración (R23, R24). El riesgo se mitiga con TLS, credenciales en Key Vault y la ausencia de datos de menores en el rol `sigecat_migrador` (que no usa la app) |
| D-113 | Secretos (clave JWT, contraseña de BD, clave de host) en **Key Vault** con referencias desde la Function App y valores con nombre en APIM, usando identidad administrada. CI se autentica en Azure por **OIDC federado**, sin secretos en GitHub | Secretos directos en la configuración de la app; secreto del principal de servicio en GitHub | Rotar sin redeployar y sin secretos de larga vida. Key Vault Standard cuesta céntimos al mes |
| D-114 | Runner de migraciones propio y mínimo (`api/scripts/migrar.ts`, unas 80 líneas con `pg`) con checksum, más una verificación en CI contra `main` | node-pg-migrate; Flyway (Java); Prisma Migrate (ORM) | Se pidió SQL puro numerado. El checksum hace cumplir el principio 6. Las otras opciones traen su propio formato o un runtime extra |
| D-115 | Jest con dos proyectos: `jest-expo` en la raíz para `src/` y Jest + `ts-jest` en `api/`. `npm test` corre el cliente, la API unitaria y la integración con PostgreSQL en Docker. `npm run test:rapido` deja fuera la integración | Vitest; integración opcional que se salta en silencio | Jest es la decisión fija. Saltar en silencio la integración violaría el principio 4: si no hay BD de pruebas, el `globalSetup` falla con un mensaje claro |
| D-116 | APIM con operaciones comodín y la autorización fina en las Functions | Una operación de APIM por endpoint | Ocho módulos tocarían Bicep en cada endpoint. La seguridad real está en `conAcceso`, que se impone en cada Function |
| D-117 | En la web, la sesión de familia vive **solo en memoria**: se canjea el enlace en cada visita | `localStorage`; cookie HttpOnly | SecureStore no existe en la web. El celular de la familia puede ser compartido (RNF-102). Una cookie entre dominios (Static Web Apps → APIM) exige `SameSite=None` y CORS con credenciales. Volver a abrir el enlace de WhatsApp no cuesta nada |
| D-118 | "Cerrar sesión" purga los datos pero **no revoca** la credencial: la cuenta vuelve a entrar con su PIN | Revocar la credencial al cerrar sesión | RNF-102 exige enviar los pendientes "la próxima vez que esa misma cuenta inicie sesión". Si la credencial se revocara, esos pendientes se rechazarían por RF-112 |
| D-119 | Ventana de reconexión: un token de renovación vencido (más de 14 días) se acepta para renovar si la credencial sigue activa y el dispositivo coincide, durante `VENTANA_RECONEXION_DIAS` = 60 (S-13) | Exigir un enlace nuevo al pasar los 14 días | RF-112 dice que se impiden registros "hasta conectarse", es decir, conectarse restablece la sesión. Vale 0 para volver a la lectura estricta |
| D-120 | Los avisos de grupo se distribuyen como una colección de solo pull por la sincronización de 003 | `GET` en línea | Se leen el domingo sin señal (principio 5). Pesan pocos bytes (RNF-304 de 003) |
| D-121 | Un solo entorno en la nube (`prod`) y desarrollo local con Docker (PostgreSQL 16 y Azurite) y Azure Functions Core Tools | Entornos `dev` y `prod` en Azure | Un segundo PostgreSQL duplicaría el costo (R23) |

### 7.2 Dependencias nuevas (hay que justificarlas en la spec antes de instalarlas, principio 1)

| Paquete | Dónde | Para qué |
| --- | --- | --- |
| `expo-secure-store` | App | Credencial y verificador del PIN (decisión fija) |
| `expo-crypto` | App | `randomUUID`, bytes aleatorios y SHA-256 del PIN |
| `jest`, `jest-expo`, `@types/jest`, `@testing-library/react-native` | Raíz (dev) | Tests del cliente y de las guardas de pantallas |
| `@azure/functions` | API | Modelo v4 |
| `pg`, `@types/pg` | API | Acceso a PostgreSQL sin ORM |
| `jose` | API | Firmar y verificar el JWT |
| `zod` | API | Validación estricta de entradas (RF-107) |
| `@azure/storage-blob` | API | Borrado idempotente real de blobs en retención y reintentos; no carga de documentos RF-204 |
| `esbuild`, `typescript`, `ts-jest`, `jest` | API (dev) | Empaquetado que incluye `src/lib` y los tests |
| `tsx`, `@types/node` | API (dev) | Ejecutar scripts TS puros de migración/semillas y tipos Node22; justificados en spec antes de siguiente instalación |
| `@react-native-community/netinfo` | App | La lista el plan 003 (dueño de la conectividad) |

---

## 8. Estructura de archivos propuesta

```
.github/
  workflows/ci.yml                 # PR y push: typecheck, lint, test:rapido, integración (servicio postgres:16), bicep build, migraciones inmutables, cobertura RF
  workflows/despliegue.yml         # push a main: OIDC, bicep what-if + deploy, migrar, functions-action, static-web-apps-deploy
  pull_request_template.md         # recordatorio de Agent Trace y RF cubiertos
infra/
  main.bicep                       # grupo de recursos rg-sigecat-prod
  prod.bicepparam
  modulos/secretos.bicep           # Key Vault (RBAC) + secretos generados
  modulos/almacenamiento.bicep     # Storage: contenedor de despliegue de Flex + contenedor 'evidencias' privado (uso: plan 004)
  modulos/postgres.bicep           # Flexible Server B1ms, PG 16, TLS, firewall servicios Azure, BD 'sigecat'
  modulos/funciones.bicep          # Flex Node 22, pool3/proceso, worker1, max5/grupo, HTTP10, 2048MB, always-ready0, UTC
  modulos/apim.bicep               # Consumo, API comodín, productos, valores con nombre desde Key Vault
  modulos/web.bicep                # Static Web Apps Free
  modulos/monitoreo.bicep          # Application Insights con muestreo, sin cuerpos (ver riesgo R-10)
  politicas/api.xml                # cors, validate-jwt condicional, set-header
  politicas/producto-app.xml       # rate-limit
  politicas/producto-web.xml
api/
  package.json  tsconfig.json  host.json  jest.config.js  esbuild.config.mjs
  local.settings.example.json  docker-compose.yml   # postgres:16 + azurite
  migraciones/0001_base.sql 0101_cuentas_y_credenciales.sql 0102_auditoria.sql
              0103_delegacion.sql 0104_consentimiento.sql 0105_retencion.sql 0106_aviso_coordinacion.sql 0107_aviso_grupo.sql
  scripts/migrar.ts  verificar-migraciones.ts  crear-administracion-inicial.ts  sembrar-demo.ts
  src/index.ts
  src/compartido/{bd/pool.ts, bd/transaccion.ts, http/con-acceso.ts, http/respuestas.ts, config.ts, reloj.ts, registro.ts}
  src/modulos/seguridad/
    dominio/index.ts               # reexporta @/lib/seguridad + tokens.ts (hash y generación, solo servidor)
    aplicacion/{activar-enlace-equipo, entrar-familia, renovar-sesion, reportar-bloqueo, cargar-contexto-acceso,
                gestionar-cuentas, emitir-enlace, revocar-enlace, delegar, revocar-delegacion, auditar,
                registrar-consentimiento, retirar-consentimiento, motor-retencion, servicios-cierre}.ts
    infraestructura/{repositorio-cuentas, repositorio-credenciales, repositorio-delegaciones, repositorio-auditoria,
                     repositorio-consentimientos, repositorio-retencion, firmador-jwt, fuente-alcance}.ts
    http/{acceso, cuentas, delegaciones, consentimientos, auditoria, avisos-coordinacion, temporizadores}.ts
  src/modulos/avisos/{dominio,aplicacion,infraestructura,http}/
  test/unit/<modulo>/  test/http/<modulo>/  test/integracion/<modulo>/  test/e2e/
  test/soporte/{bd-pruebas.ts, global-setup.ts, fabricas.ts, reloj-falso.ts}
src/
  lib/seguridad/{roles, contexto-acceso, matriz-permisos, autorizacion, delegacion, seudonimo, enlaces, pin,
                 sesion-local, reconexion, cierre-sesion, catalogo-datos, consentimiento, retencion, contratos}.ts
  lib/seguridad/__tests__/*.test.ts
  lib/avisos/avisos.ts  lib/avisos/__tests__/
  lib/domain/roles.ts              # reexportación temporal marcada @deprecated
  plataforma/seguridad/{almacen-seguro.ts, sesion.ts, contexto-sesion.tsx}
  plataforma/api/cliente.ts
  app/_layout.tsx                  # Stack.Protected por tipo de sesión
  app/acceso/{equipo, fijar-pin, desbloquear, familia, sin-acceso}.tsx
  app/(equipo)/_layout.tsx  app/(equipo)/{cuentas/…, delegaciones/…, consentimiento/[catequizandoId].tsx, avisos/…, avisos-sistema.tsx, ajustes.tsx, auditoria.tsx}
  app/(familia)/_layout.tsx  app/(familia)/{index.tsx, consentimiento.tsx}
  components/seguridad/{teclado-pin.tsx, consentimiento.tsx, compartir-enlace.tsx}
public/
  .well-known/assetlinks.json      # Android App Links (huella de EAS)
  staticwebapp.config.json         # fallback de navegación, Referrer-Policy: no-referrer, CSP, HSTS
scripts/verificar-cobertura-rf.mjs # RF de specs/*/spec.md frente a nombres de tests
jest.config.js                     # proyecto 'app' con preset jest-expo
```

Cambios en archivos existentes:
- `package.json`: scripts `test`, `test:rapido`, `test:app`, `test:api`, `typecheck` (raíz + `api`), `migrar`.
- `tsconfig.json`: excluye `api/`.
- `eslint.config.js`: agrega `no-restricted-imports` para `src/lib/**` y `api/**`, e ignora `api/dist`.
- `app.json`: agrega `android.package`, `intentFilters` con `autoVerify` para `/acceso/` y el plugin `expo-secure-store`.
- `AGENTS.md`: documenta los comandos nuevos.

---

## 9. Estrategia de tests

### 9.1 Configuración (dueño: este plan)

| Script | Qué corre |
| --- | --- |
| `npm test` | `test:app && test:api`, donde `test:api` = unitarios + HTTP + integración + e2e de la API |
| `npm run test:rapido` | Unitarios de app y API, sin BD |
| `npm --prefix api run test:integracion` | Exige `BD_PRUEBAS_URL`; `docker compose -f api/docker-compose.yml up -d` la levanta |

- La integración crea una BD efímera por ejecución (`sigecat_prueba_<pid>`) y aplica **todas** las migraciones desde cero con el runner real.
- CI usa `services: postgres:16`.
- Cada test se nombra `RF-1xx: …` o `RNF-1xx: …`.

### 9.2 Unitarios de dominio (`src/lib/seguridad/__tests__`, jest-expo)

`autorizacion` (tabla de casos por rol × acción × alcance) · `matriz-permisos` (invariantes) · `delegacion` · `seudonimo` · `pin` · `sesion-local` (reloj inyectado, días límite y reloj atrasado) · `reconexion` (puertos falsos que registran el orden de las llamadas) · `cierre-sesion` · `catalogo-datos` · `consentimiento` · `retencion` (fechas límite, 29 de febrero) · `avisos`.

### 9.3 Contrato de repositorios (`api/test/integracion/seguridad`, PostgreSQL real)

- Unicidad de una credencial vigente por cuenta y tipo.
- Trigger del último ADM.
- `sigecat_api` no puede `SELECT` en `identidad_real` y sí puede llamar a `leer_identidad_real` solo como ADM.
- `sigecat_api` no puede `UPDATE` ni `DELETE` en `evento_auditoria`.
- Consulta de `ContextoAcceso` con una delegación en el borde de `hasta`.
- Idempotencia por UUID.
- `ejecucion_retencion` única.
- Runner de migraciones: aplica desde cero y detecta un checksum alterado.

### 9.4 HTTP de cada Function (`api/test/http`)

Cada handler se invoca con `HttpRequest` de `@azure/functions` sobre la BD de pruebas.

Por cada endpoint de la §5.2 se prueba:
- el camino feliz;
- 401 sin token o con token inválido, con cuerpo idéntico;
- 403 fuera de alcance, que además genera un evento denegado;
- 422 con un campo desconocido.

Los temporizadores se prueban con reloj falso.

### 9.5 Extremo a extremo

- **API (`api/test/e2e/flujo-acceso.test.ts`).**
  1. ADM inicial (con el script de semilla).
  2. Crea un COORD y emite su enlace.
  3. El COORD activa el enlace y crea un CAT menor con seudónimo.
  4. El CAT activa su enlace y lee lo de su grupo.
  5. El CAT recibe 403 en otro grupo, que queda auditado.
  6. El COORD delega al CAT; el CAT lee datos restringidos; se revoca la delegación y el CAT recibe 403 en la petición siguiente.
  7. Se revoca el enlace del CAT; `renovar` con `pendientes: 3` responde 401 y crea un aviso con cantidad 3.
  8. FAM entra con su enlace y ve solo a sus hijos; se revoca y su siguiente petición responde 401.
- **Cliente (`src/plataforma/seguridad/__tests__/flujo-sesion.test.tsx`).** Usa SecureStore simulado y un servidor falso.
  1. Activar el enlace y fijar el PIN.
  2. Desbloquear sin red el día 13 (pasa) y el día 15 (`requiere-conexion`).
  3. Cinco PIN incorrectos llevan a `bloqueada` sin token.
  4. Cerrar sesión deja solo los pendientes de la cuenta.
  5. Al reconectar, la renovación ocurre antes del push.
- **Manual en dispositivo** (lista en `tasks.md`): el App Link abre la app, el catequista entra sin correo y la web de familia funciona sin instalar nada.

### 9.6 Cobertura de requisitos

`scripts/verificar-cobertura-rf.mjs` extrae los `RF-NNN` y `RNF-NNN` de cada `spec.md` y los busca en los nombres de los tests. En CI **solo informa** mientras la spec tenga tareas abiertas y **bloquea** cuando se declara terminada (principio 2).

### 9.7 Casos límite de la spec convertidos en tests

| Caso límite | Test |
| --- | --- |
| Catequista asignado a dos grupos | `RF-102: un catequista con dos grupos ve ambos y recibe 403 en un tercero` |
| Catequista que también es apoderado | `RF-102: una cuenta con catequista y familia ve la unión de sus alcances y nada más` |
| Catequista que cumple 18 años durante el ciclo | `RF-105: el seudónimo se mantiene hasta el cierre aunque cumpla 18 (S-05)` |
| Apoderado con varios hijos | `RF-110: un solo enlace de familia ve a todos los hijos vinculados` |
| Dos apoderados para el mismo niño | `RF-110: cada apoderado tiene su propio enlace y revocar uno no afecta al otro` |
| Enlace de familia reenviado | `RF-110: el enlace de familia funciona desde cualquier dispositivo hasta que se revoca` |
| Delegación que se solapa con el regreso de COORD | `RF-104: coordinación y delegado tienen permisos a la vez durante el periodo` |
| Delegación a un catequista menor | `RF-104: un delegado menor de edad lee datos restringidos de todos los grupos durante el periodo` |
| Catequista que deja el equipo | `RF-101: una cuenta desactivada recibe 401 en la petición siguiente` y `RF-105: sus registros siguen mostrando su seudónimo` |
| Cierre de sesión con asistencias sin enviar | `RNF-102: al cerrar sesión solo quedan los pendientes y otra cuenta no los ve ni los envía` |
| Retiro del consentimiento con justificaciones pendientes | `RF-106: al retirar el consentimiento la justificación queda sin evidencia y el blob entra en la bandeja` (con un participante falso de 004) |
| Celular perdido o robado | `RF-112: tras revocar el enlace, los pendientes del celular se rechazan y la coordinación recibe la cantidad` |
| Catequista menor sin correo, en el celular de su madre | `RF-111: el alta y la activación no piden correo ni teléfono` |
| Apoderado al que se le quita el acceso | `RF-110: revocar el enlace de un apoderado no afecta al del otro apoderado` |
| Sesión vencida sin señal en plena misa | `RF-112: el PIN desbloquea sin conexión si no pasaron 14 días desde la última renovación` |

---

## 10. Matriz de cobertura

| Req. | Componentes | Tests (nombre empieza con el id) |
| --- | --- | --- |
| RF-101 | `con-acceso.ts`, `cargar-contexto-acceso`, `activar-enlace-equipo`, `entrar-familia`, `desactivar`, APIM `validate-jwt`, `acceso/sin-acceso.tsx` | `RF-101: sin token responde 401 genérico`; `RF-101: un enlace inexistente, revocado o ya usado en otro celular responde exactamente lo mismo`; `RF-101: una cuenta desactivada recibe 401 en la petición siguiente`; `RF-101: la plantilla compilada aplica validate-jwt a todo salvo /acceso/*` (test sobre el JSON de `bicep build` y `politicas/api.xml`) |
| RF-102 | `roles.ts`, `matriz-permisos.ts`, `autorizacion.ts`, `con-acceso.ts`, `PUT /cuentas/{id}/roles`, `evento_auditoria` | `RF-102: unión de alcances con varios roles`; `RF-102: catequista solo de sus grupos, salvo escaneo y lista de cualquier grupo`; `RF-102: familia solo de sus hijos`; `RF-102: supervisión no tiene ninguna acción de escritura`; `RF-102: una petición fuera de alcance responde 403 y queda registrada` |
| RF-103 | `matriz-permisos.ts` (`asistencia:leer`, `justificacion:leer`, `avance:leer` para CAT(g)), módulo `avisos`, `aviso_grupo` local | `RF-103: CAT(g) puede leer faltas, justificaciones y avance de su grupo sin acción de COORD`; `RF-103: un aviso publicado para un grupo llega a todos sus catequistas y a nadie más`; `RF-103: el aviso muestra el seudónimo del autor` |
| RF-104 | `delegacion.ts`, `contexto-acceso.ts`, `0103_delegacion.sql`, endpoints de delegaciones, pantallas de delegación | `RF-104: el delegado tiene exactamente los permisos de coordinación durante el periodo`; `RF-104: al pasar hasta pierde los permisos sin intervención`; `RF-104: una revocación surte efecto en la petición siguiente`; `RF-104: se registran delegante, delegado, periodo y revocación`; `RF-104: delegar a un menor está permitido` |
| RF-105 | `cuenta.identidad_operativa`, `identidad_real` + funciones `SECURITY DEFINER`, `seudonimo.ts`, `GET /cuentas/{id}/identidad-real` | `RF-105: nombreVisible devuelve siempre la identidad operativa`; `RF-105: sigecat_api no puede leer identidad_real`; `RF-105: solo ADM obtiene la identidad real y la lectura se audita`; `RF-105: la auditoría y los avisos muestran el seudónimo` |
| RF-106 | `texto_consentimiento`, `consentimiento`, `consentimiento.ts`, `registrar-consentimiento`, `retirar-consentimiento`, `motor-retencion`, componente de consentimiento | `RF-106: registrar el consentimiento guarda quién, cuándo y la versión del texto`; `RF-106: el texto vigente incluye la cláusula de constancia sin vencimiento`; `RF-106: al retirarlo, todos los participantes borran en la misma transacción y el niño queda inactivo`; `RF-106: se conservan la asistencia anonimizada y la constancia`; `RF-106: si un participante falla no se borra nada` |
| RF-107 | `catalogo-datos.ts`, `matriz-permisos.ts` (`restringido:*`, `evidencia:leer`), validación `zod` estricta | `RF-107: los datos restringidos solo llegan a COORD, delegado y CAT(g)`; `RF-107: SUP puede leer evidencia y no datos restringidos del perfil`; `RF-107: la API rechaza campos fuera del catálogo`; `RF-107: todo campo personal de las migraciones figura en el catálogo con su finalidad` |
| RF-108 | `retencion.ts`, `motor-retencion`, `retencionDiaria`, `ejecucion_retencion`, `borrado_blob_pendiente` | `RF-108: un ciclo cerrado hace 2 años se anonimiza una sola vez`; `RF-108: un ciclo cerrado hace 2 años menos 1 día no se toca`; `RF-108: la constancia se conserva`; `RF-108: los blobs que fallan se reintentan` |
| RF-109 | `evento_auditoria`, `auditar`, `con-acceso.ts`, `purgaAuditoria`, `GET /auditoria` | `RF-109: crear, modificar y leer un dato restringido deja un evento`; `RF-109: si la auditoría falla, la lectura falla`; `RF-109: la API no puede modificar ni borrar eventos`; `RF-109: la purga elimina solo los eventos de más de 730 días` |
| RF-110 | `credencial` (familia), `emitir-enlace`, `revocar-enlace`, `entrar-familia`, `enlaces.ts`, `acceso/familia.tsx`, `compartir-enlace.tsx` | `RF-110: el alta de un apoderado genera un enlace que se devuelve una sola vez`; `RF-110: un enlace revocado responde 401 y se puede emitir uno nuevo`; `RF-110: el enlace de familia no vence por tiempo`; `RF-110: el cierre de ciclo revoca los enlaces de quienes no se reinscriben`; `RF-110: compartir usa la hoja de compartir del sistema, sin servicio de mensajería` |
| RF-111 | `credencial` (equipo), `activar-enlace-equipo`, `pin.ts`, `fijar-pin.tsx`, `desbloquear.tsx`, `reportar-bloqueo` | `RF-111: la primera activación ata la credencial al dispositivo`; `RF-111: el mismo enlace en otro celular responde 401`; `RF-111: el PIN acepta de 4 a 6 dígitos`; `RF-111: con 5 fallos seguidos el celular queda bloqueado y borra el token`; `RF-111: un enlace reemitido deja sin efecto al anterior en la petición siguiente` |
| RF-112 | `sesion-local.ts`, `reconexion.ts`, `sesion_renovacion`, `renovar-sesion`, `aviso_coordinacion`, `avisos-sistema.tsx` | `RF-112: el PIN desbloquea sin conexión hasta el día 14`; `RF-112: el día 15 se impiden registros nuevos`; `RF-112: atrasar el reloj del celular no extiende la sesión`; `RF-112: al reconectar se renueva antes de enviar`; `RF-112: con la credencial terminada se rechazan los pendientes y COORD recibe la cantidad`; `RF-112: renovar acepta el token anterior hasta que se use el nuevo` |
| RNF-101 | `catalogo-datos.ts`, exigencias al esquema local de 003, `no-store`, registro de logs redactado | `RNF-101: ninguna columna del esquema WatermelonDB es un campo restringido`; `RNF-101: las respuestas restringidas llevan Cache-Control no-store`; `RNF-101: el registro de logs no escribe cuerpos` |
| RNF-102 | `cierre-sesion.ts`, `ajustes.tsx`, `purgarExceptoPendientes` (003), D-118 | `RNF-102: al cerrar sesión quedan solo los pendientes de la cuenta`; `RNF-102: otra cuenta en el mismo celular no ve ni envía pendientes ajenos`; `RNF-102: la misma cuenta envía sus pendientes al volver a entrar` |
| RNF-103 | Bicep (`httpsOnly`, `minTlsVersion 1.2`, `require_secure_transport`), APIM solo HTTPS, Static Web Apps con HSTS | `RNF-103: la plantilla Bicep exige HTTPS y TLS 1.2 en todos los recursos` (test sobre el JSON compilado) |
| RNF-104 | Enlaces con `Share`, sin proveedor de mensajería, sin costo por usuario | `RNF-104: emitir un enlace no llama a ningún servicio externo de mensajería` (las dependencias del caso de uso se reemplazan por falsos y se verifica que no hay llamadas) |
| RNF-105 | Pantallas de cuentas, enlaces, roles y delegación en la app | `RNF-105: COORD crea una cuenta, asigna el rol, genera el enlace y delega desde la app` (test de pantalla con RNTL + servidor falso) |

---

## 11. Dependencias, riesgos, costo y dudas

### 11.1 Dependencias con otras specs

| Spec | Este plan necesita | Este plan entrega |
| --- | --- | --- |
| 002 | Tablas `grupo_catequista` y `vinculo_apoderado`, y los puertos `gruposACargo` y `alcanceFamilia`. Las FK hacia `cuenta`, `consentimiento` y `aviso_grupo`. Entradas del catálogo de datos y participante de retención (condiciones, documentos, perfil) | `cuenta`, credencial de familia, `registrarConsentimiento`, el componente de consentimiento, auditoría, middleware y `identidad_operativa` |
| 003 | Esquema WatermelonDB con `cuenta_id` y `credencial_id` en los pendientes, `purgarExceptoPendientes`, orquestador que llama a `alReconectar` antes del push, colección `aviso_grupo` de solo pull, NetInfo | Sesión local de 14 días, acciones `asistencia:escanear` y `asistencia:pasar-lista` con alcance de ciclo, rechazo de pendientes |
| 004 | Puerto de borrado de blobs y participante de retención (evidencias) | Cuenta de almacenamiento y contenedor privado, identidad administrada con `Storage Blob Data Contributor` y `Storage Blob Delegator` (para SAS de delegación de usuario), `evidencia:leer` para SUP y CAT(g), auditoría de cada SAS emitido |
| 005, 006, 007 | Filas propias en la matriz de permisos y participantes de retención | Middleware, matriz, rol `sigecat_retencion` para sus triggers de inmutabilidad |
| 008 | `ciclo` (inicio y cierre). Llama a los servicios de la §5.4 | Motor de retención (RF-808 lo usa), servicios de cierre |

**Acuerdos ADR y C4 (2026-10-11):** los ADR 011–014 registran enlace/PIN, marcas/contratos, excepción administrativa y configuración Azure. El C4 elimina carga documental RF-204 y contraseña servidor. Las siguientes notas anteriores son referencias históricas para integrar las decisiones; no bloquean su aceptación:
1. ADR 011 acepta identidad propia enlace/PIN local; C4 sin contraseñas servidor ni proveedor externo.
2. ADR 014 sustituye ADR 004 (históricamente accepted) con configuración Azure concreta; despliegue pendiente.
3. ADR 008 vigente trata herramientas IA, no PWA; React Native + Expo y web de familias siguen ADR 001/planes.
4. Observabilidad según ADR 014; ADR 003 ya figura rejected (SigNoz descartado), se conserva histórico. Verificar telemetría sin cuerpos y costo Application Insights.
5. C4 actualizado para Azure y RF-204; build pendiente de integración.

### 11.2 Riesgos

| Id | Riesgo | Mitigación |
| --- | --- | --- |
| R-1 | PostgreSQL B1ms cuesta alrededor de US$ 15–20 al mes cuando terminan los 12 meses gratis (choca con R23) | Usar el crédito de estudiante. Alerta de presupuesto en Bicep (US$ 5). Antes del mes 12, decidir: renovar crédito o migrar a otro proveedor (fuera de alcance) |
| R-2 | Agotar conexiones de PostgreSQL en el pico dominical | D-111: 5 × 1 × 3 por grupo; sumar HTTP, cada timer y conexiones auxiliares. Carga/medición en despliegue pendientes |
| R-3 | Arranque en frío de Flex Consumption el domingo a primera hora | El trabajo es offline-first: el registro no espera al servidor. Si molesta, una instancia siempre lista cuesta dinero, así que solo se activa si la prueba de campo lo exige |
| R-4 | SQLite de WatermelonDB sin cifrar en el celular (el ADR 002 pedía cifrado) | Solo guarda datos operativos (nombre, grupo, asistencia), nunca restringidos (RNF-101). El cifrado es decisión del plan 003 |
| R-5 | Celular robado con root: se puede extraer SecureStore (token de renovación) | COORD revoca el enlace (RF-111). Efecto en la siguiente petición (D-104). La exposición se limita a datos operativos |
| R-6 | Enlace de familia reenviado o filtrado | Lo acepta la spec. La revocación es inmediata. El fragmento evita fugas en logs y en `Referer` |
| R-7 | iOS para el equipo: una compilación nativa exige la cuenta de Apple (US$ 99 al año) | Supuesto S-16 |
| R-8 | Colisiones entre planes paralelos: numeración, `modelo.ts` y rutas | Convenciones de la §3.1 y la §6.1. La reexportación temporal de `roles.ts` y `modelo.ts` |
| R-9 | Un participante de retención no registrado deja datos sin borrar | Test de arranque: cada tabla con `catequizando_id` en las migraciones debe tener un participante que la declare (`RF-106: todas las tablas con catequizando_id tienen participante de retención`) |
| R-10 | Los logs de Application Insights pueden capturar datos personales y generar costo | Muestreo, cuerpos desactivados y un registrador que redacta. Tope diario de ingesta en Bicep |
| R-11 | El fragmento `#t=` podría no llegar a la app con App Links | Verificarlo en la fase 1. La alternativa es `?t=` limpiando la URL en Static Web Apps (`Referrer-Policy: no-referrer`) |

### 11.3 Costo en Azure (región según la política de la suscripción; parámetro `ubicacion`)

| Recurso | Nivel | Costo esperado |
| --- | --- | --- |
| API Management | Consumo | US$ 0 (incluye 1 M de llamadas al mes; el uso estimado es menor de 100 k) |
| Functions | Flex Consumption | US$ 0 dentro de la concesión mensual gratuita (unos 4 temporizadores y el tráfico dominical) |
| PostgreSQL Flexible | B1ms, 32 GB | US$ 0 los primeros 12 meses o con crédito; luego ver R-1 |
| Storage (Blob + despliegue de Flex) | LRS Hot | Menos de US$ 0,50 al mes |
| Static Web Apps | Free | US$ 0 |
| Key Vault | Standard | Céntimos al mes |
| Application Insights | Pago por GB, 5 GB gratis | US$ 0 con un tope diario |
| **Total** | | **Unos US$ 0–1 al mes el primer año**. Mensajes: US$ 0 (RNF-104) |

### 11.4 Dudas `[NECESITA ACLARACIÓN]` y supuestos provisionales

| Id | Duda | Supuesto provisional (reversible) | Cómo se revierte |
| --- | --- | --- | --- |
| S-01 | **[NECESITA ACLARACIÓN]** ¿Qué pasa si COORD falta sin haber delegado? | ADM puede crear una delegación en nombre de COORD (`delegacion:gestionar` para ADM) | Se quita la fila de ADM de la matriz |
| S-02 | **[NECESITA ACLARACIÓN]** ¿Solo COORD delega? ¿Hay un periodo máximo? | Delegan COORD-propia y ADM. El delegado no puede redelegar. `hasta` es obligatorio y no hay máximo. El cierre de ciclo termina las delegaciones | Constante `DIAS_MAXIMOS_DELEGACION` y una fila de la matriz |
| S-03 | **[NECESITA ACLARACIÓN]** ¿Puede haber más de una COORD a la vez? | Sí. El rol es asignable a varias cuentas | Un índice único parcial en una migración nueva |
| S-04 | **[NECESITA ACLARACIÓN]** ¿Qué ve exactamente la familia? | FAM(n) ve asistencia y faltas, sus justificaciones con estado y motivo, el avance formativo, el estado de los documentos (sin números), el grupo y la `identidad_operativa` del catequista. **Nunca** salud ni neurodivergencia (RF-107 no la incluye) | Se editan las filas de FAM en la matriz |
| S-05 | **[NECESITA ACLARACIÓN]** ¿Quién asigna el seudónimo y cómo se forma? ¿Quién registra que un catequista es menor? ¿Qué pasa al cumplir 18? | Quien da de alta (ADM o COORD) registra la fecha de nacimiento (que solo ADM puede leer después) y escribe un seudónimo libre y único. `es_menor` se calcula al inicio del ciclo y queda congelado hasta el cierre, cuando 008 llama a `recalcularMinoria` | Cambiar `esMenorAlInicioDeCiclo` por un cálculo diario |
| S-06 | **[NECESITA ACLARACIÓN]** ¿Qué es un "aviso" (RF-103) y en qué spec se define? | Es un texto de 1 a 500 caracteres que COORD publica para un grupo, sin adjuntos y vigente hasta que lo retire. Se define en este plan (módulo `avisos`) | El módulo es independiente y se elimina sin tocar el resto |
| S-07 | **[NECESITA ACLARACIÓN]** ¿Cuál es la lista cerrada de datos necesarios (RF-107)? | El mecanismo (`catalogo-datos.ts` + test contra las migraciones) es de 001 y el contenido lo aporta cada dueño (002 los datos del niño). En las cuentas no se guardan teléfono ni correo | Se agregan entradas al catálogo junto con su migración |
| S-08 | **[NECESITA ACLARACIÓN]** ¿Se audita cada lectura de un dato restringido? ¿Por cuánto tiempo se guarda la auditoría? ¿Quién la consulta? | Sí, cada lectura. Se conserva 730 días desde el evento. Solo ADM la consulta | Constante `DIAS_CONSERVACION_AUDITORIA` y una fila de la matriz |
| S-09 | **[NECESITA ACLARACIÓN]** ¿Qué pasa si la única persona con ADM deja la parroquia? | Un trigger impide quitar o desactivar la última cuenta ADM. Se recomienda tener dos ADM. Como último recurso, `api/scripts/crear-administracion-inicial.ts` (intervención técnica) | Se elimina el trigger con una migración |
| S-10 | **[NECESITA ACLARACIÓN]** ¿Cómo se aplica la retención a las exportaciones? | Quedan fuera del control del sistema. Cada exportación lleva al pie la fecha y "Contiene datos de menores; elimínese al cierre del ciclo + 2 años", y su generación se audita | Cambiar el pie o dejar de auditar |
| S-11 | **[NECESITA ACLARACIÓN]** ¿Hay normativa diocesana que incorporar? | No se incorpora ninguna adicional. Plazos y textos son parámetros o migraciones de texto | Nueva versión del texto y cambio de constantes |
| S-12 | **[NECESITA ACLARACIÓN]** ¿ADM puede ser la misma persona que COORD? ¿El consentimiento entra en el primer corte? | Sí: una cuenta puede tener ambos roles. El **registro mínimo de consentimiento presencial** (0104 + `registrarConsentimiento` + componente) entra en el primer corte porque 002 lo exige para inscribir (su supuesto C-08). El retiro llega en la fase 3 | Si el primer corte usa solo datos ficticios, 0104 puede pasar a la fase 3 |
| S-13 | **[NECESITA ACLARACIÓN]** (del plan) ¿Qué pasa al reconectar después de más de 14 días? | Ventana de reconexión de 60 días (D-119). Pasado ese plazo hace falta un enlace nuevo | `VENTANA_RECONEXION_DIAS = 0` |
| S-14 | **[NECESITA ACLARACIÓN]** (del plan) ¿Qué pasa con los pendientes tras un bloqueo por PIN o una reemisión del enlace en el mismo celular? | Se lee RF-112 al pie de la letra: la credencial terminó, así que se rechazan y se avisa a COORD con la cantidad | Bandera `aceptarPendientesMismoDispositivoTrasReemision` en `renovar-sesion` |
| S-15 | **[NECESITA ACLARACIÓN]** (del plan) Con dos apoderados, ¿basta el consentimiento de uno? ¿El retiro de uno solo borra todo? | Basta uno para inscribir. El retiro de cualquiera de los dos aplica el borrado (protección más fuerte) | Cambiar `inscripcionTieneConsentimiento` y la regla de retiro |
| S-16 | **[NECESITA ACLARACIÓN]** (del plan) ¿Hay catequistas con iPhone? | El equipo usa Android con un APK de EAS (distribución interna, sin tienda). Un catequista con iPhone usaría la web **solo en línea**, sin sesión de 14 días porque SecureStore no existe en la web, y se le avisa | Cuenta Apple o un adaptador web de sesión con su propio análisis de riesgo |
| S-17 | **[NECESITA ACLARACIÓN]** ¿Quién redacta el texto del consentimiento? (duda compartida con 008) | Se siembra un borrador v1 con la cláusula de constancia, marcado "borrador pendiente de aprobación" | Una migración nueva inserta la versión aprobada; la anterior queda como historial |
| S-18 | **[NECESITA ACLARACIÓN]** (de 002) ¿Qué pasa con el enlace de un apoderado desvinculado de un hijo que sigue vinculado a otro? | Se mantiene el enlace y se reduce el alcance. Si ya no le queda ningún vínculo, se termina la credencial (`sin_vinculos`) | Revocar siempre el enlace en `revocarEnlace` |
| S-19 | **[NECESITA ACLARACIÓN]** ¿Quién da de alta al equipo? (La tabla de usuarios dice ADM y RF-110/111 dicen COORD) | Ambos. COORD solo crea cuentas CAT y FAM. Los roles ADM, COORD y SUP los asigna solo ADM | Se editan las filas `cuentas:gestionar` y `roles:asignar-equipo` |
| S-20 | Ubicación de las skills (principio 11) | `skills/<nombre>/SKILL.md` en la raíz del repo hasta que se fije el marketplace | Se mueve la carpeta |

---

## 12. Orden de implementación

Las fases siguientes conservan el orden histórico. **Todas sus piezas backend F0–F4 están incluidas** en backend/001-003; “después del primer corte” no posterga la protección ni el retiro. Los criterios completos de cada tarea siguen pendientes de evidencia.

### Primer corte (junto con 003 completa y lo mínimo de 002)

| Fase | Tareas | RF |
| --- | --- | --- |
| **F0 — Base** | F0-1 Justificar las dependencias en la spec (§7.2). F0-2 Jest en la raíz (`jest-expo`) y en `api/` (ts-jest), scripts `test`, `test:rapido` y `typecheck`, regla ESLint de `src/lib`. F0-3 Esqueleto de `api/` (v4, esbuild con `@/lib`, `compartido/`), `docker-compose.yml`, runner de migraciones + `0001_base.sql`. F0-4 Bicep mínimo: Key Vault, Storage, PostgreSQL, Function App Flex, APIM (cors, validate-jwt, rate-limit, x-functions-key) y Static Web Apps. F0-5 `ci.yml` y `despliegue.yml` con OIDC. F0-6 Skills `nueva-migracion` y `verificacion`. F0-7 `verificar-cobertura-rf.mjs` en modo informe | RNF-103, RNF-104 (base) |
| **F1 — Acceso** | `0101` y `0102` (sin `identidad_real` legible todavía: la tabla se crea, el endpoint de lectura llega en F2). Dominio `roles`, `contexto-acceso`, `matriz-permisos`, `autorizacion`, `enlaces`, `pin`, `sesion-local` y `reconexion`. Middleware `conAcceso` con auditoría de denegaciones. Endpoints `acceso/*`, `yo`, `cuentas` (alta, roles, desactivar, enlaces), `avisos-coordinacion` (+ la parte de `0106` correspondiente a `aviso_coordinacion`). Script `crear-administracion-inicial` y `sembrar-demo` (credenciales de ejemplo por rol). Pantallas `acceso/*`, `cuentas/*`, guardas `(equipo)` y `(familia)`. App Links + `assetlinks.json` | RF-101, RF-102, RF-110, RF-111, RF-112, RNF-104, RNF-105 (cuentas y enlaces) |
| **F1b — Consentimiento mínimo** (S-12) | `0104`, `registrarConsentimiento` en proceso para 002, `POST /consentimientos`, texto vigente y el componente presencial | RF-106 (registro) |

**Criterio de salida del primer corte:**
- cada rol, y una cuenta con dos roles, entra con sus credenciales de ejemplo;
- un acceso fuera de alcance queda rechazado y auditado;
- un catequista entra sin correo, desbloquea sin señal hasta el día 14 y queda limitado después;
- un enlace revocado deja de funcionar y sus pendientes se rechazan con aviso.

### Después del primer corte

| Fase | Tareas | RF |
| --- | --- | --- |
| **F2 — Continuidad y seudónimo** | `0103` delegación con sus endpoints y pantallas. `identidad_real` con funciones `SECURITY DEFINER` y el endpoint ADM. `nombreVisible` en todos los listados. `0106` avisos de grupo con la colección de sync (requiere 003). Cerrar sesión (RNF-102, requiere `purgarExceptoPendientes` de 003) | RF-103, RF-104, RF-105, RNF-102 |
| **F3 — Protección de datos** | `0105` motor de retención, participantes y bandeja de blobs (requiere 002 fase 3 y 004). Retiro del consentimiento (en persona y por enlace). Catálogo de datos con su test contra las migraciones. Auditoría de lecturas restringidas (con 002 y 004). Temporizadores `retencionDiaria`, `borradosPendientes` y `purgaAuditoria`. Consulta de auditoría para ADM. Test RNF-101 sobre el esquema local | RF-106 (retiro), RF-107, RF-108, RF-109, RNF-101 |
| **F4 — Cierre y endurecimiento** | Servicios de cierre para 008. Rotación de la clave JWT (`kid`). Alerta de presupuesto. Prueba de carga de 50 clientes. `verificar-cobertura-rf` pasa a ser bloqueante para 001 | RF-104/RF-110 (cierre), R-1, R-2 |

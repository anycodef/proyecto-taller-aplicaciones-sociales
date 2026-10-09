# Plan 004 — Justificaciones de ausencias

> CÓMO implementar la [spec 004](spec.md). Sigue la [constitución](../../docs/constitution.md) y las decisiones transversales fijas (Expo SDK 57, Azure Functions v4 + APIM Consumo + PostgreSQL Flexible + Blob Storage, reglas puras en `src/lib/`). La spec 004 **no entra en el primer corte**; se implementa después de 001, 002 y 003.

## 1. Resumen y alcance

| Cubre | Cómo, en una línea |
| --- | --- |
| RF-401 | Pantalla de inicio de la familia (web, sin instalar) con las ausencias justificables de sus hijos. |
| RF-402 | Causa de lista cerrada + 1 a 3 fotos + confirmación en pantalla. |
| RF-403 | Envío por lote: una justificación por ausencia, misma causa y misma evidencia; revisión conjunta o separada. |
| RF-404 | Justificación anticipada de sesiones futuras solo con causa "evento escolar". |
| RF-405 | Plazo en días por ciclo; regla pura que deja de ofrecer la ausencia vencida. |
| RF-406 | Registro por la coordinación en nombre de un apoderado, marcado con quién y cuándo. |
| RF-407 | Justificación ligada a (niño, sesión), sin borrado; "sin efecto" al corregir a presente. |
| RF-408 | Bandeja de pendientes del ciclo; aprobar/rechazar solo coordinación o delegado; reofrecer tras rechazo. |
| RF-409 | Puertos de consulta que consumen 003 (cómputo de falta), 006 (aptitud) y 007 (riesgo). |
| RF-410 | Estado visible para catequistas del grupo (también sin conexión), evidencia solo a coordinación, catequistas del grupo y supervisión; estado y motivo para la familia. |
| RNF-401 | Flujo de una pantalla, ausencias preseleccionadas, medición en campo < 1 min. |
| RNF-402 | Compresión iterativa en el cliente a < 300 KB por foto. |
| RNF-403 | Contenedor privado; URLs SAS de usuario delegado de 5 min; lectura auditada. |
| RNF-404 | Envío solo en línea; ninguna cola ni copia local de la evidencia; borrado de temporales. |
| RNF-405 | Bandeja y visor de evidencia solo en línea. |

**Fuera de alcance** (de la spec): OCR del comprobante, recepción automática por WhatsApp, chat, justificaciones de catequistas. También queda fuera de este plan lo que pertenece a otros dueños: infraestructura base, sesión y enlace (001), apoderados y grupos (002), protocolo de sincronización, esquema WatermelonDB y cómputo de falta (003), regla de aptitud (006), pasos de riesgo (007), cierre de ciclo (008).

## 2. Verificación contra la constitución

| # | Principio | Cumplimiento en 004 |
| --- | --- | --- |
| 1 | Stack mínimo | Solo Expo + Azure. Dependencias nuevas, a justificar en la spec antes de implementar (ver §11, A-09): app `expo-image-picker`, `expo-image-manipulator`, `expo-file-system` (borrar temporales nativos), `expo-image` (visor sin caché); API `@azure/storage-blob`, `@azure/identity`. Dev: imagen Docker de Azurite para tests. |
| 2 | La spec manda | Cada RF/RNF tiene fila en la matriz (§10) y tests con su ID en el nombre. Las dudas se implementan solo como supuestos reversibles (§11). |
| 3 | Lógica sin interfaz | Justificabilidad, plazo, lotes, transiciones, efectos, permisos y plan de compresión en `src/lib/justificaciones/` (TS puro); la API los importa vía esbuild. |
| 4 | Tests en verde | Fases cierran con `npm test`, `typecheck` y `lint` en verde (§12). |
| 5 | Offline primero | **Excepción acotada y exigida por la spec**: el envío de una justificación y la revisión son en línea (RNF-404, RNF-405) porque la evidencia es dato restringido (principio 7, RNF-101). La consulta del estado por catequistas sí funciona sin conexión (D-408). La asistencia no se ve afectada. Debe constar en ADR (A-08). |
| 6 | Persistencia segura | `justificaciones.id`, `lote_id` y `evidencias.id` son UUID generados en el cliente; migraciones SQL versionadas nuevas; tabla local añadida por migración de esquema WatermelonDB. |
| 7 | Datos de menores | Evidencia nunca en el dispositivo (ni cola, ni caché de imagen); el almacén local solo recibe el estado, sin causa, motivo ni evidencia; autorización por rol y alcance en cada Function. |
| 8 | Idioma | Módulo `justificaciones`, tablas, columnas y archivos en español sin tildes ni ñ (`salud_nino`, `justificacion_plazos`); textos de interfaz en español con tildes. |
| 9 | Autoría trazable | Cada tarea de `tasks.md` se commitea con su registro Agent Trace enlazado al RF. |
| 10 | Contexto curado | El agente trabaja con `AGENTS.md`, la constitución, `spec.md` y este plan; nada fuera. |
| 11 | Skills como paquete | Las migraciones de §3 se crean con la skill de migración del repo; no se crean flujos ad hoc. |

## 3. Modelo de datos

### 3.1 PostgreSQL (`api/migraciones/`)

Los números `NNNN` se asignan al implementar según la secuencia global de plan 001 (supuesto A-10). Ninguna migración se edita una vez aplicada.

| Migración | Tabla / objeto | Columnas clave | RF |
| --- | --- | --- | --- |
| `NNNN_justificaciones_plazo_ciclo.sql` | `justificacion_plazos` | `ciclo_id` PK → `ciclos` (008), `dias_plazo int check (1..60)`, `definido_por`, `definido_en` | RF-405 |
| `NNNN_justificaciones_evidencias.sql` | `evidencias` | `id uuid` PK (cliente), `ciclo_id`, `subida_por` (cuenta), `estado` (`reservada`, `confirmada`, `eliminada`), `reservada_en`, `confirmada_en`, `eliminada_en`, `motivo_eliminacion` (`consentimiento`, `retencion`, `huerfana`) | RF-402, RF-407, RNF-403 |
| | `evidencia_archivos` | `evidencia_id`, `orden smallint (1..3)`, `blob_nombre`, `bytes int check (<= 307200)`, `content_type` (`image/jpeg`), PK (`evidencia_id`, `orden`) | RNF-402 |
| `NNNN_justificaciones_base.sql` | `justificaciones` | `id uuid` PK (cliente), `lote_id uuid`, `ciclo_id`, `catequizando_id` → 002, `sesion_id` → sesiones (003), `tipo_sesion` (`misa`, `catequesis`, `actividad`), `fecha_sesion date`, `causa` (`salud_nino`, `familiar_directo`, `evento_escolar`), `anticipada bool`, `evidencia_id` → `evidencias`, `enviada_por` (cuenta del apoderado), `enviada_en` (hora servidor), `canal` (`enlace`, `coordinacion`), `registrada_por`, `registrada_en`, `estado_revision` (`pendiente`, `aprobada`, `rechazada`), `revisada_por`, `revisada_en`, `motivo_rechazo varchar(280)`, `sin_efecto_desde timestamptz null`, `actualizado_en` (para el pull de 003) | RF-402, RF-403, RF-404, RF-406, RF-407, RF-408 |
| | Restricciones | `check (canal = 'coordinacion') = (registrada_por is not null)`; `check (estado_revision = 'rechazada') = (motivo_rechazo is not null)`; `check (estado_revision <> 'pendiente') = (revisada_por is not null)`; índices (`ciclo_id`, `estado_revision`), (`catequizando_id`, `sesion_id`), (`lote_id`), (`actualizado_en`). **Sin** unicidad por (niño, sesión): dos apoderados pueden justificar la misma ausencia. | RF-403, RF-406, RF-408 |
| | `justificacion_eventos` | `id`, `justificacion_id`, `tipo` (`creada`, `aprobada`, `rechazada`, `sin_efecto`, `efecto_restaurado`, `evidencia_eliminada`), `por` (cuenta o `sistema`), `en`, `detalle jsonb` — solo inserción | RF-406, RF-407, RF-408 |
| `NNNN_justificaciones_sin_borrado.sql` | Trigger `impedir_borrado` en `justificaciones`, `justificacion_eventos`, `evidencias`; `REVOKE DELETE` al rol de la aplicación; `UPDATE` de `evidencias` a `eliminada` solo vía función SQL `marcar_evidencia_eliminada(id, motivo)` | RF-407 |

`fecha_sesion` y `tipo_sesion` se desnormalizan para que la justificación conserve "fecha y sesión" aunque 003 corrija o anonimice (RF-407). El estado visible se deriva: `sin_efecto` si `sin_efecto_desde` no es nulo; si no, `estado_revision`.

### 3.2 Almacén local WatermelonDB (solo app del equipo)

Tabla que 004 añade al esquema definido en plan 003, mediante una migración de esquema local:

| Tabla local | Columnas | Alcance | RF |
| --- | --- | --- | --- |
| `justificaciones_estado` | `id` (= id servidor), `catequizando_id`, `sesion_id`, `fecha_sesion`, `tipo_sesion`, `estado_visible`, `actualizado_en` | Solo justificaciones de niños de los grupos del catequista (y todas para coordinación). Solo lectura: el push de 003 rechaza cambios a esta tabla. | RF-410, RF-409 (cómputo local de falta de 003) |

Nunca en el almacén local: causa, motivo de rechazo, quién envió, evidencia ni URLs SAS (D-408). La familia no usa almacén local (D-409).

### 3.3 Blob Storage

| Objeto | Configuración | RF |
| --- | --- | --- |
| Contenedor `evidencias` | Acceso público deshabilitado; sin versionado ni eliminación temporal (para que el borrado por consentimiento sea inmediato, RF-106); nombre de blob `{cicloId}/{evidenciaId}/{orden}.jpg` | RNF-403, RF-407 |
| CORS del servicio Blob | Origen: dominio de Static Web Apps; métodos `PUT`, `GET`; cabeceras `x-ms-blob-type`, `content-type`. Se entrega como parámetro al módulo base de 001 | RF-401 |

## 4. Lógica de dominio en `src/lib/justificaciones/`

Todo TS puro; la hora `ahora` y la zona horaria se reciben como parámetro.

| Archivo | Reglas (firmas ilustrativas) | RF |
| --- | --- | --- |
| `tipos.ts` | `Causa`, `EstadoRevision`, `EstadoVisible = EstadoRevision \| "sin_efecto"`, `AusenciaRef { catequizandoId, sesionId, tipoSesion, fecha }`, `Justificacion`, `EntradaLote` | todos |
| `causas.ts` | `CAUSAS` (lista cerrada de 3), `esCausaValida(c)`, `permiteAnticipada(c)` → solo `evento_escolar` | RF-402, RF-404 |
| `plazo.ts` | `fechaLimite(fechaAusencia, diasPlazo)` (fin del día, zona `America/Lima`), `plazoVigente(fechaAusencia, diasPlazo, ahora)` | RF-405 |
| `justificables.ts` | `ausenciasJustificables(ausencias, justificaciones, diasPlazo, ahora)`: plazo vigente y sin justificación `pendiente` o `aprobada` vigente; `agruparPorDomingo(...)` para mostrar misa y catequesis de un mismo domingo en una fila; `sesionesAnticipables(sesionesFuturas, justificaciones, ahora)` | RF-401, RF-404, RF-405, RF-408 |
| `lote.ts` | `validarLote(entrada, contexto)` (1 a N ausencias, todas de hijos del apoderado, justificables o anticipables, causa válida, 1 a 3 fotos); `expandirLote(entrada) → Justificacion[]` (una por ausencia, misma causa, misma `evidenciaId`, mismo `loteId`) | RF-402, RF-403, RF-404, RF-406 |
| `estados.ts` | `revisar(j, decision, por, en, motivo?)` (solo desde `pendiente`; motivo obligatorio al rechazar); `dejarSinEfecto(j, en)`; `restaurarEfecto(j)`; `estadoVisible(j)` | RF-407, RF-408 |
| `efectos.ts` | `faltaJustificada(fecha, catequizandoId, js)` (hay alguna `aprobada` sin efecto anulado para una sesión de esa fecha, según RF-311); `ausenciaMisaJustificada(sesionId, catequizandoId, js)`; `estadoParaRiesgo(ausencia, js)` → `aprobada \| pendiente \| rechazada \| ninguna` | RF-409 |
| `permisos.ts` | `puedeJustificar(sesion, catequizandoId)`, `puedeRegistrarEnNombre(sesion, ahora)`, `puedeRevisar(sesion, ahora)` (coordinación o delegación vigente de 001), `puedeVerEstado(sesion, nino)`, `puedeVerEvidencia(sesion, nino)` (coordinación/delegado, catequista del grupo, supervisión; **no** familia) | RF-406, RF-408, RF-410 |
| `compresion.ts` | `planInicial(ancho, alto)` → lado mayor 1600 px, JPEG calidad 0,7; `siguienteIntento(intento, bytes)` → baja calidad (0,55; 0,4) y luego lado (1280; 1024); máx. 5 intentos; `LIMITE_BYTES = 300 * 1024` | RNF-402 |
| `evidencia.ts` | `validarMetadatos({ contentType, bytes, cantidad })` | RNF-402, RNF-403 |

Evolución del código existente: el tipo `Justificacion` y `ResultadoOcr` de `src/lib/domain/modelo.ts` se retiran (OCR fuera de alcance; estados no coinciden con la spec) y `modelo.ts` reexporta los tipos nuevos. Los permisos generales (`roles.ts`) los evoluciona 001; `permisos.ts` solo los compone. Se recomienda a 003 no usar `"justificado"` como `EstadoAsistencia`: la justificación es un hecho aparte (D-405).

## 5. API (`api/src/modulos/justificaciones/`)

Todas las rutas pasan por APIM (política base de 001: validación de JWT, CORS, límite global). Cada Function revalida rol y alcance con `permisos.ts` y el contexto de sesión de 001, y rechaza escrituras si el ciclo está cerrado (puerto de 008).

| Function / ruta | Rol y alcance | Hace | RF |
| --- | --- | --- | --- |
| `GET /familia/ausencias-justificables` | familia: solo sus hijos | Lee ausencias del ciclo abierto (puerto de 003), justificaciones y plazo; aplica `ausenciasJustificables` | RF-401, RF-405, RF-408 |
| `GET /familia/sesiones-anticipables` | familia: solo sus hijos | Sesiones futuras del ciclo (003/005) aún sin justificación | RF-404 |
| `GET /familia/justificaciones` | familia: justificaciones de las ausencias de sus hijos | Estado visible, motivo de rechazo y "enviada por usted / otro apoderado / la coordinación"; sin evidencia | RF-410 |
| `POST /evidencias/reservas` | familia o coordinación/delegado | Recibe `{ evidenciaId, archivos: [{ orden, bytes, contentType }] }`; valida metadatos; crea `evidencias` en `reservada`; devuelve una URL SAS por archivo (permiso solo crear `c`, 5 min) | RF-402, RNF-402, RNF-403 |
| `POST /justificaciones/lotes` | familia (hijos propios) o coordinación/delegado con `apoderadoId` del niño (002) | Verifica que cada blob exista, pese ≤ 300 KB y empiece con firma JPEG; `validarLote` + `expandirLote`; inserta en una transacción; marca evidencia `confirmada`; evento `creada`. Idempotente por `loteId` (reintento devuelve el mismo resultado) | RF-402, RF-403, RF-404, RF-406, RF-407 |
| `GET /coordinacion/catequizandos/{id}/ausencias-justificables` | coordinación/delegado | Igual que la de familia, para registrar en nombre de | RF-406 |
| `GET /justificaciones/bandeja` | coordinación/delegado; supervisión solo lectura | Pendientes del ciclo agrupadas por lote, con aviso de duplicados por ausencia | RF-408, RF-403 |
| `POST /justificaciones/revisiones` | solo coordinación/delegado | `{ ids[], decision, motivo? }`; aplica `revisar` a cada id (juntas o por separado); eventos; notifica a suscriptores (D-414) | RF-408, RF-403, RF-409 |
| `GET /catequizandos/{id}/justificaciones` | coordinación/delegado, catequista del grupo, supervisión | Historial completo en el perfil (causa, motivo, quién envió, canal) | RF-407, RF-410 |
| `GET /justificaciones/{id}/evidencia` | `puedeVerEvidencia` | Genera SAS de lectura (`r`, 5 min, `rscc=no-store`) por archivo; registra la consulta en la auditoría de 001 | RF-410, RNF-403, RNF-405 |
| `GET` / `PUT /ciclos/{cicloId}/plazo-justificacion` | coordinación/delegado (PUT); equipo (GET) | Define o consulta `dias_plazo`; el cambio se audita (001) | RF-405 |
| Temporizador `limpiarEvidenciasHuerfanas` (diario, 03:00 Lima) | sistema | Borra blobs y marca `eliminada/huerfana` las reservas no confirmadas de más de 24 h | RNF-403 |
| Servicio `depurarEvidencias(criterio, motivo)` | invocado en proceso por el motor de retención y el retiro de consentimiento de 001 | Por niño o por ciclo: borra blobs, `marcar_evidencia_eliminada`, evento `evidencia_eliminada`; la justificación se conserva | RF-407 |
| Puerto `alCambiarAsistencia(catequizandoId, sesionId, estado)` | llamado por 003 en la misma transacción | A presente → `dejarSinEfecto`; de vuelta a ausente → `restaurarEfecto` | RF-407 |
| Proveedor de pull `justificaciones_estado` | protocolo de 003 | Cambios desde `actualizado_en` dentro del alcance del dispositivo | RF-410 |
| Puerto `ConsultaJustificaciones` | 003, 006, 007 (en proceso) | `faltaJustificada`, `ausenciaMisaJustificada`, `estadoParaRiesgo`, `diasPlazo` | RF-409 |

**Políticas de APIM específicas** (sobre la base de 001): límite más estricto en `POST /evidencias/reservas` y `POST /justificaciones/lotes` (orientativo 10 por minuto por cuenta, con clave = `sub` del JWT si el nivel Consumo lo admite; si no, la Function limita a 20 reservas por cuenta y hora contando en `evidencias`); `GET .../evidencia` sin caché en la respuesta. La subida y lectura de bytes van directo a Blob con SAS y no pasan por APIM.

## 6. Cliente

| Ruta (`src/app/`) | Comportamiento | Conexión | RF |
| --- | --- | --- | --- |
| `familia/index.tsx` (evoluciona `familia.tsx`) | Tras entrar por el enlace (ruta de 001), muestra **primero** las ausencias justificables por hijo y domingo (niño, fecha, sesión); debajo, "Mis justificaciones" con estado y motivo | En línea; sin red muestra aviso, nada se guarda | RF-401, RF-410 |
| `familia/justificar.tsx` | Una pantalla: ausencias marcables (preseleccionada si viene de una fila, de varios hijos y fechas), chips de causa, botón foto (cámara o galería; en web `input` con captura), vista previa, Enviar | Solo en línea | RF-402, RF-403, RNF-401 |
| `familia/anticipar.tsx` | Sesiones futuras; solo causa "evento escolar"; foto del comunicado | Solo en línea | RF-404 |
| `familia/enviada.tsx` | Confirmación de recepción con lista de ausencias justificadas | — | RF-402 |
| `coordinacion/justificaciones/index.tsx` | Bandeja de pendientes por lote; selección múltiple para aprobar/rechazar | Solo en línea (RNF-405) | RF-408, RF-403 |
| `coordinacion/justificaciones/[loteId].tsx` | Evidencia (`expo-image`, `cachePolicy="none"`), ausencias del lote, aprobar todo o por ausencia, rechazo con motivo | Solo en línea | RF-408, RF-410 |
| `coordinacion/justificaciones/registrar.tsx` | Elegir niño, apoderado, ausencias, causa y foto recibida por otro medio | Solo en línea | RF-406 |
| `coordinacion/justificaciones/plazo.tsx` | Definir días de plazo del ciclo | Solo en línea | RF-405 |
| Componente `src/components/justificaciones/resumen-justificaciones.tsx` (embebido en el perfil de 002) | Estado por ausencia desde `justificaciones_estado` local; detalle y evidencia al tocar, si hay red | Estado sin conexión; detalle en línea | RF-407, RF-410 |

**Flujo de envío** (`src/features/justificaciones/enviar-justificacion.ts`, adaptador de interfaz que delega en `src/lib/`):

1. NetInfo sin conexión → aviso "No se envió. Sin conexión: vuelve a intentarlo cuando tengas señal" y se descarta la foto (RNF-404).
2. `ImagePicker.launchCameraAsync` / `launchImageLibraryAsync` (en web abre desde la pulsación; entrega `File`).
3. `ImageManipulator.manipulate(uri).resize(...)` → `renderAsync()` → `saveAsync({ format: JPEG, compress })` iterando con `siguienteIntento` hasta < 300 KB (RNF-402).
4. `POST /evidencias/reservas` → `PUT` de cada archivo a su URL SAS (`x-ms-blob-type: BlockBlob`) → `POST /justificaciones/lotes`.
5. Éxito → `enviada.tsx`. Cualquier fallo → mismo aviso del paso 1; nada queda en cola.
6. Siempre (éxito, fallo o cancelación): en nativo, `new File(uri).delete()` de `expo-file-system` sobre la foto original y las intermedias; en web, `URL.revokeObjectURL` y se sueltan las referencias. Ninguna escritura en WatermelonDB, `localStorage` ni SecureStore (RNF-404).

Los UUID (`evidenciaId`, `loteId`, ids de justificación) se generan en el cliente con el generador definido en plan 003; un reintento manual con la misma foto en pantalla reutiliza los mismos ids (idempotencia).

## 7. Decisiones técnicas

| ID | Decisión | Alternativas descartadas y por qué |
| --- | --- | --- |
| D-401 | Envío de justificación solo en línea, sin cola ni copia local de la evidencia | Cola cifrada con reenvío diferido (como sugieren el C4 "almacena justificante temporal" y el ADR 002 "diferir fotos"): contradice RNF-404 y RNF-101. Requiere actualizar C4 y ADR (A-08). |
| D-402 | Subida directa a Blob con SAS de **usuario delegado** (identidad administrada de la Function App), permiso solo `c`, 5 min, un blob por archivo | Subir los bytes por la Function: más tiempo y memoria facturados y contrario a la decisión fija de SAS. SAS con clave de cuenta: exige guardar la clave maestra. Permiso `cw`: permitiría sobrescribir evidencia existente. |
| D-403 | Compresión en el cliente con `expo-image-manipulator` (redimensionar + JPEG iterativo) | Solo `quality` del picker: no redimensiona y en iOS se ignora en PNG. Comprimir en el servidor (C4): la foto pesada ya habría consumido datos móviles (RNF-402). |
| D-404 | Una fila por ausencia con `lote_id` y `evidencia_id` compartidos | Una justificación con N ausencias (M:N): complica aprobar por separado (RF-403) y el estado por ausencia que consumen 003/006/007. |
| D-405 | Referencia a la ausencia por (niño, `sesion_id`) de 003, con fecha y tipo desnormalizados | FK a la fila de asistencia: la ausencia a misa es derivada al cerrar la ventana (RF-305) y la anticipada aún no existe. |
| D-406 | "Sin efecto" como marca `sin_efecto_desde`, aplicada por un puerto que 003 invoca en su transacción de corrección; reversible si vuelve a ausente | Calcular al vuelo cruzando asistencia: no deja traza (RF-407). Pasar a un estado terminal: una corrección errónea perdería la justificación. |
| D-407 | Sin borrado: trigger + `REVOKE DELETE`; la evidencia solo se elimina por `depurarEvidencias` con motivo | Borrado lógico abierto al rol de la aplicación: un error de código podría borrar. Contenedor inmutable (WORM): impediría el borrado por consentimiento. |
| D-408 | Bajar al celular del catequista solo el estado (sin causa, motivo ni evidencia) de sus grupos | Solo en línea: el catequista no podría responder al padre sin señal (HU-406). Incluir la causa: "salud del niño" es dato de salud. |
| D-409 | Flujo de familia sin almacén local (web y nativo) | WatermelonDB en web (adaptador LokiJS): peso y datos de menores en un navegador posiblemente compartido. |
| D-410 | Lectura con SAS de 5 min por petición, `rscc=no-store` y `expo-image` con `cachePolicy="none"` | `Image` de React Native: en Android cachea en disco (violaría RNF-101). Proxy de bytes por la Function: más costo de ejecución sin ganancia de seguridad. |
| D-411 | Plazo en tabla propia por ciclo, días calendario, vence al final del día en `America/Lima` | Columna en `ciclos` (008): acopla migraciones de otro dueño. Plazo en horas: la spec habla de días. |
| D-412 | Limpieza de reservas huérfanas con temporizador diario | Gestión de ciclo de vida de Blob: no distingue confirmadas de huérfanas sin prefijos o etiquetas adicionales. |
| D-413 | Idempotencia por `loteId` y UUID de cada justificación (`ON CONFLICT DO NOTHING` + devolver el resultado existente) | Deduplicar por contenido: dos apoderados legítimos con la misma ausencia se fusionarían (caso límite). |
| D-414 | Efectos hacia 003/006/007 por puerto de consulta + notificación síncrona en proceso (`alCambiarJustificacion`) | Cola (Storage Queue / Service Bus): dependencia y operación extra sin necesidad a este volumen. |

## 8. Estructura de archivos propuesta

```
src/lib/justificaciones/
  tipos.ts causas.ts plazo.ts justificables.ts lote.ts estados.ts
  efectos.ts permisos.ts compresion.ts evidencia.ts
  __tests__/*.test.ts
src/features/justificaciones/          # adaptadores con Expo (picker, manipulator, NetInfo, fetch)
  enviar-justificacion.ts comprimir-foto.ts cliente-justificaciones.ts
src/components/justificaciones/
  resumen-justificaciones.tsx selector-ausencias.tsx selector-causa.tsx visor-evidencia.tsx
src/app/familia/            index.tsx justificar.tsx anticipar.tsx enviada.tsx
src/app/coordinacion/justificaciones/  index.tsx [loteId].tsx registrar.tsx plazo.tsx
src/lib/sincronizacion/esquema/        # (de 003) + migración local que añade justificaciones_estado
api/src/modulos/justificaciones/
  dominio/           puertos.ts (RepositorioJustificaciones, RepositorioEvidencias, AlmacenEvidencias)
  aplicacion/        listar-justificables.ts reservar-evidencia.ts crear-lote.ts bandeja.ts
                     revisar.ts obtener-evidencia.ts configurar-plazo.ts depurar-evidencias.ts
                     limpiar-huerfanas.ts al-cambiar-asistencia.ts proveedor-pull.ts consulta-justificaciones.ts
  infraestructura/   repositorio-justificaciones-pg.ts repositorio-evidencias-pg.ts almacen-evidencias-blob.ts
  http/              familia.ts evidencias.ts lotes.ts revision.ts consulta.ts plazo.ts temporizadores.ts
  __tests__/
api/migraciones/NNNN_justificaciones_*.sql   (4 archivos, §3.1)
infra/modulos/evidencias.bicep               # contenedor, roles Storage Blob Data Contributor (contenedor)
                                             # y Storage Blob Delegator (cuenta) para la identidad de la Function App
```

La ubicación de `src/features/` y de los temporizadores sigue la convención que fije plan 001; si difiere, se adapta sin cambiar responsabilidades.

## 9. Estrategia de tests

Runner y configuración: plan 001 (`jest-expo` en `src/`, Jest TS en `api/`, PostgreSQL en Docker). Este plan añade **Azurite** en Docker para el adaptador de Blob (SAS de cuenta en pruebas; delegado en Azure, tras la interfaz `AlmacenEvidencias`).

| Nivel | Qué | Ejemplos (nombre del test) |
| --- | --- | --- |
| Dominio (`src/lib`) | Reglas puras, tabla de casos | `RF-405: una ausencia con plazo vencido ya no es justificable`; `RF-403: un lote de tres fechas crea tres justificaciones con la misma evidencia`; `RF-402: rechaza una causa fuera de la lista (viaje)`; `RNF-402: el plan de compresión termina bajo 300 KB o falla en 5 intentos` |
| Contrato de repositorios (Postgres Docker) | `RepositorioJustificaciones`, `RepositorioEvidencias` | `RF-407: borrar una justificación falla por trigger`; `RF-403: reinsertar el mismo lote es idempotente`; `RF-406: canal coordinación exige registrada_por` |
| Contrato de almacén (Azurite) | `AlmacenEvidencias` | `RNF-403: la SAS de subida no permite sobrescribir`; `RNF-403: la SAS vencida es rechazada`; `RF-407: depurar borra el blob y conserva la justificación` |
| HTTP por Function | Handler v4 con dobles; 401/403/400/200 | `RF-408: un catequista recibe 403 al aprobar`; `RF-410: un catequista de otro grupo recibe 403 al ver estado y evidencia`; `RF-410: la familia no obtiene URL de evidencia`; `RF-408: supervisión no puede revisar` |
| Cliente (`jest-expo`) | Pantallas y adaptadores con NetInfo, picker y manipulator simulados | `RNF-404: sin conexión avisa y borra los temporales sin escribir en almacenamiento`; `RF-401: la pantalla de familia lista primero las ausencias justificables` |
| Extremo a extremo (API + Postgres + Azurite) | Reservar → subir → lote → bandeja → aprobar → `faltaJustificada` | `RF-409: tras aprobar, la falta deja de contar`; `RNF-401: el flujo de la familia requiere a lo sumo 4 interacciones` (la meta de < 1 min se mide en campo con cronómetro) |

**Casos límite de la spec → tests**

| Caso límite | Test |
| --- | --- |
| Plazo vencido | `RF-405: ausencia vencida no aparece como justificable` |
| Foto ilegible | `RF-408: rechazada con motivo y plazo vigente vuelve a ofrecerse` |
| Certificado para tres domingos | `RF-403: una evidencia, tres justificaciones ligadas a sus fechas` |
| Dos hermanos el mismo domingo | `RF-403: una evidencia, una justificación por niño` |
| Ausencia corregida a presente | `RF-407: queda sin efecto y se conserva` |
| Dos apoderados, misma ausencia | `RF-408: ambas quedan registradas y la bandeja marca el duplicado` |
| Causa fuera de lista | `RF-402: la API rechaza causa no listada` |
| Padre que escribió por WhatsApp | `RF-406: registrada por la coordinación en nombre de, con quién y cuándo` |
| Sin señal al enviar | `RNF-404: aviso claro y la foto no queda guardada` |
| Enlace revocado con pendientes | `RF-408: las pendientes de un enlace revocado siguen en la bandeja` |

## 10. Matriz de cobertura

| Req. | Componentes | Tests |
| --- | --- | --- |
| RF-401 | `justificables.ts`; `GET /familia/ausencias-justificables`; `familia/index.tsx` | dominio, HTTP, cliente |
| RF-402 | `causas.ts`, `lote.ts`; `POST /evidencias/reservas`, `POST /justificaciones/lotes`; `justificar.tsx`, `enviada.tsx` | dominio, HTTP, e2e |
| RF-403 | `lote.ts`; `lotes`, `revisiones`; selector de ausencias; bandeja por lote | dominio, contrato, HTTP, e2e |
| RF-404 | `causas.ts`, `sesionesAnticipables`; `GET /familia/sesiones-anticipables`; `anticipar.tsx` | dominio, HTTP |
| RF-405 | `plazo.ts`; `justificacion_plazos`; `PUT /ciclos/{id}/plazo-justificacion`; `plazo.tsx` | dominio, HTTP |
| RF-406 | `lote.ts`, `permisos.ts`; columnas `canal`/`registrada_*`; `registrar.tsx` | dominio, contrato, HTTP |
| RF-407 | `estados.ts`; trigger sin borrado; `alCambiarAsistencia`; `depurarEvidencias`; resumen en perfil | dominio, contrato, almacén, e2e |
| RF-408 | `estados.ts`, `permisos.ts`; bandeja y revisiones; pantallas de coordinación | dominio, HTTP, e2e |
| RF-409 | `efectos.ts`; `ConsultaJustificaciones`; notificación a 006/007 | dominio, e2e (con 003) |
| RF-410 | `permisos.ts`; `justificaciones_estado` + pull; `GET /familia/justificaciones`; `.../evidencia` | dominio, HTTP, cliente |
| RNF-401 | Pantalla única, preselección | cliente (interacciones), campo |
| RNF-402 | `compresion.ts`, `evidencia.ts`; `comprimir-foto.ts`; validación en reserva y lote | dominio, HTTP |
| RNF-403 | SAS delegado `c`/`r` 5 min; contenedor privado; auditoría de lectura | almacén, HTTP |
| RNF-404 | `enviar-justificacion.ts`; sin cola | cliente |
| RNF-405 | Bandeja y visor solo en línea | cliente |

## 11. Dependencias, riesgos, costo y dudas

**Dependencias**

| De | Necesito | Para |
| --- | --- | --- |
| 001 | Contexto de sesión (roles, delegación vigente, alcance familia), entrada por enlace, auditoría, motor de retención y retiro de consentimiento que llaman a `depurarEvidencias`, Bicep base (cuenta de Storage, CORS, CSP de Static Web Apps con `img-src` y `connect-src` del endpoint Blob), configuración de Jest | RF-401, RF-406, RF-407, RF-408, RF-410 |
| 002 | Catequizando, grupo vigente, apoderados del niño | RF-406, RF-410 |
| 003 | Puerto de lectura de ausencias por niño y ciclo, sesiones (también futuras), invocación de `alCambiarAsistencia`, protocolo de pull y esquema WatermelonDB, cómputo de falta que consulta `faltaJustificada` | RF-401, RF-404, RF-407, RF-409, RF-410 |
| 005 | Sesiones de actividades obligatorias justificables | RF-401 |
| 006, 007 | Consumen `ConsultaJustificaciones` y la notificación de cambio | RF-409 |
| 008 | Ciclo abierto, rechazo de escrituras con ciclo cerrado (las pendientes se congelan) | RF-405, RF-408 |

**Riesgos**

| Riesgo | Mitigación |
| --- | --- |
| La SAS no limita el tamaño del blob subido | Verificación de tamaño y firma JPEG antes de confirmar; borrado si no cumple; SAS de 5 min; límite de reservas por cuenta; limpieza diaria |
| Temporales de cámara o manipulator en el disco del celular | Borrado explícito en todos los caminos; test de cliente que lo verifica |
| Ausencias que llegan tarde por sincronización (catequista sin señal una semana) acortan el plazo real | El plazo cuenta desde la fecha de la ausencia según RF-405; se documenta a la coordinación al fijar el plazo |
| Evidencia compartida por hermanos y retiro de consentimiento de uno | Supuesto A-07 |
| Nivel Consumo de APIM sin límite por clave | Respaldo de límite en la Function (§5) |

**Costo en Azure** (≈ 100 niños, estimado 500 justificaciones por ciclo, ≈ 1 foto de 250 KB por lote): Blob ≈ 150 MB por ciclo, ≈ 300 MB con 2 años de retención → dentro de los 5 GB LRS gratis de 12 meses y luego < 0,01 USD/mes; transacciones y egreso despreciables. Functions y APIM Consumo: miles de llamadas al mes frente a 1 millón gratuito. PostgreSQL: unas miles de filas en el B1ms de 001. **Costo incremental ≈ 0** (R23).

**Dudas `[NECESITA ACLARACIÓN]` y supuestos provisionales**

| ID | Duda | Supuesto provisional (reversible) |
| --- | --- | --- |
| A-01 | ¿Cómo se entera el apoderado de la revisión? | Sin notificaciones: ve el estado al abrir su enlace. Reversible añadiendo notificación sin costo por mensaje en una spec futura. |
| A-02 | ¿"Familiar directo" incluye abuelos? | El sistema no valida el parentesco; la causa se muestra como "Enfermedad o fallecimiento de un familiar directo" y la coordinación juzga al revisar. Solo cambia un texto. |
| A-03 | Anticipación del evento escolar; ¿cita médica anticipada? | Sin antelación mínima, cualquier sesión futura del ciclo abierto; solo `evento_escolar` admite anticipada (`permiteAnticipada`, una constante). |
| A-04 | ¿La coordinación registra en nombre fuera de plazo? | No: se aplica el mismo plazo (RF-405). Reversible con una bandera en `permisos.ts`. |
| A-05 | ¿Revertir una aprobada falsa? | No en el MVP: aprobar y rechazar son definitivos; solo "sin efecto" por corrección. Reversible añadiendo la transición y su evento. |
| A-06 | ¿Capturas o documentos? ¿Máximo de imágenes? | Se aceptan imágenes de cámara o galería (incluidas capturas), convertidas a JPEG; sin PDF; máximo 3 por evidencia (`check` 1..3 y constante). |
| A-07 | (Derivada de RF-106 y RF-403) Evidencia compartida por hermanos cuando un apoderado retira el consentimiento de uno | Se elimina la evidencia completa (prima la privacidad); las justificaciones del hermano quedan "sin evidencia", como el caso límite de 001. |
| A-08 | El C4 ("almacena justificante temporal", compresión en backend) y el ADR 002 ("diferir fotos") contradicen RNF-404 y D-403; además 001 sustituye el servicio de autenticación externo | Este plan sigue la spec; se pide un ADR "Evidencias solo en línea" y actualizar el C4. No bloquea el desarrollo. |
| A-09 | Principio 1 exige justificar dependencias nuevas en la spec | Antes de la fase 3, la spec 004 recibe una nota de dependencias (§2, fila 1) aprobada por el equipo. |
| A-10 | Numeración de migraciones con 8 planes en paralelo | Se usa la secuencia global de plan 001; si 001 no la fija, se reserva el bloque 04xx. |
| A-11 | Plazo por defecto si la coordinación no lo definió | 7 días hasta que lo defina; el valor queda visible en `plazo.tsx`. |
| A-12 | Zona horaria del vencimiento | `America/Lima`, fin del día calendario. |
| A-13 | Falta con justificación solo de misa o solo de catequesis | Basta una aprobada de esa fecha para que la falta deje de contar (texto literal de RF-311); la interfaz agrupa misa y catequesis de un mismo domingo en una fila para que normalmente se justifiquen juntas. |
| A-14 | Qué ve la familia de justificaciones enviadas por el otro apoderado | Ve el estado y el motivo de todas las de sus hijos, con la etiqueta "otro apoderado", sin su nombre ni la evidencia. |

## 12. Orden de implementación

| Fase | Contenido | Termina cuando |
| --- | --- | --- |
| 0 | Prerrequisitos: fases de 001 (infra, sesión, enlace), 002 (niños, apoderados) y 003 (sesiones, ausencias, sync); resolver A-08 y A-09 | Puertos de 001/002/003 disponibles |
| 1 | Dominio puro `src/lib/justificaciones/` y retiro del tipo antiguo de `modelo.ts` | Tests de dominio en verde |
| 2 | Migraciones §3.1 y repositorios Postgres | Tests de contrato en verde |
| 3 | `infra/modulos/evidencias.bicep`, adaptador `AlmacenEvidencias`, Azurite | Tests de almacén en verde |
| 4 | Functions de familia: justificables, anticipables, reservas, lotes, mis justificaciones | Tests HTTP en verde |
| 5 | Cliente familia en web: picker, compresión, envío solo en línea, confirmación | Tests de cliente; prueba manual en celular sin la app |
| 6 | Coordinación: plazo, bandeja, revisión, visor de evidencia, registro en nombre de | Tests HTTP y de cliente en verde |
| 7 | Integración: `alCambiarAsistencia` (003), pull de `justificaciones_estado`, `ConsultaJustificaciones` (003/006/007), `depurarEvidencias` (001), temporizador de huérfanas | e2e en verde |
| 8 | Validación de criterios de finalización y medición de RNF-401 en campo | Todos los criterios de la spec verificados |

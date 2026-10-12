# Plan 005 — Avance formativo

> Plan técnico (CÓMO) de [spec.md](spec.md). Respeta [la constitución](../../docs/constitution.md) y las decisiones transversales fijas del proyecto. La spec 005 **no entra en el primer corte** de desarrollo (spec 003 completa + mínimo de 001 y 002).

## 1. Resumen y alcance

**Cubre:** RF-501, RF-502, RF-503, RF-504, RF-505, RF-506, RNF-501, RNF-502, RNF-503.

| Pieza | Qué hace este plan |
| --- | --- |
| Catálogo de oraciones (dueño) | 10 oraciones por ciclo con orden y mes sugerido; el mes es solo guía, ninguna oración vence (RF-501). |
| Evaluación de oraciones | Historial inmutable "sabe" / "aún no" por niño y oración, con fecha y evaluador; evaluación por lista de grupo con un toque por niño; sin conexión (RF-502, RNF-501, RNF-502). |
| Doctrina | Modelo extensible "instrumento + escala" como datos; el método y la escala reales quedan como supuesto provisional (RF-503). |
| Catálogo de actividades obligatorias (dueño) | Nombre, tipo y fecha; el cumplimiento se **deriva** de la asistencia de la spec 003, sin segundo registro (RF-504, RNF-503). |
| Pendientes | Vista del apoderado y lista por grupo para compartir, con registro de quién la generó (RF-505). |
| Quién evalúa y corrige | Catequistas del grupo + quien pasó la lista ese domingo; corrección con la misma regla de la asistencia (RF-506). |

**Fuera de alcance de este plan:**
- Registro de asistencia a actividades (lo hace la spec 003, RF-313; aquí solo se consume).
- Cómputo de falta (plan 003, RF-311): este plan solo aporta la regla "qué tipo de actividad suma falta".
- Criterio de "cumple doctrina", umbral de oraciones y saldo inicial desde papel (plan 006, RF-601, RF-602, RF-605).
- Lo que lista la spec como fuera de alcance: contenidos de sesiones, planificación semanal, evaluaciones respondidas por los niños, firma distinta de la asistencia.
- Qué se copia del catálogo al abrir un ciclo nuevo (plan 008).

## 2. Verificación contra la constitución

| # | Principio | Cómo se cumple |
| --- | --- | --- |
| 1 | Stack mínimo | Solo piezas ya fijadas: Expo SDK 57, WatermelonDB (plan 003), Functions + APIM + PostgreSQL (plan 001). Compartir usa `Share` del núcleo de React Native; **ninguna dependencia nueva** (D-507). |
| 2 | La spec manda | Cada tabla, regla, endpoint y pantalla cita su RF; matriz de cobertura en §10; cada test nombra su RF. |
| 3 | Lógica sin interfaz | Reglas en `src/lib/seguimiento/` y `src/lib/actividades/` (TypeScript puro); la API las importa vía esbuild y las pantallas solo delegan (D-503). |
| 4 | Tests en verde | Estrategia en §9; ningún RF sin test; `npm test`, typecheck y lint antes de cada commit. |
| 5 | Offline primero | Evaluaciones, correcciones y catálogos se escriben primero en WatermelonDB y viajan por el protocolo pull/push del plan 003 (D-510). Únicas excepciones con conexión: generar la lista para compartir (exige constancia en servidor, D-506) y la vista web del apoderado (D-512). |
| 6 | Persistencia segura | Todo registro con UUID generado en el dispositivo (también el `sesion_id` de la actividad, D-505). Migraciones nuevas en `api/migraciones/`, nunca editadas una vez aplicadas. Evaluaciones inmutables (D-501). |
| 7 | Datos de menores | Ningún dato restringido en estas tablas. Autorización por rol y alcance en cada Function y en cada manejador de sincronización. El reemplazante no baja avance ajeno (D-509). Familia solo ve pendientes de sus hijos. |
| 8 | Idioma | Identificadores, tablas y archivos en español sin tildes ni ñ (`evaluacion_oracion`, `aun_no`); textos visibles con tildes ("Aún no"). |
| 9 | Autoría trazable | Cada commit de implementación lleva su registro Agent Trace enlazado a la tarea de `tasks.md` de esta spec. |
| 10 | Contexto curado | El agente trabaja con `AGENTS.md`, la constitución, `spec.md`, este `plan.md` y `tasks.md`. |
| 11 | Skills como paquete | Migraciones y verificación se ejecutan con las Agent Skills del repo (nueva migración, verificación) cuando existan. |

## 3. Modelo de datos

**Integración backend 001–003 (2026-10-11):** adelantar `0505` con `actividad_obligatoria` mínima y `crearSesionActividad` no completa avance/oraciones/doctrina 005. `sesionId` es UUID v5 calculable en dispositivo según 003, no otro UUID aleatorio. La FK hacia `sesion` la añade este bloque; si `0505` ya fue aplicada, modificaciones van en migración nueva. `actividadSumaFalta`, cumplimiento, resumen y participante de retención son puertos con integración real pendiente; falsos no acreditan módulo completo.

Contrato físico/transporte actual: `sesion.actividad_id → actividad_obligatoria.id`, sin `actividad_obligatoria.sesion_id`; reprogramación produce otro UUID v5 de sesión y cancela anterior. `estado` es vigente/cancelada. `0506_actividades_trazabilidad.sql` agrega cuenta/credencial/dispositivo/huella_creacion y crea `cambio_actividad`; huella/controles/cambios nunca bajan en la fila sync. HTTP GET/POST/PATCH/cumplimiento y colección nativa ya tienen DTO de código en OpenAPI; no completan avance/oraciones/doctrina. El número 0506 queda ocupado por trazabilidad: listas pendientes futuras toman siguiente número libre.

### 3.1 PostgreSQL (`api/migraciones/`)

Columnas de control de sincronización (`creado_en_servidor`, `actualizado_en_servidor`, `eliminado_en` o equivalentes): **definidas en plan 003**; se añaden a toda tabla sincronizable. FK a `ciclo` (plan 008), `grupo` y `catequizando` (plan 002), `usuario` (plan 001), sesiones y asistencia (plan 003).

> Numeración provisional en el bloque `05NN`; el número definitivo lo fija el orden de fusión respetando las dependencias (supuesto S-11).

| Migración | Tabla | Columnas clave | Restricciones | RF |
| --- | --- | --- | --- | --- |
| `0501_catalogo_oraciones.sql` | `oracion` | `id uuid PK`, `ciclo_id`, `orden smallint`, `nombre text`, `mes_sugerido smallint`, `creado_por`, `creado_en` | `UNIQUE(ciclo_id, orden)`; `orden BETWEEN 1 AND 10`; `mes_sugerido BETWEEN 3 AND 12`; sin columna de vencimiento ni de estado "atrasada" | RF-501 |
| `0502_evaluaciones_oracion.sql` | `evaluacion_oracion` | `id uuid PK`, `catequizando_id`, `oracion_id`, `ciclo_id`, `grupo_id` (grupo del niño al evaluar), `resultado` (`sabe` \| `aun_no`), `evaluador_id`, `evaluado_en timestamptz` (hora del celular), `recibido_en timestamptz` (servidor), `dia_evaluacion date` | Inmutable: trigger que rechaza `UPDATE`/`DELETE` salvo por el motor de retención (plan 001); índice `(catequizando_id, oracion_id, evaluado_en)` | RF-502, RF-506 |
| `0503_doctrina.sql` | `escala_doctrina` | `id`, `ciclo_id`, `nombre`, `tipo` (`niveles` \| `numerica`), `niveles jsonb` (`[{codigo, etiqueta, orden}]`), `minimo`, `maximo` | `CHECK` coherente con `tipo` | RF-503 |
| | `instrumento_doctrina` | `id`, `ciclo_id`, `escala_id`, `nombre`, `tipo` (`tema` \| `periodica` \| `final`), `fecha date NULL`, `orden`, `cancelado boolean` | La escala no cambia si ya hay evaluaciones (validado en dominio) | RF-503 |
| | `evaluacion_doctrina` | `id`, `catequizando_id`, `instrumento_id`, `ciclo_id`, `grupo_id`, `valor_nivel text NULL`, `valor_numerico numeric NULL`, `evaluador_id`, `evaluado_en`, `recibido_en`, `dia_evaluacion` | `CHECK` exactamente un valor; inmutable como `evaluacion_oracion` | RF-503, RF-506 |
| `0504_correcciones_evaluacion.sql` | `correccion_evaluacion` | `id`, `evaluacion_oracion_id NULL`, `evaluacion_doctrina_id NULL`, `valor_anterior`, `valor_nuevo`, `corregido_por`, `corregido_en`, `recibido_en`, `motivo text NULL`, `por_coordinacion boolean` | `CHECK` exactamente una FK; `CHECK (NOT por_coordinacion OR motivo <> '')`; inmutable | RF-506 |
| `0505_actividades_obligatorias.sql` | `actividad_obligatoria` | `id`, `ciclo_id`, `nombre`, `tipo`, `fecha`, `estado` vigente/cancelada, `creado_por`, columnas sync; FK desde `sesion.actividad_id` | UUID sesión determinista por actividad/fecha, sin columna editable de sesión en catálogo | RF-504 |
| `0506_actividades_trazabilidad.sql` | Autoría en `actividad_obligatoria`; `cambio_actividad` | Autoría `cuenta_id`, `credencial_id`, `dispositivo_id`, `huella_creacion` servidor; cambios `id`, `ciclo_id`, `actividad_id`, `campo` nombre/tipo/fecha/estado, valores anterior/nuevo, autor/fecha | Cambio inmutable salvo motor con rol y contexto; DTO sync excluye huella/cambios | RF-504 |
| `05NN_listas_pendientes.sql` (siguiente libre, no 0506) | `lista_pendientes_generada` | `id`, `grupo_id`, `ciclo_id`, `generada_por`, `generada_en`, `corte_en`, `cantidad_ninos`, `huella_sha256`, `advertencia_aceptada` | Sin nombres (D-506); módulo externo pendiente | RF-505 |

**No hay tabla de cumplimiento de actividades** (RNF-503, D-505): el cumplimiento se lee de la asistencia de la sesión `sesion_id` (plan 003).

**Retención y consentimiento (plan 001):** `evaluacion_oracion`, `evaluacion_doctrina` y `correccion_evaluacion` se registran en el motor de retención: se eliminan al retirarse el consentimiento (RF-106 conserva solo asistencia anonimizada y constancia) y se anonimizan a los 2 años del cierre (RF-108). `lista_pendientes_generada` no contiene datos de niños.

### 3.2 Almacén local (WatermelonDB) — a incorporar al esquema del plan 003

| Tabla local | Sentido | Alcance que baja (pull) | RF |
| --- | --- | --- | --- |
| `oraciones` | pull; push solo coordinación | Ciclo abierto | RF-501 |
| `evaluaciones_oracion` | push (solo `created`) + pull | Niños de los grupos propios (coordinación: todos) | RF-502, RNF-502 |
| `escalas_doctrina`, `instrumentos_doctrina` | pull; push solo coordinación | Ciclo abierto | RF-503 |
| `evaluaciones_doctrina` | push (solo `created`) + pull | Niños de los grupos propios | RF-503, RNF-502 |
| `correcciones_evaluacion` | push (solo `created`) + pull | Evaluaciones de los grupos propios | RF-506 |
| `actividades_obligatorias` | pull; push solo coordinación | Ciclo abierto | RF-504 |

- Nada de datos restringidos (principio 7). Las listas generadas no se guardan en el celular.
- El cumplimiento de actividades en el perfil se calcula localmente con las tablas de asistencia del plan 003.
- El catequista reemplazante solo tiene la nómina (nombre y grupo, plan 003); no baja evaluaciones de grupos ajenos (D-509).
- Sin tabla local de borradores: la lista de evaluación se confirma en una sola transacción (D-508).

## 4. Lógica de dominio en `src/lib/` (TypeScript puro)

Firmas ilustrativas, no definitivas.

### `src/lib/seguimiento/`

| Archivo | Regla | RF |
| --- | --- | --- |
| `catalogo-oraciones.ts` | `validarCatalogoOraciones(oraciones): Resultado` — máx. 10, `orden` 1..10 único, `mes_sugerido` 3..12; `puedeEliminarOracion(oracion, tieneEvaluaciones)` (no se elimina una oración con historial). El tipo `EstadoOracion = 'sabe' \| 'aun_no' \| 'sin_evaluar'` **no tiene** valor "atrasada" y ninguna función recibe la fecha actual para calcular estado. | RF-501 |
| `historial-evaluaciones.ts` | Genérico para oraciones y doctrina: `valorEfectivo(evaluacion, correcciones)` (último valor de su cadena de correcciones); `evaluacionVigente(historial)` = evaluación más reciente por `evaluadoEn`, desempate por `recibidoEn` y luego `id` (supuesto S-3). | RF-502, RF-503, RF-506 |
| `oraciones.ts` | `estadoOracion(historial, correcciones)`; `resumenOraciones(catalogo, historiales) → { sabidas, total: 10, faltan: Oracion[] }`; `contarOracionesSabidas(...)` (consumido por plan 006). Válido para niños inscritos tarde o con cambio de grupo: el estado es por niño y ciclo, no por grupo. | RF-502, RF-505 |
| `doctrina.ts` | `validarValorEnEscala(escala, valor)`; `situacionDoctrina(instrumentos, evaluaciones, correcciones, escala) → { porInstrumento: [{instrumento, valorVigente \| null}], ultimoValor, evaluados, sinEvaluaciones }` (sin decidir si "cumple": eso es del plan 006). | RF-503 |
| `permisos-evaluacion.ts` | `puedeEvaluar(sesion, nino, contexto)`: verdadero si es catequista del grupo actual del niño, o si confirmó la lista de catequesis de ese grupo el mismo día (plan 003, RF-306) y la evaluación es de ese día; falso si el niño está retirado o el ciclo cerrado. `puedeCorregir(sesion, evaluacion, ahora, motivo)`: el evaluador hasta el fin de su día de evaluación; después solo coordinación (o delegado, plan 001) con motivo no vacío. Usa la regla "fin del domingo" **definida en plan 003** (importada, no duplicada). | RF-506 |
| `lista-pendientes.ts` | `construirListaPendientes(grupo, ninos, catalogo, historiales) → { texto, cantidadNinos }`: solo niños con pendientes, oraciones en orden del catálogo, nombre reducido (S-14). Texto determinista para que la huella sea reproducible. | RF-505 |

### `src/lib/actividades/`

| Archivo | Regla | RF |
| --- | --- | --- |
| `catalogo-actividades.ts` | `TIPOS_ACTIVIDAD`; `validarActividad(actividad)`; `puedeReprogramar(actividad, tieneAsistencias)` (solo sin asistencias registradas; si ya las hay: cancelar y crear otra). | RF-504 |
| `cumplimiento.ts` | `estadoCumplimiento(actividad, nino, asistencia, justificacion, hoy) → 'cumplida' \| 'no_cumplida' \| 'justificada' \| 'pendiente' \| 'cancelada' \| 'no_aplica'`. `cumplida` = presencia registrada en la sesión (plan 003) e incluye quién la registró como constancia. `no_aplica` si el niño se inscribió después de la fecha (S-9). | RF-504, RNF-503 |
| `falta-actividad.ts` | `actividadSumaFalta(actividad): boolean` — solo `jornada` no cancelada (S-5). La importa el cómputo de falta del plan 003 (RF-311). | RF-504 |

Los tipos de sesión de usuario y roles (`SesionUsuario`, delegación, supervisión) evolucionan desde `src/lib/domain/roles.ts`: **definido en plan 001**.

## 5. API (`api/src/modulos/seguimiento/` y `api/src/modulos/actividades/`)

Cada módulo con `dominio/` (reexporta `src/lib/...`), `aplicacion/`, `infraestructura/` (repositorios PostgreSQL) y `http/` (Functions v4). Autorización con el middleware de rol y alcance **definido en plan 001**, evaluado en cada petición.

### 5.1 Manejadores de sincronización (registrados en el servicio del plan 003)

| Tabla | Operaciones aceptadas | Validación y autorización en servidor | RF |
| --- | --- | --- | --- |
| `oraciones` | create/update; delete solo sin evaluaciones | Coordinación o delegado; `validarCatalogoOraciones` sobre el catálogo resultante | RF-501 |
| `evaluaciones_oracion` | solo create (idempotente por UUID; un update se rechaza) | `puedeEvaluar` con datos del servidor (grupo actual del niño; lista de catequesis confirmada por ese usuario ese día, plan 003); niño activo; ciclo abierto (si llega tras el cierre se descarta, plan 008, RF-802); fija `recibido_en` | RF-502, RF-506, RNF-502 |
| `escalas_doctrina`, `instrumentos_doctrina` | create/update | Coordinación o delegado; escala inmutable si hay evaluaciones | RF-503 |
| `evaluaciones_doctrina` | solo create | Igual que oraciones + `validarValorEnEscala` | RF-503, RF-506 |
| `correcciones_evaluacion` | solo create | `puedeCorregir` (evaluador mismo día, o coordinación con motivo); `valor_anterior` debe coincidir con el valor efectivo en servidor, si no se rechaza con aviso | RF-506 |
| `actividades_obligatorias` | create/update | Coordinación o delegado; en create invoca el puerto del plan 003 `crearSesionActividad({ sesionId, actividadId, fecha })`; cambios de fecha o estado generan `cambio_actividad` y se propagan a la sesión | RF-504 |

Los rechazos se informan al dispositivo con el mecanismo de rechazo del protocolo **definido en plan 003**; nunca se pierden en silencio.

### 5.2 Functions HTTP

| Function | Método y ruta | Autorización | RF |
| --- | --- | --- | --- |
| `seguimientoAvanceNino` | `GET /catequizandos/{id}/avance-formativo` | Coordinación/delegado; catequistas del grupo actual del niño | RF-502, RF-503, RF-504 |
| `seguimientoHistorialOracion` | `GET /catequizandos/{id}/oraciones/{oracionId}/historial` | Igual que el anterior | RF-502, RF-506 |
| `seguimientoPendientesFamilia` | `GET /familia/hijos/{id}/oraciones-pendientes` | Familia, solo si es apoderado vigente del niño; devuelve solo `sabidas`, `total` y nombres de oraciones faltantes | RF-505 |
| `seguimientoGenerarLista` | `POST /grupos/{grupoId}/listas-oraciones-pendientes` (cuerpo: `id` UUID del cliente, `advertenciaAceptada: true`) | Coordinación/delegado; con conexión; idempotente por `id`; guarda `lista_pendientes_generada` con `huella_sha256` (calculada con `node:crypto`) y devuelve el texto | RF-505 |
| `seguimientoListasGeneradas` | `GET /grupos/{grupoId}/listas-oraciones-pendientes` | Coordinación/delegado; muestra quién (seudónimo si es menor, plan 001) y cuándo | RF-505 |
| `actividadesCumplimiento` | `GET /actividades/{id}/cumplimiento` | Coordinación/delegado: todos; catequista: solo niños de sus grupos | RF-504 |

**Puerto interno para el plan 006:** `ConsultaAvanceFormativo` con `oracionesSabidas(catequizandoIds)` y `situacionDoctrina(catequizandoIds)`; tras aplicar evaluaciones o correcciones, `seguimiento` notifica al observador de recálculo que **define el plan 006** (RF-603 recalcula al cambiar un dato).

**Supervisión:** no consume estos endpoints; ve oraciones y doctrina a través de la aptitud (plan 006), según su alcance en RF-102.

### 5.3 Políticas de APIM

- CORS, autenticación JWT y límite global de peticiones: **definidos en plan 001**.
- `POST /grupos/{grupoId}/listas-oraciones-pendientes`: límite adicional de 10 llamadas por minuto por usuario (`rate-limit-by-key` con el `sub` del token).
- `GET /familia/...`: CORS con el origen de Azure Static Web Apps (plan 001).

## 6. Cliente (Expo Router)

Grupos de rutas por rol y la pantalla del perfil del niño: **definidos en planes 001 y 002**; aquí se usan provisionalmente `(equipo)`, `(coordinacion)` y `(familia)`.

| Ruta / componente | Comportamiento | Sin conexión | RF |
| --- | --- | --- | --- |
| `(equipo)/grupos/[grupoId]/oraciones/index.tsx` | Elegir oración del catálogo; muestra orden y mes sugerido como guía, nunca "atrasada". | Sí | RF-501, RF-502 |
| `(equipo)/grupos/[grupoId]/oraciones/[oracionId].tsx` | Lista del grupo, un toque por niño: sin marcar → **Sabe** → **Aún no** → sin marcar. "Guardar" escribe solo los marcados en una transacción local (D-508). Catequista del grupo ve el estado vigente; reemplazante ve solo la nómina (D-509). | Sí; contador de pendientes de envío (plan 003) | RF-502, RF-506, RNF-501, RNF-502 |
| `(equipo)/grupos/[grupoId]/doctrina/[instrumentoId].tsx` | Misma lista; el toque recorre los niveles de la escala. | Sí | RF-503, RNF-502 |
| `components/avance-formativo/resumen-avance.tsx` (embebido en el perfil del plan 002) | "Sabe X de 10" y cuáles faltan; situación en doctrina por instrumento; actividades cumplidas / no cumplidas / justificadas con quién registró la asistencia. | Sí, con datos sincronizados | RF-502, RF-503, RF-504 |
| `(equipo)/catequizandos/[id]/oraciones/[oracionId].tsx` | Historial de evaluaciones y correcciones; botón "Corregir" según `puedeCorregir` (motivo obligatorio para coordinación). | Sí | RF-502, RF-506 |
| `(coordinacion)/catalogo/oraciones.tsx` | Definir las 10 oraciones (nombre, orden, mes sugerido). | Sí (se valida al sincronizar) | RF-501 |
| `(coordinacion)/catalogo/doctrina.tsx` | Escala e instrumentos de doctrina. | Sí | RF-503 |
| `(coordinacion)/actividades/index.tsx` y `[actividadId].tsx` | Crear, cancelar o reprogramar actividades; ver quién cumplió (HU-503). | Crear: sí; cumplimiento: con datos sincronizados | RF-504 |
| `(coordinacion)/grupos/[grupoId]/pendientes.tsx` | Advertencia explícita de exposición (S-6) + "Generar"; muestra el texto y lo comparte con `Share.share({ message })`; historial de listas generadas. | No: exige conexión, lo dice con claridad | RF-505 |
| `(familia)/hijos/[id]/oraciones.tsx` (Expo web) | Por hijo: "Sabe X de 10" y oraciones que le faltan. | No (consulta en línea, D-512) | RF-505 |

## 7. Decisiones técnicas

| Id | Decisión | Alternativas descartadas | Justificación |
| --- | --- | --- | --- |
| D-501 | Evaluaciones **inmutables** (solo inserción); el estado se deriva del historial. | Tabla de estado con `UPDATE` por niño y oración; event sourcing general. | RF-502 exige historial; la inserción pura vuelve trivial el push idempotente de WatermelonDB (sin conflictos de actualización). |
| D-502 | Corrección = fila en `correccion_evaluacion` que apunta a la evaluación corregida; "olvidó la oración" = **nueva** evaluación "aún no". | Tratar toda corrección como nueva evaluación. | RF-506 distingue el error de registro (con plazo, motivo y traza) del cambio real de saber (RF-502); mezclarlos borraría la regla de plazo. |
| D-503 | Estado vigente calculado en TypeScript (`src/lib/seguimiento`) en cliente y servidor. | Vista SQL con `DISTINCT ON`. | Una sola implementación de la regla (principio 3); el volumen es pequeño (≈100 niños × 10 oraciones × pocas evaluaciones). |
| D-504 | Doctrina como **instrumento + escala** guardados como datos. | Nota numérica fija; una tabla por método. | El método está pendiente (RF-503): tema semanal, periódica o final son solo distinta cantidad de instrumentos; cambiar la escala no exige migración. |
| D-505 | Actividad catálogo + sesión 003 con UUID v5(actividad/fecha/ciclo) calculable en cliente; relación `sesion.actividad_id`, cumplimiento derivado | Columna sesión redundante en actividad; tabla de cumplimiento/firma propia | RNF-503/RF-504: un registro de asistencia; reprogramar cancela sesión anterior y genera nueva determinista; no sesión aleatoria |
| D-506 | Lista de pendientes generada **en el servidor, con conexión**; se guarda metadato + `corte_en` + huella SHA-256, no el contenido. | Generarla en el celular; guardar una copia del texto. | Debe coincidir con las evaluaciones registradas y dejar constancia (RF-505); como el historial es inmutable, el contenido es reproducible al `corte_en` sin duplicar datos personales fuera de la retención. |
| D-507 | Compartir como **texto plano** con `Share` de React Native (en web usa Web Share cuando existe; si no, texto seleccionable). | `expo-sharing` + PDF (`expo-print`). | Sin dependencias nuevas (principio 1); según la doc de SDK 57, `expo-sharing` comparte archivos locales y en web solo URLs; la familia recibe hoy la lista por mensajería como texto. |
| D-508 | La lista de evaluación es un borrador en pantalla y se guarda con un solo `database.write`. | Escribir en cada toque. | Escribir por toque generaría correcciones espurias al cambiar de opinión; el grupo es ≤ 20 niños, el riesgo de perder un borrador es bajo. |
| D-509 | El reemplazante evalúa sobre la nómina sin ver el estado previo del grupo ajeno. | Bajar el avance de todos los grupos a cada celular. | RNF-306 (plan 003): fuera de los grupos propios solo nombre y grupo. |
| D-510 | Catálogos (oraciones, doctrina, actividades) se escriben en el almacén local y se sincronizan, validados en servidor. | Endpoints REST solo en línea. | Principio 5; mismo canal para todas las escrituras; los rechazos de validación vuelven por el protocolo del plan 003. |
| D-511 | El plazo del evaluador reutiliza la regla "fin del domingo" del plan 003, aplicada al día de la evaluación. | Regla propia de 005. | RF-506 pide "la misma regla"; importarla evita divergencias. |
| D-512 | La vista del apoderado es una consulta en línea a un endpoint que devuelve solo pendientes. | Almacén local en la web de familias. | Minimización (principio 7) y simplicidad en Expo web; la familia consulta, no registra. |

**Ajustes de documentación a proponer (no los hace este plan):** en el C4, `cmpActividades` dice "Registra asistencia y firmas"; con D-505 pasa a "Catálogo de actividades y cumplimiento derivado de la asistencia". La relación `cmpSacramental -> cmpActividades` depende de la duda abierta del plan 006.

## 8. Estructura de archivos propuesta

```
api/
  migraciones/
    0501_catalogo_oraciones.sql
    0502_evaluaciones_oracion.sql
    0503_doctrina.sql
    0504_correcciones_evaluacion.sql
    0505_actividades_obligatorias.sql
    0506_actividades_trazabilidad.sql
    05NN_listas_pendientes.sql             # siguiente libre al implementar RF-505
  src/modulos/
    seguimiento/
      dominio/indice.ts                       # reexporta src/lib/seguimiento
      aplicacion/evaluar.ts, corregir.ts, generar-lista.ts, consulta-avance.ts
      infraestructura/repositorio-evaluaciones-pg.ts, repositorio-catalogo-pg.ts, repositorio-listas-pg.ts
      infraestructura/manejadores-sync.ts     # registra tablas en el servicio del plan 003
      http/avance-nino.ts, historial-oracion.ts, pendientes-familia.ts, generar-lista.ts, listas-generadas.ts
    actividades/
      dominio/indice.ts
      aplicacion/gestionar-actividad.ts, consultar-cumplimiento.ts
      infraestructura/repositorio-actividades-pg.ts, manejadores-sync.ts
      http/cumplimiento.ts
  tests/ (estructura definida en plan 001)
src/
  lib/seguimiento/
    catalogo-oraciones.ts, historial-evaluaciones.ts, oraciones.ts, doctrina.ts,
    permisos-evaluacion.ts, lista-pendientes.ts, tipos.ts
  lib/actividades/
    catalogo-actividades.ts, cumplimiento.ts, falta-actividad.ts, tipos.ts
  lib/almacen/modelos/  # modelos WatermelonDB de §3.2, en la ubicación que fije el plan 003
  components/avance-formativo/resumen-avance.tsx, lista-evaluacion.tsx
  app/(equipo)/grupos/[grupoId]/oraciones/index.tsx, [oracionId].tsx
  app/(equipo)/grupos/[grupoId]/doctrina/[instrumentoId].tsx
  app/(equipo)/catequizandos/[id]/oraciones/[oracionId].tsx
  app/(coordinacion)/catalogo/oraciones.tsx, doctrina.tsx
  app/(coordinacion)/actividades/index.tsx, [actividadId].tsx
  app/(coordinacion)/grupos/[grupoId]/pendientes.tsx
  app/(familia)/hijos/[id]/oraciones.tsx
```

## 9. Estrategia de tests

Runner, configuración de Jest, PostgreSQL en Docker y arnés del almacén local: **definidos en planes 001 y 003**. Todo nombre de test cita su RF.

### 9.1 Unitarios de dominio (`src/lib`, jest-expo)

| Test | Caso límite de la spec |
| --- | --- |
| `RF-501: rechaza catálogo con orden repetido, fuera de 1..10 o más de 10 oraciones` | — |
| `RF-501: ninguna oración resulta atrasada pase el mes sugerido` | "Ninguna aparece como atrasada" |
| `RF-501: no permite eliminar una oración con evaluaciones` | — |
| `RF-502: marca sabe antes del mes sugerido` | Aprende antes de su mes |
| `RF-502: acepta evaluar en un día distinto del domingo de la evaluación del grupo` | Ausente el domingo de la evaluación |
| `RF-502: sabe → aún no deja estado aún no y conserva ambas en el historial` | Olvida una oración |
| `RF-502: niño inscrito tarde tiene 10 oraciones y ninguna atrasada` | Inscrito tarde |
| `RF-502: las pendientes se conservan tras cambiar de grupo` | Cambio de grupo |
| `RF-502: resumen cuenta sabidas sobre 10 y lista las faltantes en orden` | — |
| `RF-502: dos evaluaciones distintas, prevalece la más reciente (supuesto S-3)` | Duda abierta 3 |
| `RF-503: rechaza valor fuera de la escala; situación sin evaluaciones = sinEvaluaciones` | — |
| `RF-503: situación por instrumento usa el valor efectivo tras corrección` | — |
| `RF-504: presente en la sesión = cumplida con su registrador` | — |
| `RF-504: ausente sin justificar = no cumplida; justificada aprobada = justificada` | — |
| `RF-504: actividad cancelada no se cuenta ni suma falta; reprogramada solo sin asistencias` | Actividad cancelada o reprogramada |
| `RF-504: solo la jornada suma falta (supuesto S-5)` | — |
| `RF-505: la lista incluye solo niños con pendientes y es determinista` | — |
| `RF-506: catequista del grupo evalúa; reemplazante solo el día de su lista confirmada` | Catequista reemplazante |
| `RF-506: evaluador corrige hasta el fin del día; después solo coordinación con motivo` | — |
| `RF-506: niño retirado no admite evaluación ni corrección` | Niño retirado |

### 9.2 Contrato de repositorios (`api`, PostgreSQL en Docker)

Una misma batería contra la implementación en memoria y la de PostgreSQL:
- `RF-502: el repositorio rechaza UPDATE y DELETE de evaluacion_oracion`.
- `RF-502: insertar dos veces el mismo UUID deja un solo registro` (idempotencia, RNF-502).
- `RF-506: corrección de coordinación sin motivo viola la restricción`.
- `RF-504: sesion referencia actividad y su UUID determinista evita duplicados`.
- `RF-505: lista_pendientes_generada no tiene columnas con datos de niños` (inspección de esquema).

### 9.3 HTTP y manejadores de sincronización (`api`)

- `RF-506: push de evaluación de un catequista ajeno al grupo sin lista ese día → rechazado`.
- `RF-506: push de evaluación del reemplazante con lista confirmada el mismo día → aceptado; al día siguiente → rechazado`.
- `RF-502: push repetido del mismo lote no duplica` y `RF-502: update de una evaluación se rechaza`.
- `RF-506: corrección con valor_anterior desactualizado se rechaza con aviso`.
- `RF-501: push de catálogo por catequista → 403`.
- `RF-505: familia consulta pendientes de un niño que no es su hijo → rechazado sin revelar existencia`.
- `RF-505: generar lista registra quién y cuándo, huella reproducible al corte_en; sin advertenciaAceptada → 400`.
- `RF-504: crear actividad crea sesión determinista con actividad_id y fecha`.
- `RF-504: cumplimiento por catequista solo incluye niños de sus grupos`.

### 9.4 Flujo extremo a extremo

- `RNF-502 / RNF-501: catequista sin conexión evalúa una oración para todo su grupo en una lista, reconecta y el perfil muestra X de 10` (cliente con almacén en memoria + API contra PostgreSQL).
- `RNF-503: asistencia registrada en una actividad aparece como cumplida sin otro registro`.
- `RF-504: inasistencia no justificada a una jornada suma una falta en el cómputo del plan 003`.
- `RF-505: la lista del grupo coincide con las evaluaciones y el apoderado ve solo las de su hijo`.
- Prueba de campo (manual, con constancia): tiempo de evaluar un grupo por lista frente a la práctica actual (RNF-501).

## 10. Matriz de cobertura

| Requisito | Componentes | Tests |
| --- | --- | --- |
| RF-501 | `oracion` (0501), `catalogo-oraciones.ts`, manejador `oraciones`, `(coordinacion)/catalogo/oraciones.tsx` | 9.1 RF-501 (×3), 9.3 RF-501 |
| RF-502 | `evaluacion_oracion` (0502), `historial-evaluaciones.ts`, `oraciones.ts`, manejador `evaluaciones_oracion`, `seguimientoAvanceNino`, `seguimientoHistorialOracion`, lista de evaluación, `resumen-avance.tsx` | 9.1 RF-502 (×7), 9.2, 9.3, 9.4 |
| RF-503 | `escala_doctrina`, `instrumento_doctrina`, `evaluacion_doctrina` (0503), `doctrina.ts`, manejadores de doctrina, `doctrina/[instrumentoId].tsx`, `resumen-avance.tsx` | 9.1 RF-503 (×2) |
| RF-504 | `actividad_obligatoria` (0505), `cambio_actividad`/autoría (0506), cumplimiento/falta/catálogo, `crearSesionActividad`, HTTP/sync; UI con evidencia propia | 9.1 RF-504 (×4), 9.2, 9.3, 9.4 |
| RF-505 | `lista_pendientes_generada` (siguiente libre, no 0506), listas/perfil familia/UI pendientes del módulo externo | 9.1 RF-505, 9.2, 9.3, 9.4 |
| RF-506 | `correccion_evaluacion` (0504), `permisos-evaluacion.ts`, validación en manejadores, historial con "Corregir" | 9.1 RF-506 (×3), 9.2, 9.3 RF-506 (×3) |
| RNF-501 | `lista-evaluacion.tsx`, D-508 | 9.4 + prueba de campo |
| RNF-502 | Tablas locales §3.2, manejadores de sync, D-501, D-510 | 9.2 idempotencia, 9.3, 9.4 |
| RNF-503 | D-505 (sin tabla de cumplimiento), `cumplimiento.ts` | 9.4 RNF-503, 9.2 RF-504 |

## 11. Dependencias, riesgos, costo y dudas

### 11.1 Dependencias

| Spec | Qué se necesita | Estado |
| --- | --- | --- |
| 001 | Infraestructura Azure, middleware de rol/alcance, delegación, seudónimo, motor de retención, configuración de Jest | Definido en plan 001 |
| 002 | `catequizando`, `grupo`, apoderados, estado activo/retirado, pantalla de perfil | Definido en plan 002 |
| 003 | Protocolo pull/push y registro de manejadores por tabla, esquema WatermelonDB (incorporar §3.2), sesiones y asistencia (puerto `crearSesionActividad`, lista confirmada por usuario y día), regla de fin del domingo, cómputo de falta que importa `actividadSumaFalta` | Definido en plan 003 |
| 004 | Estado de justificación de la ausencia a una actividad (para `justificada`) | Definido en plan 004 |
| 006 | Consume `ConsultaAvanceFormativo` (oraciones sabidas, situación en doctrina) y define el observador de recálculo y el criterio de doctrina | Definido en plan 006 |
| 008 | `ciclo`, cierre (descarte de registros tardíos), copia de catálogos al abrir ciclo | Definido en plan 008 |

### 11.2 Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Reloj del celular desfasado altera qué evaluación prevalece (S-3) | Se guardan `evaluado_en` y `recibido_en`; el historial completo permite revisar; la regla es una función pura reemplazable. |
| Doble conteo entre el saldo desde papel (plan 006, RF-605) y oraciones marcadas luego en el sistema | Coordinar con plan 006: el saldo debería registrar qué oraciones, no solo cuántas. Señalado como dependencia. |
| El método de doctrina definitivo no encaja en "instrumento + escala" | El modelo cubre tema, periódica y final; si no encaja, nueva migración aditiva. |
| La lista compartida sale del control de acceso y la retención | Advertencia explícita en cada generación, nombre reducido, solo pendientes (S-6, S-14). |
| El plan 003 modela las actividades distinto del puerto supuesto | Acordar el puerto antes de la fase 5; D-505 solo exige "una sesión por actividad con UUID del cliente". |

### 11.3 Costo en Azure

Incremental ≈ 0: unas 3 000 evaluaciones por ciclo (< 1 MB en el PostgreSQL B1ms compartido del plan 001); pocas miles de invocaciones de Functions y llamadas de APIM al mes, dentro de las concesiones gratuitas de Consumo. Sincronizar las evaluaciones de un grupo en un domingo ≈ 4 KB, dentro del presupuesto de RNF-304. Sin uso de Blob Storage.

### 11.4 Dudas `[NECESITA ACLARACIÓN]` y supuestos provisionales

| Id | Duda | Supuesto provisional (reversible) | Cómo se revierte |
| --- | --- | --- | --- |
| S-1 | Método y escala de doctrina (spec, duda 1) | **[NECESITA ACLARACIÓN]** Evaluaciones periódicas definidas por la coordinación como instrumentos, con escala de 3 niveles: "Logrado", "En proceso", "En inicio". | Son datos (`escala_doctrina`, `instrumento_doctrina`); cambiar no requiere código. |
| S-2 | Cuáles son las 10 oraciones y su orden (duda 2) | **[NECESITA ACLARACIÓN]** No se siembra ninguna lista: la coordinación las carga; hasta completar 10 la pantalla avisa "catálogo incompleto". | Carga de datos. |
| S-3 | Dos catequistas evalúan distinto la misma oración (duda 3) | **[NECESITA ACLARACIÓN]** Prevalece la evaluación más reciente por hora del celular; ambas quedan en el historial con su evaluador. | Cambiar `evaluacionVigente`; el historial está completo. |
| S-4 | Actividades de varios días (duda 4) | **[NECESITA ACLARACIÓN]** Cada día es una actividad propia (p. ej., "Semana Santa — Jueves"); se cumple asistiendo ese día. | Migración aditiva con agrupador de evento y regla de mínimo de días. |
| S-5 | Qué actividades suman falta (duda 5) | **[NECESITA ACLARACIÓN]** Solo `jornada`, literal de RF-504. | Cambiar `actividadSumaFalta`. |
| S-6 | Exposición de la lista a todos los padres (duda 6) | **[NECESITA ACLARACIÓN]** Se permite, con advertencia que la coordinación acepta en cada generación (`advertencia_aceptada`). | Desactivar la Function o endurecer la advertencia. |
| S-7 | Hora de "fin del domingo" (spec 003) | La que fije el plan 003; aplicada al día de la evaluación aunque no sea domingo. | Depende del plan 003. |
| S-8 | Qué cuenta como "pasó la lista" | Haber **confirmado** la lista de catequesis del grupo ese día (RF-306). | Cambiar `puedeEvaluar`. |
| S-9 | Actividades anteriores a la inscripción | `no_aplica` (coherente con "inscrito tarde, sin atrasos"). | Cambiar `estadoCumplimiento`. |
| S-10 | ¿Coordinación corrige también durante el domingo? | Sí, siempre con motivo. Coordinación no evalúa salvo que sea catequista del grupo. | Cambiar `puedeCorregir` / `puedeEvaluar`. |
| S-11 | Numeración de migraciones entre planes | Bloque `05NN` provisional, renumerado al fusionar. | Renumerar antes de aplicar. |
| S-12 | A quién aplica una actividad | A todos los niños activos del ciclo en su fecha. | Migración aditiva con grupos destinatarios. |
| S-13 | Qué ve la familia (spec 001, duda abierta) | De este plan, solo oraciones sabidas y faltantes de sus hijos. | Ampliar el endpoint. |
| S-14 | Formato del nombre en la lista | Nombres + inicial del primer apellido (dos iniciales si hay homónimos); solo niños con pendientes. | Cambiar `construirListaPendientes`. |

## 12. Orden de implementación por fases

| Fase | Contenido | RF | Requisito previo |
| --- | --- | --- | --- |
| 0 | Prerrequisitos: primer corte (003 completa, mínimo de 001 y 002), sincronización con registro de manejadores, ciclo (008) | — | Fuera de este plan |
| 1 | Dominio puro de oraciones: catálogo, historial, estado, resumen, permisos + tests 9.1 | RF-501, RF-502, RF-506 | Regla de fin del domingo (003) |
| 2 | Migraciones 0501, 0502, 0504; repositorios + contrato 9.2; manejadores de sync; modelos WatermelonDB | RF-501, RF-502, RF-506, RNF-502 | Esquema local del plan 003 |
| 3 | Pantallas: catálogo, lista de evaluación, historial/corrección, resumen en el perfil + tests HTTP y flujo sin conexión | RF-501, RF-502, RF-506, RNF-501, RNF-502 | Perfil del plan 002 |
| 4 | Doctrina: dominio, migración 0503, sync, pantallas | RF-503, RF-506 | Fase 2 |
| 5 | Actividades: dominio, migración 0505, puerto de sesión con 003, cumplimiento, regla de falta | RF-504, RNF-503 | Puerto acordado con plan 003; estado de justificación (004) |
| 6 | Pendientes: familia web/listas, migración siguiente libre (0506 ya trazabilidad), límites por cuenta Functions/global APIM | RF-505 | Enlace de familia (001) |
| 7 | Puerto `ConsultaAvanceFormativo` para el plan 006, flujo extremo a extremo, prueba de campo | Todos | Plan 006 |

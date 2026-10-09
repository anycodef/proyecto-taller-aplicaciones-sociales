# Plan 007 — Riesgo de deserción

Plan técnico (CÓMO) de [spec.md](spec.md). Todo lo transversal (infraestructura Azure, identidad, protocolo de sincronización, cómputo de falta, plazo de justificación) se **referencia** al plan que es su dueño; este plan solo define lo que le pertenece: la **máquina de pasos de riesgo**, la marca "posible abandono", el registro de contactos, la ficha de compromiso por faltas, el retiro confirmado, el saldo inicial desde papel y el motor de recálculo de alertas.

> La spec 007 **no entra en el primer corte de desarrollo** (spec 003 completa + mínimo de 001 y 002). Este plan se implementa después de que existan el protocolo de sincronización y el cómputo de falta (plan 003) y el plazo y estados de justificación (plan 004).

---

## 1. Resumen y alcance

| Requisito | Cubierto por este plan |
| --- | --- |
| RF-701 Conteo de faltas | Clasificación pura de cada falta (pendiente de justificar, en revisión, justificada, suma) sobre el cómputo de falta de 003 y el plazo/estado de justificaciones de 004 |
| RF-702 Pasos del proceso | Máquina de pasos pura con subidas y bajadas; alertas persistidas con apertura y cierre |
| RF-703 Ficha de compromiso | Registro sin imagen: fecha, apoderado que firmó, quién registró |
| RF-704 Retiro | Solo por confirmación humana con motivo; inactiva al niño vía módulo `catequizandos` (plan 002) |
| RF-705 Posible abandono | Parámetro N por ciclo; marca independiente del paso; confirmar (→ retiro) o descartar |
| RF-706 Registro de contactos | Resultado de lista cerrada + nota corta opcional; cierra la alerta de contacto |
| RF-707 Lista de riesgo | Lista ordenada por paso con faltas de origen; coordinación (todo) y catequista (sus grupos) |
| RF-708 Saldo inicial desde papel | Carga por niño (faltas + ficha) con fecha de corte, marcada "cargado desde papel" |
| RNF-701 Alerta oportuna | Recálculo automático cada 5 min (bandeja de pendientes + vencimientos de plazo) |
| RNF-702 Reglas explicables | Cada estado y alerta guarda las faltas que la originaron |
| RNF-703 Fuera del camino crítico | La asistencia solo inserta una marca de "recalcular"; el cálculo corre en una Function de temporizador |
| RNF-704 Sin alertas falsas sin conexión | Cálculo solo en el servidor con datos sincronizados; el celular recibe el resultado de solo lectura |
| RNF-705 Costo cero | Alertas solo dentro de la app; ningún mensaje, SMS ni correo |

**Fuera de alcance (de la spec):** modelos predictivos o puntajes (se elimina el tipo `SenalRiesgo` con `nivel: bajo|medio|alto` de `src/lib/domain/modelo.ts`, ver §4), señales por oraciones/doctrina, envío automático de mensajes, perseverancia post-sacramento.

**Fuera de este plan (son de otros dueños):** cómputo de falta y definición de "domingo consolidado" (plan 003); plazo de justificación y estados de justificación (plan 004); inactivar al niño, apoderados y grupo actual (plan 002); roles, delegación, auditoría (plan 001); congelamiento al cierre de ciclo (plan 008); lo que ve la familia de las faltas de su hijo (vistas de 003/004, alcance pendiente en 001).

---

## 2. Verificación contra la constitución

| # | Principio | Cómo se cumple |
| --- | --- | --- |
| 1 | Stack mínimo | Sin dependencias nuevas: WatermelonDB, Functions (temporizador), PostgreSQL y APIM ya decididos. No se añade cola (Storage Queue/Service Bus): la bandeja de recálculo es una tabla PostgreSQL (D-702). |
| 2 | La spec manda | Cada test cita su RF/RNF (`RF-702: ...`); matriz de cobertura en §10; las dudas abiertas se implementan solo como supuestos reversibles (§11). |
| 3 | Lógica sin interfaz | Toda la regla vive en `src/lib/riesgo/` (TypeScript puro, reloj inyectado como parámetro `ahora`). La API la importa y esbuild la empaqueta; las pantallas solo leen y delegan. |
| 4 | Tests en verde | Tests por tabla de la máquina de pasos, contrato de repositorio, manejadores de sincronización y flujo E2E; `npm test`, typecheck y lint antes de cada commit. |
| 5 | Offline primero | Contactos, fichas, retiros, saldos, descartes y parámetro se escriben primero en WatermelonDB y viajan por el push (D-704). La lista de riesgo se lee del almacén local. La asistencia nunca espera al riesgo (RNF-703). |
| 6 | Persistencia segura | Registros de usuario con UUID del dispositivo; las alertas y el estado son derivados del servidor con UUID generado en la Function (no hay serial). Migraciones SQL versionadas e inmutables. |
| 7 | Datos de menores | Ningún dato restringido en este módulo. La nota de contacto se limita a 140 caracteres con aviso "sin salud ni situaciones familiares" (D-710). Autorización por rol y alcance en cada manejador del servidor; supervisión y familia no acceden a riesgo. |
| 8 | Idioma | Identificadores sin tildes ni ñ (`riesgo_contacto`, `calcularPaso`, `posibleAbandono`); textos de interfaz con tildes. |
| 9 | Autoría trazable | Cada tarea de `tasks.md` se entrega en un commit con su registro Agent Trace enlazado a la tarea. |
| 10 | Contexto curado | El agente trabaja con `AGENTS.md`, la constitución, `spec.md` y este plan; los contratos con otras specs se citan por número de plan. |
| 11 | Skills como paquete | Las migraciones y la verificación usan las skills del repositorio (las define plan 001); este plan no crea skills nuevas. |

---

## 3. Modelo de datos

### 3.1 PostgreSQL (módulo `riesgo`)

Convenciones: enumeraciones como `text` + `CHECK` (más fáciles de ampliar por migración que los `ENUM` de PostgreSQL); toda tabla sincronizable lleva `actualizado_en timestamptz` del servidor y los campos que exija el protocolo de pull/push (definido en plan 003). Todas las tablas llevan `ciclo_id` (RF-801). El número `NNNN` de cada migración se toma del siguiente libre en la secuencia global de `api/migraciones/` al implementar (convención del plan 001).

**Migración `NNNN_riesgo_registros.sql`** — registros que crean las personas (UUID del dispositivo):

| Tabla | Columnas clave | Restricciones | RF |
| --- | --- | --- | --- |
| `riesgo_parametros` | `id uuid`, `ciclo_id`, `domingos_posible_abandono int`, `actualizado_por`, `actualizado_en` | `UNIQUE(ciclo_id)`; `CHECK (domingos_posible_abandono BETWEEN 1 AND 20)` | RF-705 |
| `riesgo_contacto` | `id uuid`, `ciclo_id`, `catequizando_id`, `apoderado_id`, `fecha date`, `resultado text`, `nota varchar(140) NULL`, `contactado_por`, `creado_en_dispositivo`, `recibido_en` | `resultado IN ('no_responde','se_compromete','justificara','se_retira','otro')`; FK a apoderado vinculado (plan 002); inmutable | RF-706 |
| `riesgo_ficha_compromiso` | `id uuid`, `ciclo_id`, `catequizando_id`, `apoderado_id`, `fecha_firma date`, `registrada_por`, `registrada_en`, `recibido_en` | `UNIQUE(ciclo_id, catequizando_id)`; sin columna de imagen | RF-703 |
| `riesgo_retiro` | `id uuid`, `ciclo_id`, `catequizando_id`, `motivo varchar(280)`, `origen text`, `confirmado_por`, `confirmado_en`, `recibido_en` | `UNIQUE(ciclo_id, catequizando_id)`; `CHECK (length(trim(motivo)) >= 3)`; `origen IN ('alerta_retiro','posible_abandono','otro')` | RF-704 |
| `riesgo_saldo_inicial` | `id uuid`, `ciclo_id`, `catequizando_id`, `faltas_no_justificadas int`, `ficha_firmada bool`, `fecha_corte date`, `cargado_por`, `cargado_en`, `reemplaza_a uuid NULL`, `vigente bool` | `CHECK (faltas_no_justificadas BETWEEN 0 AND 60)`; índice único parcial `(ciclo_id, catequizando_id) WHERE vigente` | RF-708 |
| `riesgo_descarte_abandono` | `id uuid`, `ciclo_id`, `catequizando_id`, `alerta_id`, `descartado_por`, `descartado_en`, `racha_al_descartar int` (la fija el servidor al recibir) | — | RF-705 |

**Migración `NNNN_riesgo_estado_y_alertas.sql`** — proyección derivada (la escribe solo el motor de recálculo):

| Tabla | Columnas clave | Restricciones | RF |
| --- | --- | --- | --- |
| `riesgo_estado` | `ciclo_id`, `catequizando_id`, `paso text`, `conteo int`, `sin_ficha bool`, `posible_abandono bool`, `racha_domingos int`, `faltas_origen jsonb`, `pendientes_justificar int`, `calculado_en`, `actualizado_en` | PK `(ciclo_id, catequizando_id)`; `paso IN ('sin_riesgo','contacto','citacion','seguimiento','alerta_retiro','retirado')` | RF-701, RF-702, RF-707, RNF-702 |
| `riesgo_alerta` | `id uuid`, `ciclo_id`, `catequizando_id`, `tipo text`, `sin_ficha bool`, `faltas_origen jsonb`, `abierta_en`, `cerrada_en NULL`, `motivo_cierre text NULL`, `cerrada_por NULL`, `actualizado_en` | `tipo IN ('contacto','citacion','alerta_retiro','posible_abandono')`; `motivo_cierre IN ('atendida_contacto','atendida_ficha','retiro_confirmado','descartada','ya_no_aplica','superada')`; índice único parcial: una alerta de paso abierta por niño y ciclo (`tipo <> 'posible_abandono' AND cerrada_en IS NULL`) y una de abandono abierta | RF-702, RF-705, RF-706, RF-707, RNF-702 |

`faltas_origen` (RNF-702): lista `[{ fecha, tipo: 'domingo'|'jornada'|'papel', estado, cantidad? }]`; el saldo de papel aparece como una sola entrada `{ tipo: 'papel', cantidad, fechaCorte }`.

**Migración `NNNN_riesgo_recalculo.sql`** — motor de recálculo (RNF-701, RNF-703):

| Tabla | Columnas | Uso |
| --- | --- | --- |
| `riesgo_recalculo_pendiente` | `ciclo_id`, `catequizando_id`, `motivo text`, `marcado_en` | PK `(ciclo_id, catequizando_id)`; `INSERT ... ON CONFLICT DO NOTHING`. Bandeja transaccional (outbox) que llenan 002/003/004/005 y este módulo. |
| `riesgo_marca_agua` | `ciclo_id PK`, `ultimo_vencimiento_procesado timestamptz` | Detecta faltas cuyo plazo venció desde la última ejecución. |

### 3.2 Almacén local (WatermelonDB)

El esquema y sus migraciones de WatermelonDB los gobierna el plan 003; este plan aporta estas tablas como un paso de migración de esquema.

| Tabla local | Dirección | Alcance del pull | RF |
| --- | --- | --- | --- |
| `estados_riesgo` | solo pull (lectura) | coordinación: todos; catequista: niños de sus grupos actuales | RF-701, RF-702, RF-707 |
| `alertas_riesgo` | solo pull | ídem (abiertas + cerradas del ciclo) | RF-702, RF-705, RF-707 |
| `contactos_riesgo` | push (crear) + pull | ídem | RF-706 |
| `fichas_compromiso_riesgo` | push (crear) + pull | ídem | RF-703 |
| `retiros_riesgo` | push (crear) + pull | solo coordinación | RF-704 |
| `saldos_iniciales_riesgo` | push (crear) + pull | solo coordinación | RF-708 |
| `descartes_abandono_riesgo` | push (crear) | — (el efecto llega por `alertas_riesgo`) | RF-705 |
| `parametros_riesgo` | push (actualizar) + pull | solo coordinación | RF-705 |

Ninguna tabla local contiene salud, neurodivergencia, documentos ni evidencias (principio 7). Al cerrar sesión se borran según RNF-102 (plan 001/003).

---

## 4. Lógica de dominio en `src/lib/riesgo/`

TypeScript puro; el reloj entra como parámetro `ahora: Date`. Reemplaza `SenalRiesgo` (puntaje fuera de alcance) de `src/lib/domain/modelo.ts` por `EstadoRiesgo`.

| Archivo | Firma ilustrativa | Regla | RF |
| --- | --- | --- | --- |
| `tipos.ts` | `Paso`, `ResultadoContacto`, `EstadoFalta = 'pendiente_justificar'\|'en_revision'\|'justificada'\|'suma'`, `TipoAlerta`, `MotivoCierre`, `EstadoRiesgo` | Vocabulario cerrado | RF-702, RF-706 |
| `clasificar-falta.ts` | `clasificarFalta(falta, justificacionesDeLaFecha, venceEn, ahora): EstadoFalta` | Aprobada (de cualquier sesión de esa fecha) → `justificada`. Antes de `venceEn` → `pendiente_justificar`. Vencido con alguna pendiente → `en_revision`. Vencido sin aprobada ni pendiente (ninguna o todas rechazadas/sin efecto) → `suma`. | RF-701 |
| `conteo.ts` | `contarFaltas(clasificadas, saldo?): { conteo, faltasOrigen, pendientesJustificar }` | Suma solo `suma`; añade `saldo.faltasNoJustificadas`; ignora faltas del sistema con `fecha <= saldo.fechaCorte` (evita doble conteo, D-707) | RF-701, RF-708, RNF-702 |
| `pasos.ts` | `calcularPaso({ conteo, fichaFirmada, retirado }): { paso, sinFicha }` | retirado → `retirado`; ≥4 → `alerta_retiro` (`sinFicha = !fichaFirmada`); 3 → `seguimiento` si ficha, si no `citacion`; 2 → `contacto`; 0–1 → `sin_riesgo` | RF-702, RF-703, RF-704 |
| `abandono.ts` | `calcularRacha(domingos): number`; `evaluarPosibleAbandono({ racha, n, ultimoContacto, ultimoDescarte }): boolean` | Racha = domingos consolidados seguidos (desde el más reciente) sin presencia en ninguna sesión realizada. Domingos sin ninguna sesión o no consolidados: ni suman ni cortan. Marca si `racha >= n` y (sin contacto o último contacto `no_responde`) y no hay descarte vigente (D-708) | RF-705 |
| `transiciones.ts` | `transicionar(previo: { estado, alertasAbiertas }, nuevo: EstadoRiesgo, eventos: { contactos, ficha, retiro, descartes }): { abrir: AlertaNueva[], cerrar: { id, motivo }[], actualizar: ... }` | Reglas de alertas, tabla completa en §9.2 | RF-702, RF-703, RF-704, RF-705, RF-706 |
| `evaluar-riesgo.ts` | `evaluarRiesgo(entrada, ahora): EstadoRiesgo` | Orquesta clasificar → contar → paso → abandono | RF-701, RF-702, RF-705 |
| `validaciones.ts` | `validarContacto`, `validarFicha`, `validarRetiro`, `validarSaldo`, `validarParametros` | Resultado en lista cerrada; nota ≤140; fecha no futura; motivo de retiro obligatorio (≥3, ≤280); saldo 0–60; N 1–20 | RF-703, RF-704, RF-705, RF-706, RF-708 |
| `lista-riesgo.ts` | `ordenarListaRiesgo(estados): EntradaLista[]`; `alertasPara(rol, alertas)` | Excluye `sin_riesgo` (salvo posible abandono) y `retirado`; orden: alerta de retiro, citación, contacto, seguimiento; posible abandono marcado aparte arriba. Destinatarios: contacto → catequista del grupo y coordinación; citación, retiro y abandono → coordinación | RF-707 |
| `index.ts` | barril | — | — |

Reglas de alertas (resumen de `transicionar`):

1. Como máximo **una alerta de paso abierta** por niño (la del paso actual) y una de posible abandono.
2. **Subida** de paso: cierra la alerta de paso anterior con `superada` y abre la del nuevo paso (contacto, citación, alerta de retiro; seguimiento no tiene alerta).
3. **Bajada** de paso (justificación aprobada, corrección a presente): cierra con `ya_no_aplica` y **no abre** alertas (la spec solo pide mostrar alerta al subir).
4. Contacto registrado con `fecha >=` fecha de la falta que llevó a 2 → cierra la de contacto con `atendida_contacto` (si el contacto es anterior a la apertura, la alerta se abre y se cierra en el mismo recálculo, para dejar historial).
5. Ficha registrada en citación → paso `seguimiento`, cierra con `atendida_ficha`. En alerta de retiro, actualiza `sin_ficha = false` sin cerrar.
6. En alerta de retiro, nuevas faltas solo actualizan `faltas_origen`; no abren otra alerta.
7. Retiro confirmado → paso `retirado`, cierra todo con `retiro_confirmado`. Ninguna regla produce un retiro (RF-704).
8. Posible abandono: abre al cumplirse la condición; cierra con `ya_no_aplica` si el niño asiste o llega un contacto con resultado distinto de `no_responde`; con `descartada` si la coordinación descarta.

---

## 5. API

### 5.1 Entradas del módulo `api/src/modulos/riesgo/`

007 **no expone endpoints HTTP propios**: las escrituras llegan por el push y las lecturas por el pull del protocolo de sincronización (endpoints, lotes e idempotencia definidos en plan 003). El módulo registra manejadores por tabla en el módulo `sincronizacion` y dos Functions de temporizador.

| Entrada | Tipo | Qué hace | Autorización (en el servidor) | RF |
| --- | --- | --- | --- | --- |
| `riesgoRecalculoTemporizador` | Timer `0 */5 * * * *` (UTC) | Toma `riesgo_recalculo_pendiente` con `FOR UPDATE SKIP LOCKED` + niños con faltas cuyo plazo venció desde `riesgo_marca_agua` + niños cuyo último domingo quedó consolidado; corre `evaluarRiesgo` + `transicionar`; persiste estado y alertas en una transacción por niño; borra la marca. Solo ciclo abierto. | Sin usuario; identidad administrada de la Function App (plan 001) | RF-701, RF-702, RF-705, RNF-701, RNF-703, RNF-704 |
| `riesgoReconciliacionNocturna` | Timer `0 0 7 * * *` (UTC = 02:00 Lima) | Recalcula todos los niños activos y retirados del ciclo abierto (~100); corrige cualquier marca perdida. Idempotente. | Ídem | RF-702, RNF-701 |
| Push `contactos_riesgo` | Manejador de sync | Valida, fuerza `contactado_por` = usuario del token, inserta `ON CONFLICT (id) DO NOTHING`, marca recálculo | Coordinación o delegado: cualquier niño del ciclo. Catequista: niño cuyo **grupo actual** está en sus grupos. `apoderado_id` debe estar vinculado al niño (plan 002). Supervisión y familia: rechazo | RF-706 |
| Push `fichas_compromiso_riesgo` | Manejador de sync | Valida, inserta; si ya existe otra ficha del niño en el ciclo, rechaza con aviso | Solo coordinación o delegado | RF-703 |
| Push `retiros_riesgo` | Manejador de sync | Valida motivo; inserta; llama a `catequizandos.marcarInactivo(tx, id, 'retiro')` (plan 002) en la misma transacción; marca recálculo. Retiro duplicado: conserva el primero, rechaza el segundo con aviso | Solo coordinación o delegado | RF-704 |
| Push `saldos_iniciales_riesgo` | Manejador de sync | Valida; marca el saldo anterior `vigente = false` y lo enlaza en `reemplaza_a`; marca recálculo | Solo coordinación o delegado | RF-708 |
| Push `descartes_abandono_riesgo` | Manejador de sync | Fija `racha_al_descartar` con el valor del servidor; marca recálculo | Solo coordinación o delegado | RF-705 |
| Push `parametros_riesgo` | Manejador de sync | Valida N; upsert por ciclo; marca recálculo de todo el ciclo | Solo coordinación o delegado | RF-705 |
| Pull de las tablas de §3.2 | Manejador de sync | Filtra por alcance; el alcance se resuelve con el **grupo actual** del niño, así las alertas lo siguen al cambiar de grupo | Ver columna "Alcance del pull" de §3.2; supervisión y familia: nada | RF-707 |

Cualquier rechazo por alcance se devuelve como rechazo por registro en la respuesta del push (formato de plan 003) y se registra en la auditoría (plan 001). Registros de un ciclo cerrado se descartan según plan 008 (RF-802).

### 5.2 Contratos con otros módulos

| Dirección | Función (firma ilustrativa) | Dueño |
| --- | --- | --- |
| Expone | `marcarRecalculoPendiente(tx, cicloId, catequizandoIds[], motivo)` — un `INSERT ... ON CONFLICT DO NOTHING`, sin cálculo | 007 |
| Expone | `contarRetirados(cicloId)`, `cicloTieneSaldosDePapel(cicloId)` para indicadores | 007 → consume 008 (RF-806) |
| La llaman | `asistencia` (push de asistencia, corrección RF-309, carné invalidado RF-303), `justificaciones` (envío, aprobación, rechazo, sin efecto), `actividades` (asistencia a jornadas), `catequizandos` (anulación) | 003, 004, 005, 002 |
| Consume | `obtenerFaltas(tx, cicloId, ids)` y `obtenerDomingosConsolidados(tx, cicloId, ids)` | plan 003 |
| Consume | `obtenerJustificacionesPorFecha(tx, ids)` y `calcularVencimientoPlazo(fecha, plazoDias)` (pura, en `src/lib/justificaciones/`) | plan 004 |
| Consume | `grupoActual`, `apoderadosVinculados`, `marcarInactivo` | plan 002 |
| Consume | middleware de sesión, `tienePermisoCoordinacion(sesion)` (incluye delegación), `gruposACargo`, auditoría, seudónimo | plan 001 |
| Consume | `cicloAbierto()` | plan 008 |

### 5.3 APIM

No hay operaciones nuevas en APIM: el tráfico de 007 viaja por las operaciones de sincronización ya publicadas (CORS, límite de peticiones y validación de JWT definidos en planes 001 y 003). Los temporizadores no pasan por APIM.

---

## 6. Cliente

Rutas Expo Router (SDK 57; rutas dinámicas con `[param]` y `useLocalSearchParams`). Todas leen de WatermelonDB con consultas reactivas, funcionan sin conexión y muestran "Calculado el <fecha y hora>" según `calculado_en` (RNF-704: el celular nunca recalcula).

| Ruta / componente | Quién | Comportamiento | RF |
| --- | --- | --- | --- |
| `src/app/riesgo/index.tsx` | Coordinación, catequista | Lista de riesgo con `ordenarListaRiesgo`: secciones por paso, insignia "sin ficha firmada", "posible abandono" arriba, faltas de origen por niño y contador "N pendientes de justificar". Coordinación ve todos los grupos con filtro por grupo; catequista, solo los suyos. Indicador de alertas nuevas desde la última visita (preferencia local en el dispositivo) | RF-701, RF-702, RF-705, RF-707, RNF-702 |
| `src/app/riesgo/[catequizandoId]/index.tsx` | Coordinación, catequista del grupo | Detalle: paso, alerta abierta y su historial, faltas con su estado (pendiente de justificar / en revisión / justificada / suma / "cargadas desde papel"), contactos, ficha. Botones según rol (la UI oculta; el servidor impone) | RF-701, RF-702, RF-703, RF-706, RF-708, RNF-702 |
| `src/app/riesgo/[catequizandoId]/contacto.tsx` | Coordinación, catequista del grupo | Elegir apoderado (si hay dos), fecha (hoy por defecto), resultado (5 botones), nota opcional con contador 140 y aviso "No escribas datos de salud ni situaciones familiares". Guarda local; muestra "Pendiente de envío" | RF-706 |
| `src/app/riesgo/[catequizandoId]/ficha.tsx` | Coordinación | Apoderado que firmó + fecha; sin cámara ni adjuntos | RF-703 |
| `src/app/riesgo/[catequizandoId]/retiro.tsx` | Coordinación | Motivo obligatorio + segunda confirmación explícita ("Retirar a <nombre>"). Accesible desde alerta de retiro, posible abandono ("Confirmar retiro") o detalle | RF-704, RF-705 |
| Acción "Descartar" en el detalle | Coordinación | Crea `descartes_abandono_riesgo` | RF-705 |
| `src/app/riesgo/saldo-inicial.tsx` | Coordinación | Nómina del ciclo; por niño: faltas no justificadas (numérico) y "ya firmó ficha" (interruptor); fecha de corte única para la carga. Muestra "cargado desde papel por <seudónimo> el <fecha>" | RF-708 |
| `src/app/riesgo/parametros.tsx` | Coordinación | N domingos para posible abandono | RF-705 |
| `src/components/riesgo/tarjeta-riesgo.tsx` | Perfil del niño (pantalla de plan 002) | Paso, alerta y enlace al detalle | RF-702 |
| `src/app/coordinacion.tsx` (existente) | Coordinación | Reemplaza el pendiente "señal de riesgo" por un acceso a `/riesgo` con el número de alertas abiertas | RF-707 |

Sin conexión: todo se lee del último pull; las escrituras quedan en WatermelonDB marcadas como pendientes y se muestran de forma optimista ("Contacto registrado, pendiente de envío") **sin cambiar el paso localmente**; el paso cambia cuando el pull trae el estado recalculado. Si el servidor rechaza un registro, se muestra el aviso que define el protocolo de plan 003. El registrador se muestra con su identidad operativa (seudónimo si es menor, plan 001).

---

## 7. Decisiones técnicas

| Id | Decisión | Alternativas descartadas | Justificación |
| --- | --- | --- | --- |
| D-701 | El paso es una **función pura derivada** de `{conteo, fichaFirmada, retirado}`; las alertas salen de comparar el estado previo con el nuevo (`transicionar`). | Máquina por eventos con estado mutable ("+1 falta"); vistas SQL. | Recalcular desde cero es idempotente, resuelve solo las bajadas, las sincronizaciones tardías y las correcciones, y se prueba por tabla. SQL duplicaría la regla fuera de `src/lib/` (principio 3). |
| D-702 | **Ambos disparadores**: bandeja transaccional `riesgo_recalculo_pendiente` que llenan los módulos al cambiar datos + Function de temporizador cada 5 min que la vacía y procesa vencimientos de plazo + reconciliación nocturna completa. | Recalcular dentro del push de asistencia (viola RNF-703 en el pico dominical); solo temporizador nocturno (viola RNF-701); disparador Storage Queue (no es transaccional con el cambio, añade bindings y cola de mensajes venenosos); triggers PostgreSQL (regla en SQL); cálculo en el celular (viola RNF-704). | El vencimiento de plazo es un evento de **tiempo**, no de datos: solo un temporizador lo detecta. La marca en la misma transacción del cambio cuesta un `INSERT` (no frena la asistencia) y no se pierde. 5 min cumple "en cuanto vence" con costo cero; la reconciliación nocturna cubre marcas olvidadas. |
| D-703 | El riesgo se calcula **solo en el servidor**; el celular recibe `estados_riesgo` y `alertas_riesgo` de solo lectura. | Cálculo local con lo que tiene el celular. | Un celular solo tiene sus propios registros; RNF-704 prohíbe alertas con datos parciales. |
| D-704 | Contacto, ficha, retiro, saldo, descarte y parámetro se escriben en WatermelonDB y viajan por el **push**; sin endpoints HTTP propios. | Endpoints HTTP en línea por acción. | Principio 5 (toda escritura va primero al almacén local). La spec 007 no establece excepción de "requiere conexión". Coste: la validación del servidor puede rechazar después; se mitiga con validación local idéntica (`validaciones.ts` compartido) y aviso de rechazo. |
| D-705 | Alertas **persistidas** con apertura, cierre y motivo. | Alertas calculadas al vuelo en cada lectura. | Permite historial, "cerrar alertas que ya no aplican", congelarlas al cierre de ciclo (plan 008, RF-802) y un pull pequeño. |
| D-706 | Retiro como **tabla propia** que, en la misma transacción, inactiva al niño mediante `catequizandos.marcarInactivo` (plan 002). Ningún código del motor escribe en `riesgo_retiro`. | Solo una bandera `activo = false`; retiro automático al llegar a 4. | RF-704 exige motivo, quién y cuándo, y prohíbe el retiro automático; la tabla separada deja abierta una futura reincorporación (duda abierta). Un test verifica que el motor nunca crea retiros. |
| D-707 | Saldo inicial = número + `fecha_corte`; las faltas del sistema con fecha ≤ corte se ignoran. Una corrección crea un saldo nuevo y marca el anterior como no vigente. | Crear N faltas sintéticas con fechas inventadas. | No inventa fechas (RNF-702 muestra "N cargadas desde papel"); evita el doble conteo si se registró asistencia antes de la carga; conserva quién y cuándo. |
| D-708 | Posible abandono es una **marca independiente** del paso. Un descarte la suprime hasta que la racha se corte o crezca N domingos más sobre `racha_al_descartar`. | Integrarla como paso; volver a marcar en cada recálculo. | El abandono silencioso puede ocurrir con pocas faltas sumadas (aún en plazo); sin supresión, la marca reaparecería a los 5 minutos de descartarla. |
| D-709 | Sin notificaciones push, SMS ni correo: alertas e indicador solo dentro de la app. | Expo Push Notifications (gratuito pero exige credenciales FCM/APNs y permiso del usuario). | RNF-705 y duda abierta sobre cómo enterarse; reversible añadiendo notificaciones sin cambiar el modelo. |
| D-710 | Nota de contacto ≤140 caracteres, sincronizada solo a celulares con alcance sobre el niño; aviso en pantalla. | Nota solo en servidor. | RF-706 pide que "todo el equipo lo sepa", también sin señal; no es dato restringido por la constitución. Riesgo residual en §11. |
| D-711 | Nuevo módulo `riesgo` en la API = nuevo componente C3 "Detección de Riesgo de Deserción". | Meterlo en `sacramental` o `asistencia` como sugiere hoy el C4. | Ciclo de vida propio (alertas, contactos, retiros). **Hay que actualizar `docs/diagrams/arquitectura-c4.dsl`** (fuera del alcance de este archivo). |

---

## 8. Estructura de archivos propuesta

```
src/lib/riesgo/
  tipos.ts  clasificar-falta.ts  conteo.ts  pasos.ts  abandono.ts
  transiciones.ts  evaluar-riesgo.ts  validaciones.ts  lista-riesgo.ts  index.ts
  __tests__/
    clasificar-falta.test.ts  conteo.test.ts  pasos.test.ts  abandono.test.ts
    transiciones.test.ts  validaciones.test.ts  lista-riesgo.test.ts
<carpeta de esquema WatermelonDB de plan 003>/riesgo/   # tablas y modelos de §3.2
src/app/riesgo/
  index.tsx  saldo-inicial.tsx  parametros.tsx
  [catequizandoId]/index.tsx  [catequizandoId]/contacto.tsx
  [catequizandoId]/ficha.tsx  [catequizandoId]/retiro.tsx
src/components/riesgo/
  tarjeta-riesgo.tsx  insignia-paso.tsx  lista-faltas-origen.tsx
api/migraciones/
  NNNN_riesgo_registros.sql  NNNN_riesgo_estado_y_alertas.sql  NNNN_riesgo_recalculo.sql
api/src/modulos/riesgo/
  dominio/       puertos.ts (RepositorioRiesgo, LectorFaltas, LectorJustificaciones), reexporta @/lib/riesgo
  aplicacion/    recalcular-riesgo.ts  marcar-recalculo.ts  registrar-contacto.ts
                 registrar-ficha.ts  confirmar-retiro.ts  cargar-saldo.ts
                 descartar-abandono.ts  fijar-parametros.ts  autorizacion.ts
  infraestructura/ repositorio-riesgo-pg.ts  lector-faltas.ts  lector-justificaciones.ts
  http/          temporizador-recalculo.ts  temporizador-reconciliacion.ts
                 manejadores-sincronizacion.ts   # registra push/pull por tabla en `sincronizacion`
api/test/riesgo/
  repositorio-riesgo.contrato.test.ts  recalculo.integracion.test.ts
  manejadores-sincronizacion.http.test.ts  flujo-riesgo.e2e.test.ts
```

---

## 9. Estrategia de tests

Runner y configuración: plan 001 (`jest-expo` en `src/`, Jest TS en `api/`, PostgreSQL en Docker). Cada nombre de test empieza con su identificador.

### 9.1 Unitarios de dominio (`src/lib/riesgo/__tests__`, `test.each`)

**`clasificarFalta` (RF-701)**

| Caso | Justificaciones | `ahora` vs `venceEn` | Esperado |
| --- | --- | --- | --- |
| Falta en plazo sin justificar | — | antes | `pendiente_justificar` |
| Falta justificada dentro del plazo | aprobada | antes | `justificada` |
| Falta en plazo con pendiente | pendiente | antes | `pendiente_justificar` |
| Vence sin justificación | — | después | `suma` |
| Vence con pendiente | pendiente | después | `en_revision` |
| Pendiente rechazada tras vencer | rechazada | después | `suma` |
| Pendiente aprobada tras vencer | aprobada | después | `justificada` |
| Dos apoderados: una rechazada, una pendiente | ambas | después | `en_revision` |
| Aprobada la de misa, nada en catequesis | aprobada (misa) | después | `justificada` |
| Justificación sin efecto | sin_efecto | después | `suma` |
| Exactamente en `venceEn` | — | igual | `suma` (límite inclusivo) |

**`contarFaltas` (RF-701, RF-708, RNF-702):** solo `suma` cuenta; saldo 2 + 1 falta posterior = 3; falta con fecha ≤ corte se ignora; `faltasOrigen` lista fechas y la entrada "papel".

**`calcularPaso` (RF-702):** conteo 0, 1, 2, 3 (con/sin ficha), 4 (con/sin ficha), 7, y retirado con cualquier conteo.

### 9.2 Tabla de transiciones (`transiciones.test.ts`, RF-702/703/704/705/706)

| # | Paso previo (alerta) | Entrada nueva | Paso nuevo | Abre | Cierra (motivo) |
| --- | --- | --- | --- | --- | --- |
| T1 | sin_riesgo | conteo 1 | sin_riesgo | — | — |
| T2 | sin_riesgo | conteo 2 | contacto | contacto | — |
| T3 | sin_riesgo | conteo 3, sin ficha (sync tardío) | citacion | citacion | — |
| T4 | sin_riesgo | conteo 3, ficha de papel | seguimiento | — | — |
| T5 | sin_riesgo | conteo 4, sin ficha | alerta_retiro | alerta_retiro (sin_ficha) | — |
| T6 | contacto (abierta) | contacto registrado | contacto | — | contacto (atendida_contacto) |
| T7 | contacto (atendida) | conteo 2 sin cambios | contacto | — (no reabre) | — |
| T8 | contacto (abierta) | contacto con fecha anterior a la 2.ª falta | contacto | — | — |
| T9 | contacto (abierta) | conteo 3, sin ficha | citacion | citacion | contacto (superada) |
| T10 | contacto (abierta) | conteo 1 (justificación aprobada) | sin_riesgo | — | contacto (ya_no_aplica) |
| T11 | citacion (abierta) | ficha registrada | seguimiento | — | citacion (atendida_ficha) |
| T12 | citacion (abierta) | contacto registrado | citacion | — | — |
| T13 | citacion (abierta) | conteo 2 (asistencia corregida a presente) | contacto | — (bajada) | citacion (ya_no_aplica) |
| T14 | citacion (abierta) | conteo 4, sin ficha (apoderado se negó a firmar) | alerta_retiro | alerta_retiro (sin_ficha) | citacion (superada) |
| T15 | seguimiento | conteo 4, con ficha | alerta_retiro | alerta_retiro (con ficha) | — |
| T16 | seguimiento | conteo 2 | contacto | — | — |
| T17 | alerta_retiro (sin_ficha) | ficha registrada | alerta_retiro | — | — (actualiza sin_ficha=false) |
| T18 | alerta_retiro | conteo 5 | alerta_retiro | — | — (actualiza faltas_origen) |
| T19 | alerta_retiro | conteo 3, con ficha | seguimiento | — | alerta_retiro (ya_no_aplica) |
| T20 | alerta_retiro | conteo 3, sin ficha | citacion | — (bajada) | alerta_retiro (ya_no_aplica) |
| T21 | alerta_retiro | retiro confirmado | retirado | — | alerta_retiro (retiro_confirmado) |
| T22 | contacto + posible abandono | retiro confirmado | retirado | — | ambas (retiro_confirmado) |
| T23 | retirado | conteo baja a 1 | retirado | — | — |
| T24 | sin_riesgo (tras T10) | conteo 2 otra vez | contacto | contacto (nueva) | — |
| T25 | cualquiera | solo recálculo sin cambios | igual | — | — (idempotencia) |
| T26 | cualquiera, conteo ≥4 por mucho tiempo | 100 recálculos | nunca `retirado` | — | — (RF-704) |
| A1 | sin marca | racha = N, sin contactos | igual | posible_abandono | — |
| A2 | sin marca | racha = N, último contacto `no_responde` | igual | posible_abandono | — |
| A3 | sin marca | racha = N, último contacto `se_compromete` | igual | — | — |
| A4 | sin marca | racha = N−1 | igual | — | — |
| A5 | marcado | el niño asiste (racha 0) | igual | — | posible_abandono (ya_no_aplica) |
| A6 | marcado | contacto `justificara` | igual | — | posible_abandono (ya_no_aplica) |
| A7 | marcado | descarte | igual | — | posible_abandono (descartada) |
| A8 | descartado en racha R | racha R+N−1 / R+N | igual | — / posible_abandono | — |
| A9 | — | domingo sin sesiones o no consolidado en medio | racha no se corta ni suma | — | — |

### 9.3 Validaciones (RF-703, 704, 705, 706, 708)

Resultado fuera de lista, nota de 141 caracteres, fecha futura, motivo vacío o de espacios, saldo negativo, N = 0 → rechazo con mensaje en español.

### 9.4 Contrato de repositorio (`api/test/riesgo/*.contrato.test.ts`, PostgreSQL en Docker)

- Insertar dos veces el mismo `id` de contacto → un solo registro (idempotencia por UUID).
- Índice único: no puede haber dos alertas de paso abiertas para el mismo niño.
- Segunda ficha o segundo retiro del mismo niño y ciclo → conflicto controlado.
- Saldo nuevo deja el anterior `vigente = false`.
- `marcarRecalculoPendiente` repetido → una sola fila; `SKIP LOCKED` evita que dos ejecuciones tomen el mismo niño.

### 9.5 Manejadores de sincronización (HTTP a través de la Function de sync de plan 003)

Matriz rol × tabla: coordinación, delegado vigente, delegado vencido, catequista (su grupo / otro grupo), supervisión y familia × {contactos, fichas, retiros, saldos, descartes, parámetros} en push, y alcance del pull. Se espera aceptación o rechazo según §5.1 y auditoría del rechazo. Casos: `contactado_por` falsificado se reemplaza por el usuario del token; apoderado no vinculado → rechazo; ciclo cerrado → descarte (plan 008).

### 9.6 Motor de recálculo (integración)

- RNF-703: el push de asistencia de 50 niños solo inserta marcas (se verifica que no llama a `evaluarRiesgo`, con un espía) y su duración no cambia con riesgo activo o inactivo.
- RNF-701: falta sin justificar; con el reloj antes del plazo, el temporizador deja "pendiente de justificar"; tras el plazo, el siguiente tick suma y abre la alerta sin acción manual.
- RNF-704: con la lista de catequesis de un grupo aún sin sincronizar, no hay falta ni alerta; al llegar, el tick la calcula; si después llega un escaneo de misa tardío, baja de paso.
- Reconciliación nocturna sobre una marca perdida corrige el estado.

### 9.7 Flujo extremo a extremo (`flujo-riesgo.e2e.test.ts`) — criterios de finalización

1. 2, 3 y 4 faltas no justificadas → contacto, citación, alerta de retiro (RF-702).
2. Falta en plazo no suma; al vencer sin justificación, suma (RF-701).
3. Aprobar una justificación baja el conteo y cierra la alerta que ya no aplica (RF-701, RF-702).
4. Cuarta falta sin ficha → alerta de retiro "sin ficha firmada" (RF-702).
5. N domingos sin asistencia y contacto `no_responde` → posible abandono (RF-705).
6. Ningún niño queda retirado sin un registro de retiro con motivo de una persona de coordinación (RF-704).
7. Saldo de papel (3 faltas, sin ficha) → citación; (2 faltas + ficha) + 2 faltas nuevas → alerta de retiro con ficha (RF-708).
8. Contacto con uno de dos apoderados guarda cuál (RF-706).
9. Cambio de grupo con alerta abierta: el pull del nuevo catequista la trae y el del anterior ya no (RF-707).

### 9.8 Cliente (jest-expo)

`retiro.tsx` no habilita "Confirmar" sin motivo ni sin la segunda confirmación (RF-704); `contacto.tsx` bloquea más de 140 caracteres (RF-706); la lista muestra el orden de `ordenarListaRiesgo` y las faltas de origen (RF-707, RNF-702); no existe ningún envío de mensajes (búsqueda estática de `sms:`/`mailto:`/APIs de mensajería en `src/app/riesgo`, RNF-705).

---

## 10. Matriz de cobertura

| Requisito | Componentes | Tests |
| --- | --- | --- |
| RF-701 | `clasificar-falta.ts`, `conteo.ts`, `lector-faltas.ts`, `lector-justificaciones.ts`, `riesgo/[catequizandoId]/index.tsx` | 9.1 tabla clasificar, contar; 9.6 RNF-701; 9.7 #2, #3 |
| RF-702 | `pasos.ts`, `transiciones.ts`, `riesgo_estado`, `riesgo_alerta`, `recalcular-riesgo.ts`, `tarjeta-riesgo.tsx` | 9.1 calcularPaso; 9.2 T1–T26; 9.7 #1, #3, #4 |
| RF-703 | `riesgo_ficha_compromiso`, `registrar-ficha.ts`, `ficha.tsx` | 9.2 T4, T11, T17; 9.3; 9.4 ficha duplicada; 9.5 |
| RF-704 | `riesgo_retiro`, `confirmar-retiro.ts`, `retiro.tsx`, `marcarInactivo` (002) | 9.2 T21–T23, T26; 9.3; 9.5; 9.7 #6; 9.8 |
| RF-705 | `abandono.ts`, `riesgo_parametros`, `riesgo_descarte_abandono`, `parametros.tsx` | 9.2 A1–A9, T22; 9.3; 9.5; 9.7 #5 |
| RF-706 | `riesgo_contacto`, `registrar-contacto.ts`, `contacto.tsx` | 9.2 T6–T8, T12, A6; 9.3; 9.4 idempotencia; 9.5; 9.7 #8; 9.8 |
| RF-707 | `lista-riesgo.ts`, pull por alcance, `riesgo/index.tsx`, `coordinacion.tsx` | 9.1 lista-riesgo; 9.5 alcance pull; 9.7 #9; 9.8 |
| RF-708 | `riesgo_saldo_inicial`, `conteo.ts`, `cargar-saldo.ts`, `saldo-inicial.tsx` | 9.1 contar con saldo; 9.2 T4; 9.4 saldo vigente; 9.7 #7 |
| RNF-701 | `temporizador-recalculo.ts`, `riesgo_marca_agua`, `temporizador-reconciliacion.ts` | 9.6 vencimiento y reconciliación |
| RNF-702 | `faltas_origen` en estado y alerta, `lista-faltas-origen.tsx` | 9.1 contar; 9.7 #1; 9.8 |
| RNF-703 | `marcarRecalculoPendiente`, temporizador | 9.6 espía y duración del push |
| RNF-704 | D-703, `obtenerDomingosConsolidados` (003), tablas locales de solo lectura | 9.6 lista sin sincronizar y escaneo tardío |
| RNF-705 | D-709 | 9.8 búsqueda estática |

---

## 11. Dependencias, riesgos, costo y dudas

### 11.1 Dependencias

| Spec | Qué necesita 007 | Bloquea |
| --- | --- | --- |
| 001 | Sesión con varios roles y delegación (`roles.ts` actual tiene un solo rol y no tiene supervisión), auditoría, seudónimo, infraestructura y Jest | Todo |
| 002 | Grupo actual, apoderados vinculados, `marcarInactivo`, pantalla de perfil para la tarjeta | RF-704, RF-706, RF-707 |
| 003 | Protocolo pull/push con manejadores por tabla, "entrada al alcance" tras cambio de grupo, esquema WatermelonDB, `obtenerFaltas`, `obtenerDomingosConsolidados`, llamada a `marcarRecalculoPendiente` | RF-701, RF-705, RF-707 |
| 004 | Estados de justificación, `calcularVencimientoPlazo`, llamada a `marcarRecalculoPendiente` | RF-701 (sin 004, toda falta vencida suma) |
| 005 | Faltas por jornada vía 003 y llamada a `marcarRecalculoPendiente` | RF-701 (jornadas) |
| 006 | Lee niños retirados (vía 002) para excluirlos de la propuesta | — (006 consume a 007) |
| 008 | `cicloAbierto`, congelamiento al cierre; consume `contarRetirados` y `cicloTieneSaldosDePapel` | — |

### 11.2 Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Escaneos o listas que llegan tarde bajan el paso después de abierta una alerta | Diseño por recálculo (D-701) y bajadas probadas (T10, T13, T19, T20); la alerta muestra `calculado_en` |
| Retiro confirmado sin conexión con datos viejos | La pantalla muestra la fecha del último cálculo y pide segunda confirmación; el servidor acepta (decisión humana) y el paso queda `retirado` |
| La nota de contacto se usa para escribir salud o situaciones familiares | 140 caracteres, aviso visible, sin campo libre en el retiro más allá del motivo (280); se revisa en la prueba de campo |
| Marca de recálculo olvidada por un módulo | Reconciliación nocturna completa (D-702) |
| El C4 no tiene el componente de riesgo | Actualizar `arquitectura-c4.dsl` (D-711) |
| Plan de hospedaje de Functions: Consumo en Linux se retira; los temporizadores dependen del plan elegido | Lo decide plan 001; los temporizadores funcionan igual en Consumo y Flex Consumption |

### 11.3 Costo en Azure

| Recurso | Uso de 007 | Costo |
| --- | --- | --- |
| Functions | ~8.900 ejecuciones/mes del temporizador de 5 min + 31 nocturnas, < 1 s cada una | Dentro de la concesión gratuita mensual de ejecuciones y GB‑s |
| PostgreSQL B1ms | 9 tablas pequeñas (< 1 MB por ciclo de ~100 niños) | Incluido en la instancia de plan 001 |
| APIM Consumo | Sin operaciones nuevas; el pull crece unos pocos KB por grupo | Dentro de la cuota gratuita de llamadas |
| Blob, mensajería | No se usan | 0 |

### 11.4 Dudas `[NECESITA ACLARACIÓN]` con supuesto provisional

| Duda (spec 007) | Supuesto provisional | Cómo se revierte |
| --- | --- | --- |
| Jornada en domingo a la que no va: ¿1 o 2 faltas? | **1 falta por fecha**. Lo aplica el cómputo de falta de plan 003; 007 consume la lista tal cual | Se cambia en el cómputo de 003; 007 no cambia |
| ¿Reincorporación en el mismo ciclo? | **No se permite** en v1; las faltas se conservan y se siguen mostrando | Añadir tabla `riesgo_reincorporacion` y regla "retirado → paso según conteo" (D-706 lo deja posible) |
| ¿Justificación aprobada tras el retiro revierte el retiro? | **No**; el conteo se recalcula y se muestra, el paso queda `retirado` (T23) | Cambiar la regla T23 y añadir reversión explícita por coordinación |
| ¿Cómo se enteran sin abrir el sistema? | **No se enteran**: solo dentro de la app, con indicador de alertas nuevas (D-709) | Añadir Expo Push Notifications (gratuito) leyendo `riesgo_alerta` |
| Valor inicial de N para posible abandono | **3 domingos**, configurable 1–20 por ciclo | Cambiar el valor por defecto en la migración siguiente o desde `parametros.tsx` |
| Alertas abiertas al cerrar el ciclo | Se **congelan** tal como estén (plan 008, RF-802); los temporizadores solo procesan el ciclo abierto | Lo decide plan 008 |
| ¿Otros factores de riesgo (padrino, dudas de los padres)? | **No se registran** como factor; se usa el resultado `otro` + nota corta | Ampliar la lista de resultados por migración |
| (Plan) Racha y justificaciones: ¿un domingo con justificación aprobada o pendiente cuenta para "domingos seguidos sin asistencia"? | **No cuenta ni corta** la racha (la familia sí respondió) | Cambiar `calcularRacha` |
| (Plan) ¿Qué pasos aparecen en la lista de riesgo? | Contacto, citación, seguimiento y alerta de retiro, más posible abandono; no sin riesgo ni retirado | Cambiar el filtro de `ordenarListaRiesgo` |
| (Plan) ¿La coordinación puede "decidir no retirar" y cerrar una alerta de retiro? | **No** en v1: la alerta sigue abierta hasta el retiro o hasta que baje el conteo (la spec solo define confirmar) | Añadir descarte de alerta de retiro como en D-708 |
| (Plan) ¿Qué ve la familia de 007? | **Nada** de pasos, alertas ni contactos; ve sus faltas por las vistas de 003/004 (alcance pendiente en 001) | Añadir alcance familia al pull/endpoint cuando 001 lo defina |
| (Plan) Un contacto o ficha puede corregirse? | Son **inmutables**; un error se corrige registrando uno nuevo | Añadir corrección con valor anterior |

---

## 12. Orden de implementación por fases

| Fase | Contenido | Requisito previo | RF |
| --- | --- | --- | --- |
| 0 | Confirmar contratos con planes 002, 003 y 004 (§5.2) y actualizar el C4 (D-711) | Planes aprobados | — |
| 1 | `src/lib/riesgo/` completo con tests de §9.1–9.3 (tabla de transiciones en verde); eliminar `SenalRiesgo` | Ninguno (TS puro) | RF-701–708 (reglas) |
| 2 | Migraciones `NNNN_riesgo_*` + `repositorio-riesgo-pg.ts` + tests de contrato §9.4 | Infra y Postgres de plan 001 | RF-702–708 |
| 3 | Motor: `marcarRecalculoPendiente`, lectores de faltas y justificaciones, temporizadores; llamadas desde 003/004/005; tests §9.6 | Cómputo de falta (003), justificaciones (004) | RF-701, RF-702, RF-705, RNF-701, RNF-703, RNF-704 |
| 4 | Manejadores de push/pull y autorización; tests §9.5 | Protocolo de sync (003), sesión y delegación (001), `marcarInactivo` (002) | RF-703–708 |
| 5 | Tablas WatermelonDB y pantallas de §6; tests §9.8 | Fase 4 + build de desarrollo EAS | RF-702–708, RNF-702, RNF-705 |
| 6 | Flujo E2E §9.7 con datos de prueba y prueba de campo con la coordinación | Fases 1–5 | Todos |

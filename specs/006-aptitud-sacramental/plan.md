# Plan 006 — Aptitud sacramental

> CÓMO implementar [spec.md](spec.md). Fuentes: [constitución](../../docs/constitution.md), [AGENTS.md](../../AGENTS.md), [convenciones](../README.md), [C4](../../docs/diagrams/arquitectura-c4.dsl) (componente backend «Evaluación Sacramental» = módulo `sacramental`).
> Esta spec **no entra en el primer corte** de desarrollo (003 + mínimo de 001 y 002). Su dominio puro (fase 1) puede escribirse antes porque no depende de nada.

## 1. Resumen y alcance

**Integración backend 001–003 (2026-10-11):** 003 expone `consultarAusencias` y eventos durables de asistencia; 001 aporta autorización/seudónimo/auditoría y registro de participantes. Estos puertos no completan el motor de aptitud 006. Consumidor real con cursor/idempotencia y participante de retención se verifican al integrar este módulo; todo timer UTC. Estado de evidencia en [seguimiento](../../docs/backend-implementacion.md).

| Id | Qué cubre este plan |
| --- | --- |
| RF-601 | Umbrales por ciclo (máximo de ausencias a misa, mínimo de oraciones, criterio de doctrina), versionados; sin propuesta mientras falte alguno. |
| RF-602 | Cálculo de las tres dimensiones por niño con su valor frente al umbral. |
| RF-603 | Regla de propuesta pura, completa para las 12 combinaciones (misa × oraciones × doctrina con «sin evaluación») más «umbral sin definir». |
| RF-604 | Decisión final de la coordinación o su delegado, con motivo si difiere; aviso derivado si la propuesta cambia después. |
| RF-605 | Saldo inicial desde papel por niño (ausencias y oraciones sabidas), marcado y sumado. |
| RF-606 | Cierre de decisiones → lista de aptos versionada, visible a supervisión, compartible con secretaría y conservada para la spec 008. |
| RNF-601 | Cada propuesta lleva el código de la regla aplicada y los valores de cada dimensión. |
| RNF-602 | Regla como tabla de decisión declarativa + test de tabla exhaustivo. |
| RNF-603 | Tablero de grupo calculado en el dispositivo desde WatermelonDB, sin red. |

**Fuera de alcance** (de la spec): constancias/certificados (la constancia sacramental es de 008, RF-805), padrinos y ceremonia, visto bueno de supervisión en el sistema, cargar el detalle de cada domingo previo al inicio de uso. **Fuera de este plan** por pertenecer a otros dueños: el protocolo de sincronización y el esquema WatermelonDB (plan 003), el estado efectivo de asistencia a misa (plan 003), el estado de justificaciones (plan 004), catálogo y evaluaciones de oraciones/doctrina (plan 005), ciclo y cierre de ciclo (plan 008), roles, delegación, auditoría y retención (plan 001).

## 2. Verificación contra la constitución

| # | Principio | Cómo se cumple |
| --- | --- | --- |
| 1 | Stack mínimo | Sin dependencias nuevas. Usa WatermelonDB y NetInfo (`@react-native-community/netinfo`, Expo SDK 57) ya fijados por el stack, y la API `Share` del núcleo de React Native (D-612). Sin recursos Azure nuevos. |
| 2 | La spec manda | Cada RF/RNF tiene fila en la matriz (§10) y tests con su id en el nombre. Las dudas se resuelven con supuestos explícitos (§11); el criterio de doctrina queda sin fijar (⇒ «sin propuesta», que es el comportamiento que manda RF-601) hasta que la coordinación lo confirme. |
| 3 | Lógica sin interfaz | Umbrales, dimensiones, regla, decisión, avisos y lista viven en `src/lib/sacramental/` como TypeScript puro; la API los importa (esbuild) y el cliente también, así servidor y celular calculan igual. |
| 4 | Tests en verde | Fases cerradas solo con `npm test`, `npm run typecheck` y `npm run lint` en verde. |
| 5 | Offline primero | Toda escritura de esta spec (umbral, saldo, decisión, cierre de decisiones, compartición) nace en WatermelonDB y se sincroniza por el protocolo del plan 003. El tablero se calcula localmente (RNF-603). Solo las **lecturas** de familia (web) y supervisión son en línea. |
| 6 | Persistencia segura | UUID generado en el dispositivo en todas las tablas; tablas solo de inserción (historial); migraciones nuevas `06NN_*.sql`, nunca editadas. |
| 7 | Datos de menores | Ninguna tabla local de esta spec contiene salud, neurodivergencia, documentos ni evidencias; de las justificaciones solo se usa su estado. Autorización por rol y alcance en cada Function y en cada lote de sincronización. Supervisión: solo lectura. Las decisiones (con motivos) solo bajan a celulares de coordinación/delegado. |
| 8 | Idioma | Identificadores sin tildes ni ñ (`umbral_aptitud`, `proponerAptitud`); textos de interfaz en español con tildes. |
| 9 | Autoría trazable | Cada commit de tarea lleva su registro Agent Trace enlazado a la tarea de `tasks.md` de esta spec. |
| 10 | Contexto curado | El agente trabaja con `AGENTS.md`, constitución, spec y este plan; nada fuera de ellos. |
| 11 | Skills como paquete | Migraciones y verificación se hacen con las skills del repo (nueva migración, verificación) cuando existan (plan 001). |

## 3. Modelo de datos

### 3.1 PostgreSQL (`api/migraciones/`)

Numeración: bloque `06NN` (supuesto S-11). Todas las tablas incluyen las columnas de sincronización que defina el plan 003 (p. ej. `recibido_en`, `actualizado_en_servidor`) y referencian `ciclo` (plan 008), `catequizando` (plan 002), `cuenta` (plan 001) y `oracion` (plan 005).

| Migración | Tabla | Columnas clave | RF |
| --- | --- | --- | --- |
| `0601_umbral_aptitud.sql` | `umbral_aptitud` (solo inserción; vigente = la última por `fijado_en`, desempate `recibido_en`) | `id uuid pk`, `ciclo_id`, `max_ausencias_misa int null check (>=0)`, `min_oraciones int null check (0..10)`, `criterio_doctrina jsonb null`, `motivo_cambio text null`, `fijado_por`, `fijado_en` (hora del celular), `recibido_en` | RF-601 |
| `0602_saldo_inicial_aptitud.sql` | `saldo_inicial_aptitud` (solo inserción; vigente = último por niño y ciclo) | `id`, `ciclo_id`, `catequizando_id`, `ausencias_misa int check (>=0)`, `oraciones_sabidas uuid[]` (ids del catálogo), `fecha_corte date`, `origen text default 'papel'`, `reemplaza_a uuid null`, `cargado_por`, `cargado_en`, `recibido_en` | RF-605 |
| `0603_decision_aptitud.sql` | `decision_aptitud` (solo inserción) | `id`, `ciclo_id`, `catequizando_id`, `resultado text check in ('apto','no_apto')`, `propuesta_al_decidir jsonb` (resultado + regla + valores), `motivo text null`, `decision_anterior_id uuid null`, `decidido_por`, `decidido_en`, `recibido_en`; `check (resultado = propuesta_al_decidir->>'resultado' or length(trim(motivo)) > 0)` | RF-604 |
| `0604_lista_sacramental.sql` | `cierre_decisiones_aptitud` | `id`, `ciclo_id`, `solicitado_por`, `solicitado_en`, `recibido_en`, `estado ('pendiente','aplicado','rechazado')`, `motivo_rechazo text null`, `lista_id uuid null` | RF-606 |
| | `lista_sacramental` | `id`, `ciclo_id`, `version int`, `cierre_id`, `generada_en`, `vigente bool`; `unique (ciclo_id, version)` | RF-606 |
| | `lista_sacramental_item` | `id`, `lista_id`, `catequizando_id` (referencia, sin copiar nombres: D-611), `grupo_id`, `sacramentos text[]` (`bautismo`, `primera_comunion`), `resumen jsonb` (ausencias/máximo, oraciones/mínimo, doctrina, saldo desde papel sí/no), `decision_id` | RF-606 |
| | `comparticion_lista_sacramental` | `id`, `lista_id`, `compartida_por`, `compartida_en`, `recibido_en`, `medio text` | RF-606 |

Sin tabla de propuestas ni de avisos: ambos se **derivan** (D-601). Índices: `(ciclo_id, catequizando_id, decidido_en desc)` en decisión y saldo; `(ciclo_id, fijado_en desc)` en umbral. La retención (motor del plan 001) anonimiza `lista_sacramental_item` con el resto del ciclo; lo que perdura es la constancia de 008 (RF-805).

### 3.2 Almacén local (WatermelonDB) — requisitos para el esquema del plan 003

Tablas **propias** que el plan 003 debe incluir en su esquema (nombres finales según su convención):

| Tabla local | Columnas | Baja a | Sube desde | RF |
| --- | --- | --- | --- | --- |
| `umbrales_aptitud` | las de §3.1 (`criterio_doctrina` como JSON en texto) | catequista, coordinación, delegado | coordinación, delegado | RF-601 |
| `saldos_iniciales_aptitud` | las de §3.1 (`oraciones_sabidas` como JSON en texto) | catequista (sus grupos), coordinación, delegado | coordinación, delegado | RF-605 |
| `decisiones_aptitud` | las de §3.1 | solo coordinación y delegado | coordinación, delegado | RF-604 |
| `cierres_decisiones_aptitud` | las de §3.1 (`estado` lo actualiza el servidor) | coordinación, delegado | coordinación, delegado | RF-606 |
| `comparticiones_lista` | las de §3.1 | — (solo sube) | coordinación, delegado | RF-606 |

Datos **consumidos** que deben existir localmente para calcular el tablero sin red (RNF-603), ninguno restringido:

| Dato | Campos mínimos | Dueño |
| --- | --- | --- |
| Nómina | `id`, `nombres`, `apellidos`, `grupo_id`, `estado` (activo/retirado/anulado), `fecha_inscripcion` en el ciclo | 002 / 003 |
| Sesiones de misa | `id`, `fecha`, `hay_misa`, `ventana_cerrada` | 003 |
| Asistencia a misa | registros necesarios para el estado efectivo por niño y misa (presente/ausente) | 003 |
| Justificaciones | solo `ausencia` (sesión + niño) y `estado` (pendiente/aprobada/rechazada/sin efecto); **sin evidencia ni causa** | 004 |
| Catálogo de oraciones y evaluaciones | `oracion.id`; evaluaciones con `oracion_id`, `valor` (sabe/aún no), `fecha` | 005 |
| Evaluaciones de doctrina | `fecha` y resultado normalizable a «logrado/no logrado» | 005 |
| Ciclo abierto | `id`, `inicio`, `fin` | 008 |

Alcance: catequista = sus grupos; coordinación y delegado = todos los grupos. Volumen estimado para coordinación: ~100 niños × ~40 misas ≈ 4 000 filas de asistencia, aceptable en SQLite.

### 3.3 Evolución del código existente

- `src/lib/domain/modelo.ts`: `CicloCatequetico.asistenciasRequeridas` («sesiones mínimas») contradice RF-602 (máximo de ausencias no justificadas). Queda reemplazado por `UmbralesAptitud`; el retiro del campo lo hace el plan 008 (dueño de ciclo).
- `src/lib/domain/roles.ts`: no tiene `supervision` ni delegación; los evoluciona el plan 001. Este plan solo consume sus funciones de autorización.

## 4. Lógica de dominio (`src/lib/sacramental/`)

Firmas ilustrativas (no es código final):

```ts
type UmbralesAptitud = { maxAusenciasMisa: number | null; minOraciones: number | null; criterioDoctrina: CriterioDoctrina | null };
type CriterioDoctrina = { tipo: "porcentaje_logrado"; minimo: number /* 0..100 */ }; // unión ampliable (D-603)
type EstadoDimension = "cumple" | "no_cumple" | "sin_umbral";
type SituacionDoctrina = "cumple" | "no_cumple" | "sin_evaluacion" | "sin_umbral";
type ResultadoPropuesta = "apto" | "no_apto" | "a_revisar" | "sin_propuesta";
type CodigoRegla = "R0_umbral_sin_definir" | "R1_no_cumple_misa" | "R2_misa_y_oraciones" | "R3_solo_misa" | "R4_misa_y_doctrina" | "R5_doctrina_sin_evaluacion";
type Propuesta = { resultado: ResultadoPropuesta; regla: CodigoRegla; dimensiones: DimensionesNino };
```

| Archivo | Función pura | Regla | RF |
| --- | --- | --- | --- |
| `umbrales.ts` | `validarUmbrales(u)`, `umbralesCompletos(u)`, `umbralVigente(versiones)` | Rangos válidos; completo = los tres no nulos; vigente = última versión. | RF-601 |
| `dimension-misa.ts` | `calcularMisa(entrada, umbrales)` → `{ ausenciasSistema, ausenciasPapel, total, maximo, estado }` | Cuenta misas con `hay_misa`, ventana cerrada, `fecha ≥ max(inicio ciclo, fecha_inscripcion, fecha_corte del saldo)`, estado efectivo ausente (plan 003) y **sin** justificación aprobada no anulada (004, RF-409). Suma `saldo.ausencias_misa`. `cumple ⇔ total ≤ máximo`. Solo misas dominicales (S-3). | RF-602, RF-605 |
| `dimension-oraciones.ts` | `calcularOraciones(evaluaciones, saldo, catalogo, umbrales)` → `{ sabidas, faltantes[], minimo, estado }` | Por oración: el saldo es una evaluación «sabe» con fecha `fecha_corte`; gana la evaluación más reciente (empate: la del sistema). Estado vigente de cada evaluación según plan 005. `cumple ⇔ sabidas ≥ mínimo`. | RF-602, RF-605 |
| `dimension-doctrina.ts` | `calcularDoctrina(evaluaciones, criterio)` → `{ logradas, total, situacion }` | Sin criterio ⇒ `sin_umbral`; 0 evaluaciones ⇒ `sin_evaluacion`; si no, aplica el criterio (provisional: % logradas ≥ mínimo). | RF-602 |
| `regla-aptitud.ts` | `TABLA_REGLA` (12 filas) y `proponerAptitud(dimensiones)` | Ver tabla abajo; R0 se evalúa primero. | RF-603, RNF-601, RNF-602 |
| `tablero.ts` | `construirTablero(nomina, datos, umbrales)` | Excluye retirados y anulados; agrega por niño (no por grupo, así un cambio de grupo no altera nada). | RF-602, RF-603 |
| `decision.ts` | `validarDecision(propuesta, resultado, motivo)`, `decisionVigente(decisiones)`, `detectarConflicto(decisiones)` | Solo `apto`/`no_apto`; motivo obligatorio si `resultado ≠ propuesta.resultado` (incluye `a_revisar`); prohibido decidir con `sin_propuesta`. Vigente = mayor `decidido_en`, desempate `recibido_en`. Conflicto = dos decisiones con igual `decision_anterior_id` y distinto resultado. | RF-604 |
| `avisos.ts` | `avisosDeAptitud(decisionesVigentes, propuestasActuales)` | Aviso si `propuestaActual.resultado ≠ decision.propuesta_al_decidir.resultado`, o si hay conflicto; incluye las dimensiones antes/ahora. La decisión no se toca. | RF-604 |
| `saldo-inicial.ts` | `validarSaldo(saldo, catalogo, ciclo)` | Ausencias ≥ 0; oraciones ⊆ catálogo, sin repetir; `fecha_corte` dentro del ciclo. | RF-605 |
| `lista.ts` | `validarCierre(nomina, decisiones, avisos)`, `generarLista(...)`, `sacramentosARecibir(bautizado)`, `textoCompartible(lista)` | Cierre exige decisión vigente para todo niño activo y ningún aviso/conflicto abierto (S-9). Ítems = decisiones vigentes `apto`. No bautizado ⇒ `[bautismo, primera_comunion]`. | RF-606 |
| `puertos.ts` | Interfaces de repositorio (`RepositorioAptitud`) | Implementadas en Postgres (API) y WatermelonDB (cliente). | todos |

**Tabla de la regla (RF-603, RNF-602).** C = cumple, N = no cumple, S = sin evaluación de doctrina.

| # | Misa | Oraciones | Doctrina | Propuesta | Regla |
| --- | --- | --- | --- | --- | --- |
| 1 | C | C | C | apto | R2 |
| 2 | C | C | N | apto | R2 |
| 3 | C | C | S | apto | R2 (D-604) |
| 4 | C | N | C | a_revisar | R4 |
| 5 | C | N | N | no_apto | R3 |
| 6 | C | N | S | a_revisar | R5 |
| 7–12 | N | C/N | C/N/S | no_apto | R1 |
| — | algún umbral sin definir | | | sin_propuesta | R0 |

## 5. API (módulo `api/src/modulos/sacramental/`)

Todas las rutas pasan por APIM (políticas base de CORS, límite de peticiones y validación de token: definidas en plan 001); respuestas con `Cache-Control: no-store`. Sin políticas propias adicionales. Autorización con alcance en cada Function usando el componente `seguridad` (plan 001); el delegado vigente tiene los permisos de coordinación (RF-104).

| Function (modelo v4) | Método y ruta | Coord./delegado | Catequista | Supervisión | Familia | RF |
| --- | --- | --- | --- | --- | --- | --- |
| `sacramentalTablero` | `GET /sacramental/ciclos/{cicloId}/tablero?grupoId=` | todos los grupos | solo sus grupos (403 si no) | todos, lectura | 403 | RF-602, RF-603, RNF-601 |
| `sacramentalDetalle` | `GET /sacramental/catequizandos/{id}/aptitud` | dimensiones, propuesta, decisiones e historial | dimensiones y propuesta de sus grupos, sin decisiones (S-10) | todo, lectura | 403 | RF-602–RF-604 |
| `sacramentalFamilia` | `GET /sacramental/familia/aptitud` | — | — | — | solo sus hijos; solo las tres dimensiones con su valor | RF-602 |
| `sacramentalUmbrales` | `GET /sacramental/ciclos/{cicloId}/umbrales` | vigente + historial | vigente | vigente + historial | 403 | RF-601 |
| `sacramentalAvisos` | `GET /sacramental/ciclos/{cicloId}/avisos` | sí | 403 | 403 | 403 | RF-604 |
| `sacramentalListas` | `GET /sacramental/ciclos/{cicloId}/listas[/vigente]` | sí | 403 | sí, lectura | 403 | RF-606 |

**Escrituras** (sin endpoint propio): el módulo registra manejadores de sus tablas en el servicio de sincronización del plan 003 (`push` idempotente por UUID).

| Tabla en `push` | Validación en servidor | RF |
| --- | --- | --- |
| `umbral_aptitud` | Rol coordinación/delegado vigente al recibir; `validarUmbrales`; ciclo abierto (si no, se descarta según 008, RF-802). | RF-601 |
| `saldo_inicial_aptitud` | Igual + `validarSaldo`. | RF-605 |
| `decision_aptitud` | Igual + `validarDecision` contra la `propuesta_al_decidir` enviada (lo que vio quien decidió); el aviso por diferencia con la propuesta del servidor surge solo (D-601). Rechazo ⇒ aviso a coordinación (patrón de 001, RF-112). | RF-604 |
| `cierre_decisiones_aptitud` | Igual + `validarCierre` con datos del servidor; en la misma transacción genera `lista_sacramental` v+1, marca la anterior no vigente y deja `estado = aplicado` o `rechazado` con motivo. | RF-606 |
| `comparticion_lista_sacramental` | Rol coordinación/delegado; lista existente. | RF-606 |

Cualquier `push` de estas tablas desde supervisión, catequista o familia ⇒ rechazo (403 por registro). **Puertos para otras specs**: `listaVigente(cicloId)` y `contarAptos(cicloId)` (plan 008, RF-804/RF-806), `cicloTieneSaldosDesdePapel(cicloId)` (plan 008, RF-806). Sin Functions de temporizador: propuestas y avisos se derivan en cada lectura (~100–300 niños, una consulta agregada).

## 6. Cliente (Expo Router, `src/app/`)

Las rutas por rol y sus layouts los fija el plan 001; aquí se indican las pantallas de esta spec.

| Ruta | Quién | Comportamiento | Sin conexión | RF |
| --- | --- | --- | --- | --- |
| `aptitud/index.tsx` | catequista, coordinación, delegado | Tablero por grupo: por niño, las tres dimensiones con valor/umbral, propuesta y regla en texto; insignia de avisos (coordinación). | Sí: calculado con `construirTablero` sobre WatermelonDB (reactivo); muestra «datos sincronizados hasta…» y registros pendientes. | RF-602, RF-603, RNF-601, RNF-603 |
| `aptitud/[catequizandoId].tsx` | ídem; supervisión en línea | Detalle con explicación («cumple misa: 2 de 3 ausencias…»), marca «incluye saldo desde papel», historial de decisiones (solo coordinación/supervisión); acción **Confirmar/Cambiar** con motivo obligatorio si difiere. Aviso de no anotar datos de salud en el motivo. | Sí (lectura y decisión local). | RF-602–RF-605 |
| `aptitud/umbrales.tsx` | coordinación, delegado | Fijar o cambiar umbrales; al cambiar a mitad de ciclo, motivo opcional y vista previa de cuántas propuestas y decisiones cambian. | Sí (escritura local). | RF-601 |
| `aptitud/saldo-inicial.tsx` | coordinación, delegado | Por niño: ausencias, oraciones sabidas (lista con un toque por oración), fecha de corte. | Sí. | RF-605 |
| `aptitud/avisos.tsx` | coordinación, delegado | Decisiones cuya propuesta cambió o en conflicto, con antes/ahora; atajo a confirmar o cambiar. | Sí (derivado localmente). | RF-604 |
| `aptitud/lista.tsx` | coordinación, delegado; supervisión en línea | Validación previa del cierre, «Cerrar decisiones» (escritura local; estado «pendiente de envío» → «lista generada vN»); lista vigente; **Compartir** con secretaría (D-612). | Cierre y compartir: sí; ver la lista generada: tras sincronizar. | RF-606 |
| `familia.tsx` (sección) | familia (web) | Las tres dimensiones de cada hijo, sin propuesta ni decisión. | No (en línea, S-12). | RF-602 |

Repositorio local: `src/datos/sacramental/repositorio-aptitud-local.ts` implementa `RepositorioAptitud` sobre WatermelonDB (ubicación según convención del plan 003). Las pantallas solo presentan y delegan en `src/lib/sacramental/`.

## 7. Decisiones técnicas

| Id | Decisión | Alternativas descartadas | Justificación |
| --- | --- | --- | --- |
| D-601 | Propuestas y avisos **derivados** al leer (servidor y celular), no materializados. | Tabla `propuesta` recalculada por eventos de otros módulos; Function de temporizador; disparadores SQL. | RF-603 exige recalcular ante cualquier cambio: derivar elimina el acoplamiento con 003/004/005 y la desincronización. El volumen (cientos de niños) lo permite. |
| D-602 | Regla como tabla declarativa `TABLA_REGLA` de 12 filas indexada por (misa, oraciones, doctrina). | `if` anidados. | La tabla es la misma que la de la spec y la del test (RNF-602); un cambio de regla es un cambio de fila. |
| D-603 | Doctrina tri-valor (`cumple`/`no_cumple`/`sin_evaluacion`) con criterio enchufable (unión discriminada en `jsonb`). Provisional: `porcentaje_logrado`. | Nota numérica fija; booleano. | El método es duda abierta en 005; la regla no cambia si cambia el criterio, solo su variante. |
| D-604 | Misa C + oraciones C + doctrina S ⇒ `apto`. | `a_revisar`. | RF-603 dice «apto … cumpla o no doctrina»; «sin evaluación» solo cambia el resultado donde la doctrina decide (fila 6). Reversible cambiando la fila 3 (S-1). |
| D-605 | Saldo de oraciones como **conjunto de ids** + `fecha_corte`; ausencias como número. Sistema cuenta desde `fecha_corte`. | Saldo de oraciones como número. | Evita contar dos veces una oración que luego se marca en el sistema y respeta el «aún no» posterior (005, RF-502). |
| D-606 | Decisiones solo inserción con `decision_anterior_id`; vigente por `decidido_en`; conflicto ⇒ aviso. | Una fila por niño con último-escribe-gana silencioso; bloquear decisiones sin conexión. | Principio 5 exige escribir sin red; se conserva todo el historial (RF-604) y el conflicto coordinación/delegado no se pierde (S-7). |
| D-607 | Motivo obligatorio siempre que el resultado ≠ propuesta (incluye `a_revisar`); no se decide con `sin_propuesta`. | Motivo solo al contradecir `apto`/`no_apto`. | `a_revisar` nunca coincide con un resultado final; el motivo es el respaldo pedido en HU-603. |
| D-608 | Umbrales versionados: cada versión guarda los tres valores. | Fila única actualizable; una fila por umbral. | RF-601 exige registrar cada cambio; la versión completa simplifica `umbralVigente`. |
| D-609 | El tablero se calcula en el celular con la misma librería que la API. | Resumen calculado en el servidor y bajado por sincronización. | RNF-603 y reflejo inmediato de evaluaciones hechas sin red; la paridad se asegura con el mismo código y un test de paridad. |
| D-610 | «Cerrar decisiones» es un registro local sincronizado; la lista la genera el servidor, versionada. | Endpoint `POST` en línea. | Principio 5; el servidor valida con la verdad completa (decisiones de todos los celulares). |
| D-611 | Ítems de lista por referencia al niño, sin copiar nombres; una sola lista con columna de sacramentos. | Copia de nombres; una lista por sacramento. | Minimización (001, RF-107); la constancia perpetua es de 008. Lista por sacramento es duda (S-5). |
| D-612 | Compartir con `Share` de React Native (en web, Web Share o copiar), texto con nombre, grupo y sacramentos; se registra la compartición. | `expo-print` + `expo-sharing` (PDF); enlace público. | Sin dependencias nuevas (principio 1); secretaría no tiene cuenta (duda de 008). Contenido mínimo (S-8). |
| D-613 | Visibilidad: catequista ve dimensiones y propuesta de sus grupos sin decisiones; familia solo dimensiones; supervisión todo en lectura. | Catequista ve decisiones y motivos. | Los motivos pueden contener información delicada; supervisión sí por 001, RF-102. |
| D-614 | Sin cambio al modelo C4: la relación `cmpSacramental → cmpActividades` no se implementa mientras las actividades no formen parte de la aptitud (S-3). | — | Actualizar el C4 cuando se aclare. |

## 8. Estructura de archivos propuesta

```
src/lib/sacramental/
  tipos.ts  umbrales.ts  dimension-misa.ts  dimension-oraciones.ts  dimension-doctrina.ts
  regla-aptitud.ts  tablero.ts  decision.ts  avisos.ts  saldo-inicial.ts  lista.ts  puertos.ts
  __tests__/ (un archivo .test.ts por módulo + regla-aptitud.tabla.test.ts)
src/datos/sacramental/repositorio-aptitud-local.ts        # WatermelonDB (convención plan 003)
src/app/aptitud/{index,[catequizandoId],umbrales,saldo-inicial,avisos,lista}.tsx
src/components/aptitud/{fila-dimensiones,explicacion-propuesta,formulario-decision}.tsx
api/migraciones/0601_umbral_aptitud.sql … 0604_lista_sacramental.sql
api/src/modulos/sacramental/
  dominio/          # reexporta src/lib/sacramental (empaquetado con esbuild)
  aplicacion/       # consultar-tablero, consultar-detalle, procesar-cierre, validar-push
  infraestructura/  # repositorio-aptitud-postgres.ts, manejadores-sincronizacion.ts
  http/             # tablero.ts, detalle.ts, familia.ts, umbrales.ts, avisos.ts, listas.ts
api/test/sacramental/ # http, contrato de repositorio, integración
```

## 9. Estrategia de tests

Jest según la configuración del plan 001 (`jest-expo` en `src/`, Jest TS en `api/`; integración con PostgreSQL en Docker). Cada nombre cita su id.

| Nivel | Tests | Id |
| --- | --- | --- |
| Unitario – tabla | `test.each(TABLA_ESPERADA)` con las 12 combinaciones: «RF-603: misa C, oraciones N, doctrina S ⇒ a_revisar». | RF-603 |
| Unitario – exhaustivo | Genera el producto cartesiano de todos los estados posibles de cada dimensión, incluidos `sin_umbral` (3 × 3 × 4 = 36 entradas) y verifica que cada una devuelve **exactamente un** resultado definido y que toda entrada con algún `sin_umbral` da `sin_propuesta`. | RNF-602, RF-601 |
| Unitario – umbrales | 7 subconjuntos de umbrales faltantes ⇒ `sin_propuesta` con dimensiones visibles; validaciones de rango. | RF-601 |
| Unitario – misa | Ausencia justificada aprobada no cuenta; justificación pendiente o sin efecto sí cuenta; domingo sin misa no cuenta; ventana abierta no cuenta; inscrito a mitad de ciclo; saldo + sistema; misa anterior a `fecha_corte` ignorada; asistencia en otro horario cuenta como ausencia. | RF-602, RF-605 |
| Unitario – oraciones | Saldo + sistema sin duplicar; «aún no» posterior al saldo resta; máximo 10. | RF-602, RF-605 |
| Unitario – doctrina | Sin criterio ⇒ `sin_umbral`; sin evaluaciones ⇒ `sin_evaluacion`; criterio provisional en el borde. | RF-602 |
| Unitario – explicación | Toda propuesta trae regla y valores de las tres dimensiones. | RNF-601 |
| Unitario – tablero | Retirado y anulado no aparecen; cambio de grupo conserva dimensiones; no bautizado sin regla distinta. | RF-603 |
| Unitario – decisión/avisos | Distinta sin motivo ⇒ error; con `sin_propuesta` ⇒ error; justificación aprobada tras decidir ⇒ aviso y decisión intacta; cambio de umbral ⇒ avisos de las afectadas; conflicto coordinación/delegado ⇒ aviso; confirmar resuelve. | RF-604, RF-601 |
| Unitario – lista | Cierre bloqueado con niños sin decisión o avisos; lista = decisiones `apto` vigentes; no bautizado ⇒ dos sacramentos; texto compartible sin dimensiones ni datos restringidos. | RF-606 |
| Contrato de repositorio | La misma suite contra Postgres (Docker) y WatermelonDB (adaptador de pruebas del plan 003): umbral vigente, saldo vigente, decisión vigente, idempotencia por UUID. | RF-601, RF-604, RF-605 |
| Paridad | Mismo conjunto de datos en ambos repositorios ⇒ mismo tablero. | RNF-603, RF-603 |
| HTTP de cada Function | Matriz rol × endpoint (200/403), catequista de otro grupo 403, familia solo sus hijos y sin propuesta, supervisión lectura; `push` de decisión sin motivo o desde supervisión rechazado; `push` tras cierre de ciclo descartado. | RF-601–RF-606 |
| Cliente sin conexión | Con NetInfo simulado sin red y base local con datos: el tablero se muestra y una decisión queda pendiente de envío. | RNF-603, RF-604 |
| Extremo a extremo (API + Postgres) | Fijar umbrales → asistencias, justificaciones, oraciones, doctrina y saldo → propuestas → decisiones → aprobar justificación ⇒ aviso → confirmar → cerrar → lista vN → supervisión la consulta → 008 la lee. Cubre los seis criterios de finalización. | todos |

## 10. Matriz de cobertura

| Id | Componentes | Tests |
| --- | --- | --- |
| RF-601 | `umbrales.ts`, `umbral_aptitud`, `umbrales.tsx`, `sacramentalUmbrales`, manejador `push` | tabla de umbrales faltantes, exhaustivo, contrato, HTTP, E2E |
| RF-602 | `dimension-*.ts`, `tablero.ts`, `sacramentalTablero`, `sacramentalDetalle`, `sacramentalFamilia`, `aptitud/index.tsx` | unitarios de misa/oraciones/doctrina, HTTP familia, E2E |
| RF-603 | `regla-aptitud.ts`, `tablero.ts` | tabla de 12 combinaciones, tablero, paridad, E2E («sin misa ⇒ no apto») |
| RF-604 | `decision.ts`, `avisos.ts`, `decision_aptitud`, `avisos.tsx`, `[catequizandoId].tsx`, `sacramentalAvisos`, manejador `push` | decisión/avisos, contrato, HTTP, cliente sin conexión, E2E |
| RF-605 | `saldo-inicial.ts`, `dimension-*.ts`, `saldo_inicial_aptitud`, `saldo-inicial.tsx` | misa/oraciones con saldo, contrato, E2E |
| RF-606 | `lista.ts`, tablas de lista, `lista.tsx`, `sacramentalListas`, puertos para 008 | lista, HTTP supervisión, E2E |
| RNF-601 | `Propuesta.regla` + dimensiones, `explicacion-propuesta.tsx` | explicación |
| RNF-602 | `TABLA_REGLA` | exhaustivo (36 entradas) + tabla |
| RNF-603 | `repositorio-aptitud-local.ts`, tablas locales §3.2 | paridad, cliente sin conexión |

## 11. Dependencias, riesgos, costo y dudas

**Dependencias.** 001: roles con `supervision`, delegación, autorización, auditoría, retención, configuración de Jest. 002: nómina con `fecha_inscripcion`, `estado`, `bautizado`. 003: protocolo `pull/push`, esquema WatermelonDB con las tablas de §3.2, estado efectivo de misa, `hay_misa`, ventana cerrada. 004: estado de justificación por ausencia, sin evidencia. 005: catálogo, estado vigente de oraciones, evaluaciones de doctrina normalizables. 007: retiro ⇒ niño inactivo. 008: ciclo abierto, descarte tras cierre, consumo de la lista (RF-804, RF-806).

**Riesgos.**

| Riesgo | Mitigación |
| --- | --- |
| La doctrina no se define a tiempo (005). | Criterio enchufable; sin criterio ⇒ «sin propuesta» con dimensiones visibles, que ya cumple RF-601. |
| Diferencias entre celular y servidor (datos sin sincronizar). | Misma librería y test de paridad; el servidor manda y la diferencia aparece como aviso. |
| Reloj del celular desfasado al elegir la decisión vigente. | Conflictos visibles como aviso; se guardan `decidido_en` y `recibido_en`. |
| Motivos con datos delicados. | Aviso en el formulario; decisiones solo en celulares de coordinación. |
| Volumen local de coordinación. | Estimado ~4 000 filas; medir en gama baja junto con RNF-305 de 003. |

**Costo en Azure.** Cero adicional: sin recursos nuevos, unas pocas Functions HTTP dentro del plan de Consumo, consultas agregadas pequeñas y kilobytes en PostgreSQL B1ms.

**Dudas `[NECESITA ACLARACIÓN]` con supuesto provisional (reversible).**

| Id | Duda | Supuesto provisional | Cómo se revierte |
| --- | --- | --- | --- |
| S-1 | ¿Misa C + oraciones C + doctrina sin evaluación es «apto» o «a revisar»? | `apto` (D-604). | Cambiar la fila 3 de la tabla y del test. |
| S-2 | Criterio de doctrina (spec y 005). | `porcentaje_logrado` sobre evaluaciones normalizadas a logrado/no logrado; la coordinación no lo fija hasta aclararse ⇒ «sin propuesta». | Añadir variante a `CriterioDoctrina` y ajustar el adaptador de 005. |
| S-3 | ¿Actividades obligatorias cuentan? | No; las misas de precepto tampoco cuentan como misa. | Nueva dimensión y filas en la tabla. |
| S-4 | ¿Seguimiento por ficha (007) afecta? | No. | Ídem. |
| S-5 | ¿Lista por sacramento? | Una lista con columna de sacramentos derivada de `bautizado`. | Filtrar la lista por sacramento en la vista. |
| S-6 | Valores iniciales de umbrales. | Ninguno por defecto; ni se copian del ciclo anterior (decide 008). | Precargar una versión al abrir ciclo. |
| S-7 | Decisiones distintas de coordinación y delegado sin conexión. | Vigente la de `decidido_en` mayor; la otra queda en historial y se genera aviso de conflicto. | Cambiar `decisionVigente` (p. ej. prioridad de la coordinación). |
| S-8 | Contenido compartido con secretaría. | Nombre, grupo y sacramentos, sin dimensiones. | Cambiar `textoCompartible`. |
| S-9 | Condiciones para cerrar decisiones; reapertura. | Todo niño activo decidido y sin avisos; puede volver a cerrarse mientras el ciclo esté abierto (nueva versión, la anterior se conserva). | Relajar `validarCierre`. |
| S-10 | ¿El catequista ve la propuesta y la decisión? | Ve dimensiones y propuesta; no decisiones (D-613). | Ajustar autorización y el filtro de sincronización. |
| S-11 | Numeración de migraciones entre planes. | Bloque `06NN` para esta spec, salvo que el plan 001 fije otra regla antes de aplicar. | Renumerar antes de la primera aplicación. |
| S-12 | ¿Familia y supervisión necesitan consulta sin conexión? | No: consultan en línea (familia por web). | Incluir sus datos en la sincronización. |
| S-13 | ¿Qué pasa con un «no apto»? | Nada automático en esta spec (no repite ni cambia de grupo por sistema). | Lo define 008 al reinscribir. |

## 12. Orden de implementación

| Fase | Contenido | Requiere | RF |
| --- | --- | --- | --- |
| 1 | Dominio puro: tipos, umbrales, dimensiones, regla con test de tabla y exhaustivo, explicación. | Nada (puede adelantarse al primer corte). | RF-601–RF-603, RNF-601, RNF-602 |
| 2 | Migraciones 0601–0603, repositorio Postgres, manejadores `push` de umbral y saldo, contrato de repositorio. | Infraestructura de 001, sincronización de 003. | RF-601, RF-605 |
| 3 | Lecturas: `sacramentalTablero`, `sacramentalDetalle`, `sacramentalFamilia`, `sacramentalUmbrales`; tablas locales y tablero sin conexión; pantallas `index`, detalle, umbrales. | 004 y 005 con sus datos locales. | RF-601–RF-603, RNF-603 |
| 4 | Decisiones y avisos: dominio, `push` de decisión, `sacramentalAvisos`, pantallas de decisión y avisos. | Fase 3. | RF-604 |
| 5 | Saldo inicial: pantalla y suma en dimensiones. | Fase 3. | RF-605 |
| 6 | Cierre, lista versionada, compartir, vista de supervisión, puertos para 008 (migración 0604). | Fases 4–5; ciclo de 008. | RF-606 |
| 7 | Extremo a extremo y verificación de los criterios de finalización. | Todo lo anterior. | todos |

# Seguimiento honesto backend 001–003

Estado documental al 2026-10-11, rama `backend/001-003`. **Alcance: backend completo**, no solo primer corte. D/S de 001, D/C de 002 y D/A de 003 aceptados con ajustes ADR 011–015 (015 sustituye frontera de transporte de 012). Aceptación no significa código, tests, UI, dispositivo o despliegue terminados.

## Evidencia disponible

### Ejecución previa de integración del principal

Comprobaciones locales registradas por el principal el 2026-10-11 (Lima; 2026-10-12 UTC), sobre `backend/001-003`, incluidas fases posteriores al primer corte. Esta tabla conserva la ejecución anterior; **174 es conteo preliminar, no cierre actual tras feedback/corrección calculada0310**. El principal actualizará sus resultados y `agent-trace/backend-integracion.json` con la próxima pasada final; documentación no ejecutó ni declara esos tests/typecheck/lint. Las trazas ajenas mantienen sus evidencias históricas.

| Comando/comprobación | Resultado registrado en la pasada anterior |
| --- | --- |
| `BD_PRUEBAS_URL=postgresql://postgres:postgres@localhost:55432/sigecat npm test` | **179 tests pasan**: 1 cliente compartido y 178 API en 26 suites; cero fallidos/omitidos. Incluye PostgreSQL16 y borrado real en Azurite. |
| `npm run typecheck` | Raíz y API pasan. |
| `npm run lint` | Workspace pasa sin errores ni advertencias. |
| `npm --prefix api run build` | Bundle Node22 compilado. |
| `node api/scripts/verificar-openapi.mjs` | 65 operaciones/186 schemas coherentes, metadatos `_status`/`_changed` ignorados solo en entrada. |
| `node api/scripts/verificar-migraciones.mjs` | 33 migraciones válidas e inmutables frente a `origin/main`. |
| `BICEP_BIN=<binario-local> node --test api/pruebas/infra/plantilla.test.mjs` | Bicep compila; seis tests pasan. |
| Actionlint (sin ShellCheck/Pyflakes) | Workflows válidos; no acredita una ejecución remota en GitHub. |
| `npm run adr:build` | 16 ADRs generados; advertencias del empaquetador, sin error de superseder. |
| Core Tools4.15.2/bundle4.38.1, `verificar-host.mjs` | Host real local cargado; `/api/yo` y activación con enlace inválido devuelven 401 genérico, con conexión PostgreSQL del rol limitado de API. Bundle descargado/caché temporal tras fallar la descarga automática. |
| Roles, migración y demo locales | Roles configurados sin imprimir claves; migrador aplica SQL; demo opera como `sigecat_api`, produce cinco roles/cuenta mixta/hermanos y no reemite enlaces al repetir. |
| `git diff --check` | Sin errores. |

Regresiones comprobadas: 50 clientes concurrentes sin consolidado/evento duplicado; 25 niños generan 50 marcas/consolidados y push+pull de **89.396 bytes**; tres perfiles concurrentes reutilizan su Tx con pool3; un ciclo histórico no autoriza condiciones actuales; retiro tras anulación entrega lápidas originales y pendientes tardíos no restauran QR/datos; rollback de todos los participantes y purga real con rol/contexto correctos. El catálogo cerrado cubre todas las columnas del esquema, con controles negativos para campos nuevos.

El push acepta las filas raw completas de WatermelonDB y descarta metadata/feedback de servidor antes de validar y calcular huella, sin permitir aprobar un carné inválido. `0310` permite conservar el valor anterior `sin_registro`; coordinación puede corregir con motivo la ausencia calculada en misa o catequesis sin marca previa. El reporte conserva autoría/horas reales de corrección y tipo manual, sin fabricar escaneos históricos.

`verificar-cobertura-rf` informa 17/17 citas para 001, 10/11 para 002 y 19/20 para 003. RNF-202 (UI móvil) y RNF-305 (QR/dispositivo) no se inventan ni se cubren con un test de backend. Citar un RF no acredita automáticamente todos sus componentes cliente/exteriores. Despliegue Azure, k6 en nube, frontend/WatermelonDB nativo y proveedores reales 004/avance005/006/007/historial008 siguen pendientes de sus propietarios y evidencia física.

- Specs 001–003 justifican dependencias y excepción administrativa ONLINE. Ampliación `tsx`/`@types/node` documentada antes de siguiente instalación; instalación preliminar del principal anterior a la nota se registra como desviación del orden, sin aprobación retroactiva ficticia.
- Constitución principio 5 actualizado por autorización explícita; ADR 011/013/014/015 aceptados, ADR 012 sustituido por 015 y históricos 002/004/010 sustituidos según sus campos Status. C4 alineado con PIN local/documentos solo estados; su verificación es separada del build ADR.
- [Contratos frontend](backend-contratos.md), [OpenAPI3.1](../api/openapi.json) y [desarrollo local](backend-desarrollo.md): DTO actuales, transporte sync nativo (ADR 015), QR, periodos/puertos y puerto55432 configurable.
- Fuente Azure consultada 2026-10-11: [Flex Consumption](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan), actualización 2026-09-30; menor máximo escala 1, límite aplicado por grupo, always-ready separado. No evidencia de despliegue.
- Código de módulos se desarrolla simultáneamente por otros agentes. La ampliación documental lee DTO/handlers y es propietaria exclusivamente de `api/openapi.json` y `api/scripts/verificar-openapi.mjs` fuera de docs/specs/AGENTS; no modifica módulos/configuración ni trazas ajenas. Verificador Node valida contrato estático, no declara tests integrales aprobados.

### Actualización de implementación/evidencia local

El principal informa implementado el backend completo 001–003, incluidas fases de protección posteriores al primer corte y puertos externos. La revisión de código confirma scripts reales, registro de ciclo/actividades, proveedor de perfil con la misma tx y timer de purga con rol/contexto. **Esto no cierra todos los tasks ni módulos externos completos.** Evidencias comunicadas por el principal: migraciones persistentes PostgreSQL55432 como `sigecat_migrador`; demo con rol API/repetición sin enlaces nuevos; administración inicial idempotente con PostgreSQL; inventario Node de las 65 rutas; purga de metadatos; corrección del deadlock de pool y E2E de QR tardío de niño retirado/lápidas sin datos personales. Catálogo de datos: 7 unitarios + 4 PostgreSQL; prueba de borrado Blob real en Azurite añadida. No sumar estas ejecuciones parciales como conteo final de la suite: el principal aún finaliza tests/typecheck/lint tras catálogo/avisos.

Ampliación WatermelonDB oficial, documentada por el principal antes de código: MUST punto8 push ignora `_status`/`_changed` antes de Zod/huella; otros desconocidos siguen 422. OpenAPI amplía solo cinco DTO de entrada con metadata opcional/writeOnly, sin alterar salidas ni SQL. Prueba PostgreSQL de reenvío con metadata distinta y ausencia de metadata en persistencia/pull añadida por el principal; no se infiere conteo final de la pasada anterior a esa prueba. Semilla local devuelve ocho credenciales nuevas en primera ejecución y no reemite al repetir, según principal.

Log4brains1.1.0: build ejecutado por documentación tras corregir los cuatro estados de sustitución a slug crudo. **`npm run adr:build` pasó y generó 16 ADRs en `.log4brains/out`**, con warnings de dependencias del empaquetador, sin error de superseder. Históricos conservan decisiones: solo cambió Status; no se modificó configuración/paquetes para el build.

## Matriz de entrega y pendientes

| Pieza | Decisión/acuerdo | Evidencia necesaria para cierre |
| --- | --- | --- |
| 001 F0 base | Jest/ts-jest/jest-expo, SQL pg, Functions v4/esbuild, runner/checksum, infraestructura/CI/OIDC | Tests/unitarios/HTTP/PostgreSQL/desde cero; typecheck/lint/build; CI/Bicep/despliegue real |
| 001 acceso/roles | Enlace/PIN local, unión de roles, contexto real cada petición, auditoría/seudónimo/delegación | Matriz de permisos HTTP, cuenta/credencial/desactivación inmediata, identidad real ADM, rotación/reintentos y aislamiento por cuenta |
| 001 protección completa | Consentimiento presencial/enlace/retiro, catálogo, participantes, Blob SDK/bandeja/timers, consulta auditoría y servicios cierre | Rollback/idempotencia, ciclo cerrado con rol+contexto, Azurite y registro de tablas/participantes; integración externa no ficticia |
| 002 todas las fases | Inscripción/duplicados, grupos/asignaciones, correcciones/historial, documentos-estados, condiciones/conteos, apoderados/QR | Flujo API completo, datos restringidos no-store/auditados, FK/índices, vigencias históricas, emisión vigente, retiro de hijo con hermano |
| 002 perfil | `ProveedorResumenPerfil` + `resumenAsistencia` real de 003 | Proyección por rol y resúmenes externos 004/005/007 cuando integrados; sección ausente no simula resumen vacío |
| 003 backend completo | Sync filas, idempotencia/bloqueo, avisos, correcciones, ausencias/faltas, reportes, actividad/ciclo, retención | Contratos memoria/PostgreSQL, HTTP/alcance por fila, concurrencia, volumen, 429 distribuido, integración de fuentes/participantes |
| Frontend 001–003 | Propuestas cliente aceptadas | Adaptadores HTTP/WatermelonDB, pantallas, guardas, SecureStore, memoria/borradores, compatibilidad v57, tests cliente; permanecen pendientes |
| Campo/laboratorio | Valores por defecto y responsables del plan aceptados | JSI/nueva arquitectura, CameraView poca luz, App Link/fragmento, Android referencia, línea base papel, piloto modo avión y mediciones; sin resultados inventados |
| Azure | pool3/proceso, worker1, max5/grupo, HTTP10, 2048 MB, always-ready0, UTC | Build/what-if/despliegue, región/cuota, grupos de escala, conexiones auxiliares, presupuesto/telemetría sin cuerpos, k6 50 clientes y p95 |

Las casillas `tasks.md` permanecen abiertas; ninguna se marca completa con aprobación conceptual. Las etiquetas históricas de “primer corte” no excluyen backend F2–F4 de 001 ni fases 2–4 de 002. La fase técnica de 003 bloquea nativo, no API/dominio. Texto de consentimiento conserva estado de versión/borrador hasta evidencia de la versión efectiva; aceptar el proceso del plan no inventa aprobación de un texto no revisado.

## Integraciones externas 004–008

| Dueño | Puerto/soporte en backend 001–003 | Pendiente externo |
| --- | --- | --- |
| 004 justificaciones | `FuenteJustificacionesAprobadas`, `alCambiarAsistencia(..., tx)`, consulta/eventos asistencia, resumen perfil, participante evidencia y `BorradorBlobs` real en 001 | Endpoints/evidencias/aprobación/SAS/consentimiento y proveedor real; adaptador vacío o falso no cumple RF-311 integrado |
| 005 avance/actividades | `0505` catálogo mínimo, `0506` autoría/traza, HTTP GET/POST/PATCH/cumplimiento y colección nativa `actividades_obligatorias`; sesión determinista y `actividadSumaFalta` | Evaluaciones/oraciones/doctrina/UI y evidencia de integración; no declarar avance 005 completo |
| 006 aptitud | `consultarAusencias`, eventos con cursor e idempotencia, permisos/retención | Motor aptitud, decisiones, listas/reportes reales |
| 007 riesgo | `consultarFaltas`, eventos, `grupoActual`, `apoderadosVinculados`, `marcarInactivo`, resumen perfil | Alertas, compromisos y estados/consumidores reales |
| 008 historial | `0002` + `0801`, guardia, HTTP listado/abierto/apertura/cierre (dos alias), colección `ciclos`, puertos delegaciones/enlaces/minoría/reinscripción/retención | Indicadores/constancia/historial/reinscripción/UI y evidencia de cierre integrado; soporte transversal no completa 008 |

Consolidación escribe `evento_asistencia` transaccional. Si 004 exige efecto síncrono, su puerto recibe la misma tx y falla con rollback completo; consumidores de eventos no repiten ese efecto. Registrar disponibilidad de cada proveedor al arrancar; ausencia externa debe quedar explícita y no generar cumplimiento ficticio.

## Contradicciones corregidas y trabajo de integración

1. Pool4 vs pool3 y 10 vs 5: unificados en 3 por proceso/1worker/5 por grupo. Revisar suma de grupos, no usar 15 como total app. Timer precalienta su grupo, no garantiza HTTP.
2. Límites por cuenta en APIM: Functions con contador PostgreSQL atómico; APIM global. T001-151/T002-39/T003-55 requieren prueba distribuida.
3. QR UUID suelto vs SGC1: solo SGC1+UUID+emisión. T002-27/28 y T003-17/33 usan `codigo_carne` local derivado de `emision` BD.
4. SQL singular vs local plural: mapeo explícito. Decisión final ADR 015 conserva claves nativas WatermelonDB en HTTP; adaptadores españoles internos opcionales, sin traducción obligatoria. OpenAPI refleja DTO/handlers actuales.
5. `0106` mezclado: `0106_aviso_coordinacion.sql` y `0107_aviso_grupo.sql`; FK en bloque 02; vista nómina en `0204`.
6. Fuente histórica omitida: T002-107; resumen asistencia omitido: T003-114; puertos 007/008: T002-108; retención asistencia: T003-115.
7. Retiro incompleto: T002-102 incluye estados/historial/apoderado sin otros hijos/perfil anonimizado e inactivo operativo; motor fija rol **y** contexto en retiro/vencimiento. Seguridad implementa puertos/motor, cada dueño su participante real.
8. 003 “completa de primer corte” vs dependencia 004: backend incluye puertos/integración; T003-107/108 no se cierran sin 004 real. Falsos prueban contrato, no comportamiento integral.

## Checks y bloqueos de evidencia

Handlers transversales, registradores y proveedores de ciclo/actividades están conectados en `api/src/index.ts`; perfil recibe la misma tx. OpenAPI conserva 65 operaciones/186 schemas. `0309` guarda metadatos de borrado antes de anonimizar/cambiar UUIDs y pull devuelve IDs originales sin datos personales. `depurarMetadatos` aplica rol/contexto; prueba PostgreSQL reportada en verde por el principal, ejecución del scheduler real aún requiere host/cloud.

Resultado de esta ampliación: `node api/scripts/verificar-openapi.mjs` pasa con **65 operaciones declaradas y 186 schemas**; incluye cierre/cierre-alias y cumplimiento, DTO de actividades/vigencia/autoría 0506 y ledger 0309 exclusivamente de cinco metadatos. Solo se ejecutó este verificador en la ampliación; checks finales integrales del principal siguen sin declaración de aprobación aquí.

Registro resuelto y **host real local verificado por el principal**: Core Tools4.15.2 + extensionBundle4.38.1 precargado desde CDN a caché temporal fuera del repo. `verificar-host.mjs` pasó smoke401 de `/api/yo` y activación inválida, con rol API en PostgreSQL; inventario de65rutas también confirmado. Scripts/configuración de roles/migraciones/semilla con propietario/API separados siguen operativos. Azurite/CI usan `--skipApiVersionCheck` solo compatibilidad emulada, con creación/borrado real sin skips. **Sin despliegue Azure verificado** ni prueba física JSI/QR.

La pausa npm terminó. **Conteos finales de npm test/typecheck/lint tras metadata local requieren evidencia del principal**; no se declaran a partir de pasadas previas ni se suma un total estimado. Build ADR aprobado por ejecución propia y host local por smoke del principal; C4/Bicep/despliegue mantienen evidencia separada. UI/EAS/Android/campo/carga y consumidores reales 004–008 siguen pendientes. No omitir/debilitar tests ni marcar todos los tasks terminados.

Agent Trace de la edición documental: [backend-documentacion.json](agent-trace/backend-documentacion.json). La implementación se verificó antes de publicar commits. A petición del usuario, la publicación se organiza en las tareas T001-DOC (acuerdos y contratos), T001-152 (API integrada) y T001-153 (infraestructura/CI), cada una con su commit Conventional Commits y traza `backend-publicacion-*.json`. Los hashes efectivos se consultan en `git log`; publicación no sustituye revisión ni despliegue.

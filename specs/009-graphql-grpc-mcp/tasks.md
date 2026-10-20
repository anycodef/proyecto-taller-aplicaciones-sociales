# Tareas 009 — GraphQL, gRPC y MCP

Tareas de [spec.md](spec.md) según [plan.md](plan.md). Cada una dura 20–30 min, va en un commit propio (Conventional Commits + Agent Trace `docs/agent-trace/tarea3-pN.json`) y termina solo con `npm test`, `npm run typecheck`, `npm run lint` y `npm --prefix tarea3 test` en verde. Todo test empieza por su identificador (`RF-9xx: ...`).

Dependencias nuevas: solo las de plan §3, en `tarea3/package.json`.

## P5 — Integración, base y evidencia (abre primero)

- [ ] **T009-51** Crear `tarea3/package.json` con scripts `demo`, `test`, `token`, `bd:subir`, `bd:sembrar`, `typecheck` y las dependencias del plan §3. RF: RNF-902. Hecho cuando: `npm --prefix tarea3 install` funciona y `package.json` raíz no cambió.
- [ ] **T009-52** Migración SQL del esquema `demo_tarea3` (plan §4) + script `bd:subir`. RF: RF-912. Hecho cuando: crea y borra el esquema repetidamente sin error.
- [ ] **T009-53** Siembra ficticia: 2 grupos, 12 catequizandos con `identidadOperativa`, 6 domingos con faltas que dejen casos BAJO, MEDIO y ALTO. RF: RNF-901. Hecho cuando: un test cuenta los casos esperados.
- [ ] **T009-54** `compartido/riesgo.ts` (regla pura plan §4). RF: RF-908. Hecho cuando: tabla de casos en test, incluida falta justificada.
- [ ] **T009-55** `compartido/auth.ts`: emitir y verificar JWT demo, `puedeLeerGrupo`, `puedeEscribir`. RF: RF-906. Hecho cuando: tests por cada rol (CAT otro grupo, FAM, SUP escribiendo).
- [ ] **T009-56** `compartido/bd.ts` (pool `pg` y transacción) y tipos TS generados a mano de los contratos. RF: RF-902. Hecho cuando: P2 y P3 pueden importarlos.
- [ ] **T009-57** Extender `scripts/verificar-cobertura-rf.mjs` para escanear `tarea3/`. RF: RNF-905. Hecho cuando: el script cuenta los RF-9xx.
- [ ] **T009-58** `scripts/demo.mjs`: sube BD, siembra, arranca ambos servicios, espera salud y ejecuta el recorrido. RF: RF-912. Hecho cuando: `npm --prefix tarea3 run demo` termina con código 0.
- [ ] **T009-59** `pruebas-e2e/recorrido.test.ts`: GraphQL consulta → mutación (gRPC) → consulta cambia → lote → streaming. RF: RF-902, RF-903, RF-904, RF-905, RF-912. Hecho cuando: pasa contra los servicios reales.
- [ ] **T009-60** `docs/tarea-3/ejecutar.md` y `docs/tarea-3/evidencia.md` (mapa viñeta del profesor → artefacto → comando → captura/log) y carpeta `tarea3/evidencia/` con salidas reales. RF: RF-913, RNF-904. Hecho cuando: un compañero ajeno reproduce siguiendo solo `ejecutar.md`.

## P2 — Servicio de consulta GraphQL

- [ ] **T009-21** Cargar `schema.graphql`, servidor HTTP con `graphql-http` en el puerto 4000 y `/salud`. RF: RF-902.
- [ ] **T009-22** Contexto de petición: verificar JWT con `compartido/auth.ts`; `Query.yo`. RF: RF-906.
- [ ] **T009-23** Resolvers `catequizando` y `catequizandos` con paginación (máx. 50) y DataLoader casero para evitar N+1. RF: RF-902, RNF-903. Hecho cuando: un test cuenta consultas SQL de una lista de 12 con asistencias (debe ser constante).
- [ ] **T009-24** Resolvers `asistenciaDelDomingo` y `riesgoDelGrupo`. RF: RF-902.
- [ ] **T009-25** Límite de profundidad 6 y rechazo con mensaje claro. RF: RNF-903.
- [ ] **T009-26** Cliente gRPC hacia actualización (`proto-loader`, metadata `authorization` reenviada) y las tres mutaciones. RF: RF-904.
- [ ] **T009-27** Mapeo de errores gRPC → `extensions.codigo`. RF: RF-906, RF-907. Hecho cuando: test confirma que no aparece ningún campo de salud o documento en el esquema introspectado.
- [ ] **T009-28** Tests con cliente gRPC doble. RF: RF-902…RF-906.

## P3 — Servicio de actualización gRPC

- [ ] **T009-31** Cargar `sigecat.proto`, servidor en 50051, interceptor de autenticación, servicio de salud. RF: RF-903, RF-906.
- [ ] **T009-32** `RegistrarAsistencia` idempotente (`ON CONFLICT (id) DO NOTHING` + lectura) con permisos. RF: RF-903, RF-905.
- [ ] **T009-33** `RegistrarAsistenciaLote` (client streaming) en una transacción, con conteos. RF: RF-903.
- [ ] **T009-34** `RegistrarJustificacion` (cambia la asistencia a JUSTIFICADA). RF: RF-903, RF-905.
- [ ] **T009-35** `RecalcularRiesgo` usando `compartido/riesgo.ts` y persistiendo. RF: RF-908.
- [ ] **T009-36** `ObservarAsistencia` (server streaming) alimentado por `LISTEN/NOTIFY` de PostgreSQL. RF: RF-903.
- [ ] **T009-37** Cierre ordenado, reintentos de conexión y tests con cliente gRPC real. RF: RF-903…RF-908.

## P4 — Servidor MCP y agente

- [ ] **T009-41** Servidor MCP stdio con el SDK y `zod`; registrar las herramientas de lectura con `readOnlyHint`. RF: RF-909.
- [ ] **T009-42** Cliente GraphQL mínimo (fetch) que pide solo los campos necesarios por herramienta. RF: RF-909, RF-902.
- [ ] **T009-43** Herramientas de escritura (UUID generado aquí, `idempotentHint`). RF: RF-909, RF-905.
- [ ] **T009-44** Recurso `sigecat://grupo/{id}/riesgo` y prompt `revision-dominical`. RF: RF-909.
- [ ] **T009-45** Errores controlados (`fuera_de_alcance`), sin fugas. RF: RF-906, RF-907.
- [ ] **T009-46** Pruebas con el cliente MCP del SDK sobre un GraphQL doble: lista de herramientas = contrato; ninguna herramienta borra. RF: RF-909.
- [ ] **T009-47** `tarea3/.mcp.json` y `agente/guion.md`; ejecutar el guion con Claude Code y guardar la transcripción en `tarea3/evidencia/agente-transcripcion.md`. RF: RF-910. Hecho cuando: el agente responde y escribe usando solo MCP.

## P1 — Análisis, decisión y informe

- [ ] **T009-11** Inventario de funcionalidades candidatas (≥ 10) desde las specs 001–008 y requerimientos R1–R27. RF: RF-901.
- [ ] **T009-12** `matriz-aplicabilidad.md`: protocolo recomendado, veredicto y justificación por fila; incluir los «no aplicable» honestos (p. ej. sync WatermelonDB, enlaces de familia). RF: RF-901.
- [ ] **T009-13** Sección «Dónde sí y dónde no» para consultas y para actualizaciones (síntesis de la matriz). RF: RF-901.
- [ ] **T009-14** ADR `20261019-graphql-grpc-mcp.md` (Log4brains, plantilla `docs/adr/template.md`); regenerar el índice si aplica. RF: RF-901, RF-911.
- [ ] **T009-15** `decision-agente-mcp.md`: tabla comparativa GraphQL/gRPC/MCP para agentes y conclusión; respaldarla con medición real de tokens/bytes tomada de P4 y P5 (misma pregunta por los tres caminos). RF: RF-911.
- [ ] **T009-16** Diagrama C4/secuencia de la demo en `docs/diagrams/` (DSL existente) y en el informe. RF: RF-912.
- [ ] **T009-17** `docs/tarea-3/informe.md` (documento final de entrega: análisis, arquitectura, demo, decisión MCP, reparto del equipo con commits). RF: RF-913.
- [ ] **T009-18** Guion de exposición (10 min, quién dice qué) y checklist de ensayo. RF: RF-913.

## Hito final (todas/os)

- [ ] **T009-90** Ensayo completo: P5 corre `demo`, P4 hace la demo con agente, P1 expone; `docs/tarea-3/evidencia.md` sin huecos.

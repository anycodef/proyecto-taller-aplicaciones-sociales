# Evidencia de la Tarea 3 — P5 (Integración, base de datos, pruebas y evidencia)

Este documento mapea cada **viñeta del enunciado del profesor** a su **artefacto**, el
**comando que la reproduce**, el **log/captura de salida real** y los **commits** que la
respalden. Salidas reales guardadas en `tarea3/evidencia/`.

## Viñeta 1 — Identificar dónde aplicar GraphQL/gRPC (consultas y actualizaciones), validar y justificar

| Campo | Valor |
|---|---|
| Responsable principal | P1 (apoya todos) |
| Artefacto | `docs/tarea-3/matriz-aplicabilidad.md` + `docs/adr/20261019-graphql-grpc-mcp.md` |
| Comando | — (documentación de P1) |
| Log/captura | — |
| Commits | de P1 (`git log --author` + Agent Trace de P1) |

Apoyo de P5: los contratos congelados en `tarea3/contratos/` (schema.graphql, sigecat.proto,
herramientas-mcp.md) definen dónde aplica GraphQL (consulta) y gRPC (actualización).

## Viñeta 2 — Demo funcional con microservicios de consulta y actualización

| Campo | Valor |
|---|---|
| Responsable principal | P2 (consulta GraphQL), P3 (actualización gRPC), P5 (orquesta y prueba) |
| Artefacto | `tarea3/compartido/` (auth, riesgo, bd, tipos), `tarea3/bd/` (migración), `tarea3/scripts/` (demo, bd:subir, bd:sembrar, token, cobertura), `tarea3/pruebas-e2e/` |
| Comando | `npm --prefix tarea3 run demo` |
| Log/captura | `tarea3/evidencia/demo-output.txt` |
| Commits (P5) | `git log --oneline tarea3/p5-integracion` (ver abajo) |

Salida real resumida (`tarea3/evidencia/demo-output.txt`):
```
[demo] subiendo base de datos
[bd:subir] esquema demo_tarea3 creado en PostgreSQL
[demo] sembrando datos ficticios
[bd:sembrar] siembra ficticia completada: 2 grupos, 12 catequizandos, 6 domingos
[demo] 1/5 consulta completada: 6 catequizandos
[demo] 2/5 mutación completada: id=<uuid>, repetido=false
[demo] 3/5 consulta posterior confirmó la escritura
[demo] 4/5 lote completado: registrados=2, repetidos=0
[demo] 5/5 streaming recibió asistencia=<uuid>
[demo] OK: recorrido completo contra servicios reales
```
Código de salida: `0` (RF-912). La demo arranca ambos servicios, espera salud y
ejecuta consulta GraphQL → mutación gRPC → consulta → lote → streaming.

## Viñeta 3 — ¿GraphQL, gRPC o MCP para un agente de IA? Justificar

| Campo | Valor |
|---|---|
| Responsable principal | P4 (servidor MCP), P1 (texto de decisión), P5 (mide) |
| Artefacto | `tarea3/servidor-mcp/`, `tarea3/agente/`, `tarea3/.mcp.json` (P4); `docs/tarea-3/decision-agente-mcp.md` (P1) |
| Comando | Claude Code con `tarea3/.mcp.json` y `tarea3/agente/guion.md` |
| Log/captura | `tarea3/evidencia/agente-transcripcion.md` y `medicion-agente.md` |
| Commits | de P4 y P1 |

## Pruebas ejecutadas (resultado real)

Comando: `npm --prefix tarea3 test` → `tarea3/evidencia/test-output.txt`

```
tests 113
pass 113
fail 0
skipped 0
```

El recorrido `GraphQL → gRPC → GraphQL → lote → streaming` se ejecutó contra
los servicios y PostgreSQL reales, sin omisiones.

Comando: `npm --prefix tarea3 run typecheck` → sin errores (`tarea3/evidencia/tipo.txt`).
Comando: `npm --prefix tarea3 run lint` → debe pasar sin errores ni warnings.

Comando: `node tarea3/scripts/verificar-cobertura-rf.mjs` → `tarea3/evidencia/cobertura.txt`:

```
=== Cobertura de RF sobre tarea3/ (spec 009) ===
Archivos de prueba escaneados: 28
Identificadores citados: RF-901 ... RF-913
RESULTADO: RF-901 a RF-913 tienen al menos un test que cita su identificador.
```

## Commits de P5 (rama `tarea3/p5-integracion`)

```bash
git log --oneline tarea3/p5-integracion
```

Cada commit es un Conventional Commit `feat(tarea3): ...` (o `docs(tarea3): ...`) con su
registro Agent Trace `docs/agent-trace/tarea3-p5.json` incluido en el mismo commit.

## Archivos de evidencia en `tarea3/evidencia/`

- `demo-output.txt` — salida de `npm --prefix tarea3 run demo`
- `test-output.txt` — salida de `npm --prefix tarea3 test`
- `tipo.txt` — salida de `npm --prefix tarea3 run typecheck`
- `cobertura.txt` — salida de `node tarea3/scripts/verificar-cobertura-rf.mjs`

## Reproducción completa

Un compañero ajeno puede reproducir la parte de P5 siguiendo solo
`docs/tarea-3/ejecutar.md` (pasos 0 a 8).

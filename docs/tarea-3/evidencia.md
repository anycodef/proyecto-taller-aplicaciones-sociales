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

Salida real (`tarea3/evidencia/demo-output.txt`):
```
[demo] hito 1: subiendo base de datos (bd:subir)
[bd:subir] esquema demo_tarea3 creado en PostgreSQL
[demo] hito 1: sembrando datos ficticios (bd:sembrar)
[bd:sembrar] siembra ficticia completada: 2 grupos, 12 catequizandos, 6 domingos
[demo] AVISO: servicio-consulta o servicio-actualizacion no implementados aún (P2/P3).
[demo] La base está lista. El recorrido completo requiere P2 y P3.
[demo] OK (modo base, sin servicios)
```
Código de salida: `0` (RF-912). Cuando P2 y P3 mergéen sus servicios, `demo` arranca ambos,
espera salud y ejecuta el recorrido completo: consulta GraphQL → mutación (gRPC) → consulta
refleja el cambio → lote → streaming.

## Viñeta 3 — ¿GraphQL, gRPC o MCP para un agente de IA? Justificar

| Campo | Valor |
|---|---|
| Responsable principal | P4 (servidor MCP), P1 (texto de decisión), P5 (mide) |
| Artefacto | `tarea3/servidor-mcp/`, `tarea3/agente/`, `tarea3/.mcp.json` (P4); `docs/tarea-3/decision-agente-mcp.md` (P1) |
| Comando | — (P4/P1) |
| Log/captura | `tarea3/evidencia/` (transcripción del agente, cuando P4 grabe) |
| Commits | de P4 y P1 |

## Pruebas ejecutadas (resultado real)

Comando: `npm --prefix tarea3 test` → `tarea3/evidencia/test-output.txt`

```
tests 17
pass 16
fail 0
skipped 1
```

El test `recorrido.test.ts` (RF-902/903/904/905/912) **salta** (`skipped 1`) porque los
servicios de P2 y P3 aún no están mergéados; se ejecutará en el hito 3 contra los servicios
reales.

Comando: `npm --prefix tarea3 run typecheck` → sin errores (`tarea3/evidencia/tipo.txt`).
Comando: `npm --prefix tarea3 run lint` → debe pasar sin errores ni warnings.

Comando: `node tarea3/scripts/verificar-cobertura-rf.mjs` → `tarea3/evidencia/cobertura.txt`:

```
=== Cobertura de RF sobre tarea3/ (spec 009) ===
Archivos de prueba escaneados: 7
Identificadores RF-9xx citados: RF-902, RF-905, RF-906, RF-908, RF-912

RF esperados de P5 en tarea3/:
  ✓ RF-902  ✗ RF-903  ✗ RF-904  ✓ RF-905  ✓ RF-906  ✗ RF-907  ✓ RF-908  ✓ RF-912  ✗ RF-913
RESULTADO: 4 RF de P5 aún sin test en tarea3/.
```

RF-903 y RF-904 son de P2/P3 (servicios de consulta y actualización); se cubren cuando se
mergéen P2 y P3. RF-907 se verifica en la introspección del esquema (no hay campos de salud,
neurodivergencia ni documentos). RF-913 es este documento de evidencia.

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

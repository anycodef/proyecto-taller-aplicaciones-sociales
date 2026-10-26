# Cómo reproducir la demo de la Tarea 3 (P5 — Integración)

Este documento permite a cualquier compañero (que no haya escrito el código) reproducir
la parte de integración, base de datos, pruebas y evidencia de la Tarea 3 usando **solo**
este archivo. Requiere: Node 22+, npm, PostgreSQL en `PUERTO_POSTGRES` (55432 por defecto)
y Docker Desktop (opcional, si se usa `api/docker-compose.yml`).

## 0. Requisitos previos

- Tener PostgreSQL corriendo en `127.0.0.1:55432` con la base de datos `sigecat`.
  Si usa Docker: `docker compose -f api/docker-compose.yml up -d postgres`.
- Estar en la rama `main` (o en `tarea3/p5-integracion` mergeada con `main`).

## 1. Instalar dependencias de tarea3 (una sola vez)

```bash
npm --prefix tarea3 install
```

Comando esperado: `added NN packages`. No modifica `package.json` raíz.

## 2. Subir la base de datos y sembrar datos ficticios (hito 1, T009-52/53)

```bash
npm --prefix tarea3 run bd:subir
npm --prefix tarea3 run bd:sembrar
```

Salida esperada (ver `tarea3/evidencia/demo-output.txt`):
```
[bd:subir] esquema demo_tarea3 creado en PostgreSQL
[bd:sembrar] siembra ficticia completada: 2 grupos, 12 catequizandos, 6 domingos
```

La siembra usa datos 100 % ficticios con `identidadOperativa` (RF-907, RNF-901) y deja
casos de riesgo BAJO/MEDIO/ALTO (RF-908).

## 3. Generar un token de demostración (T009-51, RF-906)

```bash
npm --prefix tarea3 run token -- --rol COORD
```

Imprime un JWT HS256 para autenticar contra los servicios.

## 4. Ejecutar la demo completa (T009-58, RF-912)

```bash
npm --prefix tarea3 run demo
```

Esto sube la BD, migra, siembra, arranca servicio-consulta (puerto 4000) y
servicio-actualizacion (puerto 50051),
esperando salud y ejecutando el recorrido:
**consulta GraphQL → mutación (delega por gRPC) → consulta refleja el cambio → lote → streaming**,
imprimiendo cada paso.

Salida esperada (ver `tarea3/evidencia/demo-output.txt`):
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
El comando termina con código 0 únicamente si todos los pasos pasan; ante un
fallo devuelve un código distinto de cero.

## 5. Ejecutar las pruebas de tarea3

```bash
npm --prefix tarea3 test
```

Debe terminar con `pass NN` y `fail 0`. Ver `tarea3/evidencia/test-output.txt`.

## 6. Typecheck y lint de tarea3

```bash
npm --prefix tarea3 run typecheck
npm --prefix tarea3 run lint
```

Deben terminar sin errores.

## 7. Verificar cobertura de RF (RNF-905, T009-57)

```bash
node tarea3/scripts/verificar-cobertura-rf.mjs
```

Cuenta los identificadores `RF-9xx` citados en los nombres de test de P1–P5.
Ver `tarea3/evidencia/cobertura.txt`.

## 8. Checks integrales (raíz)

```bash
npm test && npm run typecheck && npm run lint
```

## Mapa viñeta del profesor → artefacto → comando → log/captura → commits

| Viñeta del enunciado | Artefacto | Comando | Log/captura | Commits (P5) |
|---|---|---|---|---|
| 1. Dónde aplicar GraphQL/gRPC (consultas y actualizaciones) | `docs/tarea-3/matriz-aplicabilidad.md` + ADR (P1) | — (P1) | — | — |
| 2. Demo funcional: microservicios de consulta y actualización | `tarea3/compartido/`, `tarea3/bd/`, `tarea3/scripts/`, `tarea3/pruebas-e2e/` | `npm --prefix tarea3 run demo` | `tarea3/evidencia/demo-output.txt` | `feat(tarea3): ...` (T009-51…58) |
| 3. GraphQL vs gRPC vs MCP para un agente | `tarea3/servidor-mcp/` (P4) + `decision-agente-mcp.md` (P1) | — (P4/P1) | — | — |

La evidencia completa con salidas reales está en `tarea3/evidencia/` y se resume en
`docs/tarea-3/evidencia.md`. Cada commit de P5 lleva su registro
`docs/agent-trace/tarea3-p5.json`.

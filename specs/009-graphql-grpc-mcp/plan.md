# Plan 009 — GraphQL, gRPC y MCP

Implementa [spec.md](spec.md).

## 1. Estructura y dueños (un directorio = una persona)

| Directorio | Dueña/o | Contenido |
| --- | --- | --- |
| `docs/tarea-3/`, `docs/adr/20261019-graphql-grpc-mcp.md`, `specs/009-*` | P1 | Análisis, matriz, ADR, decisión MCP, informe |
| `tarea3/servicio-consulta/` | P2 | Servidor GraphQL (lectura) + cliente gRPC para mutaciones |
| `tarea3/servicio-actualizacion/` | P3 | Servidor gRPC (escritura, lote, streaming) |
| `tarea3/servidor-mcp/`, `tarea3/agente/`, `tarea3/.mcp.json` | P4 | Herramientas MCP y guion de agente |
| `tarea3/compartido/`, `tarea3/bd/`, `tarea3/scripts/`, `tarea3/package.json`, `tarea3/pruebas-e2e/`, `tarea3/evidencia/`, `docs/tarea-3/evidencia.md`, `docs/tarea-3/ejecutar.md` | P5 | Base, siembra, auth demo, regla de riesgo, orquestación, e2e, evidencia |
| `tarea3/contratos/` | **Congelado** | Solo se cambia por PR aprobado por P1 y avisando al grupo |

Regla de oro: **nadie edita fuera de su directorio.** Si necesita algo de otro, lo pide por issue/PR al dueño. Así los merges no tienen conflictos.

## 2. Contratos congelados (hito 0)

`tarea3/contratos/schema.graphql`, `sigecat.proto` y `herramientas-mcp.md` ya están escritos. Cada servicio se implementa contra ellos sin esperar al resto; los tests de cada persona usan dobles (P2 simula el cliente gRPC, P4 simula GraphQL, P3 prueba con un cliente gRPC propio).

## 3. Dependencias (justificación, principio 1)

Solo en `tarea3/package.json`. Versiones exactas las fija P5 con `npm install` (≥ 2 semanas de antigüedad).

| Paquete | Para qué | Alternativa descartada |
| --- | --- | --- |
| `graphql`, `graphql-http` | Esquema, ejecución y endpoint HTTP | Apollo/Yoga: más superficie y dependencias |
| `@grpc/grpc-js`, `@grpc/proto-loader` | Servidor/cliente gRPC en Node puro | `grpc` nativo: obsoleto |
| `@modelcontextprotocol/sdk`, `zod` | Servidor MCP y validación de entradas | Protocolo a mano |
| `pg` | PostgreSQL (ya usado en `api/`) | SQLite: no comparte entre procesos igual de simple |
| `jose` | JWT de demostración (ya usado en `api/`) | — |
| `tsx`, `typescript` | Ejecutar TS sin build (ya usados en `api/`) | — |

Pruebas con `node:test` incluido en Node 22 (sin Jest extra).

## 4. Modelo de datos de la demo (esquema `demo_tarea3`)

No es el modelo de producción; es una proyección mínima para la demo, creada y borrada por scripts propios.

- `grupo(id uuid, nombre)`
- `catequizando(id uuid, grupo_id, identidad_operativa, edad)` — sin salud ni documentos
- `asistencia(id uuid pk, catequizando_id, fecha date, estado, registrado_por, registrado_en)` — `id` lo genera el cliente
- `justificacion(id uuid pk, asistencia_id, motivo, estado)`
- `riesgo(catequizando_id pk, nivel, motivo, calculado_en)`

Regla de riesgo (RF-908, pura, en `compartido/riesgo.ts`): 0–1 faltas consecutivas sin justificar → BAJO; 2 → MEDIO; ≥ 3 → ALTO; una falta justificada no cuenta.

## 5. Autenticación de demostración

`npm --prefix tarea3 run token -- --rol CAT --grupo <uuid>` imprime un JWT HS256 (clave local `DEMO_JWT_CLAVE`). GraphQL lo recibe como `Authorization: Bearer`, gRPC como metadata `authorization`, MCP como variable de entorno `SIGECAT_TOKEN`. La verificación vive en `compartido/auth.ts` (P5) y la usan los tres servicios.

## 6. Puertos

PostgreSQL 55432 (el de `PUERTO_POSTGRES`), servicio-consulta 4000, servicio-actualizacion 50051.

## 7. Integración y ramas

- Rama por persona: `tarea3/p1-analisis`, `tarea3/p2-consulta`, `tarea3/p3-actualizacion`, `tarea3/p4-mcp`, `tarea3/p5-integracion`.
- Orden de merge a `main`: P5 (base y compartido) → P3 → P2 → P4 → P1 → P5 (e2e y evidencia final). P5 abre primero porque los demás importan `compartido/`.
- PR pequeños, un commit por tarea de `tasks.md`, Conventional Commits (`feat(tarea3): ...`), Agent Trace en el mismo commit.

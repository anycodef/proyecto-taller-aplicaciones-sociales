# Spec 009 — GraphQL, gRPC y MCP (Tarea 3 del taller)

## 1. Qué y por qué

La Tarea 3 del taller pide tres entregables, que esta spec convierte en requisitos verificables:

1. **Análisis**: identificar en SIGECAT dónde aplican GraphQL y gRPC para consultas y para actualizaciones, validar si son aplicables al proyecto y justificar.
2. **Demo funcional** con GraphQL o gRPC que incluya microservicios de consulta y de actualización de datos.
3. **Decisión para agentes de IA**: si un agente usara esos microservicios, ¿GraphQL, gRPC o exponerlos como herramienta MCP? Justificar.

Decisión de alcance (ADR `docs/adr/20261019-graphql-grpc-mcp.md`): la demo usa **ambos** estilos, cada uno donde encaja, y un servidor MCP encima:

```
Agente IA ──MCP──▶ servidor-mcp ─┐
                                 ├─GraphQL──▶ servicio-consulta ──SQL──▶ PostgreSQL (esquema demo_tarea3)
Cliente web/Postman ─GraphQL─────┘                  │ (mutaciones)
                                                    └─gRPC──▶ servicio-actualizacion ──SQL──▶ PostgreSQL
```

- **servicio-consulta** (GraphQL, lectura + puerta de entrada de mutaciones): el coordinador pide solo los campos que necesita (R20, datos móviles mínimos).
- **servicio-actualizacion** (gRPC, escritura): contrato binario tipado, idempotente por UUID de cliente, con streaming para la asistencia masiva del domingo (R22).
- **servidor-mcp**: expone ambas capacidades como herramientas para un agente de IA.

Todo vive en `tarea3/` y es **independiente de la app y de la API de producción**: no toca `src/`, `api/` ni el modelo de datos de las specs 001–008. Los datos son de demostración (ficticios).

## 2. Fuera de alcance

- Reemplazar el REST/WatermelonDB de la app (se justifica en la matriz por qué no).
- Desplegar en Azure (la demo corre en local con Docker + Node).
- Exponer salud, neurodivergencia o documentos de identidad por ninguno de los tres canales.

## 3. Requisitos funcionales

- **RF-901 Matriz de aplicabilidad.** El sistema (documentación) deberá incluir en `docs/tarea-3/matriz-aplicabilidad.md` una tabla con cada funcionalidad candidata de SIGECAT (al menos 10, cubriendo consultas y actualizaciones), el protocolo recomendado (REST actual / GraphQL / gRPC / ninguno), el veredicto «aplicable / no aplicable» y su justificación atada a requerimientos R1–R27 y a la constitución.
- **RF-902 Consulta GraphQL.** El servicio-consulta deberá exponer el esquema de `tarea3/contratos/schema.graphql` y resolver `yo`, `catequizando`, `catequizandos`, `asistenciaDelDomingo` y `riesgoDelGrupo`, devolviendo solo los campos solicitados.
- **RF-903 Actualización gRPC.** El servicio-actualizacion deberá implementar `tarea3/contratos/sigecat.proto`: `RegistrarAsistencia`, `RegistrarAsistenciaLote` (client streaming), `RegistrarJustificacion`, `RecalcularRiesgo` y `ObservarAsistencia` (server streaming).
- **RF-904 Mutaciones por la puerta GraphQL.** Cuando llegue una mutación GraphQL, el servicio-consulta deberá delegarla por gRPC en el servicio-actualizacion y devolver su resultado sin duplicar reglas de negocio.
- **RF-905 Idempotencia.** Si una escritura repite un `id` (UUID generado en el cliente), entonces el sistema deberá devolver el resultado original con `repetido = true` y no crear un segundo registro (constitución 6).
- **RF-906 Autorización por rol.** El sistema deberá validar en cada petición un JWT de demostración con rol (`COORD`, `CAT`, `FAM`, `SUP`) y alcance de grupo: `CAT` solo ve y escribe su grupo, `FAM` solo a su hijo, `SUP` nunca escribe. Una violación devuelve `fuera_de_alcance` (GraphQL: `extensions.codigo`; gRPC: `PERMISSION_DENIED`; MCP: error de herramienta).
- **RF-907 Datos protegidos.** El sistema nunca deberá exponer por GraphQL, gRPC ni MCP salud, neurodivergencia ni documentos; y deberá mostrar al autor siempre con `identidadOperativa` (R25, R26).
- **RF-908 Riesgo calculado.** `RecalcularRiesgo` deberá clasificar BAJO/MEDIO/ALTO con la regla pura de `tarea3/compartido/riesgo.ts` (faltas consecutivas sin justificar; ver plan §4) y persistir el resultado con su fecha.
- **RF-909 Servidor MCP.** El servidor-mcp deberá exponer las herramientas de `tarea3/contratos/herramientas-mcp.md` por transporte stdio, con esquema de entrada validado; las herramientas de escritura deberán marcarse no destructivas e idempotentes y no deberán permitir borrar.
- **RF-910 Agente demostrado.** Deberá existir `.mcp.json` en `tarea3/` y un guion `tarea3/agente/guion.md` con el que un agente (Claude Code) responde «¿qué niños del grupo 3 están en riesgo y por qué?» y registra una asistencia solo usando herramientas MCP; la transcripción queda en `tarea3/evidencia/`.
- **RF-911 Justificación MCP.** `docs/tarea-3/decision-agente-mcp.md` deberá comparar GraphQL, gRPC y MCP para un agente (descubrimiento, tokens/contexto, seguridad, tipado, streaming, costo) y concluir una elección.
- **RF-912 Demo en un comando.** `npm --prefix tarea3 run demo` deberá levantar la base, migrar, sembrar, arrancar los servicios y ejecutar un recorrido que imprime cada paso (consulta → mutación → consulta → streaming).
- **RF-913 Evidencia contra el enunciado.** `docs/tarea-3/evidencia.md` deberá mapear cada viñeta del enunciado del profesor a su artefacto, comando y captura/log.

## 4. Requisitos no funcionales

- **RNF-901 Datos ficticios.** La siembra usa nombres inventados e `identidadOperativa`; ningún dato real de menores.
- **RNF-902 Dependencias acotadas.** Solo `tarea3/package.json` declara las dependencias nuevas (plan §3); `package.json` y `api/package.json` no cambian.
- **RNF-903 Protección de GraphQL.** El servicio-consulta deberá rechazar consultas con profundidad > 6 y paginar con máximo 50 por página, para no abrir un vector de abuso nuevo.
- **RNF-904 Reproducible.** Un equipo con Node 22 y Docker obtiene la demo sin pasos manuales fuera de `docs/tarea-3/ejecutar.md`.
- **RNF-905 Trazabilidad.** Cada commit lleva su registro Agent Trace (`docs/agent-trace/tarea3-pN.json`) y cada RF tiene un test que lo cita (`scripts/verificar-cobertura-rf.mjs`).

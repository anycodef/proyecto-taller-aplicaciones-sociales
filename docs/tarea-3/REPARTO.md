# Reparto de la Tarea 3 entre 5 personas

Spec: [`specs/009-graphql-grpc-mcp`](../../specs/009-graphql-grpc-mcp/spec.md) · Contratos congelados: [`tarea3/contratos/`](../../tarea3/contratos).

## Qué pidió el profesor y quién lo cubre

| Viñeta del enunciado | Entregable | Responsable principal | Apoya |
| --- | --- | --- | --- |
| 1. Identificar dónde aplicar GraphQL/gRPC (consultas y actualizaciones), validar y justificar | `matriz-aplicabilidad.md` + ADR | **P1** | todos aportan 1–2 filas de su área |
| 2. Demo funcional con microservicios de consulta y actualización | GraphQL (consulta) + gRPC (actualización) | **P2** consulta · **P3** actualización | **P5** orquesta y prueba el conjunto |
| 3. ¿GraphQL, gRPC o MCP para un agente de IA? Justificar | Servidor MCP + `decision-agente-mcp.md` | **P4** (MCP) · **P1** (texto) | P5 mide |

## Las 5 personas

| Persona | Rol | Directorio propio | Tareas | Rama |
| --- | --- | --- | --- | --- |
| **P1** | Análisis, decisión y documento final | `docs/tarea-3/` (salvo evidencia/ejecutar), `docs/adr/` | T009-11…18 | `tarea3/p1-analisis` |
| **P2** | Microservicio de consulta (GraphQL) | `tarea3/servicio-consulta/` | T009-21…28 | `tarea3/p2-consulta` |
| **P3** | Microservicio de actualización (gRPC) | `tarea3/servicio-actualizacion/` | T009-31…37 | `tarea3/p3-actualizacion` |
| **P4** | Servidor MCP y agente de IA | `tarea3/servidor-mcp/`, `tarea3/agente/` | T009-41…47 | `tarea3/p4-mcp` |
| **P5** | Integración, base de datos, pruebas y evidencia | `tarea3/{compartido,bd,scripts,pruebas-e2e,evidencia}` | T009-51…60 | `tarea3/p5-integracion` |

Carga equilibrada: P5 es la más técnica en el arranque (todos dependen de `compartido/`), P1 pesa al final. Si alguien termina antes, ayuda a P5 con `T009-59/60`.

## Orden de trabajo

| Hito | Qué pasa | Condición de salida |
| --- | --- | --- |
| **0. Hoy** | Se hace commit de spec 009 y contratos; cada quien crea su rama y lee su prompt. | `main` contiene `specs/009-*` y `tarea3/contratos/`. |
| **1. Base** | P5 sube `package.json`, BD, siembra, `auth` y `riesgo` (T009-51…56). Mientras, P2/P3/P4/P1 avanzan con dobles y documentos. | PR de P5 mergeado; el resto hace `git merge main`. |
| **2. Servicios** | P3 y P2 terminan; P4 conecta MCP contra GraphQL real. | Cada PR mergeado con tests verdes. |
| **3. Integración** | P5 corre `demo` y e2e; P4 graba la transcripción del agente; P1 mide tokens y cierra la decisión. | `npm --prefix tarea3 run demo` termina en 0. |
| **4. Cierre** | Informe, evidencia, ensayo de exposición (T009-90). | `evidencia.md` sin celdas vacías. |

## Reglas para que se integre sin dolor

1. **Un directorio = una persona.** Nadie edita fuera del suyo; se pide por PR/issue al dueño.
2. **Contratos congelados.** Cambiar `tarea3/contratos/` exige acuerdo de las 5 personas y que P1 lo apruebe.
3. **Un commit por tarea**, Conventional Commits (`feat(tarea3): ...`, `docs(tarea3): ...`), con su Agent Trace `docs/agent-trace/tarea3-pN.json` (uno por persona → sin conflictos).
4. **Un test por RF, con el identificador en el nombre** (`RF-902: ...`); se verifica con `node scripts/verificar-cobertura-rf.mjs`.
5. **Rebase/merge de `main` cada vez que P5 mergee** y antes de abrir PR.
6. **Nada de datos reales** de niños ni de catequistas; solo la siembra ficticia.

## Cómo demostramos que hicimos lo que dijo el profesor

Se resume en `docs/tarea-3/evidencia.md` (lo arma P5, lo revisa P1): por cada viñeta, un enlace al documento, el comando que lo reproduce, el log o captura de la salida y los commits que lo respaldan (`git log --author` por persona + Agent Trace). Eso permite también mostrar quién hizo qué.

## Comandos de cada persona

```bash
git checkout -b tarea3/pN-...        # tu rama
# abre tu agente en la raíz del repo y pégale docs/tarea-3/prompts/persona-N.md
npm test && npm run typecheck && npm run lint && npm --prefix tarea3 test
```

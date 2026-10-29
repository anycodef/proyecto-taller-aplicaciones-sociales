# Instrucciones comunes (van al inicio de cada prompt)

Trabajas en el repositorio SIGECAT, Tarea 3 del taller (GraphQL, gRPC y MCP).

Antes de escribir código:
1. Lee `AGENTS.md`, `docs/constitution.md` y `specs/009-graphql-grpc-mcp/{spec,plan,tasks}.md`.
2. Lee los contratos congelados en `tarea3/contratos/`. No los modifiques.
3. Crea tu rama (indicada abajo) desde `main`.

Reglas:
- Edita **solo tu directorio** (indicado abajo). Si necesitas algo de otro, déjalo escrito en `docs/tarea-3/pedidos/pN-para-pM.md` y avisa a la persona.
- Haz **una tarea de `tasks.md` por commit** (Conventional Commits, `feat(tarea3): ...`). En el mismo commit actualiza tu registro Agent Trace `docs/agent-trace/tarea3-pN.json` (copia el formato de `docs/agent-trace/backend-001.json`: fecha, agente, modelo, rama, tareas, alcance, fuentes, cambios, verificacion) y marca la tarea `[x]` **solo con evidencia** (test que pasó).
- Todo test lleva el identificador en su nombre (`RF-902: ...`) y se escribe antes o junto con el código.
- Código, nombres, mensajes y documentación en español; identificadores sin tildes ni ñ; archivos en `kebab-case`; alias de importación según el `tsconfig` de `tarea3`.
- No agregues dependencias fuera de plan §3. No toques `src/`, `api/`, `package.json` raíz, `docs/constitution.md` ni specs 001–008.
- Datos solo ficticios; nunca salud, neurodivergencia ni documentos; autores siempre con `identidadOperativa`.
- Al terminar cada tarea: `npm test`, `npm run typecheck`, `npm run lint` y `npm --prefix tarea3 test` deben pasar. Si algo falla, la tarea no está terminada; no debilites tests.
- Si el contrato congelado te parece insuficiente, detente y repórtalo; no lo cambies tú.
- Al final entrega un resumen: tareas hechas, comandos ejecutados con su salida real, y lo que quedó pendiente.

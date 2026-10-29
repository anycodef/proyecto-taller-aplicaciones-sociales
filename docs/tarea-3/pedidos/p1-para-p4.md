# Pedido de P1 a P4 (MCP y agente)

P1 necesita cerrar T009-15 con una medición **real** de la demo, no solo con la
cota de contratos. Cuando el servidor MCP esté integrado contra el GraphQL real,
por favor entrega en `tarea3/evidencia/medicion-agente.md`:

1. La pregunta exacta: «¿quién está en riesgo en el grupo 3?» (o el grupo de la
   siembra que uses).
2. Por cada camino, los bytes reales de solicitud y respuesta:
   - MCP `listar_riesgo_grupo`;
   - GraphQL directo (`riesgoDelGrupo` + nombres, o la consulta que uses);
   - gRPC, si logras una ruta de lectura sin inventar un RPC fuera del contrato;
     si no existe, dilo explícitamente.
3. El número de llamadas y el tiempo total aproximado.
4. La salida cruda o la transcripción donde se vea el resultado.
5. Confirmación de que ninguna respuesta incluye salud, neurodivergencia ni
   documentos, y que los autores son `identidadOperativa`.

No cambies `tarea3/contratos/` para lograrlo: si el contrato no alcanza, repórtalo
y P1 lo llevará al grupo. P1 reemplazará la tabla de
`docs/tarea-3/decision-agente-mcp.md` con tus números.

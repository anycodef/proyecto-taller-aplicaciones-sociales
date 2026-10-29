# Medición MCP frente a GraphQL

Fecha: 2026-10-26.

Se midió la respuesta de la misma operación usada por el agente: riesgos MEDIO o ALTO del grupo `11111111-1111-1111-1111-111111111101`. La base estaba sembrada y ambos resultados estaban vacíos.

| Capa medida | Contenido | Bytes UTF-8 | Tokens aproximados |
|---|---|---:|---:|
| MCP, contenido de herramienta | `[]` | 2 | 1 |
| GraphQL, respuesta HTTP cruda | `{"data":{"riesgoDelGrupo":[]}}` | 30 | 8 |

La petición HTTP GraphQL, con consulta y variables pero sin contar cabeceras ni JWT, midió 267 bytes. La estimación de tokens usa la cota práctica `ceil(bytes / 4)`; no sustituye una tokenización por modelo.

La comparación mide el contenido de aplicación que recibe el agente, no los sobres de transporte JSON-RPC de MCP ni HTTP/TLS. En este caso MCP entrega 28 bytes menos porque elimina el envoltorio `data.riesgoDelGrupo`. Con respuestas no vacías el ahorro relativo será menor, pues los objetos de dominio son iguales en ambas capas.

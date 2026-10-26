# Salida de la medición de respuestas

Generado por `node docs/tarea-3/medicion/medir-respuestas.mjs`. Pregunta:
«¿quién está en riesgo en el grupo?». Datos ficticios, contratos congelados.
La carga útil de la respuesta no incluye TLS, cabeceras HTTP/2 ni metadata
JWT; la lista de herramientas se mide aparte. Los tokens son una aproximación
de bytes/4, no un tokenizer del modelo.

## Descubrimiento de capacidades

| Artefacto | Bytes | Tokens aprox. |
| --- | ---: | ---: |
| SDL GraphQL (`schema.graphql`) | 2,254 | 564 |
| Proto gRPC (`sigecat.proto`) | 2,077 | 520 |
| Lista MCP de 6 herramientas (JSON-RPC) | 1,522 | 381 |

La introspección GraphQL completa no se mide aquí porque sería mayor que el SDL;
un agente no debería pedirla entera para una pregunta. El proto se compila en el
cliente y no viaja en cada respuesta. La lista MCP sí se entrega al agente al
iniciar la sesión.

## Respuesta a la misma pregunta

| Camino | Llamadas | Bytes solicitud | Bytes respuesta | Bytes totales | Tokens aprox. (respuesta) | Nota |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| GraphQL: una consulta a catequizandos con riesgo anidado | 1 | 265 | 1,976 | 2,241 | 494 | Trae 12 niños y el agente filtra; no necesita conocer IDs de antemano. |
| GraphQL: riesgo + nombres en 2 llamadas (composición manual) | 2 | 761 | 717 | 1,478 | 180 | Solo los 4 niños en riesgo; requiere que el agente componga la segunda consulta. |
| GraphQL: 1 riesgo + 4 nombres (ingenuo) | 5 | 963 | 791 | 1,754 | 198 | Ronda por cada nombre; más llamadas y más contexto. |
| gRPC con el contrato congelado (12 RecalcularRiesgo) | 12 | 516 | 1,336 | 1,852 | 334 | No existe RPC de lectura por grupo; se usaría una escritura por niño y además devuelve los 12. |
| MCP: listar_riesgo_grupo (1 herramienta compuesta) | 1 | 171 | 568 | 739 | 142 | El servidor hace la composición; el agente ve solo nombre, nivel y motivo de los 4 en riesgo. |

## Lectura

- MCP gana en la respuesta porque una herramienta compuesta devuelve solo los 4
  casos relevantes y no obliga al agente a conocer el esquema ni a componer
  consultas. Su costo está en la lista de herramientas y en el servidor.
- GraphQL gana si el agente ya sabe consultar y quiere explorar campos; su
  mejor caso son 2 llamadas, pero el ingenuo multiplica tokens.
- gRPC pierde para esta pregunta: el contrato no tiene lectura de riesgo por
  grupo y habría que escribir 12 veces para obtener una respuesta peor.
- La medición es una cota de contratos, no una prueba e2e. P4/P5 deben
  reemplazarla por los bytes reales de la demo cuando esté integrada.

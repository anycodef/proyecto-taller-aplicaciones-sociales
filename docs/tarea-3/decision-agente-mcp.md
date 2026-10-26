# ¿GraphQL, gRPC o MCP para un agente de IA? (T009-15)

Pregunta del enunciado: si un agente de IA usara los microservicios de SIGECAT,
¿debería hablar GraphQL, gRPC o usar herramientas MCP? La respuesta corta es
**MCP como fachada del agente**, con GraphQL detrás para leer y gRPC detrás para
escribir. gRPC directo no es una buena interfaz para un agente exploratorio y
GraphQL directo solo funciona si el agente ya conoce el esquema y tiene límites
de costo.

## Criterios

1. **Descubrimiento de capacidades**: ¿el agente puede saber qué puede hacer sin
   leer documentación externa?
2. **Consumo de contexto/tokens**: ¿cuánto esquema y cuánta respuesta ocupa en
   la ventana del modelo?
3. **Seguridad y alcance**: ¿cómo se impide que el agente lea datos protegidos o
   escriba fuera de su rol?
4. **Tipado**: ¿el contrato se valida antes de ejecutar?
5. **Streaming**: ¿puede recibir eventos sin inventar un bucle de sondeo?
6. **Costo de integración**: ¿cuánto trabajo exige conectarlo a Claude Code,
   OpenCode u otro agente?

## Tabla comparativa

| Criterio | GraphQL directo | gRPC directo | MCP |
| --- | --- | --- | --- |
| Descubrimiento | Introspección del esquema; potente pero el agente debe saber formular consultas y elegir campos | No hay descubrimiento en tiempo de ejecución: el agente necesita el `.proto` y stubs generados | `tools/list` entrega nombre, descripción, esquema de entrada y anotaciones; el agente descubre sin leer el código |
| Contexto/tokens | Puede pedir solo campos, pero el esquema completo y las consultas ingenuas ocupan contexto; riesgo de over-fetch y de N+1 | Respuestas binarias compactas, pero el agente necesita el proto y un runtime gRPC; no es un formato que el modelo lea directamente | Devuelve texto JSON corto y acotado por herramienta; la lista de herramientas es pequeña (medición: 1.522 bytes para 6) |
| Seguridad y alcance | El servidor valida JWT y alcance, pero el esquema abierto permite consultas amplias si no se limita la profundidad | Metadata `authorization` y errores `PERMISSION_DENIED`; el contrato es angosto, pero el agente necesita credenciales y stubs | Cada herramienta declara alcance; el servidor MCP filtra y devuelve `fuera_de_alcance`; no hay herramienta de borrado ni de datos protegidos |
| Tipado | SDL + validación de consulta; los inputs se validan en el resolver | Proto3 + validación binaria; el tipado más estricto de los tres | `zod` valida la entrada de cada herramienta; el esquema es explícito y legible |
| Streaming | Subscriptions exigirían WebSocket y otra autenticación; no están en el contrato | Server streaming nativo (`ObservarAsistencia`); ideal para eventos de coordinación | El SDK puede exponer notificaciones, pero el contrato de la demo no define streaming por MCP; para esta pregunta no hace falta |
| Costo de integración | Cliente HTTP y conocimiento del esquema; bajo si ya existe el endpoint | Generar stubs, manejar binarios, metadata y reintentos; alto para un agente | SDK MCP + `.mcp.json`; el agente lo descubre solo. Costo medio, pero se paga una vez |

## Medición real disponible

La pregunta medida es **«¿quién está en riesgo en el grupo?»** con 12
catequizandos ficticios y 4 casos en riesgo (2 MEDIO, 2 ALTO). La medición se
genera con `node docs/tarea-3/medicion/medir-respuestas.mjs` y queda en
`docs/tarea-3/medicion/salida-medicion.md`. **No es una medición e2e**: serializa
los contratos congelados y los datos de ejemplo; no incluye TLS, cabeceras
HTTP/2 ni metadata JWT. La lista de herramientas se mide aparte, en la tabla de
descubrimiento. Los tokens son una aproximación de `bytes / 4`, no un tokenizer
del modelo.

| Camino | Llamadas | Bytes de respuesta | Tokens aprox. | Observación |
| --- | ---: | ---: | ---: | --- |
| GraphQL: una consulta a `catequizandos` con `riesgo` anidado | 1 | 1.976 | 494 | Trae los 12 niños y el agente filtra; no necesita IDs previos |
| GraphQL: `riesgoDelGrupo` + nombres en 2 llamadas | 2 | 717 | 180 | Solo los 4 en riesgo; exige que el agente componga la segunda consulta |
| GraphQL: 1 riesgo + 4 nombres (ingenuo) | 5 | 791 | 198 | Una llamada por nombre; más latencia y más oportunidades de error |
| gRPC con el contrato congelado | 12 | 1.336 | 334 | No hay RPC de lectura por grupo: habría que ejecutar `RecalcularRiesgo` (escritura) por cada niño |
| MCP: `listar_riesgo_grupo` | 1 | 568 | 142 | El servidor compone; el agente ve solo nombre, nivel y motivo de los 4 en riesgo |

### Descubrimiento

| Artefacto | Bytes | Tokens aprox. |
| --- | ---: | ---: |
| SDL GraphQL (`schema.graphql`) | 2.254 | 564 |
| Proto gRPC (`sigecat.proto`) | 2.077 | 520 |
| Lista MCP de 6 herramientas (JSON-RPC) | 1.522 | 381 |

La introspección GraphQL completa sería mayor que el SDL; no se mide porque un
agente no debería pedirla entera para una pregunta. El `.proto` no viaja en cada
respuesta, pero el agente necesita stubs. La lista MCP sí se entrega al iniciar
la sesión y es la más pequeña de las tres.

## Lectura honesta de la medición

- **MCP gana para un agente conversacional**: una sola herramienta devuelve 568
  bytes y 142 tokens aproximados, frente a 1.976 bytes y 494 tokens de la
  consulta GraphQL que trae los 12 niños. La diferencia no es solo de tamaño:
  el agente no tiene que saber GraphQL ni componer consultas.
- **GraphQL directo puede ser eficiente si el agente es experto**: su mejor caso
  son 2 llamadas y 717 bytes, apenas más que MCP, pero exige que el modelo
  construya una segunda consulta con los IDs que acaba de recibir. Un agente
  ingenuo cae en 5 llamadas; uno mal instruido puede pedir el esquema completo o
  una consulta profunda.
- **gRPC directo pierde para esta pregunta**: el contrato no tiene una lectura
  de riesgo por grupo. Para responder habría que escribir 12 veces con
  `RecalcularRiesgo`, lo que además cambia el estado y no es una consulta. Es la
  evidencia más fuerte de que gRPC no es la interfaz del agente, sino el canal
  interno de escritura.
- **La medición no sustituye la demo**: P4 debe medir la respuesta real del
  servidor MCP y P5 la respuesta real de GraphQL/gRPC cuando estén integrados.
  Los pedidos están en `docs/tarea-3/pedidos/p1-para-p4.md` y
  `p1-para-p5.md`; esta tabla se reemplaza antes del cierre.

## Conclusión

**Para un agente de IA se elige MCP**, no porque sea un protocolo más rápido,
sino porque es el único de los tres que ofrece descubrimiento, esquema de
entrada validado y alcance acotado por herramienta en el formato que el agente
consume. MCP no reemplaza a GraphQL ni a gRPC: es una fachada. Detrás de
`listar_riesgo_grupo` el servidor MCP consulta GraphQL; detrás de
`registrar_asistencia` llama a GraphQL, que delega por gRPC en el servicio de
actualización (RF-904). Así el agente no necesita conocer ni el esquema GraphQL
ni el `.proto`.

**Cuándo no usar MCP**:

- Si el agente es un job interno determinista que ya conoce el contrato y solo
  mueve lotes, gRPC directo es más simple y más rápido.
- Si el agente es un analista que necesita explorar combinaciones de campos no
  previstas, GraphQL directo con límites de profundidad y costo es razonable,
  siempre que no se le dé un token con más alcance del necesario.
- Si el agente debe consumir eventos en vivo, gRPC server streaming es la
  herramienta correcta; MCP no está pensado para streaming continuo en este
  contrato.

**Cuándo no usar ninguno**: para la app móvil offline y para las escrituras
administrativas online, la respuesta sigue siendo REST/WatermelonDB. El agente
es un consumidor adicional, no la razón para cambiar la arquitectura de la app
(ver `matriz-aplicabilidad.md` y el ADR 016).

## Seguridad

- El token del agente va en `SIGECAT_TOKEN`; no se escribe en el repositorio ni
  en la transcripción.
- Las herramientas de escritura son no destructivas e idempotentes; no existe
  herramienta de borrado (RF-909).
- Salud, neurodivergencia y documentos no aparecen en ninguna herramienta ni en
  los recursos (RF-907).
- Un error de rol o alcance devuelve `{"codigo":"fuera_de_alcance"}` con
  `isError: true`, sin detalle interno (RF-906).
- Los autores se muestran con `identidadOperativa`, nunca con el nombre real de
  un catequista menor (R25, RF-907).

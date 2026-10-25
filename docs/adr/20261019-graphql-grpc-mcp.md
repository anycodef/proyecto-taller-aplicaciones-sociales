# 016 - GraphQL en el borde de consulta, gRPC interno y MCP para agentes

- Status: accepted
- Deciders: equipo SIGECAT (P1 análisis, P2 consulta, P3 actualización, P4 MCP, P5 integración)
- Date: 2026-10-19
- Tags: api graphql grpc mcp tarea3

Technical Story: Tarea 3 del taller y spec [009](../../specs/009-graphql-grpc-mcp/spec.md).

## Contexto y problema

La Tarea 3 pide identificar dónde aplican GraphQL y gRPC en SIGECAT, validar
si aplican y justificarlo; además, decidir cómo los usaría un agente de IA. La
presión fácil es cambiar todo a GraphQL o a gRPC para "cumplir" con la consigna.
Eso chocaría con decisiones ya aceptadas: la app es offline-first con
WatermelonDB (ADR 015), el backend aprobado es Azure Functions (ADR 014) y los
datos de menores exigen Zero Trust (ADR 005) y minimización (Const. 7).

La pregunta real es: **¿en qué bordes de SIGECAT un protocolo distinto aporta
algo medible sin romper offline, costo cero ni protección de datos?**

## Factores de decisión

- La asistencia debe registrarse sin señal y sincronizarse después (R19, Const. 5).
- El consumo de datos móviles debe ser mínimo (R20) y la digitación también (R27).
- Los domingos hay picos de 50 catequistas en 30 minutos (R22).
- Salud, neurodivergencia y documentos nunca salen del servidor autorizado
  (R26, Const. 7); los autores se muestran con `identidadOperativa` (R25).
- El backend corre en Azure Functions, que no ejecuta gRPC nativo (Const. 1).
- GraphQL y gRPC no están soportados de forma directa por React Native/Expo
  sin módulos nativos; el enlace familiar es web y no debe instalar nada (R9).
- Cada requisito debe tener un test que lo cite (Const. 2) y toda dependencia
  se justifica antes en la spec (Const. 1).

## Opciones consideradas

1. **Todo REST/JSON actual**, sin GraphQL ni gRPC.
2. **Todo GraphQL**, incluidas mutaciones, suscripciones y sincronización.
3. **Todo gRPC**, incluido el borde móvil y el navegador familiar.
4. **Híbrido por borde**: REST/WatermelonDB para la app y lo administrativo;
   GraphQL en paneles de consulta; gRPC interno para escritura, lotes y streaming.
5. **Solo MCP**, como única puerta para clientes y agentes.
6. **GraphQL subscriptions** para la asistencia en vivo.

## Decisión

Se adopta la **opción 4**, con estos límites explícitos:

- **REST actual / WatermelonDB** sigue siendo el transporte de la app móvil y de
  la sincronización offline. No se reemplaza por GraphQL ni gRPC (F-03, F-04,
  F-09, F-11, F-20 de la matriz; R19, R20, R22; ADR 013 y 015).
- **REST actual / HTTP+JSON** sigue siendo el borde de las escrituras
  administrativas online y sensibles: inscripción, enlaces, delegaciones,
  decisiones de justificación y aptitud, constancia y auditoría (F-02, F-08,
  F-15, F-17, F-18, F-19; R21, R26; Const. 5 y 7).
- **GraphQL** se usa solo en el borde de consulta de paneles con conexión, donde
  el cliente elige campos y combina datos: ficha, bandeja de justificaciones,
  avance, riesgo, aptitud, historial y reporte de misa (F-01, F-07, F-10, F-12,
  F-14, F-16, F-22; R15, R20, R27; RNF-903). Las mutaciones del contrato existen
  como puerta, pero **delegan por gRPC** en el servicio de actualización y no
  duplican reglas (RF-904).
- **gRPC** se usa solo servicio a servicio, en la demo local o en un futuro
  contenedor interno: escritura idempotente, lote y streaming (F-05, F-13;
  RF-903, RF-905, RF-908; R22). No se expone a React Native/Expo ni al navegador
  familiar, y no se presenta como viable en Azure Functions sin cambiar el
  plan aprobado.
- **MCP** es una fachada para agentes de IA, no un protocolo de producto. Expone
  herramientas de lectura y escritura acotadas, texto JSON corto, anotaciones y
  un recurso de riesgo; detrás usa GraphQL para leer y gRPC para escribir
  (`docs/tarea-3/decision-agente-mcp.md`, RF-909 a RF-911).

La demo de la Tarea 3 implementa el híbrido en `tarea3/` con datos ficticios y
el esquema `demo_tarea3`; **no toca** `src/`, `api/` ni el modelo de producción
(spec 009, alcance).

## Viabilidad real y alcance de la demo

Esta decisión es **para la demo de la Tarea 3**, no una autorización para migrar
producción. Leída como recomendación de producción, la respuesta honesta es:

- **GraphQL: viable solo en el borde online**, y solo con límites de profundidad,
  paginación y costo. No reemplaza REST/WatermelonDB y no se justifica si no hay
  un panel que realmente necesite seleccionar campos.
- **gRPC: no viable en la infraestructura aprobada**. Azure Functions no lo
  ejecuta nativo, Expo no lo soporta sin módulos nativos y el navegador familiar
  no puede hablar HTTP/2 gRPC sin un proxy. La demo local demuestra el contrato
  y el streaming, **no** un despliegue. Para producción habría que cambiar el
  plan de hosting y justificar el costo; eso no está aprobado.
- **MCP: opcional**. No es necesario para la app ni para el negocio; solo tiene
  sentido si se aprueba un caso de uso de agente. No se debe exponer a Internet
  sin autenticación, alcance y auditoría.
- Si el equipo tuviera que elegir una sola cosa para producción hoy, sería
  **no cambiar nada**: REST/WatermelonDB + Functions sigue siendo la opción ya
  verificada. GraphQL y gRPC quedan como demostración y como base de una
  discusión futura, no como deuda técnica ya contraída.

## Consecuencias positivas

- Los paneles de coordinación piden solo lo necesario y reducen datos y
  digitación (R20, R27) sin comprometer el almacén offline (R19).
- Las escrituras internas tienen contrato binario tipado, idempotencia por UUID
  y una sola transacción para el lote dominical (RF-903, RF-905).
- El agente de IA descubre herramientas con esquema y no necesita el esquema
  GraphQL completo ni stubs gRPC; puede responder en pocos tokens y con alcance
  acotado (RF-909, RF-911).
- Se conserva la arquitectura aprobada para la app y para Azure Functions; la
  demo no obliga a migrar producción.
- La matriz deja escrito dónde **no** aplicar cada protocolo, lo que evita
  decisiones por moda.

## Consecuencias negativas

- Hay tres fachadas que mantener (REST, GraphQL, gRPC) y una cuarta para el
  agente (MCP); aumenta la superficie de autenticación y de pruebas.
- gRPC no corre en Azure Functions ni en Expo sin trabajo adicional; la demo
  local no acredita despliegue en producción.
- GraphQL añade riesgo de consultas profundas y de N+1; se mitiga con límite de
  profundidad 6, paginación máxima 50 y cargador por lote (RNF-903).
- MCP tiene un costo de integración y un SDK joven; se acota a herramientas
  explícitas, sin borrado y sin datos protegidos (RF-907, RF-909).
- Los contratos congelados de `tarea3/contratos/` solo cambian por acuerdo de las
  cinco personas y aprobación de P1.

## Pros y contras de las opciones

### Todo REST/JSON actual

- Bueno: es la arquitectura ya verificada y la más simple de operar.
- Bueno: no añade dependencias ni superficies de autenticación.
- Malo: no responde a la consigna de identificar dónde aplican GraphQL y gRPC.
- Malo: no explora la selección de campos ni el streaming interno.

### Todo GraphQL

- Bueno: un solo esquema y selección de campos para todos los clientes.
- Malo: la sincronización offline de WatermelonDB no es GraphQL y se rompería
  (R19, Const. 5).
- Malo: la carga de evidencias a Blob y las suscripciones en Azure Functions
  añaden complejidad y costo (R8, R22, R23).
- Malo: un esquema introspectable amplio facilita el descubrimiento de datos que
  la auditoría y la minimización quieren limitar (R26, Const. 7).

### Todo gRPC

- Bueno: contratos binarios estrictos y streaming eficiente.
- Malo: no es viable en React Native/Expo ni en el navegador familiar sin
  módulos nativos o proxies (R9, R18).
- Malo: Azure Functions no lo ejecuta nativo; exigiría contenedores y otro
  modelo de costo (R23, Const. 1).
- Malo: depurar y observar binarios es más caro para un equipo pequeño (R24).

### Híbrido por borde (elegido)

- Bueno: cada protocolo se usa donde su ventaja es medible.
- Bueno: conserva offline, costo cero y Zero Trust en la app.
- Malo: más piezas y más pruebas de integración; se asume conscientemente.

### Solo MCP

- Bueno: una sola interfaz descubrible para agentes.
- Malo: MCP es para agentes, no para la app móvil ni el navegador; stdio no es
  un transporte público de producto.
- Malo: escondería la API real y ataría el producto al SDK de turno.

### GraphQL subscriptions para asistencia en vivo

- Bueno: el cliente recibiría eventos sin sondeo.
- Malo: WebSocket persistente, autenticación y costo en Functions; el contrato
  congelado ya resuelve el caso con gRPC server streaming en la demo (RF-903).
- Malo: la coordinación puede tolerar sondeo o un panel conectado; no es el
  camino crítico de la toma de asistencia (RNF-703).

## Enlaces

- [Spec 009](../../specs/009-graphql-grpc-mcp/spec.md) y
  [plan](../../specs/009-graphql-grpc-mcp/plan.md)
- [Matriz de aplicabilidad](../tarea-3/matriz-aplicabilidad.md)
- [Decisión para agentes: GraphQL, gRPC o MCP](../tarea-3/decision-agente-mcp.md)
- [Contratos congelados](../../tarea3/contratos/)
- [ADR 013: excepción administrativa ONLINE y retención](20261011-excepcion-administrativa-online-y-retencion.md)
- [ADR 014: servidores Azure Flex](20261011-configuracion-servidores-azure-flex.md)
- [ADR 015: transporte nativo WatermelonDB](20261011-transporte-nativo-watermelondb.md)
- [ADR 005: Zero Trust](20260914-zero-trust-para-proteccion-de-datos-de-menores.md)

# Guion de exposición — Tarea 3 (10 minutos)

**Regla de oro:** no afirmar que un servicio corre si no se ejecutó. Si P2, P3 o
P4 no están integrados, se muestra el contrato, el diagrama y se dice
explícitamente «esto está implementado por otra persona; hoy no lo ejecutamos».
La honestidad vale más que una demo inventada.

## Reparto y tiempos

| Minuto | Quién | Qué dice | Artefacto |
| --- | --- | --- | --- |
| 0:00–0:50 | P1 | Pregunta, tesis y hoja de ruta: «no cambiamos la app; elegimos un protocolo por borde». | `informe.md` §1 |
| 0:50–2:20 | P1 | Inventario y matriz: dónde sí y dónde no; los «no aplicable» honestos. | `inventario-funcionalidades.md`, `matriz-aplicabilidad.md` |
| 2:20–3:40 | P2 | GraphQL: consulta de panel, selección de campos, límite de profundidad 6 y página 50. | `schema.graphql`, `servicio-consulta/` |
| 3:40–5:00 | P3 | gRPC: escritura idempotente, lote dominical y `ObservarAsistencia`; por qué no va en el celular. | `sigecat.proto`, `servicio-actualizacion/` |
| 5:00–6:50 | P4 | MCP: descubrimiento, herramientas acotadas y agente respondiendo «quién está en riesgo y por qué». | `herramientas-mcp.md`, `servidor-mcp/`, `agente/` |
| 6:50–8:30 | P5 | Demo y e2e: un comando, migración, siembra, recorrido y evidencia; qué falló y qué no se ejecutó. | `ejecutar.md`, `evidencia.md` |
| 8:30–9:30 | P1 | Decisión para agentes: MCP como fachada, GraphQL para leer, gRPC para escribir; límites de producción. | `decision-agente-mcp.md` |
| 9:30–10:00 | P1 | Cierre: lo verificado, lo pendiente y la respuesta a «¿lo pondrías en producción?». | `informe.md` §8 |

## Texto base por bloque

### P1 — Apertura (0:00–0:50)

> «SIGECAT ya funciona offline con WatermelonDB y Azure Functions. La pregunta no
> es qué protocolo es más moderno, sino en qué borde uno distinto aporta algo sin
> romper offline, costo cero ni protección de datos. Nuestra tesis es híbrida:
> REST/WatermelonDB se queda; GraphQL solo en paneles; gRPC solo entre servicios;
> MCP solo como fachada para agentes. Y decimos con claridad qué no es viable en
> producción.»

### P1 — Matriz (0:50–2:20)

Mostrar la tabla de 22 filas y detenerse en tres «no»:

- Sincronización WatermelonDB: **no** GraphQL; el motor de sync no habla GraphQL.
- Enlaces de familia: **no** gRPC en el navegador; no hay HTTP/2 gRPC sin proxy.
- Administración sensible: **no** GraphQL directo; sigue REST con las mismas
  garantías.

### P2 — GraphQL (2:20–3:40)

> «GraphQL entra donde el panel necesita elegir campos y combinar datos: ficha,
> bandeja, avance, riesgo, aptitud, historial y reporte de misa. No reemplaza la
> app. Las mutaciones del contrato existen, pero delegan por gRPC para no
> duplicar reglas.»

Si el servicio no está levantado: mostrar `schema.graphql`, la consulta de riesgo
y la medición de 2 llamadas; decir que la ejecución queda pendiente.

### P3 — gRPC (3:40–5:00)

> «gRPC entra servicio a servicio: escritura idempotente por UUID, lote dominical
> y streaming de asistencia. No entra al celular ni al navegador familiar. En
> Azure Functions no corre nativo; la demo es local y no acredita producción.»

Si el servicio no está levantado: mostrar `sigecat.proto` y explicar
`RegistrarAsistenciaLote` y `ObservarAsistencia`; no simular la salida.

### P4 — MCP (5:00–6:50)

> «El agente no habla GraphQL ni gRPC: descubre herramientas MCP. `listar_riesgo_grupo`
> devuelve solo nombre operativo, nivel y motivo. Detrás, el servidor consulta
> GraphQL; para escribir, GraphQL delega en gRPC. El agente no ve salud,
> neurodivergencia ni documentos.»

Si el agente no está disponible: mostrar `herramientas-mcp.md`, la transcripción
de P4 si existe y la medición de 568 bytes; decir que la demo real está pendiente.

### P5 — Demo y e2e (6:50–8:30)

Ejecutar solo si está integrado:

```bash
npm --prefix tarea3 run demo
npm --prefix tarea3 test
```

Mostrar la salida real. Si falla, leer el error y decir qué falta. No pegar una
salida vieja como si fuera nueva.

### P1 — Decisión y cierre (8:30–10:00)

> «Para un agente elegimos MCP porque descubre, valida y acota; no porque sea más
> rápido. gRPC directo no puede responder “quién está en riesgo” sin escribir 12
> veces, porque el contrato no tiene lectura por grupo. Y si hoy hubiera que
> llevar una sola cosa a producción, no cambiaríamos nada: REST/WatermelonDB +
> Functions es lo ya verificado. GraphQL y gRPC son demo y discusión futura, no
> deuda técnica contraída.»

## Checklist de ensayo

### 24 horas antes

- [ ] `npm run typecheck` sin errores.
- [ ] `npm run lint` sin errores.
- [ ] `npm test` ejecutado y fallos conocidos, si los hay.
- [ ] `node --test docs/tarea-3/pruebas/documentacion.test.mjs` en verde.
- [ ] `node docs/tarea-3/medicion/medir-respuestas.mjs` reproduce la tabla.
- [ ] `npm --prefix tarea3 run demo` ejecutado por P5 y salida guardada.
- [ ] `npm --prefix tarea3 test` ejecutado por P5 y salida guardada.
- [ ] Enlaces del informe abren: ADR, matriz, decisión, diagrama, pedidos.

### 1 hora antes

- [ ] PostgreSQL de la demo arriba en `55432` o `PUERTO_POSTGRES`.
- [ ] Variables `DEMO_JWT_CLAVE` y `SIGECAT_TOKEN` definidas; ninguna en el repo.
- [ ] Servicios en `4000` (GraphQL) y `50051` (gRPC) sin procesos viejos.
- [ ] Agente con `.mcp.json` apuntando al servidor MCP local.
- [ ] Fuente del editor en tamaño legible; diagramas y tablas visibles.
- [ ] Plan B: capturas/logs de la última ejecución y contratos abiertos.

### Durante

- [ ] Cada persona dice solo su bloque y pasa la palabra.
- [ ] No se afirma «funciona» si no se ejecutó en vivo.
- [ ] Si algo falla, se muestra el error y se explica el impacto.
- [ ] Se respeta el tiempo: aviso a los 8:30 para el cierre.

### Preguntas probables

| Pregunta | Respuesta corta |
| --- | --- |
| ¿Por qué no todo GraphQL? | Rompe el sync offline de WatermelonDB y amplía la superficie de datos sensibles. |
| ¿Por qué no todo gRPC? | No corre en Expo ni en el navegador familiar, y Azure Functions no lo ejecuta nativo. |
| ¿MCP es un protocolo de transporte? | No; es una fachada para agentes. Detrás hay GraphQL y gRPC. |
| ¿Qué pasa si el agente intenta borrar? | No existe herramienta de borrado; las escrituras son idempotentes y no destructivas. |
| ¿Los datos son reales? | No; siembra ficticia con `identidadOperativa` y esquema `demo_tarea3`. |
| ¿Esto está listo para producción? | No. Es una demo; gRPC y MCP no están aprobados para producción. |

## Frases que no se deben decir

- «Ya está todo integrado» si P2–P5 no están mergeados.
- «Los tests pasan» sin mostrar la salida.
- «GraphQL es más rápido» sin la medición y sin decir que es una cota.
- «gRPC funciona en Azure Functions»: no es cierto con el plan aprobado.
- «El agente ve las fichas completas»: solo ve lo que la herramienta devuelve.

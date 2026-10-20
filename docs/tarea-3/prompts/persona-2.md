# Prompt P2 — Microservicio de consulta (GraphQL)

Sigue primero `docs/tarea-3/prompts/_comun.md`.

**Eres P2.** Rama: `tarea3/p2-consulta`. Directorio propio: `tarea3/servicio-consulta/`.
**Tareas:** T009-21 a T009-28. Requisitos: RF-902, RF-904, RF-906, RF-907, RNF-903.

Implementa el servicio GraphQL del contrato `tarea3/contratos/schema.graphql` (puerto 4000, `/graphql` y `/salud`) con `graphql` y `graphql-http` sobre `node:http`.
- Lee datos del esquema `demo_tarea3` con `tarea3/compartido/bd.ts`; autentica con `compartido/auth.ts` (ambos los entrega P5 en el hito 1: hasta entonces trabaja con dobles locales y no los copies).
- Evita el N+1 con un cargador por lote casero; demuéstralo en un test que cuente consultas SQL.
- Límite de profundidad 6 y paginación máxima 50.
- Las 3 mutaciones llaman por gRPC (`@grpc/proto-loader` con `tarea3/contratos/sigecat.proto`) al servicio de P3 en `localhost:50051`, reenviando el JWT en la metadata `authorization`, y traducen los errores gRPC a `extensions.codigo` (`fuera_de_alcance`, etc.). No dupliques reglas de negocio.
- El esquema nunca expone salud, neurodivergencia ni documentos; `registradoPor` siempre es `identidadOperativa`.
- Pruebas con `node:test` y un servidor gRPC doble. Un test por RF citado en su nombre.

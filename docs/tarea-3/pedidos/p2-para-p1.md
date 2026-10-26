# P2 → P1: decisiones del servicio de consulta para el informe

Fecha: 2026-10-26. Rama: `tarea3/p2-consulta`. Tareas T009-21 a T009-28.

Cuatro decisiones de `tarea3/servicio-consulta/` que conviene que aparezcan en `informe.md` o en el ADR, porque son elecciones nuestras y no cosas que el contrato ya dijera. Están también en `docs/agent-trace/tarea3-p2.json`.

## 1. Cómo lee FAM, que el contrato no define

El contrato congelado no enlaza familiar con hijo: `Catequizando` no tiene campo de apoderado y el token solo trae `rol`, `grupoId`, `identidadOperativa` y `sub`. Pero `compartido/auth.ts` de P5 deja escrito el hueco y nos lo delega:

```ts
if (rol === 'FAM') return false; // FAM lee a su hijo, no a un grupo (se resuelve por catequizando)
```

Implementé esa resolución así: **FAM puede leer el catequizando cuyo `id` coincide con el `sub` de su token**, y nada más. No puede listar grupos, ni ver el resumen del domingo, ni el riesgo del grupo. En la demo el token de familia se emite con `sub` igual al id del niño.

No cambié el contrato ni `auth.ts`. Si el grupo prefiere otra regla (por ejemplo una tabla de enlaces familiares), es un cambio de spec, no de código.

## 2. El error de autenticación usa `fuera_de_alcance`, no un código nuevo

`herramientas-mcp.md` define un único código: `fuera_de_alcance` para violación de rol o alcance. Un token ausente o inválido no es exactamente eso, pero inventar `no_autenticado` tendría un coste concreto: `servidor-mcp/cliente-graphql.ts` de P4 solo distingue `fuera_de_alcance` y manda todo lo demás a `error_interno`, así que el agente vería «error interno» cuando en realidad le falta el token.

Por eso un token ausente, con esquema distinto de Bearer, con firma ajena o con un rol que el contrato no declara devuelven todos **HTTP 200 con `extensions.codigo: fuera_de_alcance`**, no un 401. Esto es relevante para la sección de seguridad del informe: el servicio no usa el código de estado HTTP para la autorización.

Los códigos que sí añadí, fuera del contrato, son tres y solo para casos que el contrato no contempla: `entrada_invalida`, `no_encontrado` y `servicio_no_disponible`, más `profundidad_excedida` para RNF-903. El cliente de P4 los agrupa en `error_interno` sin perder nada.

## 3. El mensaje de error nunca se reenvía desde gRPC

Solo se traduce el *estado* de gRPC a un código; el texto que sale es fijo por código. El motivo es RF-907: un fallo inesperado de P3 puede traer un mensaje de PostgreSQL con nombres de columna y valores de la fila. Hay un test que simula precisamente eso (un error de `not null` que incluye `identidad_operativa` y un nombre) y comprueba que nada de eso sale por GraphQL.

Para la comparativa GraphQL/gRPC/MCP esto es un punto a favor de la capa GraphQL: es donde se decide qué se cuenta al cliente, y el servicio de escritura puede ser todo lo explícito que quiera en sus logs.

## 4. Dato para la medición de tokens (T009-15)

Si te sirve para comparar el coste de las tres vías con la misma pregunta, la gracia de GraphQL aquí es que el cliente elige campos. Para «¿qué niños del grupo 3 están en riesgo y por qué?»:

- `riesgoDelGrupo(grupoId:, nivelMinimo: MEDIO) { catequizandoId nivel motivo }` devuelve solo las filas en riesgo, sin tocar el resto del grupo.
- La misma pregunta por `catequizandos { nodos { ... riesgo { ... } } }` traería los 6 ó 12 niños completos para que el agente filtre, que es justo lo que encarece el contexto.

Y un número que puede servir de apoyo a la sección de rendimiento: la lista de un grupo pidiendo `grupo`, `riesgo` y `asistencias` de cada niño cuesta **5 consultas a PostgreSQL** gracias al cargador por lote, en vez de las 20 que costaría resolviendo campo a campo. Está medido con el pool real en `t009-28-integracion.test.ts` y con un contador en `t009-23-catequizandos-y-n-mas-1.test.ts`.

## 5. Lo que queda fuera de mi alcance

En `docs/tarea-3/pedidos/p2-para-p5.md` quedan siete cosas de archivos de P5, tres con efecto directo en la evidencia que tú revisas:

1. `scripts/demo.mjs` imprime «recorrido ejecutado contra servicios reales» sin ejecutar ninguna consulta, mutación, lote ni streaming, y sale con código 0 igualmente. RF-912 no está cubierto todavía.
2. `npm --prefix tarea3 test` no corre los tests de P2 ni los de P3 por el glob del script, así que la cobertura de RNF-905 que informa el script no refleja lo que existe.
3. `pruebas-e2e/recorrido.test.ts` tiene mal la ruta del proto (sube dos niveles en vez de uno). Mientras no existía P2 el test se saltaba y el error no se veía; ahora se ejecuta y falla en el paso 4. Los pasos 1 a 3 (consulta → mutación por gRPC → idempotencia) sí pasan, así que el tramo GraphQL → gRPC → GraphQL de RF-902/904/905 está demostrado; lo que falta es el tramo de lote y streaming.

Conviene no dar por cerrados RF-912 ni RNF-905 hasta que esos tres se arreglen.

# P2 → P5: seis cosas de la base compartida

Fecha: 2026-10-26. Rama de origen: `tarea3/p2-consulta` (creada desde `origin/tarea3/p3-actualizacion`).

`tarea3/servicio-consulta/` ya está implementado y verde (T009-21 a T009-28, 61 tests). Al integrarlo aparecieron seis cosas en archivos tuyos. Ninguna la toqué: son de `tarea3/compartido/`, `tarea3/scripts/`, `tarea3/package.json` y `tarea3/package-lock.json`.

Están ordenadas por lo que bloquea.

## 1. `bd:sembrar` depende de un paquete no declarado

`tarea3/scripts/bd-sembrar.mjs` hace `import { v4 as uuidv4 } from 'uuid'`, pero `uuid` no está en `tarea3/package.json` ni en `tarea3/node_modules`.

Hoy el script *parece* funcionar porque Node sube un nivel y encuentra `uuid` en el `node_modules` de la raíz, donde llegó como dependencia transitiva de `expo-splash-screen` → `@expo/config-plugins` → `xcode`:

```
$ node -e "console.log(require.resolve('uuid', {paths:['./tarea3']}))"
/home/.../proyecto-taller-aplicaciones-sociales/node_modules/uuid/dist/cjs/index.js

$ npm ls uuid
├─┬ expo-splash-screen@57.0.9
│ └─┬ @expo/config-plugins@57.0.9
│   └─┬ xcode@3.0.1
│     └── uuid@7.0.3
└── uuid@11.1.1
```

Con las dependencias de la raíz sin instalar, falla:

```
$ npm --prefix tarea3 run bd:sembrar
Cannot find module 'uuid' ... code: 'ERR_MODULE_NOT_FOUND'
```

Esto incumple RNF-902 («solo `tarea3/package.json` declara las dependencias nuevas») y se rompe en cuanto cambien las dependencias de Expo. Node 22 y 26 ya traen `crypto.randomUUID()`, así que lo más simple es `import { randomUUID } from 'node:crypto'` y no añadir dependencia ninguna. Es lo que usé en `servicio-consulta/pruebas/siembra-prueba.ts`, que replica tu conjunto de datos precisamente para no importar un script roto.

## 2. `npm --prefix tarea3 test` no ejecuta los tests de P2 ni los de P3

El script es `tsx --test --test-concurrency=1 pruebas-e2e/*.test.ts`. Los siete archivos de P3 en `servicio-actualizacion/pruebas/` y los ocho míos en `servicio-consulta/pruebas/` quedan fuera: **hoy nadie los corre con el comando oficial**.

Pedido: ampliar el glob, por ejemplo

```json
"test": "tsx --test --test-concurrency=1 pruebas-e2e/*.test.ts servicio-*/pruebas/*.test.ts"
```

Mientras tanto los míos se corren con:

```bash
npx tsx --test --test-concurrency=1 'tarea3/servicio-consulta/pruebas/*.test.ts'
```

## 3. `verificar-cobertura-rf.mjs` solo mira `pruebas-e2e/`

`DIRECTORIO_PRUEBAS` apunta únicamente a `pruebas-e2e`, así que RF-902 y RF-904 salen como no cubiertos aunque estén cubiertos: los cito en los nombres de 30 tests de `servicio-consulta/pruebas/`. Con el mismo cambio del punto 2 (escanear también `servicio-*/pruebas/`) el informe de RNF-905 queda correcto.

## 4. `compartido/bd.ts` no pasa contraseña

El pool no incluye `password`, así que `pg` depende de `PGPASSWORD`. Sin esa variable, contra el contenedor de `api/docker-compose.yml`:

```
$ npm --prefix tarea3 run bd:subir
[bd:subir] error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

P3 lo resolvió fijando `process.env.PGPASSWORD = 'postgres'` dentro de su servidor y yo hice lo mismo en `servicio-consulta/index.ts`, pero son dos parches para un problema que es de `compartido/bd.ts`. Pedido: que el pool lea `password: process.env.PGPASSWORD ?? 'postgres'` en un sitio, y que `docs/tarea-3/ejecutar.md` diga que hay que exportarla.

## 5. La demo dice que ejecutó el recorrido y no lo ejecuta

`scripts/demo.mjs` termina así:

```js
const serviciosListos = saludConsulta;
if (serviciosListos) {
  paso('recorrido ejecutado contra servicios reales');
}
```

Solo imprime la línea si `/salud` respondió; no hay consulta, ni mutación, ni lote, ni streaming. Hoy `npm --prefix tarea3 run demo` sale con código 0 y el mensaje `recorrido ejecutado contra servicios reales` sin haber tocado GraphQL. RF-912 pide que el comando «ejecute un recorrido que imprime cada paso (consulta → mutación → consulta → streaming)».

Ya está comprobado que el recorrido real funciona con los servicios de verdad (ver §8), así que es cuestión de llamarlo desde `demo.mjs`. También conviene que la demo falle con código distinto de 0 si el recorrido falla: hoy el `.catch` termina en `process.exit(0)`.

## 6. `package-lock.json` se desincroniza al instalar

`tarea3/package.json` fija `"@types/pg": "8.15.6"` y el lock tiene `"^8.15.6"`, así que cada `npm --prefix tarea3 install` deja el lock modificado. Lo revertí en cada commit para no tocar tu archivo. Pedido: `npm install` una vez y commitear el lock ya normalizado.

## 7. `recorrido.test.ts` tiene mal la ruta del proto, y hasta ahora no se notaba

Con P2 en marcha tu recorrido e2e ya no se salta, y al ejecutarse aparece un error de ruta:

```
$ npm --prefix tarea3 test
✖ RF-902/903/904/905/912: recorrido e2e GraphQL → gRPC → GraphQL → lote → streaming
  Error: ENOENT: no such file or directory, open
  '/home/.../proyecto-taller-aplicaciones-sociales/contratos/sigecat.proto'
      at TestContext.<anonymous> (tarea3/pruebas-e2e/recorrido.test.ts:75:34)
```

La línea 75 es:

```js
protoLoader.loadSync(join(import.meta.dirname, '..', '..', 'contratos', 'sigecat.proto'), {
```

`import.meta.dirname` es `tarea3/pruebas-e2e`, así que `'..', '..'` sube a la raíz del repositorio y busca `/contratos/sigecat.proto`, que no existe. Debería ser un solo nivel:

```js
protoLoader.loadSync(join(import.meta.dirname, '..', 'contratos', 'sigecat.proto'), {
```

**Lo importante: los pasos 1, 2 y 3 sí pasaron.** El fallo es posterior, en el paso 4 (el lote por gRPC), que no depende de P2. Es decir, con los dos servicios arriba:

- paso 1, consulta GraphQL `catequizandos` → 200 con `total >= 1`
- paso 2, mutación `registrarAsistencia` delegada por gRPC → `repetido: false`
- paso 3, el mismo `id` otra vez (RF-905) → `repetido: true`

Esos tres asserts se ejecutaron y pasaron antes del ENOENT. El recorrido GraphQL → gRPC → GraphQL está probado; lo que queda roto es la carga del proto para el tramo de lote y streaming, y es un cambio de una línea en tu archivo.

Para reproducirlo:

```bash
export PGPASSWORD=postgres
npx tsx tarea3/servicio-actualizacion/index.mjs &   # P3, puerto 50051
npx tsx tarea3/servicio-consulta/index.mjs &        # P2, puerto 4000
npm --prefix tarea3 test
```

## 8. Lo que sí quedó verificado por mi parte

Con PostgreSQL 16.15 en `127.0.0.1:55432` (`api/docker-compose.yml`), el servicio de P3 en 50051 y el mío en 4000, ambos arrancados con `tsx`:

| Paso | Resultado |
| --- | --- |
| `riesgoDelGrupo(nivelMinimo: BAJO)` | ALTO, MEDIO, BAJO, BAJO de la siembra |
| `registrarAsistencia` (GraphQL → gRPC → PostgreSQL) | `repetido: false` |
| el mismo `id` otra vez (RF-905) | `repetido: true` |
| `recalcularRiesgo` | `ALTO`, «3 faltas consecutivas sin justificar» |
| `catequizando` con riesgo y asistencias | `registradoPor` = identidad operativa |
| SUP y FAM escribiendo (RF-906) | `fuera_de_alcance`, denegado por P3 |
| CAT escribiendo en grupo ajeno (RF-906) | `fuera_de_alcance` |
| CAT leyendo grupo ajeno (RF-906) | `fuera_de_alcance` |
| FAM leyendo a otro niño (RF-906) | `fuera_de_alcance` |
| sin token (RF-906) | `fuera_de_alcance` |
| consulta de 7 niveles (RNF-903) | `profundidad_excedida` |

El recorrido GraphQL → gRPC → GraphQL que `pruebas-e2e/recorrido.test.ts` deja en `t.skip` ya se puede ejecutar: el servicio escucha en 4000, responde `/salud` con `{"estado":"ok","servicio":"servicio-consulta"}` y `scripts/demo.mjs` lo encuentra en `servicio-consulta/index.mjs`, como esperaba.

## 9. Contrato que respeté sin tocarlo

Para que no haya sorpresas al integrar: la consulta `catequizandos(grupoId:) { nodos { id identidadOperativa } total }` y la mutación `registrarAsistencia` con repetición de `id` que usa tu `recorrido.test.ts` están cubiertas tal cual en `servicio-consulta/pruebas/t009-28-integracion.test.ts`, igual que las seis operaciones exactas de `servidor-mcp/cliente-graphql.ts` de P4.

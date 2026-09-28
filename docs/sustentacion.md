# Sustentación — SOLID y DDD en los microservicios de SIGECAT

> **Estado:** cada afirmación apunta a un archivo real. Las 26 rutas citadas se comprobaron leyendo el código de los paquetes 1 y 2 en sus ramas (`paquete-1`, commit 61e43a8, y `paquete-2`, sin commit al escribir esto); las líneas citadas son las de esas versiones y **hay que revisarlas si el código cambia**. `docs/verificar-referencias.mjs` comprueba que las rutas existan (no las líneas); solo dará 0 cuando el código de ambos servicios esté integrado en el mismo repo.

✅ = el archivo existe y se leyó.

Rutas de `SIGECAT:` son del repo principal (`anycodef/proyecto-taller-aplicaciones-sociales`); el resto, de este repo.

---

## 1. Idea central

SIGECAT se diseñó como **monolito modular con contextos acotados**. Esta demo extrae dos de esos módulos, **Catequizandos** y **Asistencia**, como microservicios, y con eso comprueba que la modularidad era correcta: se separaron sin rediseñar el dominio, y entre ellos solo queda un identificador. Diagrama en [`arquitectura.md`](arquitectura.md#2-cómo-encaja-con-sigecat-de-monolito-modular-a-dos-servicios).

Evidencia del diseño modular previo: el C3 del backend agrupa `cmpCatequizandosBack` y `cmpAsistenciaSvc` como componentes distintos dentro de un único contenedor `apiBackend` (✅ `SIGECAT:docs/diagrams/arquitectura-c4.dsl`, líneas 42–70).

Regla de dependencias del código: `interfaces → application → domain`. El dominio no importa Express ni infraestructura.

---

## 2. SOLID

### S — Responsabilidad única: un caso de uso por clase

| Servicio | Caso de uso | Archivo |
|---|---|---|
| Catequizandos | `InscribirCatequizando` | ✅ `services/catequizandos/src/application/inscribir-catequizando.ts` |
| Catequizandos | `ListarCatequizandos`, `ObtenerCatequizando`, `ListarGrupos` | ✅ `services/catequizandos/src/application/` (`listar-catequizandos.ts`, `obtener-catequizando.ts`, `listar-grupos.ts`) |
| Asistencia | `PasarLista` | ✅ `services/asistencia/src/application/PasarLista.ts` |
| Asistencia | `CalcularRiesgo` | ✅ `services/asistencia/src/application/CalcularRiesgo.ts` |
| Asistencia | `ObtenerHistorial` | ✅ `services/asistencia/src/application/ObtenerHistorial.ts` |

**Qué mostrar:** cada clase tiene un solo método público (`ejecutar`) y una sola razón para cambiar. Los controladores no contienen reglas: llaman al caso de uso.

**Dónde vive cada regla (verificado):** `CalcularRiesgo` **solo orquesta**: lee el historial, llama al dominio y fija la hora (`CalcularRiesgo.ts` líneas 16–20). La regla de qué cuenta como falta está en `services/asistencia/src/domain/EstadoAsistencia.ts` (`cuentaComoFalta`, línea 14: solo `ausente`) y el cálculo del nivel en `services/asistencia/src/domain/SenalRiesgo.ts` (`calcularSenalRiesgo`, línea 33, función pura; umbrales en las líneas 14 y 16). Así el SPEC ("el cálculo vive en el dominio") y la lista de casos de uso son coherentes. El reloj se inyecta (`services/asistencia/src/application/Reloj.ts`), por lo que el cálculo se prueba sin depender de la fecha real.

*Catequizandos:* `InscribirCatequizando` solo orquesta: resuelve si el grupo existe, genera el id y guarda (`inscribir-catequizando.ts` líneas 22–33); los invariantes viven en el agregado (ver 3.2). El reloj también es un puerto inyectable (✅ `services/catequizandos/src/domain/reloj.ts`).

### O — Abierto/cerrado: agregar SQLite sin tocar dominio ni casos de uso

- Se agregaría una clase que implemente la interfaz del repositorio y se cambiarían las dos líneas donde `main.ts` crea los repositorios. El propio `main.ts` lo dice: "Para pasar a SQLite basta con cambiar las dos líneas de repositorios" (✅ `services/asistencia/src/main.ts`, línea 4; los repositorios se crean en las líneas 19–20).
- Implementación actual: ✅ `services/asistencia/src/infrastructure/RegistroRepositorioEnMemoria.ts` y `SesionRepositorioEnMemoria.ts`.

**Alcance honesto:** **SQLite no se implementó** (era deseable, no obligatorio). Por eso O se sostiene como *"diseñado para"*, no como *"demostrado"*: hay una interfaz, una sola implementación, y `main.ts` es el único sitio que la elige. Decir "se puede agregar sin tocar dominio ni casos de uso", no "lo agregamos". SQLite queda como trabajo futuro.

### L — Sustitución de Liskov: repositorios intercambiables

- El contrato que toda implementación debe cumplir está escrito en las interfaces: "Upsert por `registro.id`: reenviar el mismo lote no duplica ni pierde nada" (✅ `services/asistencia/src/domain/RegistroRepositorio.ts`, línea 5) y "Upsert por `sesion.id`" (✅ `services/asistencia/src/domain/SesionRepositorio.ts`, línea 5). Los casos de uso solo dependen de ese contrato.

**Alcance honesto:** hay **una sola implementación** (memoria), así que la intercambiabilidad es teórica: no hay una segunda implementación ni pruebas que corran los mismos casos de uso contra otro repositorio. Decir que el contrato está definido en la interfaz y que cualquier implementación que lo cumpla sustituye a la actual; no decir que memoria y SQLite ya son intercambiables.

### I — Segregación de interfaces: una por agregado

- Asistencia: dos interfaces, una por agregado, con dos métodos cada una: ✅ `services/asistencia/src/domain/SesionRepositorio.ts` (`guardar`, `buscarPorIds`) y ✅ `services/asistencia/src/domain/RegistroRepositorio.ts` (`guardarVarios`, `listarPorCatequizando`).
- Catequizandos: dos interfaces, una por agregado: ✅ `services/catequizandos/src/domain/catequizando-repository.ts` (`siguienteId`, `guardar`, `obtener`, `listar`) y ✅ `services/catequizandos/src/domain/grupo-repository.ts` (`listar`, `existe`). Implementaciones en memoria en `services/catequizandos/src/infrastructure/` (`catequizando-repository-en-memoria.ts`, `grupo-repository-en-memoria.ts`).

### D — Inversión de dependencias: `main.ts` inyecta

- Los casos de uso reciben la interfaz por constructor (`PasarLista`, `CalcularRiesgo`: ✅ líneas 10–14 y 11–14 respectivamente); solo `main.ts` conoce la implementación concreta (composition root): ✅ `services/asistencia/src/main.ts`, líneas 19–20 crean los repositorios en memoria y 25–27 los inyectan.
- Catequizandos: ✅ `services/catequizandos/src/main.ts`; el comentario de la línea 11 lo declara ("único lugar donde se elige la implementación concreta de cada puerto") y las líneas 12–14 crean las implementaciones, inyectadas en las líneas 18–21. `InscribirCatequizando` recibe `CatequizandoRepository`, `GrupoRepository` y `Reloj` por constructor (`inscribir-catequizando.ts` líneas 16–20).
- Verificado también en Catequizandos: ni `domain/` ni `application/` importan `express` ni `infrastructure/`.

**Verificado:** ningún archivo de `services/asistencia/src/domain/` ni de `application/` importa `express` ni `infrastructure/`.

**Qué mostrar en vivo:** abrir `CalcularRiesgo.ts` y señalar que solo importa del dominio; luego `main.ts`, donde sí aparece `new RegistroRepositorioEnMemoria()`.

---

## 3. DDD

### 3.1 Dos contextos acotados con el lenguaje ubicuo de SIGECAT

Los nombres y formas de datos no se inventaron para la demo: salen de `SIGECAT:src/lib/domain/modelo.ts` ✅, que a su vez sale del trabajo de campo con la parroquia. Correspondencias comprobadas:

| Tipo en `modelo.ts` | Contexto | Nota |
|---|---|---|
| `Grupo`, `Catequizando`, `Consentimiento` | Catequizandos | Mismas formas (`modelo.ts` líneas 48–63 y 80–87) |
| `SesionCatequesis`, `EstadoAsistencia`, `RegistroAsistencia`, `SenalRiesgo` | Asistencia | Mismos estados y niveles (`modelo.ts` líneas 89–112 y 143–148) |

Diferencias con `modelo.ts`, todas declaradas:
- **`SesionCatequesis.tipo` (`"misa" | "catequesis"`)** es una **[PROPUESTA]**: no existe en `modelo.ts` ✅ (`SesionCatequesis`, líneas 89–94, no lo tiene). Se agrega porque la cartilla física de la parroquia distingue misa de catequesis y el conflicto central del trabajo de campo es la asistencia a misa. Se propone llevarlo a `modelo.ts`.
- `DatosRestringidos` (salud, neurodivergencia) **queda fuera** de la demo por minimización (ADR 005).
- El SPEC omite `RegistroAsistencia.sincronizadoEn`, que es opcional en `modelo.ts` (línea 111). Es una marca del dispositivo, sin sentido en el servidor.

### 3.2 El consentimiento informado es un invariante del agregado

El dominio hace imposible inscribir a un menor sin consentimiento completo. Invariantes de `Catequizando`, validados en el agregado y **nunca en el controlador**:

1. `otorgadoPor`, `otorgadoEn` y `version` no vacíos, y `retencionHasta` posterior a `otorgadoEn`.
2. Edad entre 8 y 13 años a la fecha actual.
3. `nombres` y `apellidos` no vacíos; `grupoId` existente.

- ✅ Agregado: `services/catequizandos/src/domain/catequizando.ts`. El constructor es **privado** (línea 39): la única forma de obtener un `Catequizando` es `Catequizando.inscribir` (línea 41), que hace cumplir los tres invariantes antes de construir nada.
- ✅ Invariante 1: `services/catequizandos/src/domain/consentimiento.ts`, función `validarConsentimiento` (línea 22), que `inscribir` llama en su primera línea (línea 42).
- ✅ Invariante 2: constantes `EDAD_MINIMA = 8` y `EDAD_MAXIMA = 13` (`catequizando.ts` líneas 5–6), comprobadas en las líneas 53–56; el cálculo de edad está en `services/catequizandos/src/domain/fechas.ts`.
- ✅ Pruebas de los tres invariantes: `services/catequizandos/src/domain/catequizando.test.ts` (por ejemplo "rechaza la inscripción sin consentimiento", "rechaza a quien aún no cumplió 8 años", "rechaza un grupo que no existe"). 27 pruebas en el servicio, todas pasan (las corrí).

**Por qué no es "validación de formulario":** un formulario se puede saltar llamando a la API directamente; el invariante en el agregado no, porque con el constructor privado no hay otra forma de crear un `Catequizando` que pasar por `inscribir`. Ni siquiera la semilla se lo salta: `services/catequizandos/src/infrastructure/semilla.ts` crea los 12 catequizandos de ejemplo con `Catequizando.inscribir` (línea 39), es decir, hasta los datos de prueba tienen consentimiento válido. Es la traducción a código del principio de minimización y consentimiento de SIGECAT (`SIGECAT:src/lib/domain/modelo.ts`, comentario inicial, líneas 3–9 ✅).

**Matiz del invariante 3 (decirlo antes de que pregunten):** "`grupoId` debe existir" no lo puede consultar el agregado, porque no conoce los repositorios. Lo resuelve el caso de uso: `InscribirCatequizando` pregunta `grupos.existe(...)` (`services/catequizandos/src/application/inscribir-catequizando.ts`, línea 23) y le pasa el resultado al agregado como `grupoExiste` (línea 28), y el agregado **sigue haciendo cumplir la regla** (`catequizando.ts` líneas 46–48). Es una división correcta (el dominio no depende de infraestructura), pero significa que el agregado confía en ese booleano: un llamador que pase `grupoExiste: true` sin comprobarlo lo saltaría. Hoy hay dos llamadores: el caso de uso (que consulta de verdad) y la semilla, que fija `grupoExiste: true` (`semilla.ts` línea 49) porque siembra los propios grupos del servicio. Grupos y catequizandos viven en el mismo servicio, así que no se llama a otro servicio.

### 3.3 Referencia entre contextos solo por identidad

- Asistencia guarda `catequizandoId` y `grupoId`; **no llama a Catequizandos** ni importa sus tipos.
- La web compone ambos servicios.
- Se **acepta consistencia eventual y se declara**: Asistencia puede recibir registros de un `catequizandoId` que en Catequizandos no exista (o que ya se haya anonimizado).

**Cómo defenderlo si preguntan por qué no validar:** validar exigiría que Asistencia llame a Catequizandos en cada pase de lista. Eso introduce acoplamiento en tiempo de ejecución (si Catequizandos cae, no se puede pasar lista) y contradice el principio offline-first del proyecto (`SIGECAT:docs/adr/20260914-estrategia-de-sincronizacion-offline-first.md`, ADR 002 ✅): la lista debe poder registrarse aunque no haya red hacia otros servicios. El costo es aceptado: un registro huérfano es corregible después; una lista perdida no.

### 3.4 Idempotencia por id de cliente

- Sesiones y registros llevan un id generado en el cliente; reenviar el mismo lote **no duplica** (upsert por id).
- El agregado `PaseDeLista` (✅ `services/asistencia/src/domain/PaseDeLista.ts`) conserva los ids del cliente y valida el lote: un mismo id repetido es un solo registro (gana el último, línea 31) y un catequizando no puede aparecer dos veces en una sesión (línea 32, evita contar la falta doble). Acepta el instante real de la toma (`registradoEn`, líneas 11 y 61), que es lo que conoce la cola offline.
- El upsert lo garantizan los repositorios, con `Map.set` por id: ✅ `services/asistencia/src/infrastructure/RegistroRepositorioEnMemoria.ts`, línea 8, y ✅ `SesionRepositorioEnMemoria.ts`.
- Si llegaran dos registros del mismo catequizando para la misma sesión con ids distintos (una corrección), el riesgo toma solo el más reciente (✅ `SenalRiesgo.ts`, `registrosVigentesPorSesion`, línea 67).
- Pruebas: ✅ `services/asistencia/test/paseDeLista.test.ts` ("reenviar el mismo lote no duplica nada", "reenviar con el mismo id y otro estado actualiza, no agrega").

**Por qué existe:** está diseñada para recibir la cola offline que ya existe en el proyecto principal. `SIGECAT:src/lib/offline/cola-sincronizacion.ts` ✅ declara que el `id` del item "permite escritura idempotente en el servidor" (línea 15–16) y `encolar` toma ese id del propio registro (`id: registro.id`, línea 43). Los reintentos con espera creciente (`esperaReintento`, líneas 30–35) implican que el mismo registro **llegará más de una vez**; sin idempotencia habría duplicados.

**Límite honesto:** la cola actual envía **un registro por vez** (`enviar: (registro: RegistroAsistencia) => Promise<void>`, línea 58 ✅), mientras que el endpoint `POST /pases-de-lista` recibe **una sesión con todos sus registros**. La demo no usa la cola (la web llama directo). Integrarla exigiría un adaptador que agrupe por sesión, o cambiar la cola a lotes. Es trabajo futuro, no algo que ya funcione.

---

## 4. Simplificaciones declaradas

| Simplificación | Por qué es aceptable en la demo | Qué haría producción |
|---|---|---|
| Almacén en memoria con semilla | Demuestra la inversión de dependencias sin operar una base de datos | Repositorio persistente detrás de la misma interfaz |
| Clave del gateway (`demo-key`) en el frontend (`config.js`) | Solo demo | Autenticación de usuario; la clave viviría en un backend |
| Gateway local en contenedor en lugar de un APIM en la nube | No hubo acceso a Azure ni AWS; demuestra las mismas características | Plataforma administrada (p. ej. Azure APIM); `infra/apim/policy.xml` muestra la traducción, sin probar |
| Asistencia no valida que el catequizando exista | Consistencia eventual, declarada arriba | Conciliación periódica o eventos entre contextos |
| Sin `DatosRestringidos` | Minimización (ADR 005) | Entidad propia, fuera de cualquier listado y del caché offline |

---

## 5. Preguntas probables y respuestas cortas

**¿Por qué microservicios si SIGECAT es un monolito modular?**
No estamos afirmando que deba ser microservicios. La demo prueba que *podría*: los dos módulos se extraen sin rediseñar el dominio, lo que es la señal de que los límites estaban bien puestos. Un monolito mal modularizado no se deja extraer así.

**¿Entonces por qué no se despliega SIGECAT como microservicios?**
Porque el proyecto necesita costo cercano a cero y cero administración (ADR 004). Extraer servicios cuesta latencia, fallos parciales y operación. La modularidad nos deja esa opción abierta sin pagar el costo hoy.

**¿Qué cuesta la extracción que la demo no muestra?**
Los consumidores internos (`cmpSyncSvc`, `cmpSacramental`) llaman hoy a `cmpAsistenciaSvc`; quedarían como llamadas remotas. Y pasamos de una PostgreSQL compartida a un almacén por servicio.

**¿Por qué Asistencia no consulta a Catequizandos?**
Ver 3.3: evita acoplamiento en tiempo de ejecución y protege el offline-first. Consistencia eventual declarada.

**¿Dónde se ve que aplicaron DDD y no solo carpetas?**
En que el consentimiento es un invariante del agregado (3.2), en que el lenguaje viene de `modelo.ts` (3.1) y en que los contextos se referencian por identidad (3.3).

**¿Está bien la clave en el frontend?**
Solo en la demo. Cualquiera que abra el navegador la ve. En producción iría detrás de autenticación de usuario.

**¿Por qué el rate limit es 30 por minuto?**
Modela el pico concentrado del domingo por la mañana (ADR 004). El valor es de la demo, para poder provocar un 429 con una ráfaga de 40.

**¿Dónde está el API Management en la nube que pide la tarea?**
No lo hay: no tuvimos acceso a Azure ni a AWS y aplicamos el plan B del SPEC, un gateway local en contenedor (`infra/gateway/gateway.js`). Implementa las características pedidas (enrutamiento, clave con 401, rate limit con 429, CORS) y tiene pruebas, pero no es una plataforma administrada. Lo decimos de frente; `infra/apim/policy.xml` muestra cómo se traduciría a Azure, sin probar.

**¿En qué se diferencia de un APIM real?**
El contador de rate limit vive en memoria de un solo proceso, hay una sola clave fija y no hay portal ni análisis. Un APIM comparte el contador entre instancias y gestiona suscripciones por producto y usuario.

---

## 6. Pendientes antes de entregar

- [x] Asistencia (paquete 2): rutas verificadas leyendo el código en `../sigecat-paquete-2` (sin commit); 40 pruebas pasan. La regla de riesgo vive en el dominio (S); SQLite no existe, O y L suavizados.
- [x] Catequizandos (paquete 1): rutas verificadas leyendo el código en `../sigecat-paquete-1` (rama `paquete-1`, commit 61e43a8); 27 pruebas pasan. Nombres en kebab-case (`catequizando.ts`), no los que el SPEC sugería.
- [ ] Tras integrar los paquetes en una sola rama, correr `node docs/verificar-referencias.mjs` hasta que dé 0 (hoy las rutas de Asistencia existen solo en el worktree del paquete 2).
- [ ] Añadir la ruta de las pruebas de riesgo de Asistencia a la sección DDD/SOLID si se quiere citar en vivo: `services/asistencia/test/senalRiesgo.test.ts`, `semilla.test.ts`.
- [ ] Confirmar con el docente si un gateway local cumple "plataforma de API Management en la nube" (es la mayor brecha con la tarea).
- [ ] Verificar la referencia a las láminas 18 y 19 del curso (el SPEC las cita; no están en el repo).

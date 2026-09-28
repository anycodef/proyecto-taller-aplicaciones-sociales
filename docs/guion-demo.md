# Guion de demo — 5 minutos

> **Borrador.** Está escrito contra el SPEC y el gateway local del paquete 3, no contra la web ni los servicios terminados. **No hay nube ni APIM**: todo corre en local con Docker (gateway en `:8080`, clave `demo-key`). Los textos de botones y los resultados marcados con ⏳ se confirman en el ensayo con los paquetes 1, 2 y 4.

## Antes de empezar (T − 10 min)

- [ ] **T − 10 min:** levantar todo: `docker compose -f docker-compose.yml -f infra/docker-compose.gateway.yml up --build`, y esperar a que ambos servicios estén `healthy`.
- [ ] Comprobar `/health` de ambos servicios (directo en `:3001` y `:3002`) y una llamada con clave por el gateway (`:8080/cat/grupos`).
- [ ] Servir la web desde la raíz del repo: `python -m http.server 5500 --directory web` (o `npx serve web -l 5500`) y abrir `http://localhost:5500`.
- [ ] Reiniciar los contenedores si se ensayó antes: los datos guardados viven en memoria y cambian los riesgos de la semilla.
- [ ] Tener abierto: la web (`http://localhost:5500`, con `config.js` apuntando a `:8080` y `demo-key`), `infra/gateway/gateway.js` y `docs/arquitectura.md`.
- [ ] Registros de 200, 401 y 429 de `docs/evidencias/` (son texto, no capturas de pantalla), abiertos en otra pestaña por si algo falla en vivo. Si se quieren capturas, hacerlas en el ensayo.
- [ ] Abiertos en el editor: el agregado `Catequizando`, un caso de uso y `main.ts` de Asistencia.
- [ ] Anotar el minuto en que se hace la ráfaga: **el rate limit es 30/min**; una vez agotado hay que esperar 60 s.

## Línea de tiempo

| Tiempo | Qué se muestra | Qué se dice |
|---|---|---|
| **0:00 – 0:40** | Diagrama de `arquitectura.md` §1 | El problema: la coordinadora quiere quitarse de encima la asistencia. SIGECAT es un **monolito modular**. Hoy extraemos **dos** de sus módulos como microservicios para probar que la modularidad era correcta. |
| **0:40 – 1:20** | Diagrama §2 (monolito → dos servicios) | En el C3, Catequizandos y Asistencia ya eran componentes separados. Aquí se extraen sin rediseñar el dominio y entre ellos solo queda un id. |
| **1:20 – 2:30** | Web: grupo `8 años (mixto)` → lista con todos en `presente` → tocar a **`cat-001`** (un toque a tardanza, otro a `ausente`) → **Guardar pase de lista** | Dos APIs, una sola URL base. Todos parten en "presente" (ADR 006): la catequista solo marca excepciones. La web compone ambos servicios; los servicios no se hablan. **No marcar a `cat-003`**: pasaría de 2 a 3 ausencias y dejaría de ser el ejemplo de riesgo medio. |
| **2:30 – 3:10** | "Ver riesgo" de `cat-003` (**medio**, ámbar, grupo 8 años) y, cambiando a `10 años (mixto)`, de `cat-007` (**alto**, rojo) | Solo `ausente` cuenta como falta. A las 2 se conversa con el apoderado; a las 3 es umbral de retiro. La web muestra "Riesgo alto/medio/bajo" con los motivos que devuelve Asistencia. |
| **3:10 – 3:30** | Volver a `8 años`, **Guardar** otra vez la misma lista y abrir "Ver riesgo" de `cat-001` | Idempotencia: la web reutiliza los ids para el mismo grupo, fecha y tipo, y el servidor hace upsert. Se ve porque el riesgo de `cat-001` sigue en **1 ausencia**, no en 2. Es lo que necesita la cola offline del proyecto. ⏳ confirmar en el ensayo. |
| **3:30 – 4:10** | Panel "Probar gateway": **Llamar sin clave** → **401**. Editor: `infra/gateway/gateway.js` (enrutamiento, clave, CORS) | Autenticación por clave de suscripción (datos de menores, ADR 005), enrutamiento `/cat` y `/asis`, CORS. Decir de frente que es un **gateway local** (plan B), no un APIM en la nube; el mismo diseño se traduce a Azure (`infra/apim/policy.xml`, sin probar). |
| **4:10 – 4:30** | **Ráfaga de 40 llamadas** → conteo de **429** | Rate limiting de 30/min: el pico concentrado del domingo. **Este paso va al final** porque agota la cuota. |
| **4:30 – 5:00** | Editor: agregado `Catequizando` (invariante de consentimiento) y `main.ts` | Inscribir un menor sin consentimiento es imposible por construcción, no por validación de formulario. Los casos de uso dependen de la interfaz; `main.ts` inyecta la implementación. Cierre: la modularidad era correcta. |

## Reglas para no perder la demo

1. **La ráfaga va última.** Cada llamada a la API consume cuota: cargar la página (1), elegir grupo (1), guardar (1) y cada "Ver riesgo" (1, y los riesgos abiertos se refrescan tras guardar). El guion gasta unas 10 de las 30; la llamada sin clave da 401 y no consume cupo. Si la ráfaga se dispara antes, todo lo siguiente devuelve 429.
2. **Si aparece un 429 antes de tiempo**, no es un fallo: la web lo muestra en ámbar en la franja superior ("el gateway permite 30 llamadas por minuto"). Decirlo y esperar 60 s.
3. **Si el servicio tarda en responder**, es el arranque en frío. No reintentar en ráfaga; esperar.
4. **Si el gateway falla**, apuntar `config.js` directo a `localhost:3001` y `3002` (sin clave) para seguir mostrando el flujo, y mostrar los registros guardados de 200, 401 y 429 para la parte del gateway. Con los servicios en `production` hay que volver a levantarlos sin el fragmento del gateway para que pongan CORS.
5. **Reiniciar antes de cada ensayo completo**, porque guardar listas cambia los riesgos de la semilla.

## Resultados esperados de la semilla

Según el SPEC. Grupo de cada uno: `cat-002` y `cat-003` en `8 años`, `cat-005` en `9 años`, `cat-007` en `10 años` (junto a `cat-006`). El paquete 4 lo confirmó con los servicios reales: `cat-007` sale en rojo con "Riesgo alto", "3 ausencias sin justificar" y "Alcanza el umbral de retiro"; `cat-003` sale ámbar con "2 ausencias sin justificar" y "A las 2 faltas se conversa con el apoderado". `cat-005` y `cat-002` no los he visto en pantalla; comprobarlos en el ensayo (⏳).

| Niño | Riesgo | Por qué es buen ejemplo |
|---|---|---|
| `cat-007` | alto | 3 ausencias: umbral de retiro |
| `cat-003` | medio | 2 ausencias: se conversa con el apoderado |
| `cat-005` | bajo | 1 ausencia y 2 justificadas: las justificadas no suman |
| `cat-002` | bajo | 1 tardanza: la tardanza cuenta como asistencia |

## Ensayo cronometrado

- [ ] Primera pasada con la web contra local.
- [ ] Segunda pasada a través del gateway (`:8080`), cambiando solo `config.js`.
- [ ] Marcar los tiempos reales; si se pasa de 5:00, recortar la sección de idempotencia (3:10 – 3:30) antes que la ráfaga.
- [ ] Repartir quién habla en cada tramo y quién maneja el teclado.

## Si preguntan

Las respuestas preparadas están en [`sustentacion.md`](sustentacion.md#5-preguntas-probables-y-respuestas-cortas). La más probable: *"¿por qué microservicios si es un monolito modular?"* — porque la demo no afirma que deba serlo; prueba que **podría**, y esa es la señal de que los límites están bien.

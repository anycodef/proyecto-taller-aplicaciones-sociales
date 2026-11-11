## Context

SIGECAT ya tiene identidad, roles, API en Azure Functions, PostgreSQL y app Expo. La constitución prohíbe datos de menores en el dispositivo y en logs, exige costo cero y lógica de negocio pura en `src/lib/`. La spec 009 dejó un agente MCP de demostración, pero no un asistente de consulta para la operación diaria.

El asistente debe responder dudas de catequesis con material público. No es un oráculo doctrinal ni un consultor de datos: su valor está en encontrar el fragmento correcto y citarlo.

## Goals / Non-Goals

**Goals**

- Responder en español con fragmentos públicos y citas verificables.
- Abstenerse cuando el corpus no alcanza.
- Rechazar datos de menores, salud, documentos, familia y riesgo.
- Costo cero: recuperación local y proveedor gratuito o local.
- No persistir preguntas ni respuestas.
- Dejar el camino listo para cambiar de proveedor sin tocar la lógica.

**Non-Goals**

- Consultar tablas operativas o responder “quién está en riesgo”.
- Reemplazar a la coordinación, al párroco o al catequista.
- Entrenar un modelo con documentos de la parroquia.
- Responder sin conexión.
- Audio, imágenes o archivos adjuntos.

## Decisions

### D-1001: RAG con recuperación local BM25

La pregunta se usa para recuperar fragmentos del corpus y solo esos fragmentos se envían al generador. Se implementa BM25 en TypeScript puro para evitar dependencias nuevas y funcionar con el stack actual. Alternativas descartadas: embeddings (mejor semántica, pero exige modelo y dependencia), búsqueda SQL (duplica la lógica fuera de `src/lib/`), enviar todo el corpus al modelo (caro y con más alucinación).

### D-1002: Corpus público versionado en el repositorio

Cada fragmento lleva `id`, `documento`, `seccion`, `texto`, `fuente`, `licencia` y `version`. El corpus vive en `api/src/modulos/asistente/corpus/` y se revisa por PR. No se indexan datos de personas. Para el demo se usan fragmentos de dominio público o material autorizado por la parroquia; si un texto no tiene licencia clara, no entra.

### D-1003: Proveedor de generación detrás de un puerto

`ProveedorRespuesta` recibe `{ pregunta, fragmentos }` y devuelve `{ texto, proveedor, modelo }`. Adaptadores iniciales: Gemini free tier, Groq free tier y Ollama local. La selección viene de `ASISTENTE_PROVEEDOR` y la clave de `ASISTENTE_CLAVE` en la configuración de la Function App; nunca en la app ni en el repositorio. Si el proveedor falla o tarda más de 8 segundos, se devuelve una respuesta extractiva armada con los fragmentos y sus citas, sin inventar texto.

### D-1004: Citación y abstención obligatorias

El prompt exige responder solo con los fragmentos y citar `[documento, sección]`. Un validador posterior comprueba que cada cita exista en los fragmentos recuperados. Si no hay fragmentos sobre el umbral o la validación falla, la respuesta es de abstención. Esto prioriza exactitud sobre fluidez.

### D-1005: Guardia de temas sensibles antes y después del modelo

Antes de recuperar, un filtro por léxico y expresiones regulares detecta pedidos de datos de menores, salud, neurodivergencia, documentos, situación familiar, riesgo, diagnóstico o consejo legal. Esas consultas se rechazan con un texto fijo y una derivación a la coordinación o a un profesional. Después de generar, se revisa que no aparezcan datos personales ni afirmaciones de autoridad doctrinal. El filtro es deliberadamente conservador: prefiere rechazar de más a filtrar datos de menores.

### D-1006: Sin historial y sin logs de contenido

El endpoint no guarda pregunta ni respuesta. Solo registra métricas agregadas por cuenta y día: cantidad de consultas, rechazos, abstenciones y latencia. No se escribe el texto en logs de aplicación, APIM ni Application Insights.

### D-1007: Cuota por cuenta y caché en memoria

Se reutiliza `limitarPorCuenta` con la operación `asistente:preguntar`, por defecto 20 consultas por hora. Una caché LRU en memoria por instancia evita repetir la misma pregunta normalizada y reduce el consumo del proveedor gratuito; no es durable ni guarda datos personales. Si más adelante hace falta, se evalúa una tabla de caché con hash y TTL, sin texto libre.

### D-1008: Endpoint y permiso

`POST /asistente/preguntar` con `authLevel: "function"`, cuerpo `{ pregunta }` validado con Zod, respuesta `{ respuesta, fuentes[], proveedor, modelo, versionCorpus }`. Se añade `asistente:consultar` a `MATRIZ_PERMISOS` para los roles autenticados; el manejador no recibe recurso operativo y solo lee el corpus público. El límite por cuenta se aplica antes de llamar al proveedor.

### D-1009: Pantalla y cliente

`src/app/asistente.tsx` muestra un campo de pregunta, un botón, estado de carga, respuesta, fuentes y avisos de rechazo o error. Se añade `api.preguntarAsistente` al cliente HTTP y la entrada en `src/app/galeria.tsx`. La pantalla no guarda el historial al cerrar.

### D-1010: Pruebas

- Dominio: recuperación, umbral, citas, abstención, filtro de sensibles y normalización.
- Adaptador: timeout, error del proveedor y respuesta extractiva.
- HTTP: permiso, validación, cuota, 429 y ausencia de contenido en logs.
- Corpus: fuente y licencia presentes, sin datos personales.
- E2E: pregunta con respuesta citada, pregunta sin sustento y pregunta rechazada.

## Risks / Trade-offs

- **Alucinación doctrinal.** Se mitiga con RAG, citas verificadas, temperatura baja y abstención; no se elimina del todo.
- **Cupo gratuito.** Se mitiga con cuota por cuenta, caché y fallback extractivo; el proveedor puede cambiar sus límites.
- **Filtro conservador.** Puede rechazar preguntas legítimas que mencionan salud sin pedir datos; se prefiere el falso positivo.
- **Corpus pequeño.** Las primeras respuestas cubrirán pocas preguntas; el corpus crece por revisión, no por scraping.
- **Privacidad.** La pregunta puede contener datos personales escritos por el usuario; el filtro y la ausencia de logs reducen el riesgo, pero la pantalla debe advertir “no escribas datos de niños”.

## Migration Plan

1. Añadir el corpus y sus pruebas de licencia.
2. Implementar dominio y adaptadores con dobles del proveedor.
3. Registrar el endpoint y el permiso; actualizar OpenAPI e inventario.
4. Añadir la pantalla y el método del cliente.
5. Configurar el proveedor gratuito en desarrollo y verificar con una pregunta de prueba.
6. Si el proveedor no está disponible, el asistente queda en modo extractivo y la app sigue funcionando.

## Open Questions

- ¿Qué documentos de la parroquia tienen autorización escrita para publicarse en el corpus?
- ¿La familia accede al asistente desde la app o solo desde el enlace web? En este cambio se asume la app autenticada.
- ¿Se acepta Gemini free tier como proveedor principal o se prefiere Ollama local para no sacar preguntas del colegio?

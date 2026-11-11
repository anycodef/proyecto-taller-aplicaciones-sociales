## 1. Dominio y corpus

- [x] 1.1 Crear `src/lib/asistente/tipos.ts` con `Pregunta`, `Fragmento`, `Fuente`, `RespuestaAsistente` y `ResultadoRecuperacion` (RF-1001). Hecho cuando el typecheck acepta los tipos y no importan React ni Expo.
- [x] 1.2 Crear el cargador de corpus con validación de `id`, `documento`, `seccion`, `texto`, `fuente`, `licencia` y `version` (RF-1002, RNF-1005). Hecho cuando un corpus incompleto falla con un mensaje en español.
- [x] 1.3 Curar diez fragmentos públicos de oraciones, sacramentos y doctrina con fuente y licencia (RF-1002, RNF-1005). Hecho cuando cada fragmento tiene fuente verificable y no contiene nombres ni datos de personas.
- [x] 1.4 Implementar normalización y tokenización en español con lista de palabras vacías (RF-1002). Hecho cuando “¿Qué es la Eucaristía?” y “eucaristia” producen términos comparables.
- [x] 1.5 Implementar BM25, umbral y selección de hasta cinco fragmentos (RF-1002). Hecho cuando el test devuelve el fragmento correcto primero y descarta el que no alcanza el umbral.
- [x] 1.6 Escribir tests de recuperación, empate y corpus vacío (RF-1002). Hecho cuando `npm run test:app` pasa y cada test cita RF-1002.

## 2. Generación y guardias

- [x] 2.1 Crear el puerto `ProveedorRespuesta` y un doble de prueba (RNF-1001). Hecho cuando el dominio se prueba sin red ni claves.
- [ ] 2.2 Implementar el adaptador Gemini free tier con timeout de 8 segundos (RNF-1001, RNF-1002). Hecho cuando un timeout devuelve error controlado y no deja la petición colgada.
- [ ] 2.3 Implementar el adaptador Groq free tier y el adaptador Ollama local detrás del mismo puerto (RNF-1001). Hecho cuando cambiar `ASISTENTE_PROVEEDOR` no cambia el dominio.
- [x] 2.4 Construir el prompt en español con instrucciones de citar y no inventar (RF-1003, RF-1007). Hecho cuando el prompt incluye solo la pregunta y los fragmentos recuperados.
- [x] 2.5 Validar que cada cita de la respuesta exista en los fragmentos usados (RF-1003). Hecho cuando una cita inventada se rechaza y se devuelve abstención.
- [x] 2.6 Implementar la abstención cuando no hay fragmentos sobre el umbral (RF-1003). Hecho cuando el test recibe una respuesta de “no encontré sustento” sin texto doctrinal.
- [x] 2.7 Implementar el fallback extractivo cuando el proveedor falla o tarda (RNF-1002). Hecho cuando el test simula un error y recibe una respuesta armada con citas.

## 3. Privacidad y cuota

- [x] 3.1 Implementar el filtro previo de datos de menores, salud, neurodivergencia, documentos, familia y riesgo (RF-1004). Hecho cuando las expresiones de prueba se rechazan antes de llamar al proveedor.
- [x] 3.2 Implementar el rechazo de diagnóstico, consejo médico, legal o psicológico (RF-1004). Hecho cuando la respuesta deriva a un adulto responsable o a un profesional.
- [x] 3.3 Implementar el validador posterior de datos personales y autoridad doctrinal (RF-1004, RF-1007). Hecho cuando una respuesta que se presenta como autoridad se reemplaza por una abstención.
- [x] 3.4 Añadir la cuota por cuenta con `limitarPorCuenta` y el mensaje 429 (RF-1005). Hecho cuando la consulta 21 de la hora responde 429.
- [ ] 3.5 Añadir métricas agregadas sin texto de pregunta ni respuesta (RF-1006). Hecho cuando el test verifica que no se guarda contenido y sí se incrementa el contador.
- [ ] 3.6 Añadir la caché LRU de preguntas normalizadas (RNF-1001). Hecho cuando dos preguntas idénticas en la misma instancia llaman una sola vez al proveedor.

## 4. API y permisos

- [x] 4.1 Crear el esquema Zod de `{ pregunta }` de 3 a 500 caracteres (RF-1001). Hecho cuando una pregunta vacía o de 501 caracteres responde 422.
- [x] 4.2 Crear el caso de uso `preguntarAsistente` que orquesta filtro, recuperación, generación y validación (RF-1001, RF-1003). Hecho cuando el test unitario cubre respuesta, abstención y rechazo.
- [x] 4.3 Registrar `POST /asistente/preguntar` con `authLevel: "function"` (RF-1001, RNF-1003). Hecho cuando el binding aparece en el inventario.
- [x] 4.4 Añadir `asistente:consultar` a `MATRIZ_PERMISOS` para los roles autenticados (RF-1001). Hecho cuando cada rol permitido pasa y un rol desconocido no.
- [x] 4.5 Devolver `respuesta`, `fuentes`, `proveedor`, `modelo` y `versionCorpus` (RF-1003, RNF-1004). Hecho cuando el contrato no expone claves ni configuración interna.
- [x] 4.6 Verificar que el endpoint no escribe el texto en logs ni en la base (RF-1006). Hecho cuando la prueba revisa las llamadas de log y no encuentra la pregunta.

## 5. Cliente y documentación

- [ ] 5.1 Añadir `preguntarAsistente` al cliente HTTP (RF-1001). Hecho cuando el test del cliente cubre éxito, 429 y error de red.
- [ ] 5.2 Crear `src/app/asistente.tsx` con campo, botón, carga, respuesta y fuentes (RF-1001, RNF-1002). Hecho cuando la pantalla muestra los tres estados.
- [ ] 5.3 Añadir el aviso “No escribas datos de niños” y el estado sin conexión (RF-1004, RNF-1003). Hecho cuando la pantalla bloquea el envío sin conexión y muestra el aviso.
- [ ] 5.4 Añadir la pantalla a `src/app/galeria.tsx` (RF-1001). Hecho cuando la galería la muestra sin errores.
- [x] 5.5 Documentar el endpoint y los esquemas en `api/openapi.json` (RF-1001). Hecho cuando `node api/scripts/verificar-openapi.mjs` pasa.
- [x] 5.6 Actualizar el inventario de bindings y las pruebas de rutas (RF-1001). Hecho cuando el arranque registra el endpoint nuevo y el contrato coincide.
- [x] 5.7 Escribir el flujo E2E: respuesta citada, abstención y rechazo (RF-1002, RF-1003, RF-1004). Hecho cuando el flujo pasa con el corpus de prueba.
- [x] 5.8 Revisar el corpus y dejar fuente y licencia en `api/src/modulos/asistente/corpus/FUENTES.md` (RNF-1005). Hecho cuando cada fragmento tiene su fuente y licencia.

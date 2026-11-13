# Evaluación de técnicas inteligentes para SIGECAT

## Para qué sirve este documento

El taller pide evaluar seis técnicas inteligentes y dejar claro cuáles se usan de verdad en el software y cuáles solo se modelan. SIGECAT es una app para la catequesis parroquial de niños de 8 a 13 años; cualquier técnica que se elija debe respetar la constitución: costo cero, datos de menores fuera del dispositivo y de los logs, reglas explicables y operación offline para la asistencia.

No todas las técnicas propuestas se implementan. La idea es comparar valor, datos, costo, privacidad y esfuerzo, y quedarse con las que resuelven un problema real de la parroquia.

## Criterios

| Criterio | Pregunta |
| --- | --- |
| Valor | ¿Resuelve un dolor real de coordinación, catequistas o familias? |
| Datos | ¿Qué datos necesita y ya existen? |
| Costo | ¿Cabe en la capa gratuita o en un modelo local? |
| Privacidad | ¿Puede evitar datos de menores, salud o documentos? |
| Explicabilidad | ¿Una persona puede entender y corregir la salida? |
| Esfuerzo | ¿Se puede implementar y probar en el taller? |

## Las seis técnicas

| # | Técnica | Estado en SIGECAT | Dónde se ve |
| --- | --- | --- | --- |
| 1 | Sistema experto basado en reglas | Implementada | `src/lib/riesgo/`, spec 007 |
| 2 | RAG (recuperación aumentada) | Implementada con caché y métricas | `src/lib/asistente/`, spec 010 |
| 3 | LLM generativo | Implementado con Gemini/Groq y fallback extractivo | Asistente de catequesis |
| 4 | Agente inteligente con herramientas (MCP) | Funcionando en demo | `tarea3/servidor-mcp/`, spec 009 |
| 5 | PLN para intención y temas sensibles | Implementada como filtro léxico | `src/lib/asistente/guardia.ts`, spec 010 |
| 6 | Aprendizaje automático predictivo | Descartada para esta entrega | Spec 007 la excluye |

## 1. Sistema experto basado en reglas

**Qué es.** Un conjunto de reglas explícitas que ubica a cada niño en un paso según sus faltas no justificadas, su ficha de compromiso y su retiro. No hay puntaje estadístico: hay una tabla que la coordinación ya usa.

**Aplicación en la catequesis.** La parroquia ya tiene un proceso: dos faltas, hablar con el padre; tres faltas sin ficha, citar y firmar; cuatro faltas, decidir el retiro. El sistema replica ese proceso y muestra qué faltas originaron la alerta.

**Datos.** Asistencia dominical y de jornadas (spec 003), justificaciones aprobadas (spec 004), ficha firmada y retiro confirmado. Son datos que la parroquia ya registra.

**Ventajas.** Es explicable, barato, offline para la lectura y no necesita entrenamiento. Una corrección o una justificación aprobada baja el conteo y cierra la alerta.

**Límites.** La regla es tan buena como el registro de asistencia. No descubre causas que no estén en los datos y no debe retirar a nadie de forma automática.

**Decisión.** Implementada. Es la técnica principal del proyecto porque resuelve el problema central de la coordinación sin inventar un modelo.

## 2. RAG (recuperación aumentada por generación)

**Qué es.** Antes de responder, el sistema busca los fragmentos más relevantes de un corpus público y solo esos fragmentos se le pasan al generador. La respuesta queda atada al material de la parroquia.

**Aplicación en la catequesis.** Un catequista pregunta “¿qué se necesita para la primera comunión?” o “¿cómo se reza el Padre Nuestro?”. El asistente recupera el fragmento del Catecismo o del documento parroquial y responde con la cita.

**Datos.** Corpus público versionado: Catecismo, Sagrada Escritura, documentos de la parroquia y material de catequesis autorizado. Nada de fichas de niños, salud ni documentos.

**Ventajas.** Reduce respuestas inventadas, permite citar la fuente y actualizar el conocimiento sin reentrenar un modelo. La recuperación se puede probar sin llamar al proveedor.

**Límites.** Si el corpus no cubre la pregunta, el asistente debe abstenerse. Un corpus mal curado produce respuestas mal citadas.

**Decisión.** Implementada en la spec 010: BM25 en TypeScript puro, corpus público versionado, endpoint `POST /asistente/preguntar`, caché LRU por versión de corpus, métricas agregadas sin contenido y pantalla móvil con aviso de privacidad y bloqueo sin conexión. No añade dependencias ni datos de menores.

## 3. LLM generativo

**Qué es.** Un modelo de lenguaje que redacta la respuesta en español a partir de la pregunta y los fragmentos recuperados.

**Aplicación en la catequesis.** Convierte fragmentos dispersos en una explicación breve y ordenada para alguien que no quiere leer tres párrafos del Catecismo. También puede reformular la misma respuesta para una familia.

**Datos.** Solo la pregunta y los fragmentos públicos. El proveedor no recibe nombres, asistencia ni justificaciones.

**Ventajas.** Mejora la redacción y la cercanía sin cambiar las reglas del negocio. Se puede cambiar de proveedor sin tocar la app.

**Límites.** Puede alucinar, tiene cupos gratuitos y depende de conexión. Por eso la respuesta se valida contra las citas y se prefiere abstenerse antes que inventar.

**Decisión.** Implementados `ProveedorRespuesta`, `ProveedorLLM` para Gemini, Groq y Ollama, timeout de 8 s, validación de citas y fallback extractivo. La app se despliega con Gemini o Groq en el servidor y la clave nunca sale de la API. Si no hay clave o el proveedor falla, la respuesta sigue siendo extractiva y citada; no se inventa doctrina.

## 4. Agente inteligente con herramientas (MCP)

**Qué es.** Un agente que descubre herramientas acotadas y las llama para consultar o escribir datos. En la Tarea 3 se demostró con un servidor MCP que lee el riesgo de un grupo y registra asistencia.

**Aplicación en la catequesis.** La coordinación podría preguntar “¿qué niños del grupo A están en alerta de retiro?” y el agente consultaría la herramienta `listar_riesgo_grupo`. También podría registrar una asistencia con confirmación.

**Datos.** Datos operativos de menores. Por eso cada herramienta debe respetar rol, alcance y auditoría, y no devolver salud, neurodivergencia ni documentos.

**Ventajas.** Compone varias llamadas y ahorra pasos. Es útil para una demostración y para tareas internas controladas.

**Límites.** Un agente con acceso a datos de menores es un riesgo alto: puede encadenar consultas, equivocarse de grupo o filtrar información. No es un protocolo de producto ni reemplaza la API.

**Decisión.** Funcionando solo en la demo de la Tarea 3. No se lleva a producción en esta entrega; el asistente de consulta no tiene herramientas sobre la base operativa.

## 5. PLN para intención y temas sensibles

**Qué es.** Procesamiento de lenguaje natural para clasificar qué pide una pregunta y detectar temas que no se deben responder: datos de un niño, salud, documentos, situación familiar, riesgo, diagnóstico o consejo legal.

**Aplicación en la catequesis.** Antes de buscar en el corpus, el asistente decide si la pregunta es doctrinal, si pide datos personales o si necesita derivación humana. También puede normalizar “eucaristia” y “Eucaristía” para recuperar mejor.

**Datos.** Solo el texto de la pregunta. No necesita entrenamiento si se hace con léxico, expresiones regulares y reglas; una versión más fina podría usar un clasificador pequeño.

**Ventajas.** Es barato, rápido y explicable. Es la primera barrera para que el asistente no se convierta en una fuga de datos de menores.

**Límites.** Un filtro por léxico puede fallar con ironía, errores de escritura o preguntas indirectas. Se prefiere rechazar de más y dejar una vía clara a la coordinación.

**Decisión.** Implementada en la spec 010 como filtro léxico previo y validador posterior de datos personales y autoridad doctrinal. No se usa PLN estadístico ni se clasifica el riesgo: esa decisión sigue en reglas explicables.

## 6. Aprendizaje automático predictivo

**Qué es.** Entrenar un modelo con faltas, justificaciones y retiros históricos para estimar la probabilidad de que un niño abandone.

**Aplicación en la catequesis.** Podría priorizar a los niños con mayor probabilidad y anticipar la conversación con la familia.

**Datos.** Varios ciclos de asistencia, justificaciones, contactos y retiros. La parroquia tiene pocos ciclos digitalizados y muchos registros en papel.

**Ventajas.** Si hubiera datos suficientes y limpios, podría encontrar patrones que la regla fija no ve.

**Límites.** La spec 007 excluye los puntajes estadísticos: el proceso de la parroquia es explicable y no quiere etiquetar niños con un número. Con pocos datos, el modelo aprendería sesgos del grupo y sería difícil de auditar. Además, un falso positivo puede estigmatizar a una familia.

**Decisión.** Descartada para esta entrega y modelada solo como evaluación. Si en el futuro hay varios ciclos de datos y una decisión explícita de la parroquia, se puede estudiar; hoy no cumple privacidad, explicabilidad ni volumen de datos.

## Qué queda funcionando y qué queda modelado

- **Funcionando:** sistema experto de riesgo (spec 007), agente MCP de demostración (spec 009) y asistente con RAG, PLN, proveedor LLM cloud, caché, métricas y pantalla móvil (spec 010).
- **Pendiente de evaluación:** calidad de las respuestas generativas con el corpus actual y ampliación del corpus; no bloquea la demo porque el fallback extractivo está probado.
- **Descartada:** aprendizaje automático predictivo, por decisión de la spec 007 y por falta de datos y de explicabilidad.

La técnica que el profesor pide usar está cubierta: el proyecto usa reglas inteligentes para el riesgo y un asistente con RAG, PLN y LLM sobre corpus público. Sin clave externa el asistente sigue funcionando en modo extractivo; con clave, redacta y mantiene la cita obligatoria.

## ADDED Requirements

### Requirement: RF-1001 Preguntar en lenguaje natural

El sistema SHALL permitir a una persona autenticada escribir una pregunta en español sobre la catequesis y recibir una respuesta en la misma pantalla.

#### Scenario: Consulta de un catequista

- **WHEN** un catequista autenticado escribe una pregunta sobre una oración o un sacramento
- **THEN** el sistema muestra una respuesta en español en la misma pantalla

### Requirement: RF-1001 Pregunta válida

El sistema SHALL aceptar preguntas de 3 a 500 caracteres y SHALL rechazar las vacías o más largas con un mensaje en español.

#### Scenario: Pregunta demasiado larga

- **WHEN** la persona envía una pregunta de más de 500 caracteres
- **THEN** el sistema no consulta al proveedor y muestra un mensaje que pide acortarla

### Requirement: RF-1002 Consultar solo material público

El sistema SHALL responder únicamente con fragmentos del corpus público versionado: Catecismo, Sagrada Escritura, documentos de la parroquia y material de catequesis autorizado. El corpus SHALL NOT contener datos de menores ni datos personales.

#### Scenario: Pregunta sobre un niño

- **WHEN** la pregunta menciona datos de un niño, su salud o su familia
- **THEN** el sistema no usa el corpus para responder esos datos y aplica el rechazo de RF-1004

### Requirement: RF-1002 Recuperar fragmentos relevantes

Cuando llega una pregunta, el sistema SHALL recuperar hasta cinco fragmentos del corpus ordenados por relevancia y SHALL descartar los que no superen el umbral mínimo.

#### Scenario: Recuperación con fragmentos suficientes

- **WHEN** la pregunta coincide con al menos un fragmento por encima del umbral
- **THEN** el sistema recupera hasta cinco fragmentos ordenados por relevancia

### Requirement: RF-1003 Responder con fuentes

El sistema SHALL incluir en cada respuesta el documento y la sección de cada fragmento usado, y SHALL NOT inventar referencias que no estén en el corpus.

#### Scenario: Respuesta con cita

- **WHEN** el sistema genera una respuesta con fragmentos recuperados
- **THEN** la respuesta muestra el documento y la sección de cada fragmento usado

### Requirement: RF-1003 Abstenerse sin sustento

Si ningún fragmento supera el umbral, el sistema SHALL responder que no encontró sustento en el material público y SHALL NOT generar una respuesta doctrinal.

#### Scenario: Pregunta fuera del corpus

- **WHEN** la pregunta no tiene fragmentos por encima del umbral
- **THEN** el sistema indica que no encontró sustento en el material público y no inventa una respuesta

### Requirement: RF-1004 Rechazar datos de menores y temas sensibles

El sistema SHALL rechazar preguntas que pidan datos de un menor, salud, neurodivergencia, documentos de identidad, situación familiar o riesgo de deserción, y SHALL orientar a la coordinación.

#### Scenario: Pregunta por la salud de un niño

- **WHEN** la pregunta pide información sobre la salud o la situación familiar de un niño
- **THEN** el sistema rechaza la consulta y orienta a contactar a la coordinación

### Requirement: RF-1004 No dar consejo profesional

El sistema SHALL NOT emitir diagnósticos ni consejo médico, legal o psicológico; ante esos temas SHALL derivar a un adulto responsable o a un profesional.

#### Scenario: Pregunta médica

- **WHEN** la pregunta pide un diagnóstico o un consejo médico
- **THEN** el sistema no responde con consejo profesional y deriva a un adulto responsable o a un profesional

### Requirement: RF-1005 Límite por cuenta

El sistema SHALL limitar las consultas por cuenta a un máximo configurable por hora y SHALL responder con el código 429 y un mensaje en español al superarlo.

#### Scenario: Cuota agotada

- **WHEN** una cuenta supera el máximo de consultas permitido en la hora
- **THEN** el sistema responde 429 con un mensaje que invita a intentar más tarde

### Requirement: RF-1006 Sin historial de conversaciones

El sistema SHALL NOT guardar el texto de las preguntas ni de las respuestas; solo SHALL registrar métricas agregadas sin datos personales.

#### Scenario: Consulta terminada

- **WHEN** el sistema termina de responder una pregunta
- **THEN** no guarda el texto de la pregunta ni de la respuesta y solo actualiza métricas agregadas

### Requirement: RF-1007 Español y tono respetuoso

El sistema SHALL responder en español, con tono respetuoso, y SHALL NOT afirmar autoridad doctrinal propia.

#### Scenario: Respuesta doctrinal

- **WHEN** la pregunta pide una definición doctrinal
- **THEN** el sistema responde en español, cita el material público y no se presenta como autoridad doctrinal

### Requirement: RNF-1001 Gratuito y sin datos personales al proveedor

El asistente SHALL funcionar con un proveedor de generación gratuito o local, sin servicios de pago, y SHALL NOT enviar datos personales al proveedor.

#### Scenario: Proveedor externo

- **WHEN** el asistente usa un proveedor externo de capa gratuita
- **THEN** solo le envía la pregunta y los fragmentos públicos, sin datos de menores ni credenciales

### Requirement: RNF-1002 Respuesta oportuna

El sistema SHALL responder en menos de 8 segundos en el percentil 95 y SHALL mostrar un estado de carga mientras espera.

#### Scenario: Espera de la respuesta

- **WHEN** la persona envía una pregunta y el proveedor tarda
- **THEN** la pantalla muestra un estado de carga hasta recibir la respuesta o el error

### Requirement: RNF-1003 Requiere conexión sin bloquear lo offline

El asistente SHALL requerir conexión y SHALL NOT bloquear la operación offline de asistencia, justificaciones o riesgo.

#### Scenario: uso sin conexión

- **WHEN** no hay conexión y la persona abre el asistente
- **THEN** el asistente avisa que necesita conexión y la operación offline sigue disponible

### Requirement: RNF-1004 Trazabilidad de versión

Cada respuesta SHALL incluir la versión del corpus y el proveedor o modelo usados, sin exponer claves ni configuración interna.

#### Scenario: Metadatos de la respuesta

- **WHEN** el sistema devuelve una respuesta
- **THEN** incluye la versión del corpus y el proveedor o modelo usados, sin claves ni configuración interna

### Requirement: RNF-1005 Corpus auditable

El corpus SHALL estar versionado en el repositorio con la fuente y la licencia de cada documento, y SHALL poder revisarse antes de publicarse.

#### Scenario: Revisión de una fuente

- **WHEN** una persona revisa el corpus antes de publicarlo
- **THEN** encuentra la fuente y la licencia de cada documento y puede retirar o corregir un fragmento

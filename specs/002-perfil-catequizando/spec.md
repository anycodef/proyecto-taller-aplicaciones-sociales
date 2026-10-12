# 002 — Perfil e inscripción del catequizando

## Contexto y objetivo

### Acuerdos aprobados para backend/001-003 (2026-10-11)

Se aceptan D-201 a D-214 y C-01 a C-13 del plan como decisiones cerradas. Las marcas históricas de aclaración remiten a esos acuerdos. Se cubren todas las fases backend: documentos (solo estados), correcciones, condiciones, apoderados, grupos, carné y retención. UI, impresión física, tiempos de digitación y módulos externos requieren evidencia propia.

UUID interno, sin DNI. QR exclusivamente `SGC1:<uuid>:<emision>`; BD conserva `emision` y el pull deriva `codigo_carne`. Los periodos de inscripción y asignación se consultan mediante `FuenteInscripciones`, sin usar el grupo actual para reconstruir fechas pasadas. RF-106 de 001 exige borrar condiciones, estados documentales e historial personal, anonimizar el perfil y dejarlo inactivo en las listas; solo borra datos del apoderado si no tiene otros hijos vinculados.

### Dependencias justificadas del cliente

| Paquete | Motivo y alternativa descartada |
| --- | --- |
| `qrcode-generator` | Matriz QR en TS puro para pantalla/HTML; evita PNG en servidor |
| `react-native-svg` | Dibuja matriz sin wrapper QR adicional |
| `expo-print` | Imprime HTML nativo/web; evita servicio PDF backend |

Se conserva D-210. En nativo se usa el flujo de impresión; compartir PDF requiere justificar `expo-sharing` antes de instalarlo. SDK 57 y mediciones físicas se verifican en las tareas cliente, no se dan por probados en esta entrega documental.

La información de cada niño está repartida entre la cartilla física, la lista impresa de secretaría, el WhatsApp de la coordinación y un Excel que nadie alcanza a mantener. El coordinador pidió, sin que se le sugiriera, "presionar el nombre y que aparezca todo lo que está pasando con el niño". Además, cada año hay más niños con autismo u otras necesidades, y el equipo empezó a considerarlas al formar los grupos.

**Objetivo:** un perfil único por niño que reúna sus datos, el estado de sus documentos de inscripción, sus condiciones a considerar y, a medida que avancen las demás specs, su asistencia, justificaciones y avance formativo; y que la coordinación pueda formar grupos teniendo en cuenta esas condiciones.

## Usuarios

- **Coordinación (o quien la tenga delegada):** inscribe, corrige datos, revisa documentos y forma los grupos. Es la única que escribe en esta spec.
- **Catequista:** consulta el perfil de los niños de su grupo y sus condiciones a considerar.
- **Familia:** consulta el perfil de su hijo y qué documentos le faltan (alcance exacto pendiente en spec 001).

## Historias de usuario

- **HU-201.** Como coordinador, quiero inscribir a un niño registrando solo lo indispensable, para no convertir la inscripción en una carga.
- **HU-202.** Como coordinador, quiero ver qué documentos le faltan a cada niño, para no descubrir al final del ciclo que le faltaba un requisito.
- **HU-203.** Como coordinador, quiero registrar las condiciones de un niño con categorías claras, para asignarlo al grupo adecuado sin guardar diagnósticos.
- **HU-204.** Como coordinador, quiero crear los grupos que el ciclo necesite (por ejemplo, dos grupos de 8 años), para no dejar a un solo catequista con más de 20 niños.
- **HU-205.** Como catequista, quiero abrir el perfil de un niño de mi grupo y ver todo su año en un solo lugar.
- **HU-206.** Como apoderado, quiero saber qué documentos de mi hijo están pendientes.

## Requisitos funcionales

### RF-201 Perfil único
- El sistema deberá mantener un único perfil por niño, que perdure entre ciclos mientras no se aplique la retención (spec 001, RF-108).
- Cuando se abre el perfil de un niño, el sistema deberá mostrar nombre, edad, grupo, apoderados, estado de documentos y un resumen de asistencia, justificaciones y avance formativo del ciclo actual.
- Si al inscribir se detecta que el niño podría estar ya registrado, entonces el sistema deberá avisarlo a la coordinación sin mostrar datos del perfil existente hasta que ella lo confirme.
- **[NECESITA ACLARACIÓN]** Identificador del niño y criterio de duplicado (ver dudas abiertas).

### RF-202 Inscripción
- El sistema deberá permitir inscribir y editar niños solo a la coordinación o a quien la tenga delegada.
- Mientras no haya conexión, el sistema no deberá permitir inscribir ni editar los datos de inscripción, y deberá indicarlo con claridad.
- El sistema deberá registrar de cada niño: nombres, apellidos, fecha de nacimiento, sexo, si está bautizado y al menos un apoderado con un medio de contacto.
- El sistema no deberá completar la inscripción sin el consentimiento informado del apoderado (spec 001, RF-106).
- Si la edad del niño a la fecha de inicio del ciclo está fuera del rango de 8 a 13 años, entonces el sistema deberá advertirlo y pedir confirmación de la coordinación para continuar.

### RF-203 Corrección y anulación
- Cuando la coordinación corrige un dato de inscripción, el sistema deberá conservar el valor anterior, quién lo cambió y cuándo.
- Si la corrección de la fecha de nacimiento cambia el grupo sugerido, entonces el sistema deberá avisarlo sin mover al niño de grupo automáticamente.
- Cuando la coordinación anula una inscripción hecha por error, el sistema deberá retirar al niño de su grupo y de las listas sin borrar los registros ya hechos.

### RF-204 Documentos de inscripción
- El sistema deberá llevar, por niño y ciclo, el estado de cada documento: documento de identidad, partida de nacimiento, partida de bautismo, boleta de pago y ficha de compromiso firmada.
- El sistema deberá registrar solo el estado del documento (pendiente, entregado, inválido o no aplica), la fecha y quién lo recibió; no deberá guardar imágenes ni copias de los documentos.
- Donde el niño no esté bautizado, el sistema deberá marcar la partida de bautismo como "no aplica".
- Cuando un niño se bautiza durante el ciclo, el sistema deberá permitir pasar la partida de bautismo de "no aplica" a "pendiente".
- Cuando un documento entregado resulta ilegible o inválido, el sistema deberá permitir marcarlo como inválido con un motivo y volverlo a contar como pendiente.
- El sistema deberá mostrar a la coordinación la lista de niños con documentos pendientes o inválidos.

### RF-205 Condiciones a considerar
- El sistema deberá registrar las condiciones de un niño eligiendo una o más categorías de una lista cerrada: trastorno del espectro autista, déficit de atención e hiperactividad, discapacidad física, discapacidad intelectual, alergia, condición médica y otra.
- El sistema deberá permitir añadir a cada condición una nota opcional y corta sobre cómo apoyar al niño en la sesión, sin diagnósticos ni tratamientos.
- El sistema deberá mostrar esas condiciones solo a la coordinación (o quien la tenga delegada) y a los catequistas del grupo del niño.

### RF-206 Grupos
- El sistema deberá permitir a la coordinación crear, renombrar y cerrar los grupos que el ciclo necesite, cada uno con su rango de edad, si es mixto o por sexo, y sus catequistas.
- Cuando la coordinación asigna un niño, el sistema deberá sugerir los grupos que corresponden a su edad y sexo según la regla habitual (8, 9 y 10 años mixtos; 11 a 13 separados por sexo), y mostrar de cada uno cuántos niños tiene y cuántos con cada categoría de condición.
- El sistema deberá permitir a la coordinación asignar al niño a un grupo distinto del sugerido.
- Cuando un niño cambia de grupo durante el ciclo, el sistema deberá conservar su historial y hacerlo visible para el nuevo catequista.
- Si un grupo no tiene catequista asignado, entonces el sistema deberá avisarlo a la coordinación.

### RF-207 Apoderados
- El sistema deberá permitir vincular uno o más apoderados a un niño, indicando su relación (madre, padre u otro familiar o tutor), y un apoderado a varios niños.
- Cuando la coordinación desvincula a un apoderado, el sistema deberá revocar su enlace personal para ese niño (spec 001, RF-110).

## Requisitos no funcionales

- **RNF-201 Mínima digitación.** Registrar los datos obligatorios de un niño (sin contar la lectura del consentimiento) deberá tomar menos de 3 minutos desde el celular (R27).
- **RNF-202 Mobile-first.** Todo el flujo de inscripción y consulta deberá poder hacerse desde un celular (R18).
- **RNF-203 Datos restringidos.** Las condiciones y el número de documento de identidad nunca deberán estar disponibles sin conexión (spec 001, RNF-101).
- **RNF-204 Perfil liviano.** Abrir el perfil sin conexión deberá mostrar los datos operativos (nombre, grupo, asistencia, avance) ya sincronizados.

## Casos límite

- Niño de 13 años que cumple 14 durante el ciclo: permanece en su grupo.
- Niño que cumple años entre el inicio del ciclo y su inscripción: la edad se calcula a la fecha de inicio del ciclo.
- Dos hermanos con el mismo apoderado.
- Apoderado que no es padre ni madre (abuela, tío o tutor).
- Niño que se reinscribe tras haber abandonado un ciclo anterior: se reutiliza su perfil (ver spec 008).
- Documento entregado después de iniciado el ciclo.
- Familia exonerada del pago por falta de recursos.
- Grupo de 8 años con más de 20 niños: la coordinación crea un segundo grupo de 8 años.
- Inscripción en el local sin señal: no se puede hacer hasta tener conexión.
- Niño anulado por error que luego sí se inscribe.

## Fuera de alcance

- Guardar fotos o copias de los documentos de inscripción.
- Inscripción sin conexión.
- Que los apoderados o los catequistas inscriban niños.
- Lectura automática (OCR) de documentos.
- Requisitos de padrinos y charlas pre-bautismales.
- Catequesis de adultos y confirmación de jóvenes.
- Cobro o pasarela de pagos.

## Criterios de finalización

- La coordinación inscribe a un niño de punta a punta desde el celular con conexión, y sin conexión el sistema impide inscribir y lo explica.
- El perfil muestra el estado de los cinco documentos y ninguna imagen de ellos.
- Un posible duplicado se avisa sin exponer el perfil existente.
- Un catequista ve las condiciones de los niños de su grupo y no las de otros grupos.
- La coordinación crea dos grupos de 8 años y el sistema sugiere ambos para un niño de 8 años.
- Una corrección de datos conserva el valor anterior y quién la hizo.

## Dudas abiertas

Registro histórico: las respuestas C-01–C-13 del plan fueron aceptadas el 2026-10-11. UUID/sin DNI, exoneración, categorías, ficha solo estado, sexo obligatorio y reducción de alcance por hijo quedan decididos; no bloquean backend.

- **[NECESITA ACLARACIÓN]** Identificador del niño: ¿código interno del sistema, DNI obligatorio, o código sin guardar el número de documento? Incluye cómo se detectan duplicados y qué pasa con niños sin DNI o con documento extranjero. Pendiente de consultar con el coordinador.
- **[NECESITA ACLARACIÓN]** ¿Una familia exonerada del pago cuenta como "boleta entregada" o tiene un estado propio?
- **[NECESITA ACLARACIÓN]** ¿Es correcta la lista de categorías de condiciones? ¿Falta alguna que el equipo use?
- **[NECESITA ACLARACIÓN]** ¿Qué compromisos incluye la ficha de compromiso de inscripción y cuáles se registran? Es distinta de la ficha que se firma al llegar a 3 faltas (spec 007).
- **[NECESITA ACLARACIÓN]** ¿Se necesita registrar el sexo de los niños de 8 a 10 años, si sus grupos son mixtos?
- **[NECESITA ACLARACIÓN]** ¿Qué pasa con el enlace de un apoderado cuando se le desvincula de uno de sus hijos pero sigue vinculado a otro?

## Trazabilidad

| Requerimiento | Requisitos |
| --- | --- |
| R1 Perfil único | RF-201, RF-203, RF-207 |
| R2 Datos y documentos de inscripción | RF-202, RF-204 |
| R3 Salud, neurodivergencia y grupos | RF-205, RF-206 |

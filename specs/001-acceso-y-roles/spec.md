# 001 — Acceso, roles y protección de datos

## Contexto y objetivo

SIGECAT guarda información de niños de 8 a 13 años (identidad, salud, neurodivergencia) y lo operan catequistas que en su mayoría también son menores de edad. Hoy toda la información administrativa (faltas, justificaciones, avisos de secretaría) vive solo en el celular de la coordinación: cuando faltó tres domingos, el equipo no supo qué responder a los padres y los padres desautorizaron a los catequistas jóvenes.

**Objetivo:** que cada persona entre con su propia credencial y vea exactamente lo que sus roles le permiten, que el equipo pueda operar un domingo sin la coordinación y que los datos de menores estén protegidos desde el diseño: mínimos, con consentimiento, con plazo de vida y con la identidad de los catequistas menores oculta.

## Usuarios

| Rol | Quiénes | Alcance |
| --- | --- | --- |
| Administración | Responsable técnico o parroquial del sistema | Gestiona cuentas, roles y ciclos. No opera la asistencia. |
| Coordinación | Coordinador de catequesis | Ve y gestiona todos los grupos del ciclo, incluidos los datos restringidos. |
| Catequista | Voluntarios, muchos menores de edad | Ve y registra lo de los grupos que tiene asignados; además puede tomar asistencia de cualquier grupo (spec 003). |
| Familia | Padre, madre o apoderado | Ve solo a los niños de los que es apoderado. Entra con un enlace personal. |
| Supervisión | Párroco y Madre Concepción (asesora) | Solo lectura de asistencia, justificaciones con su evidencia y aptitud de todos los grupos. |

Una misma cuenta puede tener varios roles a la vez (por ejemplo, catequista y familia) y ve la unión de sus alcances.

## Historias de usuario

- **HU-101.** Como catequista, quiero entrar con mi propia cuenta y ver solo a los niños de mi grupo, para registrar su información sin acceder a la de otros.
- **HU-102.** Como catequista, quiero consultar las faltas, justificaciones y avance de un niño de mi grupo, para responder a sus padres sin esperar a la coordinación.
- **HU-103.** Como coordinador, quiero delegar mis funciones a un catequista de confianza cuando no pueda asistir, para que el domingo funcione igual.
- **HU-104.** Como apoderado, quiero entrar con un enlace personal, sin contraseña ni correo, y ver solo la información de mi hijo.
- **HU-105.** Como catequista menor de edad, quiero aparecer con un seudónimo en todo lo que el sistema muestra o exporta, para que mi identidad real no circule.
- **HU-106.** Como apoderado, quiero dar mi consentimiento informado al inscribir a mi hijo, para saber qué datos se guardan, quién los ve y por cuánto tiempo.
- **HU-107.** Como párroco, quiero consultar la asistencia y las evidencias sin depender de que la coordinación me las envíe.
- **HU-108.** Como apoderado, quiero poder retirar mi consentimiento y que los datos sensibles de mi hijo se borren de inmediato.

## Requisitos funcionales

### RF-101 Acceso autenticado
- El sistema deberá exigir una credencial personal válida para consultar o registrar cualquier dato: enlace personal más PIN para administración, coordinación, catequistas y supervisión (RF-111); enlace personal para familias (RF-110).
- Si una persona intenta acceder sin credencial válida, entonces el sistema deberá negar el acceso sin revelar si la cuenta o el enlace existen.
- Cuando una cuenta se desactiva, el sistema deberá impedir su acceso en la siguiente interacción con el servidor.

### RF-102 Roles y alcance por dato
- El sistema deberá permitir asignar a cada cuenta uno o más roles de la tabla de usuarios.
- Mientras una cuenta tenga varios roles, el sistema deberá mostrarle la unión de los alcances de esos roles y nada más.
- Mientras una cuenta tenga el rol catequista, el sistema deberá mostrarle y permitirle registrar solo información de los niños de los grupos que tiene asignados, con dos excepciones de asistencia: escanear el carné de cualquier niño en misa sin ver sus datos y pasar la lista de catequesis de cualquier grupo (spec 003).
- Mientras una cuenta tenga el rol familia, el sistema deberá mostrarle solo a los niños de los que es apoderada.
- Mientras una cuenta tenga el rol supervisión, el sistema deberá permitirle consultar, sin modificar, la asistencia, las justificaciones con su evidencia y la aptitud de todos los grupos.
- Si una cuenta solicita información fuera de su alcance, entonces el sistema deberá rechazar la solicitud aunque se haga sin pasar por las pantallas habituales.

### RF-103 Consulta descentralizada
- Cuando un catequista abre el perfil de un niño de su grupo, el sistema deberá mostrarle sus faltas, justificaciones con su estado y su avance formativo, sin requerir intervención de la coordinación.
- El sistema deberá mostrar a todos los catequistas de un grupo los avisos que la coordinación publique para ese grupo.

### RF-104 Delegación de la coordinación
- Cuando la coordinación delega sus funciones a un catequista indicando un periodo, el sistema deberá otorgarle durante ese periodo exactamente los mismos permisos que la coordinación, incluidos los datos restringidos, sea mayor o menor de edad.
- Cuando termina el periodo de delegación, el sistema deberá retirar esos permisos automáticamente.
- Cuando la coordinación revoca una delegación antes de su fin, el sistema deberá retirar los permisos en la siguiente interacción del delegado con el servidor.
- El sistema deberá registrar quién delegó, a quién, durante qué periodo y, si la hubo, la revocación.

### RF-105 Seudónimo de catequistas menores de edad
- Donde un catequista sea menor de edad, el sistema deberá mostrar su seudónimo institucional en toda vista, reporte, exportación y registro de auditoría.
- El sistema deberá guardar la identidad real de un catequista separada de su seudónimo y mostrarla solo a administración.

### RF-106 Consentimiento informado
- El sistema deberá registrar el consentimiento informado del apoderado (quién, cuándo y sobre qué texto) como condición para completar la inscripción de un niño.
- Cuando un apoderado retira su consentimiento, el sistema deberá eliminar de inmediato la salud, la neurodivergencia, los documentos y las evidencias del niño, marcarlo como inactivo y conservar solo sus registros de asistencia anonimizados y, si ya recibió un sacramento, su constancia sacramental (spec 008, RF-805).
- El sistema deberá informar en el texto del consentimiento que la constancia sacramental se conserva sin vencimiento.

### RF-107 Minimización de datos
- El sistema deberá pedir solo los datos necesarios para formar grupos y determinar la aptitud sacramental.
- El sistema deberá tratar salud, neurodivergencia y documentos de identidad como datos restringidos, visibles solo para la coordinación (y quien la tenga delegada) y los catequistas del grupo del niño.
- El sistema deberá mostrar a supervisión la evidencia de las justificaciones, aunque contenga datos de salud, como autorización expresa de su rol.

### RF-108 Retención
- Cuando se cumplen 2 años desde el cierre de un ciclo, el sistema deberá anonimizar los datos personales de ese ciclo y conservar solo los registros agregados de valor institucional y la constancia sacramental (spec 008).

### RF-109 Auditoría
- El sistema deberá registrar quién creó, modificó o consultó datos restringidos y cuándo.

### RF-110 Enlace personal de familia
- Cuando la coordinación da de alta a un apoderado, el sistema deberá generar un enlace personal para él, que se envía por los canales que ya usa la familia.
- Cuando la coordinación revoca el enlace de un apoderado, el sistema deberá rechazar cualquier acceso posterior con ese enlace y permitir generar uno nuevo.
- El sistema no deberá enviar mensajes con costo por usuario para identificar a las familias.
- El enlace de familia no vence solo: dura hasta que se revoque o hasta el cierre del ciclo si el niño no se reinscribe (spec 008, RF-802).

### RF-111 Enlace personal y PIN del equipo
- Cuando la coordinación da de alta a un miembro del equipo, el sistema deberá generar un enlace personal que se envía por los canales que ya usa, sin requerir correo ni teléfono.
- Cuando la persona abre su enlace por primera vez, el sistema deberá pedirle que fije un PIN de 4 a 6 dígitos y quedar asociado a ese celular.
- Cuando la persona pierde el celular u olvida su PIN, el sistema deberá permitir a la coordinación revocar su enlace y generar uno nuevo; el enlace anterior deja de funcionar en la siguiente interacción con el servidor.
- Si se ingresa un PIN incorrecto 5 veces seguidas, entonces el sistema deberá bloquear el acceso en ese celular hasta que se emita un enlace nuevo.

### RF-112 Sesión sin conexión
- Mientras no haya conexión, el sistema deberá permitir desbloquear la aplicación con el PIN y registrar asistencia durante un máximo de 14 días desde la última renovación de la sesión.
- Cuando vuelve la conexión, el sistema deberá renovar la sesión antes de enviar los registros pendientes.
- Si al reconectar la cuenta o el enlace fueron revocados, entonces el sistema deberá rechazar los registros pendientes de ese celular y avisar a la coordinación de cuántos fueron rechazados.
- Cuando se cumplen los 14 días sin renovar, el sistema deberá impedir nuevos registros hasta conectarse.

## Requisitos no funcionales

- **RNF-101 Datos sensibles fuera del celular.** Salud, neurodivergencia, documentos de identidad y evidencias nunca deberán quedar guardados en el celular; solo se consultan con conexión.
- **RNF-102 Celular compartido.** Al cerrar sesión, el sistema deberá borrar del celular todos los datos de niños excepto los registros pendientes de envío, que se enviarán la próxima vez que esa misma cuenta inicie sesión y no podrán verse desde otra cuenta.
- **RNF-103 Canal cifrado.** Toda comunicación con el servidor deberá viajar cifrada.
- **RNF-104 Costo cero.** La gestión de cuentas y enlaces no deberá generar costo por usuario ni por mensaje enviado (R23).
- **RNF-105 Administración mínima.** Crear cuentas, asignar grupos, generar enlaces y delegar deberán poder hacerse desde el celular, sin intervención técnica (R24).

## Casos límite

- Catequista asignado a dos grupos: ve ambos y nada más.
- Catequista que también es apoderado de un niño inscrito: una sola cuenta con ambos roles.
- Catequista que cumple 18 años durante el ciclo: el seudónimo se mantiene hasta el cierre del ciclo **[NECESITA ACLARACIÓN]**.
- Apoderado con varios hijos inscritos: un solo enlace ve a todos sus hijos.
- Dos apoderados para el mismo niño: cada uno con su propio enlace.
- Enlace de familia reenviado a otra persona: quien lo tenga entra como ese apoderado hasta que se revoque.
- Delegación que se solapa con el regreso de la coordinación: ambos tienen permisos hasta que termine el periodo o la coordinación la revoque.
- Delegación a un catequista menor de edad: ve los datos restringidos de todos los niños durante el periodo.
- Catequista que deja el equipo a mitad del ciclo: su cuenta se desactiva y sus registros conservan su seudónimo.
- Cierre de sesión con asistencias sin enviar: se conservan solo esos registros hasta el próximo inicio de sesión de la misma cuenta.
- Retiro del consentimiento con justificaciones pendientes: la evidencia se elimina y la justificación queda sin evidencia.
- Celular perdido o robado: la coordinación revoca el enlace; los registros que ese celular no había enviado se pierden.
- Catequista menor sin correo propio que usa el celular de su madre: entra con su enlace y su PIN, sin correo.
- Apoderado al que se debe quitar el acceso (custodia, orden judicial): se revoca su enlace y el del otro apoderado sigue funcionando.
- Sesión vencida sin señal en plena misa: el PIN desbloquea la aplicación si no pasaron 14 días desde la última renovación.

## Fuera de alcance

- Inicio de sesión con biometría o reconocimiento facial (descartado por tratar datos biométricos de menores).
- Identificación por código enviado por SMS (tiene costo por mensaje).
- Cuentas para los propios niños.
- Integración con sistemas de la diócesis o de secretaría.

## Criterios de finalización

- Cada rol, y una cuenta con dos roles, puede probarse con credenciales de ejemplo y ve exactamente su alcance; un intento de acceso fuera de alcance queda rechazado y registrado.
- Supervisión consulta asistencia y evidencias, y cualquier intento de modificar queda rechazado.
- Un apoderado entra con su enlace sin contraseña ni correo, y tras revocarlo el enlace deja de funcionar.
- Ninguna vista, reporte o exportación muestra el nombre real de un catequista menor de edad.
- Una inscripción sin consentimiento registrado no puede completarse, y al retirar el consentimiento los datos sensibles desaparecen de inmediato.
- Una delegación vence sola en la fecha indicada y puede revocarse antes.
- Tras cerrar sesión, solo quedan en el celular los registros pendientes de envío, y no son visibles desde otra cuenta.
- Un catequista entra con enlace y PIN sin tener correo, desbloquea sin señal dentro de los 14 días y queda bloqueado después.
- Un enlace revocado deja de funcionar, y los registros pendientes de ese celular se rechazan con aviso a la coordinación.

## Dudas abiertas

- **[NECESITA ACLARACIÓN]** ¿Qué pasa si la coordinación falta sin haber delegado (el incidente real de tres domingos)?
- **[NECESITA ACLARACIÓN]** ¿Solo la coordinación puede delegar? ¿Hay un periodo máximo?
- **[NECESITA ACLARACIÓN]** ¿Puede haber más de una persona con rol de coordinación a la vez?
- **[NECESITA ACLARACIÓN]** ¿Qué ve exactamente la familia de su hijo: asistencia, justificaciones, avance, documentos pendientes, salud, nombre del catequista?
- **[NECESITA ACLARACIÓN]** ¿Quién asigna el seudónimo, cómo se forma y quién registra que un catequista es menor de edad?
- **[NECESITA ACLARACIÓN]** ¿Qué es un "aviso" de la coordinación (RF-103) y en qué spec se define?
- **[NECESITA ACLARACIÓN]** Lista cerrada de datos necesarios que hace verificable la minimización (RF-107).
- **[NECESITA ACLARACIÓN]** ¿Cada lectura de un dato restringido se audita? ¿Cuánto tiempo se guarda la auditoría?
- **[NECESITA ACLARACIÓN]** ¿Qué pasa si la única persona con rol de administración deja la parroquia?
- **[NECESITA ACLARACIÓN]** Las exportaciones (como el reporte al párroco) salen del sistema: ¿cómo se les aplica la retención?
- **[NECESITA ACLARACIÓN]** ¿Existe normativa diocesana sobre datos de menores que deba incorporarse?
- **[NECESITA ACLARACIÓN]** ¿La administración puede ser la misma persona que la coordinación?

## Trazabilidad

| Requerimiento | Requisitos |
| --- | --- |
| R15 Consulta descentralizada | RF-102, RF-103 |
| R16 Continuidad sin coordinación | RF-103, RF-104 |
| R21 Usuarios autenticados | RF-101, RF-110, RF-111, RF-112 |
| R25 Anonimizar catequistas menores | RF-105 |
| R26 Protección de datos de menores | RF-102, RF-106, RF-107, RF-108, RF-109, RNF-101, RNF-102 |

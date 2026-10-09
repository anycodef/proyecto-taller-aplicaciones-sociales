# 008 — Historial de ciclos

## Contexto y objetivo

El ciclo dura de marzo a diciembre y el equipo de voluntarios rota cada año. Desde hace dos años la coordinación guarda las listas de quienes recibieron el sacramento porque "a veces se pierden" y alguien puede decir "yo tuve Primera Comunión". Toda la información del año vive en papeles y en el celular de una sola persona, así que se pierde cuando el equipo cambia.

**Objetivo:** cerrar cada ciclo dejando un registro institucional consultable, conservar para siempre la constancia de quién recibió el sacramento, permitir que un niño que vuelve conserve su historial y aplicar la política de retención de datos personales.

## Usuarios

- **Administración:** abre y cierra ciclos.
- **Coordinación (o quien la tenga delegada):** marca quién recibió el sacramento, consulta ciclos anteriores y corrige la constancia.
- **Supervisión (párroco, Madre Concepción):** consulta la constancia y los indicadores de ciclos anteriores.

## Historias de usuario

- **HU-801.** Como administración, quiero cerrar el ciclo y que todo quede guardado, para que el equipo del próximo año no empiece de cero.
- **HU-802.** Como coordinador, quiero marcar después de la ceremonia quiénes recibieron el sacramento, porque no todos los aptos se presentan.
- **HU-803.** Como coordinador, quiero comprobar si una persona recibió la Primera Comunión en un ciclo anterior.
- **HU-804.** Como coordinador, quiero reinscribir a un niño que no terminó el ciclo anterior sin volver a digitar sus datos.
- **HU-805.** Como administración, quiero que los datos personales de ciclos antiguos se depuren solos al vencer su plazo.

## Requisitos funcionales

### RF-801 Ciclos
- El sistema deberá organizar toda la información operativa (grupos, asistencia, justificaciones, avance, alertas, decisiones) dentro de un ciclo con fechas de inicio y fin.
- El sistema deberá permitir un solo ciclo abierto a la vez.
- El sistema deberá permitir abrir y cerrar ciclos solo a la administración.

### RF-802 Cierre de ciclo
- Cuando la administración cierra un ciclo, el sistema deberá congelar lo que esté registrado en el servidor en ese momento, sin pedir confirmaciones por lo pendiente.
- El sistema deberá conservar en su estado al momento del cierre las justificaciones sin revisar, las alertas abiertas y las aptitudes sin decidir, sin permitir modificarlas.
- Si llegan registros de un celular después del cierre, entonces el sistema deberá descartarlos.
- Cuando se cierra un ciclo, el sistema deberá terminar las delegaciones vigentes, revocar los enlaces de las familias cuyos hijos no se reinscriban y dejar a los catequistas sin grupo asignado, sin desactivar sus cuentas.

### RF-803 Excepciones al cierre
- Mientras un ciclo esté cerrado, el sistema no deberá permitir reabrirlo ni modificar sus registros, salvo lo indicado en RF-804 y RF-805.

### RF-804 Sacramento recibido
- Cuando la coordinación marca sobre la lista de aptos (spec 006, RF-606) que un niño recibió el sacramento, el sistema deberá registrar el sacramento, la fecha de la ceremonia, quién lo marcó y cuándo.
- El sistema deberá permitir marcarlo aunque el ciclo ya esté cerrado.

### RF-805 Constancia sacramental
- El sistema deberá conservar sin vencimiento, por cada persona que recibió un sacramento: nombres, apellidos, fecha de nacimiento, sacramento, fecha de la ceremonia y ciclo; ningún otro dato.
- El sistema deberá conservar la constancia aunque el apoderado haya retirado su consentimiento o haya vencido la retención de los demás datos (spec 001, RF-106 y RF-108).
- Cuando la coordinación busca a una persona por nombre y fecha de nacimiento, el sistema deberá indicar qué sacramentos recibió y en qué ciclo, si constan.
- Cuando la coordinación corrige un error de la constancia, el sistema deberá exigir un motivo y conservar el valor anterior, quién lo cambió y cuándo.

### RF-806 Indicadores de ciclo
- El sistema deberá mostrar por cada ciclo: inscritos, retirados, porcentaje de asistencia a misa y a catequesis, aptos y sacramentos recibidos.
- El sistema deberá calcular el porcentaje de asistencia como presencias registradas sobre el total de niños activos en cada domingo con esa sesión.
- Donde el ciclo tenga saldos cargados desde papel (specs 006 y 007), el sistema deberá indicarlo junto a los indicadores.

### RF-807 Reinscripción
- Cuando un niño de un ciclo anterior se inscribe en un ciclo nuevo y su perfil no fue anonimizado, el sistema deberá reutilizar su perfil y mostrar su historial previo.
- Si su perfil ya fue anonimizado, entonces el sistema deberá inscribirlo como un perfil nuevo.

### RF-808 Retención
- Cuando se cumplen 2 años desde el cierre de un ciclo, el sistema deberá anonimizar sus datos personales y eliminar sus evidencias, y conservar solo los indicadores y la constancia sacramental (spec 001, RF-108).

## Requisitos no funcionales

- **RNF-801 Sin mantenimiento.** El cierre, la revocación de accesos y la depuración deberán funcionar sin intervención técnica (R24).
- **RNF-802 Costo cero.** Conservar el historial no deberá generar costo; la evidencia fotográfica de ciclos cerrados se elimina con la retención (R23).

## Casos límite

- Intento de modificar un registro de un ciclo cerrado: se rechaza.
- Ceremonia posterior al cierre: el sacramento recibido se marca igual.
- Niño apto que no se presenta a la ceremonia: no entra en la constancia.
- Niño que recibió el Bautismo y la Primera Comunión en el mismo ciclo: dos entradas en la constancia.
- Cierre con justificaciones sin revisar: quedan pendientes para siempre y no afectan a nadie.
- Catequista que no envió sus registros antes del cierre: se descartan al llegar.
- Apoderado que retira el consentimiento después del sacramento: se borra todo menos la constancia.
- Búsqueda de una persona cuyos datos ya fueron anonimizados: solo consta en la constancia.
- Niño que vuelve 3 años después: se inscribe como perfil nuevo.
- Nombre mal escrito en la constancia: se corrige con motivo y traza.

## Fuera de alcance

- Reabrir un ciclo cerrado.
- Digitalizar los ciclos anteriores a la implantación del sistema.
- Emisión de certificados oficiales; la constancia formal la lleva secretaría.

## Criterios de finalización

- Un ciclo cerrado no admite cambios, salvo marcar sacramentos recibidos y corregir la constancia.
- Un registro que llega de un celular después del cierre se descarta.
- Al cerrar, las delegaciones vencen y los catequistas quedan sin grupo con su cuenta activa.
- La búsqueda por nombre y fecha de nacimiento devuelve el sacramento y el ciclo correctos.
- Un niño reinscrito conserva su historial si su perfil no fue anonimizado.
- Al vencer la retención, los datos personales del ciclo quedan anonimizados, sus evidencias eliminadas y la constancia intacta.

## Dudas abiertas

- **[NECESITA ACLARACIÓN]** Al abrir un ciclo nuevo, ¿qué se copia del anterior (grupos, catálogo de oraciones, umbrales de aptitud, plazo de justificación, ventana de misa)?
- **[NECESITA ACLARACIÓN]** ¿Secretaría necesita acceso propio a la constancia sacramental?
- **[NECESITA ACLARACIÓN]** ¿Se avisa al catequista cuyos registros se descartaron por llegar después del cierre?
- **[NECESITA ACLARACIÓN]** El texto del consentimiento debe informar que la constancia sacramental se conserva sin vencimiento. ¿Quién redacta ese texto?

## Trazabilidad

| Requerimiento | Requisitos |
| --- | --- |
| R17 Historial institucional | RF-801 a RF-808 |

# Historial de ciclos

## Purpose

Cerrar cada ciclo dejando un registro institucional consultable, conservar para siempre la constancia de quién recibió el sacramento, permitir que un niño que vuelve conserve su historial y aplicar la política de retención de datos personales. Administración abre y cierra ciclos. La coordinación marca quién recibió el sacramento, consulta ciclos anteriores y corrige la constancia. La supervisión consulta la constancia y los indicadores de ciclos anteriores.

## Requirements

### Requirement: RF-801 Organizar la información en un ciclo

El sistema SHALL organizar toda la información operativa (grupos, asistencia, justificaciones, avance, alertas, decisiones) dentro de un ciclo con fechas de inicio y fin.

#### Scenario: Información del año

- **WHEN** se registra un grupo, una asistencia, una justificación, un avance, una alerta o una decisión
- **THEN** el sistema la guarda dentro del ciclo que tiene fechas de inicio y fin

### Requirement: RF-801 Un solo ciclo abierto

El sistema SHALL permitir un solo ciclo abierto a la vez.

#### Scenario: Segundo ciclo abierto

- **WHEN** ya hay un ciclo abierto y se intenta abrir otro
- **THEN** el sistema no permite tener dos ciclos abiertos a la vez

### Requirement: RF-801 Abrir y cerrar solo administración

El sistema SHALL permitir abrir y cerrar ciclos solo a la administración.

#### Scenario: HU-801 Cerrar el ciclo

- **WHEN** administración cierra el ciclo
- **THEN** el sistema guarda el cierre
- **WHEN** otra cuenta intenta abrir o cerrar un ciclo
- **THEN** el sistema no lo permite

### Requirement: RF-802 Congelar lo registrado en el servidor

Cuando la administración cierra un ciclo, el sistema SHALL congelar lo que esté registrado en el servidor en ese momento, sin pedir confirmaciones por lo pendiente.

#### Scenario: Cierre sin confirmaciones pendientes

- **WHEN** administración cierra un ciclo
- **THEN** el sistema congela lo registrado en el servidor en ese momento, sin pedir confirmaciones por lo pendiente

### Requirement: RF-802 Conservar pendientes sin modificarlos

El sistema SHALL conservar en su estado al momento del cierre las justificaciones sin revisar, las alertas abiertas y las aptitudes sin decidir, sin permitir modificarlas.

#### Scenario: Cierre con justificaciones sin revisar

- **WHEN** se cierra el ciclo y quedan justificaciones sin revisar, alertas abiertas o aptitudes sin decidir
- **THEN** el sistema las conserva en ese estado para siempre y no permite modificarlas

### Requirement: RF-802 Descartar registros posteriores al cierre

Si llegan registros de un celular después del cierre, el sistema SHALL descartarlos.

#### Scenario: Catequista que no envió antes del cierre

- **WHEN** llegan registros de un celular después del cierre
- **THEN** el sistema los descarta

### Requirement: RF-802 Cerrar accesos del ciclo

Cuando se cierra un ciclo, el sistema SHALL terminar las delegaciones vigentes, revocar los enlaces de las familias cuyos hijos no se reinscriban y dejar a los catequistas sin grupo asignado, sin desactivar sus cuentas.

#### Scenario: Accesos al cerrar

- **WHEN** se cierra un ciclo
- **THEN** terminan las delegaciones vigentes, se revocan los enlaces de las familias cuyos hijos no se reinscriben y los catequistas quedan sin grupo, con su cuenta activa

### Requirement: RF-803 No reabrir ni modificar un ciclo cerrado

Mientras un ciclo esté cerrado, el sistema SHALL NOT permitir reabrirlo ni modificar sus registros, salvo lo indicado en RF-804 y RF-805.

#### Scenario: Intento de modificar un ciclo cerrado

- **WHEN** alguien intenta reabrir un ciclo cerrado o modificar uno de sus registros
- **THEN** el sistema lo rechaza, salvo marcar el sacramento recibido o corregir la constancia

### Requirement: RF-804 Registrar el sacramento recibido

Cuando la coordinación marca sobre la lista de aptos (spec 006, RF-606) que un niño recibió el sacramento, el sistema SHALL registrar el sacramento, la fecha de la ceremonia, quién lo marcó y cuándo.

#### Scenario: HU-802 Después de la ceremonia

- **WHEN** la coordinación marca en la lista de aptos que un niño recibió el sacramento
- **THEN** el sistema registra el sacramento, la fecha de la ceremonia, quién lo marcó y cuándo

#### Scenario: Apto que no se presenta

- **WHEN** un niño apto no se presenta a la ceremonia y la coordinación no lo marca
- **THEN** no entra en la constancia

### Requirement: RF-804 Marcar con el ciclo cerrado

El sistema SHALL permitir marcarlo aunque el ciclo ya esté cerrado.

#### Scenario: Ceremonia posterior al cierre

- **WHEN** la ceremonia es posterior al cierre y la coordinación marca el sacramento recibido
- **THEN** el sistema lo registra igual

### Requirement: RF-805 Conservar la constancia sin vencimiento

El sistema SHALL conservar sin vencimiento, por cada persona que recibió un sacramento: nombres, apellidos, fecha de nacimiento, sacramento, fecha de la ceremonia y ciclo; ningún otro dato.

#### Scenario: Datos de la constancia

- **WHEN** una persona recibió un sacramento
- **THEN** el sistema conserva sin vencimiento sus nombres, apellidos, fecha de nacimiento, el sacramento, la fecha de la ceremonia y el ciclo, y ningún otro dato

#### Scenario: Bautismo y Primera Comunión

- **WHEN** un niño recibió el Bautismo y la Primera Comunión en el mismo ciclo
- **THEN** la constancia tiene dos entradas

### Requirement: RF-805 Conservar la constancia tras el consentimiento o la retención

El sistema SHALL conservar la constancia aunque el apoderado haya retirado su consentimiento o haya vencido la retención de los demás datos (spec 001, RF-106 y RF-108).

#### Scenario: Retiro del consentimiento después del sacramento

- **WHEN** el apoderado retira el consentimiento después del sacramento
- **THEN** el sistema borra los demás datos y conserva la constancia

### Requirement: RF-805 Buscar por nombre y fecha de nacimiento

Cuando la coordinación busca a una persona por nombre y fecha de nacimiento, el sistema SHALL indicar qué sacramentos recibió y en qué ciclo, si constan.

#### Scenario: HU-803 Comprobar la Primera Comunión

- **WHEN** la coordinación busca a una persona por nombre y fecha de nacimiento
- **THEN** el sistema indica qué sacramentos recibió y en qué ciclo, si constan

#### Scenario: Datos ya anonimizados

- **WHEN** se busca a una persona cuyos demás datos ya fueron anonimizados
- **THEN** el sistema responde solo con lo que consta en la constancia

### Requirement: RF-805 Corregir la constancia con motivo

Cuando la coordinación corrige un error de la constancia, el sistema SHALL exigir un motivo y conservar el valor anterior, quién lo cambió y cuándo.

#### Scenario: Nombre mal escrito

- **WHEN** la coordinación corrige un nombre mal escrito en la constancia e indica el motivo
- **THEN** el sistema guarda la corrección, el valor anterior, quién la hizo y cuándo
- **WHEN** intenta corregirla sin motivo
- **THEN** el sistema no guarda la corrección

### Requirement: RF-806 Mostrar indicadores del ciclo

El sistema SHALL mostrar por cada ciclo: inscritos, retirados, porcentaje de asistencia a misa y a catequesis, aptos y sacramentos recibidos.

#### Scenario: Indicadores de un ciclo

- **WHEN** supervisión o la coordinación consultan un ciclo
- **THEN** el sistema muestra inscritos, retirados, porcentaje de asistencia a misa y a catequesis, aptos y sacramentos recibidos

### Requirement: RF-806 Calcular el porcentaje de asistencia

El sistema SHALL calcular el porcentaje de asistencia como presencias registradas sobre el total de niños activos en cada domingo con esa sesión.

#### Scenario: Porcentaje de un domingo

- **WHEN** el sistema calcula el porcentaje de asistencia a misa o a catequesis
- **THEN** usa las presencias registradas sobre el total de niños activos en cada domingo con esa sesión

### Requirement: RF-806 Indicar saldos desde papel

Donde el ciclo tenga saldos cargados desde papel (specs 006 y 007), el sistema SHALL indicarlo junto a los indicadores.

#### Scenario: Ciclo con saldo de papel

- **WHEN** el ciclo tiene saldos cargados desde papel
- **THEN** el sistema lo indica junto a los indicadores

### Requirement: RF-807 Reutilizar el perfil

Cuando un niño de un ciclo anterior se inscribe en un ciclo nuevo y su perfil no fue anonimizado, el sistema SHALL reutilizar su perfil y mostrar su historial previo.

#### Scenario: HU-804 Reinscribir sin volver a digitar

- **WHEN** un niño de un ciclo anterior se inscribe de nuevo y su perfil no fue anonimizado
- **THEN** el sistema reutiliza su perfil y muestra su historial previo

### Requirement: RF-807 Inscribir como perfil nuevo si fue anonimizado

Si su perfil ya fue anonimizado, el sistema SHALL inscribirlo como un perfil nuevo.

#### Scenario: Vuelve tres años después

- **WHEN** un niño vuelve y su perfil ya fue anonimizado
- **THEN** el sistema lo inscribe como un perfil nuevo

### Requirement: RF-808 Anonimizar a los dos años

Cuando se cumplen 2 años desde el cierre de un ciclo, el sistema SHALL anonimizar sus datos personales y eliminar sus evidencias, y conservar solo los indicadores y la constancia sacramental (spec 001, RF-108).

#### Scenario: HU-805 Depurar al vencer el plazo

- **WHEN** se cumplen 2 años desde el cierre de un ciclo
- **THEN** el sistema anonimiza los datos personales, elimina las evidencias y conserva los indicadores y la constancia

### Requirement: RNF-801 Sin mantenimiento

El cierre, la revocación de accesos y la depuración SHALL funcionar sin intervención técnica (R24).

#### Scenario: Cierre y depuración

- **WHEN** se cierra un ciclo, se revocan sus accesos o vence la retención
- **THEN** el sistema lo hace sin intervención técnica

### Requirement: RNF-802 Costo cero

Conservar el historial SHALL NOT generar costo; la evidencia fotográfica de ciclos cerrados se elimina con la retención (R23).

#### Scenario: Historial conservado

- **WHEN** el sistema conserva el historial de un ciclo
- **THEN** esa conservación no genera costo y la evidencia fotográfica se elimina al vencer la retención

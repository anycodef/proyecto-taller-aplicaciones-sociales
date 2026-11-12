# 017 - Evidencias de justificación solo en línea y comprimidas en el cliente

- Status: accepted
- Date: 2026-11-11
- Tags: privacidad offline justificaciones evidencias

## Contexto y problema

La spec 004 exige que la familia justifique ausencias con la foto de un comprobante. La evidencia puede revelar datos de salud del niño o de su familia, que nunca se guardan en el dispositivo (principio 7, RNF-101 de 001). RNF-404 prohíbe guardar la evidencia para enviarla después y RNF-402 exige que pese menos de 300 KB antes de enviarse. ADR 002 proponía diferir las cargas pesadas, como fotos, y el C4 original ubicaba la compresión en el backend. ADR 013 ya sustituyó la subida diferida de evidencias, pero no fijó cómo se envían ni dónde se comprimen.

## Opciones consideradas

- Cola local cifrada con reenvío al recuperar conexión: contradice RNF-404 y RNF-101.
- Subir la foto original y comprimirla en el servidor: la foto pesada ya consumió los datos móviles de la familia (RNF-402).
- Enviar solo en línea, comprimir en el cliente y subir directo a Blob privado con SAS de corta vigencia.

## Decisión

Se adopta la tercera opción (decisiones D-401, D-402, D-403 y D-410 del plan 004):

- El envío de una justificación y la revisión de la coordinación requieren conexión (RNF-404, RNF-405). Sin conexión, el cliente avisa que no se envió y no conserva la foto.
- El cliente redimensiona y recomprime cada foto a JPEG de menos de 300 KB con `expo-image-manipulator` antes de enviarla.
- La subida va directa a un contenedor Blob privado con SAS de usuario delegado, permiso solo de creación y 5 minutos de vigencia. Nunca pasa por WatermelonDB ni por ninguna cola.
- Los temporales nativos del picker y del manipulador se borran tras enviar o fallar.
- La lectura usa SAS de 5 minutos con `rscc=no-store` y `expo-image` con `cachePolicy="none"`, y queda auditada.
- Al celular del catequista baja solo el estado de la justificación, sin causa, motivo ni evidencia (D-408), para que la consulta de estado funcione sin conexión.

## Consecuencias

- La asistencia sigue siendo offline primero; esta excepción solo afecta al envío y la revisión de evidencias.
- Una familia sin señal debe reenviar la justificación al recuperar conexión.
- Las dependencias de cliente y de API quedan justificadas en la spec 004.
- Complementa ADR 013 y sustituye lo que ADR 002 decía sobre diferir fotos.

## Enlaces

- [Spec 004](../../specs/004-justificaciones/spec.md) y [plan 004](../../specs/004-justificaciones/plan.md)
- [ADR 002 sustituido](20260914-estrategia-de-sincronizacion-offline-first.md)
- [ADR 013](20261011-excepcion-administrativa-online-y-retencion.md)
- [Constitución](../constitution.md)

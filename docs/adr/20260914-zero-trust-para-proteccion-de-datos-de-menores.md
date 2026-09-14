# 005 - Implementación de Zero Trust Architecture (ZTA) para la Protección de Datos de Menores

- Status: accepted
- Date: 2026-09-14
- Tags: seguridad privacidad backend mobile

## Contexto y problema

El sistema gestionará información altamente sensible de menores de edad, incluyendo DNI, partidas de nacimiento, condiciones de salud y neurodivergencias. Los catequistas accederán a esta información utilizando sus dispositivos móviles personales conectados a redes no seguras (datos móviles compartidos, Wi-Fi público de la parroquia). Un modelo de seguridad perimetral tradicional es insuficiente, ya que asumir que un dispositivo "dentro de la app" es confiable representa un riesgo crítico de fuga de datos.

## Opciones consideradas

- Seguridad perimetral tradicional: una vez autenticado, el dispositivo se considera confiable
- Zero Trust Architecture: validar cada petición y minimizar lo que reside en el dispositivo

## Decisión

Se implementará un enfoque de Zero Trust Architecture (ZTA):

- Cada petición al backend serverless requerirá validación de un token JWT de corta duración, verificando el rol (Administrador, Catequista, Padre) antes de procesar cualquier acción.
- Los dispositivos de los catequistas tendrán acceso restringido. La base de datos local solo sincronizará la información estrictamente necesaria para la jornada (nombres, asistencia, avance de oraciones).
- La información médica y los documentos de identidad **no** se guardarán en el caché offline del teléfono; sólo podrán ser consultados mediante peticiones encriptadas en tiempo real y únicamente por usuarios con permisos explícitos.

### Consecuencias positivas

- Se garantiza la protección integral de los datos de los niños y se cumple con las normativas de privacidad.
- Si el celular de un catequista es robado, la exposición de información se limita a datos operativos de bajo riesgo, sin exponer documentos legales.
- Permite anonimizar la identidad de catequistas menores de edad a nivel de base de datos.

### Consecuencias negativas

- Incrementa la complejidad del backend al requerir validación estricta en cada endpoint.
- Los catequistas no podrán consultar las condiciones de salud de un niño si no tienen conexión a internet en ese momento exacto.

## Enlaces

- Acota a [002 - Estrategia de sincronización de datos Offline-First](20260914-estrategia-de-sincronizacion-offline-first.md): define qué datos pueden vivir en el caché local
- Endurece [004 - Arquitectura de Backend Serverless](20260914-arquitectura-de-backend-serverless.md)

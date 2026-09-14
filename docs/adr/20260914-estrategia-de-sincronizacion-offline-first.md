# 002 - Estrategia de sincronización de datos Offline-First

- Status: accepted
- Date: 2026-09-14
- Tags: mobile datos offline

## Contexto y problema

Uno de los requerimientos más críticos es la toma de asistencia en zonas parroquiales donde la señal de internet es baja o nula. Además, los catequistas comparten conexión de datos, por lo que el consumo debe ser mínimo. Si la aplicación depende de una conexión constante, el registro fallará masivamente los domingos.

## Opciones consideradas

- Lectura y escritura directas contra el servidor, dependiendo de conexión constante
- Arquitectura Offline-First con base de datos local y cola de sincronización

## Decisión

Implementar una arquitectura Offline-First. Toda lectura y escritura se realizará primero contra una base de datos local en el dispositivo (ej. SQLite / WatermelonDB). Se implementará una cola de sincronización (Sync Queue) en segundo plano que transmitirá los cambios al servidor únicamente cuando se detecte una conexión estable o se fuerce manualmente.

### Consecuencias positivas

- Garantiza la continuidad operativa total de los catequistas en ausencia de internet.
- El tiempo de digitación es instantáneo, minimizando la frustración y el consumo de datos móviles al diferir cargas pesadas (como fotos).

### Consecuencias negativas

- Introduce alta complejidad para manejar resolución de conflictos (ej. modificaciones simultáneas de un mismo registro por distintos usuarios sin conexión).
- La base de datos local debe estar estrictamente encriptada para proteger los datos de los menores.

## Enlaces

- Depende de [001 - Elección de React Native como framework Mobile-First](20260914-react-native-como-framework-mobile-first.md)
- Acotada por [005 - Implementación de Zero Trust Architecture (ZTA)](20260914-zero-trust-para-proteccion-de-datos-de-menores.md), que define qué datos pueden vivir en el caché local

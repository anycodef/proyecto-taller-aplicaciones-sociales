# 001 - Elección de React Native como framework Mobile-First

- Status: accepted
- Date: 2026-09-14
- Tags: frontend mobile

## Contexto y problema

El sistema requiere priorizar el uso en dispositivos móviles para que los catequistas puedan tomar asistencia y gestionar el avance formativo directamente en las parroquias. Se evaluó la posibilidad de hacer una aplicación web responsiva (PWA), pero el requerimiento de uso intensivo de la cámara (para comprobantes fotográficos), el almacenamiento local seguro y la necesidad de una experiencia nativa fluida inclinan la balanza hacia una aplicación móvil dedicada. Se cuenta con recursos limitados, por lo que desarrollar dos bases de código nativas (iOS y Android) es inviable.

## Opciones consideradas

- Aplicación web progresiva (PWA) responsiva
- Dos bases de código nativas independientes (iOS y Android)
- Aplicación móvil multiplataforma con React Native

## Decisión

Se desarrollará una aplicación móvil multiplataforma utilizando React Native.

### Consecuencias positivas

- Permite unificar el desarrollo para iOS y Android bajo una misma base de código en JavaScript/TypeScript, aprovechando un ecosistema extenso de librerías.
- Facilita la integración nativa con el hardware del dispositivo (cámara para evidencias, almacenamiento para modo offline).

### Consecuencias negativas

- Las aplicaciones en React Native suelen tener un peso final (bundle) ligeramente mayor.
- Se requiere manejar cuidadosamente el "puente" (bridge) al procesar las fotografías de los comprobantes para no bloquear la interfaz de usuario.

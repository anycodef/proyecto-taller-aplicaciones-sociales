# 007 - Adopción de Claude Code como Herramienta IA para Acelerar la Generación de Código Crítico

- Status: accepted
- Date: 2026-09-14
- Tags: herramientas proceso

## Contexto y problema

El equipo de desarrollo cuenta con tiempo limitado debido al cronograma del curso. Implementar una arquitectura robusta que combina React Native, una base de datos local con sincronización de conflictos y un backend Serverless desde cero requiere escribir una gran cantidad de código con estructuras repetitivas, configuraciones de infraestructura como código y esquemas de bases de datos.

## Opciones consideradas

- Escribir manualmente todo el código repetitivo y de infraestructura
- Integrar Claude Code como asistente principal de desarrollo, con revisión humana obligatoria

## Decisión

Se integrará Claude Code directamente en el flujo de trabajo del equipo como asistente principal de desarrollo, en tres frentes concretos:

- Generar la infraestructura como código (IaC) para desplegar los servicios Serverless de costo cero.
- Escribir las migraciones de la base de datos y los esquemas locales para SQLite/WatermelonDB.
- Modelar la lógica inicial del algoritmo de detección temprana de deserción basado en reglas (procesando las inasistencias y la falta de entrega de oraciones).

Todo código generado por Claude Code pasará por una revisión de código estricta por al menos dos miembros del equipo antes de ser fusionado, garantizando que el equipo mantenga el control sobre la arquitectura.

### Consecuencias positivas

- Acelera drásticamente la velocidad de desarrollo del MVP, permitiendo al equipo enfocarse en la lógica de negocio y las pruebas de usabilidad con la parroquia en lugar de pelear con configuraciones de infraestructura.
- Reduce los errores humanos al estructurar las colas de sincronización offline, un patrón que la IA maneja eficientemente basándose en buenas prácticas consolidadas.

### Consecuencias negativas

- El equipo podría aceptar implementaciones complejas, como la sincronización de datos o las reglas de Zero Trust, sin entender completamente cómo funcionan por detrás. De ahí la regla de revisión obligatoria por dos miembros.

## Enlaces

- Aplica sobre [002 - Estrategia de sincronización de datos Offline-First](20260914-estrategia-de-sincronizacion-offline-first.md) y [005 - Implementación de Zero Trust Architecture (ZTA)](20260914-zero-trust-para-proteccion-de-datos-de-menores.md)

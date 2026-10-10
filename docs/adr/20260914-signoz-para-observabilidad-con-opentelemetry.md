# 003 - Adopción de SigNoz para Observabilidad basada en OpenTelemetry

- Status: rejected
- Date: 2026-09-14
- Tags: backend observabilidad operaciones

## Contexto y problema

Para asegurar que la aplicación responda adecuadamente durante los picos de uso dominicales, se necesita una plataforma de monitoreo de rendimiento y logs. Herramientas comerciales exceden el requisito de "costo cero".

## Opciones consideradas

- Plataformas comerciales de observabilidad en modalidad SaaS
- SigNoz, Open Source y auto-alojado, sobre el estándar OpenTelemetry

## Decisión

Se **rechaza** la adopción de SigNoz y OpenTelemetry debido a que representan una sobreingeniería innecesaria y una carga de mantenimiento insostenible para un sistema de ámbito parroquial y bajo consumo (SIGECAT) que prioriza el principio de menor fricción operativa.

### Consecuencias positivas

- Se evita añadir complejidad de infraestructura y costos ocultos de mantenimiento.
- Se mantiene el foco del equipo en el desarrollo de la funcionalidad central de asistencia offline.

### Consecuencias negativas

- Al no contar con una plataforma centralizada de trazas distribuidas, si ocurre un fallo intermitente o un problema de rendimiento durante la sincronización dominical, el diagnóstico dependerá enteramente de los logs básicos y dispersos de la plataforma, lo que puede dificultar la identificación de la causa raíz.

## Enlaces

- Instrumenta el backend definido en [004 - Arquitectura de Backend Serverless](20260914-arquitectura-de-backend-serverless.md)

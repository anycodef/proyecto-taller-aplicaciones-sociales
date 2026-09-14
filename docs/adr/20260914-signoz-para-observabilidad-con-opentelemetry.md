# 003 - Adopción de SigNoz para Observabilidad basada en OpenTelemetry

- Status: accepted
- Date: 2026-09-14
- Tags: backend observabilidad operaciones

## Contexto y problema

Para asegurar que la aplicación responda adecuadamente durante los picos de uso dominicales, se necesita una plataforma de monitoreo de rendimiento y logs. Herramientas comerciales exceden el requisito de "costo cero".

## Opciones consideradas

- Plataformas comerciales de observabilidad en modalidad SaaS
- SigNoz, Open Source y auto-alojado, sobre el estándar OpenTelemetry

## Decisión

Se utilizará SigNoz como plataforma de observabilidad, estandarizando la recolección de métricas, trazas y logs del backend y la base de datos utilizando el estándar OpenTelemetry.

### Consecuencias positivas

- Es Open Source, reduce costos de infraestructura y evita el vendor lock-in gracias a OpenTelemetry.
- Permite rastrear de extremo a extremo los picos de peticiones los domingos.

### Consecuencias negativas

- Al ser auto-alojado en una capa gratuita, añade una ligera sobrecarga de configuración inicial y mantenimiento en comparación con un SaaS totalmente gestionado.

## Enlaces

- Instrumenta el backend definido en [004 - Arquitectura de Backend Serverless](20260914-arquitectura-de-backend-serverless.md)

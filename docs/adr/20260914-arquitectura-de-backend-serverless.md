# 004 - Arquitectura de Backend Serverless (Framework y Lenguaje Pendiente)

- Status: proposed
- Date: 2026-09-14
- Tags: backend infraestructura

## Contexto y problema

El sistema presenta un patrón de tráfico altamente asimétrico: picos extremos de concurrencia los domingos por la mañana y uso cercano a cero el resto de la semana. Mantener un servidor tradicional encendido 24/7 generaría costos operativos. Se necesita un backend capaz de comunicarse eficientemente con PostgreSQL y cumplir con las restricciones de "costo cero" y "cero administración", pero la tecnología base dependerá de la familiaridad y consenso del equipo de desarrollo (evaluando opciones como el ecosistema Node.js/TypeScript).

## Opciones consideradas

- Servidor tradicional encendido 24/7
- Modelo de despliegue Serverless en capas gratuitas (ej. AWS Lambda, Azure Functions o similares)

## Decisión

Se adoptará un modelo de despliegue Serverless (ej. AWS Lambda, Azure Functions o similares en capas gratuitas) para el backend. La elección específica del lenguaje y framework queda diferida hasta que el equipo evalúe su curva de aprendizaje y el soporte de las librerías ORM para conectarse a PostgreSQL.

Este ADR queda en estado **propuesto**: el modelo de despliegue está decidido, pero la definición técnica concreta (lenguaje, framework y proveedor) sigue pendiente de consenso del equipo.

### Consecuencias positivas

- El modelo Serverless cobra únicamente por tiempo de ejecución; de lunes a sábado el costo será virtualmente cero.
- Escalará de 0 a las instancias necesarias automáticamente durante los picos dominicales sin intervención humana.

### Consecuencias negativas

- Obliga a que la arquitectura elegida sea estrictamente sin estado (stateless).
- El equipo deberá seleccionar un framework que minimice los tiempos de "arranque en frío" (Cold Starts), un factor crítico en arquitecturas Serverless, especialmente si se opta por ecosistemas pesados.

## Enlaces

- Recibe las escrituras diferidas de [002 - Estrategia de sincronización de datos Offline-First](20260914-estrategia-de-sincronizacion-offline-first.md)
- Observado mediante [003 - Adopción de SigNoz](20260914-signoz-para-observabilidad-con-opentelemetry.md)
- Endurecido por [005 - Implementación de Zero Trust Architecture (ZTA)](20260914-zero-trust-para-proteccion-de-datos-de-menores.md)

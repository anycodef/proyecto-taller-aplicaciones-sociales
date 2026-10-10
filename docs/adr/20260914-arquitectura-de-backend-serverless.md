# 004 - Arquitectura de Backend Serverless (Node.js y Azure Functions v4)

- Status: accepted
- Date: 2026-09-14
- Tags: backend infraestructura

## Contexto y problema

El sistema presenta un patrón de tráfico altamente asimétrico: picos extremos de concurrencia los domingos por la mañana y uso cercano a cero el resto de la semana. Mantener un servidor tradicional encendido 24/7 generaría costos operativos. Se necesita un backend capaz de comunicarse eficientemente con PostgreSQL y cumplir con las restricciones de "costo cero" y "cero administración".

## Opciones consideradas

- Servidor tradicional encendido 24/7 (ej. Azure App Service, contenedores dedicados)
- AWS Lambda con Node.js / TypeScript
- Azure Functions v4 con Node.js / TypeScript

## Decisión

Se adopta Azure Functions v4 sobre el runtime de Node.js (con soporte para TypeScript) bajo el plan de consumo serverless.

Esta elección responde a la familiaridad técnica del equipo con el ecosistema JavaScript/Node.js, la madurez del modelo de programación v4 de Azure Functions (que simplifica la definición de triggers y bindings vía código en lugar de archivos function.json), y la integración fluida con PostgreSQL mediante librerías del ecosistema (como Prisma).

### Consecuencias positivas

- El modelo de consumo factura únicamente por ejecución y recursos consumidos; el tráfico residual de lunes a sábado opera dentro del tier gratuito o con costo cercano a cero.
- El equipo aprovecha el conocimiento previo en Node.js/TypeScript, acelerando el tiempo de entrega y simplificando el tipado de contratos de datos.
- Sin necesidad de parches del sistema operativo, gestión de clusters ni aprovisionamiento de máquinas virtuales.


### Consecuencias negativas

- Las invocaciones iniciales tras periodos prolongados de inactividad experimentan latencia adicional. Se requiere optimizar el empaquetado del bundle (ej. vía bundlers ligeros o esbuild) y evitar inicializaciones pesadas fuera de los handlers.

## Enlaces

- Recibe las escrituras diferidas de [002 - Estrategia de sincronización de datos Offline-First](20260914-estrategia-de-sincronizacion-offline-first.md)
- Endurecido por [005 - Implementación de Zero Trust Architecture (ZTA)](20260914-zero-trust-para-proteccion-de-datos-de-menores.md)

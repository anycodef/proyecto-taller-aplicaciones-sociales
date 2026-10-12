# 014 - Configuración acotada de servidores Azure Flex

- Status: accepted
- Date: 2026-10-11
- Tags: azure infraestructura limites backend

## Contexto y problema

D-111 de 001 proponía 10 instancias/pool3; D-314 de 003, 5/pool4. Flex escala por grupo, no con un único total de instancias. Límites por cuenta no pueden depender de memoria de instancia ni de APIM Consumo.

## Opciones consideradas

- Consumo Linux heredado o Premium: modelo anterior o costo fijo.
- Pool4/tope global supuesto: estimación incorrecta de conexiones.
- Flex Linux Node22, pool y concurrencia explícitos, límites distribuidos PostgreSQL.

## Decisión

Functions v4 Flex Consumption, Linux, Node22; pool `pg` **3 por proceso**, **1 worker**, máximo **5 instancias por grupo**, **HTTP concurrency 10**, **2048 MB**, **always-ready 0**. SQL puro `pg`, sin ORM. PostgreSQL Flexible16 B1ms, TLS, Key Vault/identidad administrada y despliegue OIDC según 001. APIM global por producto/cliente; límites por cuenta/operación/ventana en Functions con incremento atómico PostgreSQL y respuesta 429.

Timers NCRONTAB UTC (Flex no soporta `WEBSITE_TIME_ZONE`/`TZ`): generación `0 0 8 * * 1`; precalentamiento `0 */5 12-16 * * 0`; retención `0 0 8 * * *`; blobs `0 */15 * * * *`; purga auditoría `0 0 9 1 * *`. Lima UTC−5. Timer se ejecuta en grupo propio: su consulta no garantiza calentar HTTP.

## Evidencia documental y pendientes de despliegue

Microsoft Learn, consultado 2026-10-11, documento actualizado 2026-09-30: el menor **máximo de escalado** admitido es **1**, hasta 1000. Por tanto 5 no está bloqueado por un supuesto mínimo 40/100. Es distinto de always-ready, fijado en 0. La documentación confirma que el máximo se aplica **a cada grupo**, y timers escalan individualmente. No acredita que nuestros recursos estén desplegados.

Inventariar grupos activos y conexiones auxiliares: `3 × 1 × 5 = 15` por grupo, **no total global**. Verificar cuota educativa/región, presupuesto, conexiones efectivas y carga de 50 clientes antes de declarar RNF-303 cumplido. No prometer costo cero medido con estimaciones gratuitas.

## Consecuencias y sustitución

Sustituye ADR 004 concretando Consumo en Flex, límites y SQL sin ORM; conserva serverless v4. Refina persistencia del ADR 010 mediante ADR 013. Application Insights es la decisión del plan aceptado para este backend; su captura sin cuerpos/costo requiere verificación y no constituye evidencia de despliegue SigNoz.

## Enlaces

- [Azure Flex Consumption (fuente 2026)](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan)
- [ADR 004 sustituido](20260914-arquitectura-de-backend-serverless.md)
- [Plan 001 D-111](../../specs/001-acceso-y-roles/plan.md)
- [Plan 003 D-314](../../specs/003-asistencia-dominical/plan.md)

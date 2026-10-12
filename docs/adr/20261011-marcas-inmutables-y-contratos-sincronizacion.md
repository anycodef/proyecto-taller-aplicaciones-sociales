# 012 - Marcas inmutables y contratos explícitos de sincronización

- Status: superseded by 20261011-transporte-nativo-watermelondb
- Date: 2026-10-11
- Tags: offline datos contratos backend

## Contexto y problema

RF-307–RF-309 necesitan reenvíos sin duplicación, ambos registradores y correcciones trazables. Los planes divergían entre nombres SQL/locales y QR. La integración con 004–008 debe respetar módulos.

## Opciones consideradas

- Registro mutable con último escritor ganador: pierde registradores/traza.
- Resolución en cada cliente: resultados inconsistentes ante pushes concurrentes.
- Marcas/correcciones nuevas, consolidación única servidor y protocolo WatermelonDB adaptado.

## Decisión

Marcas y correcciones inmutables, UUID cliente, consolidado por sesión/niño con bloqueo transaccional e idempotencia. Corrección aceptada más reciente manda; sin corrección, presente gana, conflicto preserva registradores y genera aviso. Ausencias/faltas se calculan con periodos de inscripción/asignación de `FuenteInscripciones`; no materializar faltas ni reemplazar historial por grupo actual.

HTTP usa campos camelCase español; SQL tablas singulares/columnas snake_case; colecciones sincronizadas plurales y filas snake_case. El adaptador cliente convierte envoltorio HTTP a claves nativas WatermelonDB (`changes`, `timestamp`, `experimentalStrategy`, `created`, `updated`, `deleted`), sin renombrar columnas de fila. Contrato estable en la guía frontend. QR **solo** `SGC1:<uuid>:<emision>`; `emision` física en `carne_emision`, `codigo_carne` derivado local. UUID suelto se rechaza.

Rechazos de negocio vuelven como filas rechazadas/avisos; no bloquean un lote válido. Cambios de alcance exigen reemplazo de datos ya ajenos conservando pendientes propios según sesión. Datos restringidos nunca se sincronizan. Retención excepcional exige rol y contexto de transacción (ADR 013).

## Consecuencias

`resumenAsistencia` alimenta perfil 002. `evento_asistencia` durable sirve a consumidores con cursor/idempotencia; puerto síncrono 004 para efecto en la misma transacción, sin duplicar efectos al consumir evento. Puertos/falsos no acreditan módulos externos completos. Prueba JSI/QR y mediciones físicas quedan pendientes. Cifrado local se conserva como verificación de implementación del ADR 002; no se declara resuelto por minimización.

## Enlaces

- Refina la sincronización del [ADR 002 histórico](20260914-estrategia-de-sincronizacion-offline-first.md), sustituido en su política universal por ADR 013.
- [Plan 003](../../specs/003-asistencia-dominical/plan.md)
- [Guía de contratos](../backend-contratos.md)

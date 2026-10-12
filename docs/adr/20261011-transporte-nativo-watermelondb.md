# 015 - Conservar el transporte nativo WatermelonDB en HTTP

- Status: accepted
- Date: 2026-10-11
- Tags: contratos offline sincronizacion

## Contexto y problema

El ADR 012 exigía traducir el envoltorio HTTP español antes de usar WatermelonDB. La decisión final del usuario conserva la interfaz necesaria del protocolo nativo y exige que OpenAPI documente los DTO reales.

## Opciones consideradas

- Traducción obligatoria `cambios`/`marcaTiempo` y conjuntos españoles: capa adicional y contrato divergente del motor.
- Claves nativas como excepción explícita de transporte, dejando adaptadores españoles internos opcionales.

## Decisión

Se adopta la segunda opción. Pull HTTP devuelve `{ changes, timestamp, experimentalStrategy?, huellaAlcance }`; push recibe `{ changes }`; conjuntos `{ created, updated, deleted }`. Colecciones plurales y filas snake_case. Query y resúmenes propios conservan nombres españoles (`ultimoPulso`, `versionEsquema`, `huellaAlcance`, `migracion`, `aceptados`, `rechazados`, `descartadosCierre`). No exigir ni simular traducción del envoltorio. DTO estrictos de cada colección en OpenAPI, tomados de handlers/validación actuales. Adaptadores españoles dentro del dominio son opcionales.

## Consecuencias y sustitución

Sustituye ADR 012 en la frontera de transporte obligatoria; conserva sus decisiones de marcas inmutables, QR SGC1, SQL singular, consolidación y puertos. Su texto histórico no se reescribe: solo cambia estado. Ninguna excepción permite datos restringidos locales, campos administrativos en push ni PIN servidor. Verificador Node compara rutas registradas, refs, schemas/ejemplos/configuración; no acredita UI, campo ni despliegue.

## Enlaces

- [ADR 012 sustituido](20261011-marcas-inmutables-y-contratos-sincronizacion.md)
- [Guía frontend](../backend-contratos.md)
- [Plan 003](../../specs/003-asistencia-dominical/plan.md)
- [OpenAPI actual](../../api/openapi.json)

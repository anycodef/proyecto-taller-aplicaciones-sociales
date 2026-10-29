# Contrato MCP de SIGECAT (spec 009, RF-909). CONGELADO.

Transporte: stdio. Token en la variable de entorno `SIGECAT_TOKEN`. Entradas validadas con `zod`. Todas las respuestas son texto JSON corto (pensado para gastar pocos tokens del agente): nunca devuelven el esquema completo ni listas sin paginar.

## Herramientas

| Nombre | Tipo | Entrada | Detrás de | Anotaciones |
| --- | --- | --- | --- | --- |
| `listar_riesgo_grupo` | lectura | `grupoId`, `nivelMinimo?` (`MEDIO` por defecto) | GraphQL `riesgoDelGrupo` | `readOnlyHint: true` |
| `consultar_catequizando` | lectura | `catequizandoId`, `incluirAsistencias?` (bool) | GraphQL `catequizando` (pide solo los campos necesarios) | `readOnlyHint: true` |
| `resumen_asistencia_domingo` | lectura | `grupoId`, `fecha` | GraphQL `asistenciaDelDomingo` | `readOnlyHint: true` |
| `registrar_asistencia` | escritura | `catequizandoId`, `fecha`, `estado` (el servidor genera el UUID y lo devuelve) | GraphQL `registrarAsistencia` → gRPC | `destructiveHint: false`, `idempotentHint: true` |
| `registrar_justificacion` | escritura | `asistenciaId`, `motivo` | GraphQL `registrarJustificacion` → gRPC | `destructiveHint: false`, `idempotentHint: true` |
| `recalcular_riesgo` | escritura | `catequizandoId` | GraphQL `recalcularRiesgo` → gRPC | `destructiveHint: false`, `idempotentHint: true` |

No existe ninguna herramienta que borre ni que lea salud, neurodivergencia o documentos (RF-907).

## Recursos

- `sigecat://grupo/{grupoId}/riesgo` — lista de riesgo actual del grupo (solo lectura).

## Prompts

- `revision-dominical` (argumento `grupoId`) — plantilla: «Revisa la asistencia del último domingo del grupo, lista a quienes están en riesgo MEDIO o ALTO y propón a quién contactar primero».

## Errores

Una violación de rol o alcance devuelve `isError: true` con `{"codigo":"fuera_de_alcance"}`; nunca el detalle interno.

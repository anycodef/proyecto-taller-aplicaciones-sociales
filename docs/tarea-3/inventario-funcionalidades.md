# Inventario de funcionalidades candidatas (T009-11)

Fuente: `specs/001` a `specs/008`, tabla de requerimientos de origen `R1`–`R27`
(`specs/README.md`), `docs/constitution.md` y los contratos congelados de
`tarea3/contratos/`. No se inventan funcionalidades: cada fila apunta a un
requisito funcional (RF) existente.

El inventario separa **dónde ocurre la operación** porque ese contexto decide el
protocolo: el celular offline, un panel de coordinación con conexión, o una
llamada interna entre servicios.

| Id | Funcionalidad | Spec / RF | R | Tipo | Contexto real | ¿Candidata a GraphQL/gRPC? |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | Ficha consolidada del catequizando (datos, grupo, resumen de asistencia, justificaciones y avance) | 002 RF-201, RF-203, RF-207 | R1, R3, R15 | Consulta | Celular (perfil ya sincronizado) y panel de coordinación | Sí, en el panel; no en el almacén local |
| F-02 | Inscripción, correcciones y estados documentales | 002 RF-202, RF-203, RF-204; 001 RF-101, RF-102, RF-106 | R1, R2, R3, R21, R26 | Actualización | Solo online; administrativa | Sí, para evaluar; el flujo actual ya es REST/JSON |
| F-03 | Lista de asistencia a catequesis del domingo (todos presentes y se desmarcan ausentes) | 003 RF-306, RF-307, RF-311 | R4, R6, R19, R20, R22, R27 | Actualización | Celular sin señal; sincronización diferida | No en la app; sí como lote interno de demostración |
| F-04 | Escaneo de carné QR en misa y registro manual de respaldo | 003 RF-302, RF-303, RF-304, RF-307 | R4, R5, R6, R18, R19, R20, R27 | Actualización | Celular sin señal; confirmación en menos de 1 s | No en la app; sí como lote interno de demostración |
| F-05 | Observación en vivo de la asistencia de un grupo (coordinación) | 003 RF-308, RF-310, RF-312; 009 RF-903 | R5, R15, R22 | Consulta en streaming | Panel de coordinación con conexión | Sí: gRPC server streaming |
| F-06 | Justificación de ausencia con foto del comprobante | 004 RF-402, RF-403, RF-404, RF-407 | R7, R8, R9, R20, R26 | Actualización con archivo | Enlace web familiar con conexión; la evidencia nunca se guarda en el celular | No: REST actual + Blob + URL firmada |
| F-07 | Bandeja de revisión de justificaciones (aprobar/rechazar) | 004 RF-408, RF-409, RF-410 | R7, R8, R15, R26 | Consulta y actualización | Panel de coordinación con conexión | Consulta sí (GraphQL); decisión no (REST actual) |
| F-08 | Evaluación de oraciones para todo un grupo en una lista | 005 RF-502, RF-506 | R10, R19, R27 | Actualización por lote | Celular sin señal | No en la app; sí como lote interno de demostración |
| F-09 | Avance formativo: oraciones, doctrina y pendientes por niño | 005 RF-502, RF-503, RF-505 | R10, R11, R15, R20, R27 | Consulta | Celular (datos sincronizados) y panel | Sí, en el panel; no en el almacén local |
| F-10 | Actividades obligatorias y su cumplimiento | 005 RF-504; 003 RF-313 | R12, R19 | Actualización | Celular sin señal, reutilizando la asistencia | No en la app |
| F-11 | Tablero de riesgo de deserción por grupo y por paso del proceso | 007 RF-701 a RF-708 | R14, R15, R20, R27 | Consulta | Panel de coordinación y celular del catequista | Sí: GraphQL |
| F-12 | Recalcular el riesgo de un catequizando | 007 RF-701, RF-702; 009 RF-908 | R14, R22 | Actualización interna | Servicio a servicio, sin interfaz | Sí: gRPC |
| F-13 | Tablero de aptitud sacramental (tres dimensiones y propuesta) | 006 RF-602, RF-603, RF-606 | R13, R15, R20, R26 | Consulta | Panel de coordinación y supervisión | Sí: GraphQL |
| F-14 | Decisión final de aptitud con motivo y traza | 006 RF-604 | R13, R26 | Actualización | Solo coordinación o delegado, online | No: REST actual |
| F-15 | Historial de ciclos e indicadores institucionales | 008 RF-801, RF-806 | R17, R20, R23 | Consulta | Panel de supervisión y coordinación | Sí: GraphQL |
| F-16 | Constancia sacramental y búsqueda restringida | 008 RF-804, RF-805 | R17, R26 | Consulta y actualización | Coordinación y administración, online | No: REST actual con auditoría |
| F-17 | Enlaces de familia, enlaces del equipo y delegaciones | 001 RF-104, RF-110, RF-111 | R16, R21, R26 | Actualización | Solo online; credenciales y permisos | No: REST actual |
| F-18 | Auditoría de acceso a datos restringidos | 001 RF-109 | R25, R26 | Consulta restringida | Administración y supervisión | No: REST actual de solo lectura/exportación |
| F-19 | Sincronización offline pull/push de WatermelonDB | 003 RF-307; ADR 013 y 015 | R19, R20, R22 | Consulta y actualización por lote | Celular; protocolo fijo del motor local | No: REST actual es el transporte del motor |
| F-20 | Retención y anonimización al cerrar ciclo | 001 RF-106, RF-108; 008 RF-808 | R17, R23, R26 | Proceso por lote | Temporizador del backend, sin interfaz | No: proceso interno, no API |

## Lectura del inventario

1. **La app móvil no es el lugar para GraphQL ni gRPC.** F-03, F-04, F-08, F-10
   y F-19 nacen offline y usan el contrato pull/push de WatermelonDB (ADR 015).
   Cambiar ese transporte rompe la promesa de la constitución 5 y los límites de
   datos de R19 y R20.
2. **Los paneles de coordinación y supervisión sí ganan con GraphQL.** F-01,
   F-07, F-09, F-11, F-13 y F-15 muestran campos distintos según el rol y el
   momento; pedir solo lo necesario reduce datos móviles (R20) y digitación
   (R27) sin tocar el motor offline.
3. **gRPC encaja servicio a servicio, no en el borde móvil.** F-05, F-12 y los
   lotes de F-03/F-04/F-08 son llamadas internas tipadas, idempotentes o en
   streaming; Azure Functions no ejecuta gRPC nativo y React Native/Expo no lo
   soporta directamente, así que su uso se limita a la demo local o a un futuro
   contenedor interno.
4. **MCP no es una funcionalidad del producto.** Es una fachada para que un
   agente de IA use F-01, F-05, F-11 y F-12 con herramientas acotadas; se evalúa
   en `decision-agente-mcp.md`, no como reemplazo de la API.

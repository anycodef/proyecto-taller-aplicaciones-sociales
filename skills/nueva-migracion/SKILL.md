---
name: nueva-migracion
description: Guia la creacion de migraciones SQL de SIGECAT; usar al agregar una migracion en api/migraciones, nunca para editar una ya aplicada.
---

# Nueva migración

1. Leer constitución, spec, plan y tarea activa. Cambios de modelo necesitan spec aprobada antes del código.
2. Elegir `api/migraciones/SSNN_descripcion.sql`: `SS` = spec 00–08, `NN` correlativo libre. Usar nombres singulares snake_case, español sin tildes ni ñ. No renumerar lo aplicado.
3. Referenciar solo tablas propias o de bloques menores. La FK a un bloque mayor se agrega en una migración de ese bloque. `0002_ciclo_base` es transversal y precede las tablas operativas.
4. Objetos propiedad de `sigecat_migrador`, nunca de `sigecat_api`. Declarar GRANT explícito por tabla/función y mínimo privilegio. Identidad real no recibe SELECT directo. Auditoría e historial son solo inserción; retención exige rol NOLOGIN y contexto SET LOCAL, en la misma transacción.
5. Registro nuevo: UUID cliente cuando nace en app; no sustituirlo por autoincremento. No agregar datos restringidos a proyecciones sincronizadas.
6. El runner conserva SHA-256 en `esquema_migracion`: jamás editar ni eliminar una migración aplicada. Agregar otra migración correctiva. Ejecutar el verificador contra `origin/main` y probar desde cero y actualización, incluyendo rollback, GRANT y restricciones.
7. Usar `verificacion`; cada test cita RF/RNF. Registrar evidencia real en Agent Trace enlazada a TNNN-NN. No marcar tarea completa sin checks o despliegue requerido.

Producción: migrar con `sigecat_migrador` vía workflow OIDC/prod, TLS `verify-full` y firewall temporal retirado incluso si falla. La contraseña administrativa solo prepara roles, nunca configura Functions.

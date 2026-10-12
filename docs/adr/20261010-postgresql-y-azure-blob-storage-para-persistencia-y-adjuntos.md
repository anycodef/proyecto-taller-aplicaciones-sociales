# 010 - Adopción de PostgreSQL para datos estructurados y Azure Blob Storage para almacenamiento de archivos y justificaciones

- Status: superseded by 20261011-excepcion-administrativa-online-y-retencion
- Date: 2026-10-10
- Tags: base-de-datos persistencia backend cloud arquitectura

## Contexto y problema

SIGECAT (Sistema Integrado de Gestión y Seguimiento Catequético Parroquial) administra información estructurada (inscripciones de catequizandos, sacramentos cursados, asistencias por sesión, justificaciones y usuarios catequistas) y elementos multimedia de soporte (fotografías de constancias de bautismo, recetas médicas y comprobantes de justificación de inasistencia).

Dado que la aplicación móvil opera bajo un modelo *offline-first* (con base de datos local SQLite/WatermelonDB), se requiere definir la persistencia del lado del servidor para:
1. Almacenar y sincronizar el estado transaccional y relacional de las parroquias y capillas.
2. Custodiar los documentos digitales y fotos adjuntas sin degradar el rendimiento de la base de datos transaccional ni disparar costos de almacenamiento en servidores backend serverless.

## Opciones consideradas

- **Base de datos documental (MongoDB / Cosmos DB) para datos y archivos (GridFS/Base64):** Flexibilidad de esquema, pero manejo ineficiente de imágenes pesadas y complejidad en restricciones de integridad referencial requeridas para el avance sacramental.
- **PostgreSQL con almacenamiento de fotos en campos BLOB (Bytea):** Centraliza todo en un único servicio, pero incrementa drásticamente el tamaño del backup (`pg_dump`), satura la memoria de la base de datos y eleva los costos de cómputo/I/O.
- **Arquitectura híbrida: PostgreSQL para datos relacionales + Azure Blob Storage para archivos binarios (fotos y documentos):** Desacopla la persistencia estructurada del almacenamiento no estructurado de gran tamaño.

## Decisión

Se adopta una **arquitectura híbrida**:

1. **PostgreSQL como Base de Datos Relacional Central:**
   - Actuará como la fuente única de verdad para la metadata del sistema: catequizandos, sacramentos, sesiones de catequesis, historial de asistencia y registros de auditoría.
   - Soportará las colas de sincronización provenientes de los dispositivos móviles (WatermelonDB/SQLite) y garantizará la integridad referencial y consistencia de las etapas sacramentales.

2. **Azure Blob Storage para Archivos No Estructurados:**
   - Se utilizará un contenedor privado de Azure Blob Storage para almacenar fotografías de justificaciones de inasistencia y documentación de respaldo (partidas de bautismo, constancias).
   - En PostgreSQL únicamente se registrará la referencia (URI/identificador único del blob) y los metadatos asociados (tipo de archivo, tamaño, timestamp y hash de integridad).
   - El acceso a las imágenes desde la app móvil se gestionará mediante **Shared Access Signatures (SAS Tokens)** temporales de lectura generados por el backend, manteniendo el cumplimiento de las políticas de Zero Trust y privacidad de datos de menores.

### Consecuencias positivas

- El tamaño del catálogo y las copias de seguridad de PostgreSQL se mantienen compactos y rápidos al no almacenar binarios en tablas.
- Azure Blob Storage ofrece almacenamiento altamente eficiente en costos (Hot/Cool tiers) para adjuntos que rara vez se modifican tras su subida.
- El uso de SAS tokens con tiempo de expiración corto evita exponer URLs públicas permanentes de fotos de documentos o menores.
- Los registros de justificación pueden sincronizarse primero en texto/relación, y la subida en segundo plano de la foto hacia Azure puede gestionarse en colas desacopladas cuando haya conexión estable.

### Consecuencias negativas

- Si falla la subida del archivo o la inserción de la tupla en PostgreSQL, se pueden generar blobs huérfanos; se requerirá un proceso periódico de limpieza (reconciliation job).
- Se requiere gestionar credenciales y políticas de acceso tanto para la base de datos como para la cuenta de almacenamiento en Azure.

## Enlaces

- Aplica sobre [002 - Estrategia de sincronización de datos Offline-First](20260914-estrategia-de-sincronizacion-offline-first.md)
- Aplica sobre [005 - Implementación de Zero Trust Architecture (ZTA)](20260914-zero-trust-para-proteccion-de-datos-de-menores.md)
- Aplica sobre [004 - Arquitectura de Backend Serverless (Node.js y Azure Functions v4)](20260914-arquitectura-de-backend-serverless.md)

# 013 - Excepción administrativa ONLINE y retención coordinada

- Status: accepted
- Date: 2026-10-11
- Tags: privacidad offline retencion

## Contexto y problema

El principio 5 anterior y ADR 002 exigían toda escritura local; RF-202 y RNF-101 prohíben inscripción offline y datos restringidos en dispositivo. ADR 010 proponía documentos de inscripción en Blob y fotos diferidas, contradictorios con RF-204 y RNF-101. El usuario aprueba corregir constitución/docs/specs el 2026-10-11.

## Opciones consideradas

- Encolar toda administración: expone datos restringidos y no valida consentimiento/duplicados atómicamente.
- Hacer toda operación online: impide asistencia sin señal.
- Separar escrituras operativas offline y administrativas exclusivamente ONLINE.

## Decisión

Se adopta la tercera opción y se actualiza principio 5. Inscripción/correcciones, grupos/asignaciones administrativas, apoderados, cuentas, roles, enlaces, delegación, consentimiento y condiciones usan HTTP síncrono, borradores solo en memoria, **nunca base local ni cola**. Sesiones operativas y correcciones de asistencia de 003 mantienen su sincronización local. Condiciones/documentos/evidencias nunca se persisten localmente. RF-204 solo registra estados: no hay upload, SAS, fotos, copias ni DNI de inscripción. Blob privado se destina a evidencias autorizadas de 004; su módulo no se da por completo.

Retiro borra condiciones, estados documentales, historial personal y evidencias; cierra vigencias/vínculos e invalida carné; anonimiza perfil y lo excluye como inactivo de operación; elimina/anonimiza apoderado solo sin otros hijos vinculados. Conserva asistencia anonimizada y constancia sacramental. Motor 001 ejecuta participantes con una única transacción y **ambos** `SET LOCAL ROLE sigecat_retencion` y `SET LOCAL sigecat.contexto` (`retiro_consentimiento` o `retencion`), incluidos ciclos cerrados. Contexto no se toma de HTTP. Blobs se encolan transaccionalmente y borran después del commit con reintentos idempotentes. Vencimiento no borra perfiles necesarios para ciclos no vencidos.

## Consecuencias y sustitución

Sustituye ADR 002 en su exigencia universal de lecturas/escrituras locales y cola en segundo plano; ADR 012 concreta la sincronización vigente. Sustituye ADR 010 en almacenamiento de copias de inscripción y subida diferida de evidencias; conserva PostgreSQL y Blob privado para 004. Los históricos solo cambian estado. Sin proveedor real externo su integración sigue pendiente; no conservar datos personales porque el módulo no registró participante. Registro de participantes/rollback y borrado real requieren tests/evidencia.

## Enlaces

- [Constitución](../constitution.md)
- [ADR 002 sustituido](20260914-estrategia-de-sincronizacion-offline-first.md)
- [ADR 010 sustituido](20261010-postgresql-y-azure-blob-storage-para-persistencia-y-adjuntos.md)
- [Planes 001](../../specs/001-acceso-y-roles/plan.md) y [002](../../specs/002-perfil-catequizando/plan.md)

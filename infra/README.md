# Infraestructura backend 001–003

Entrega de T001-16–25/27/28/143/144, T002-94 y parte infra de T003-55.
`main.bicep` tiene ámbito **grupo de recursos**, `rg-sigecat-prod`. Solo existe
`prod`; desarrollo usa PostgreSQL 16/Azurite locales. La infraestructura no
acredita despliegue, costo medido, compatibilidad nativa ni carga RNF-303.

## Validación local

```sh
bicep build infra/main.bicep --outfile /tmp/opencode/sigecat-plantilla.json
bicep build infra/bootstrap.bicep --outfile /tmp/opencode/sigecat-bootstrap.json
BICEP_BIN=/ruta/bicep node --test api/pruebas/infra/plantilla.test.mjs
actionlint .github/workflows/*.yml
git diff --check
```

También se admite `az bicep build`; el test falla si no hay compilador.
`prod.example.bicepparam` lee la contraseña del entorno y no contiene secretos.
Los JSON compilados y parámetros operativos se generan fuera del repositorio.
No publicar parámetros operativos, salidas de secretos o un `.bicepparam` real
como artefactos de CI.

## Recursos y límites

- Functions Flex Linux Node 22/modelo v4, 2048 MB, HTTP10, máximo5 **por grupo**,
  `alwaysReady: []` (cero); paquetes en contenedor privado `flexpackages` y
  OneDeploy con `Azure/functions-action`, sin ZIP deploy heredado ni Oryx.
- Un worker es el objetivo/default de plataforma. La referencia Azure 2026
  marca `FUNCTIONS_WORKER_PROCESS_COUNT` inválido en Flex; no se añade ese
  ajuste ni `FUNCTIONS_EXTENSION_VERSION` (host gestionado por Azure). El
  número efectivo de workers requiere evidencia en Azure. `PG_POOL_MAX=3`
  acompaña al pool fijo3 que implementa el dueño del API.
- Timers UTC: Flex no acepta `TZ` ni `WEBSITE_TIME_ZONE`. HTTP y cada timer
  tienen grupos separados: `3 × 1 × 5 = 15` conexiones **por grupo**. Medir
  grupos activos, conexiones auxiliares, cuota/región y carga50; un timer no
  precalienta el grupo HTTP.
- PostgreSQL Flexible16 B1ms, TLS obligatorio, BD `sigecat`, firewall Azure
  `0.0.0.0` según D-112, regla temporal por IP del runner con limpieza `always()`.
  Administración solo prepara roles. DDL con `sigecat_migrador`; Functions con
  `sigecat_api`; retención NOLOGIN mediante rol y contexto transaccionales.
- Storage Hot LRS, HTTPS/TLS1.2, `evidencias` privado para 004. No carga de
  documentos de inscripción. Host/paquetes usan identidad; `BLOBS_CONEXION`
  mantiene la conexión del SDK aprobado, guardada en Key Vault.
- APIM Consumption, `/v1`, operaciones comodín, suscripción obligatoria,
  HS256/exp/iss/aud salvo **POST** `/acceso/*`, rechazo401 genérico. Clave JWT
  de APIM en base64 de los mismos bytes UTF-8 que firma la Function, no de otro
  secreto. Key Vault entrega también la clave de host, inyectada por APIM;
  todos los handlers HTTP deben registrar `authLevel: 'function'` (dueño API).
- CORS global fijo al dominio SWA, sin comodines/localhost. `no-store` para
  perfil, condiciones, documentos e identidad real; cuerpos/cabeceras0 en
  diagnóstico APIM. Límite push512KB; límites por suscripción1200/300 por minuto
  en productos. Los límites **por cuenta** pertenecen al contador PostgreSQL
  atómico en Functions, nunca a APIM/memoria.
- Application Insights con muestreo10%, cuota de ingesta0.1GB/día del workspace
  asociado y presupuesto mensual5 (moneda de la suscripción), aviso al80% a
  `correoPresupuesto`. El presupuesto avisa, no detiene recursos. Overrides
  del host desactivan colección HTTP extendida, dependencias y live metrics;
  el API no debe registrar cuerpos/secretos/datos restringidos.
- SWA Free mínima; publicación frontend separada, condicionada a artefacto
  aprobado. No ejecuta EAS ni cambia pantallas/configuración Expo.

## Preparación externa de OIDC y entorno

Antes del primer workflow, el responsable configura la suscripción y GitHub:

1. Crear aplicación/principal de Entra y credencial federada con audiencia
   `api://AzureADTokenExchange` y sujeto
   `repo:ORGANIZACION/REPOSITORIO:environment:prod`.
2. Crear `rg-sigecat-prod`; restringir roles del principal a ese grupo:
   Contributor para recursos, Key Vault Secrets Officer para bootstrap y
   lectura/escritura de secretos, y Role Based Access Control Administrator
   con condición que permita únicamente los roles Storage/Secrets User de
   `modulos/permisos.bicep` para identidades de Functions/APIM. No Owner de la
   suscripción. Permisos Cost Management del grupo si la asignación existente
   no permite crear presupuesto. Registrar providers y comprobar región/cuota.
3. En GitHub, crear entorno `prod` con revisores obligatorios, impedir
   autoaprobación y restringir ramas de despliegue a `main`. Proteger `main`
   con CI obligatorio. La declaración `environment: prod` del YAML no crea
   esas protecciones por sí sola.
4. Variables de entorno GitHub (no secrets): `AZURE_CLIENT_ID`,
   `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `CORREO_PRESUPUESTO`,
   `INICIO_PRESUPUESTO` (primer día del mes ISO UTC). Opcionales:
   `AZURE_UBICACION`, `AZURE_UBICACION_WEB` (eastus2 por defecto),
  `AZURE_PREFIJO` (sigecat), `JWT_KID` (prod-1).
   Durante rotación, `JWT_KID_ANTERIOR` configura la segunda clave de APIM y
   el mapa `JWT_CLAVES` en Key Vault; la clave anterior debe existir como
   `jwt-clave-anterior`, preparada por el responsable de seguridad. No se
   genera una clave anterior ficticia. Al terminar la ventana, retirar ese kid.

## Operación

`despliegue.yml` solo se dispara manualmente desde `main`; no publica
producción al hacer push a `backend/**`. Con `solo_plan=true` (por defecto)
solo ejecuta what-if sobre un grupo/bóveda ya existentes y no crea secretos.
Imprime únicamente tipo de cambio/id, sin valores de parámetros.

Con `solo_plan=false`, exige CI completo mediante workflow reutilizable:

1. Bootstrap de bóveda RBAC/soft-delete/purge-protection; generar y conservar
   contraseñas/claves en Key Vault. No regenerar credenciales existentes.
2. What-if y primera creación sin políticas sensibles APIM; identidades y
   permisos quedan antes de leer secretos. Crear referencias de entorno
   `BD_URL`, `JWT_CLAVE`, `JWT_KID`, `RENOVACION_CLAVE`, `URL_WEB`,
   `BLOBS_CONEXION`; refrescar referencias.
3. Firewall runner temporal, preparación de roles con credencial administrativa,
   migraciones como migrador, limpieza del firewall incluso al fallar.
4. Publicar paquete con `dist/index.js`, `host.json`, `package.json` y módulos
   Node; recuperar clave de host, guardar en Key Vault, aplicar políticas finales.
5. Eliminar parámetros0600 y paquete temporales del runner aun ante fallo.

El runner de migraciones del principal debe ser compatible con roles
precreados NO CREATEROLE y propiedad del migrador. Inmutabilidad/checksum y
creación desde cero se verifican en CI. No usar el migrador como `BD_URL`
de la Function. Rotación JWT/kid/clave de renovación es una operación coordinada
por el dueño de seguridad; cambiar kid sin mantener claves anteriores corta
sesiones y no acredita una rotación segura.

Publicación web: el frontend publica un artefacto `frontend-web` desde una
ejecución exitosa de `main`. Habilitar `FRONTEND_HABILITADO=true` y
`AZURE_NOMBRE_WEB` cuando ese pipeline exista. `despliegue-web.yml` verifica
rama/resultado/origen, descarga el artefacto y obtiene el token de SWA por OIDC
en el runner (enmascarado, no secreto de repositorio).

## Evidencia de integración pendiente

La instalación y la verificación local de integración están completadas. CI consume los
contratos que publica el principal: lockfiles raíz/API, `npm test` completo
con globalSetup PostgreSQL aislado, scripts API `typecheck`, `lint`, `build`,
`migrar`, `verificar-migraciones` y `scripts/verificar-cobertura-rf.mjs` en raíz.
La URL administrativa de pruebas es
`postgres://postgres:postgres@localhost:5432/postgres`; `BD_URL` apunta a
`sigecat_ci_aislada`, nunca a una base de producción. No se migran ambas como
la misma BD ni se omite integración si el servicio no está disponible.

Verificación local: `npm test` (179 tests), typecheck, lint, build de API,
compilación Bicep, seis tests de plantilla y Actionlint pasan. PostgreSQL/Azurite
y el host real local de Functions se verificaron según `docs/backend-implementacion.md`.
Pendientes externos: ejecución CI remota, what-if/despliegue, RBAC/protecciones
GitHub, TLS/host key en Azure, propagación Key Vault y carga RNF-303 en nube.
La traza `docs/agent-trace/backend-infra.json` conserva el estado de su ejecución
original; la publicación final está en `docs/agent-trace/backend-publicacion-infra.json`.

Fuentes consultadas 2026-10-11:
- https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan
- https://learn.microsoft.com/en-us/azure/azure-functions/functions-app-settings#flex-consumption-plan-deprecations
- https://learn.microsoft.com/en-us/azure/api-management/api-management-policy-expressions

# Tareas 001 — Acceso, roles y protección de datos

- Spec: [spec.md](spec.md)
- Plan: [plan.md](plan.md)
- **Total de tareas: 150** (100 de primer corte, 3 bloqueadas por aclaración).

## Leyenda

- **[Primer corte]**: entra en el primer corte de desarrollo (spec 003 completa + lo mínimo de 001: fases F0, F1 y F1b del plan, §12).
- **[Bloqueada por aclaración]**: no se cierra hasta resolver la duda `[NECESITA ACLARACIÓN]` indicada. Las demás tareas que usan un supuesto provisional (S-xx, plan §11.4) avanzan con él y lo citan; el supuesto es reversible.
- **[Requiere cuenta externa]**: necesita Azure, GitHub con OIDC o EAS; su "Hecho cuando" separa lo verificable sin desplegar de lo que exige el despliegue.
- `TNNN-XX`: tarea de otra spec. Como las demás specs aún no tienen `tasks.md`, se citan como `TNNN (pieza del plan NNN)`.

## Convenciones para todas las tareas

- Cada tarea es un commit (Conventional Commits) con su registro Agent Trace (principio 9).
- Cada tarea termina con `npm test`, `npm run typecheck` y `npm run lint` en verde (principio 4). A partir de T001-10, `npm test` incluye la integración con PostgreSQL de `api/docker-compose.yml`.
- Los tests de lógica se nombran `RF-1xx: …` o `RNF-1xx: …` (plan §9.1). Los tests de infraestructura sin RF propio se nombran `infra: …` y no cuentan para `verificar-cobertura-rf`.
- Las reglas viven en `src/lib/seguridad/` y `src/lib/avisos/` como TS puro; las pantallas solo presentan y delegan (principio 3).
- Cada endpoint HTTP se prueba con los cuatro casos de la §9.4 del plan: camino feliz, 401 con cuerpo idéntico, 403 con evento denegado en `evento_auditoria` y 422 con un campo desconocido. En el texto se abrevia como "los cuatro casos HTTP".
- Antes de usar cualquier API de Expo se consulta https://docs.expo.dev/versions/v57.0.0/ (`AGENTS.md`).

## Notas sobre el plan

- **`0106` se parte en dos archivos.** El plan (§12, F1) crea en F1 "la parte de `0106` correspondiente a `aviso_coordinacion`" y deja `aviso_grupo` para F2. Como una migración aplicada no se edita (principio 6, D-114), F1 crea `0106_aviso_coordinacion.sql` y F2 crea `0107_aviso_grupo.sql`. Hay que reflejarlo en la §3.2 del plan.
- **ADR y C4 pendientes** (plan §11.1): el plan los deja fuera de su alcance y no tienen tarea aquí. D-101 exige el ADR "Identidad propia con enlace + PIN" antes de dar 001 por terminada.
- **Migración `ciclo` de 008 (M1).** El plan 008 pide aplicarla justo después de `0001_base.sql`. Su número lo fija el plan 008; aquí solo se cita como `T008 (M1, tabla ciclo)`.

---

## F0 — Base

- [ ] **T001-01** Justificar en la spec las dependencias nuevas **[Primer corte]**
  - RF: habilita RF-101 a RF-112 y RNF-101 a RNF-105 (principio 1)
  - Depende de: —
  - Hecho cuando: `specs/001-acceso-y-roles/spec.md` tiene una sección "Dependencias nuevas" con cada paquete de la §7.2 del plan (`expo-secure-store`, `expo-crypto`, `jest`, `jest-expo`, `@types/jest`, `@testing-library/react-native`, `@azure/functions`, `pg`, `@types/pg`, `jose`, `zod`, `esbuild`, `typescript`, `ts-jest`), dónde se usa y para qué (`@react-native-community/netinfo` queda a cargo de 003), y el PR está aprobado por el equipo; `npm run typecheck` y `npm run lint` pasan (`npm test` aún no existe: lo crea T001-02).

- [ ] **T001-02** Configurar Jest en la raíz con `jest-expo` **[Primer corte]**
  - RF: habilita todos los RF y RNF (principio 4)
  - Depende de: T001-01
  - Hecho cuando: `jest`, `jest-expo`, `@types/jest` y `@testing-library/react-native` están en `devDependencies`; `jest.config.js` define el proyecto `app` (preset `jest-expo`, raíz `src/`, alias `@/`); existen los scripts `test:app` y `test` (provisionalmente igual a `test:app`); el test `infra: jest-expo resuelve el alias @/` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-03** Prohibir imports de interfaz en `src/lib` y en `api` con ESLint **[Primer corte]**
  - RF: habilita RF-102 y RF-107 (principio 3: reglas puras)
  - Depende de: T001-02
  - Hecho cuando: `eslint.config.js` aplica `no-restricted-imports` (`react`, `react-native`, `expo*`, `@/plataforma`) a `src/lib/**` y (`react`, `react-native`, `expo*`) a `api/**`, e ignora `api/dist`; un archivo temporal en `src/lib` que importa `react` hace fallar `npm run lint` (comprobado y descartado); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-04** Crear el esqueleto de la Function App en `api/` **[Primer corte]**
  - RF: habilita RF-101 (API protegida)
  - Depende de: T001-01
  - Hecho cuando: existen `api/package.json` (Node 22, `@azure/functions`, `typescript`), `api/tsconfig.json` estricto con alias `@/lib/*` → `../src/lib/*`, `api/host.json` y `api/src/index.ts`; el `tsconfig.json` raíz excluye `api/`; `npm run typecheck` corre `tsc --noEmit` en la raíz y en `api/` y ambos pasan; `npm test` y `npm run lint` pasan.

- [ ] **T001-05** Configurar Jest con `ts-jest` en `api/` y los scripts de test de la raíz **[Primer corte]**
  - RF: habilita todos los RF y RNF (principio 4, D-115)
  - Depende de: T001-02, T001-04
  - Hecho cuando: `api/jest.config.js` usa `ts-jest` con proyectos `unit` y `http`; la raíz tiene `test:api`, `test` = `test:app && test:api` y `test:rapido` (unitarios de app y API, sin BD); el test `infra: la API importa @/lib desde Jest` en `api/test/unit/` pasa; `npm test`, `npm run test:rapido`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-06** Empaquetar la API con esbuild incluyendo `src/lib` **[Primer corte]**
  - RF: habilita RF-102 (la matriz de `src/lib` se impone en la API, D-107)
  - Depende de: T001-04
  - Hecho cuando: `api/esbuild.config.mjs` genera `api/dist/index.js` (plataforma `node22`, alias `@/lib`); `npm --prefix api run build` termina sin errores y `node -e "require('./api/dist/index.js')"` carga el paquete; `api/dist` está en `.gitignore`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-07** Crear el reloj inyectable y el registrador de logs que redacta **[Primer corte]**
  - RF: RNF-101
  - Depende de: T001-05
  - Hecho cuando: `api/src/compartido/reloj.ts` (interfaz `Reloj` con `ahora()`) y `api/src/compartido/registro.ts` (solo acepta mensaje y campos de una lista permitida; nunca escribe cuerpos de petición ni de respuesta) existen; el test `RNF-101: el registro de logs no escribe cuerpos` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-08** Crear la configuración validada y las respuestas HTTP genéricas **[Primer corte]**
  - RF: RF-101, RNF-101
  - Depende de: T001-05
  - Hecho cuando: `zod` está instalado en `api/`; `api/src/compartido/config.ts` valida las variables (URL de BD, clave JWT, emisor, audiencia) y falla con un mensaje que nombra la variable que falta; `api/src/compartido/http/respuestas.ts` expone `noAutorizado()` (401 `{ codigo: 'acceso_denegado' }`), `fueraDeAlcance()` (403 `{ codigo: 'fuera_de_alcance' }`), `entradaInvalida()` (422) y `respuestaRestringida()`; los tests `RF-101: la respuesta 401 tiene siempre el mismo cuerpo` y `RNF-101: respuestaRestringida agrega Cache-Control no-store` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-09** Levantar PostgreSQL 16 y Azurite en local con Docker **[Primer corte]**
  - RF: habilita RF-101 a RF-112 (BD de pruebas, D-121)
  - Depende de: T001-04
  - Hecho cuando: `api/docker-compose.yml` define `postgres:16` y Azurite, y `api/local.settings.example.json` no contiene secretos reales; `docker compose -f api/docker-compose.yml up -d` deja PostgreSQL respondiendo `SHOW server_version` con 16.x y Azurite escuchando en el puerto 10000; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-10** Crear el soporte de tests de integración con BD efímera **[Primer corte]**
  - RF: habilita RF-101 a RF-112 (contrato de repositorios, §9.3)
  - Depende de: T001-05, T001-09
  - Hecho cuando: `pg` y `@types/pg` están instalados en `api/`; `api/test/soporte/global-setup.ts` y `bd-pruebas.ts` crean `sigecat_prueba_<pid>` desde `BD_PRUEBAS_URL` y la borran al terminar; sin `BD_PRUEBAS_URL`, `npm --prefix api run test:integracion` falla con un mensaje que indica levantar `api/docker-compose.yml` (D-115: nunca se salta en silencio); `npm test` incluye la integración y el test `infra: la BD de pruebas responde select 1` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-11** Crear el pool de conexiones y el helper de transacción **[Primer corte]**
  - RF: habilita RF-106 y RF-109 (transacciones atómicas y auditoría con cierre en falla)
  - Depende de: T001-10
  - Hecho cuando: `api/src/compartido/bd/pool.ts` crea un pool `pg` con `max: 3` y TLS cuando la URL lo exige (D-111) y `api/src/compartido/bd/transaccion.ts` expone `enTransaccion(fn)`; el test `infra: enTransaccion deshace todo si el callback lanza` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-12** Escribir el runner de migraciones con checksum **[Primer corte]**
  - RF: habilita todos los RF con modelo de datos (principio 6, D-114)
  - Depende de: T001-11
  - Hecho cuando: `api/scripts/migrar.ts` crea `esquema_migracion(version, nombre, checksum_sha256, aplicada_en)`, aplica en orden numérico los archivos `SSNN_*.sql` pendientes (aunque haya otros mayores ya aplicados), cada uno en su transacción, y falla si cambió el checksum de uno aplicado; existe el script raíz `migrar`; `global-setup.ts` aplica todas las migraciones con este runner; los tests `infra: el runner aplica todas las migraciones desde cero` e `infra: el runner falla si una migración aplicada cambió` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-13** Escribir la migración base `0001_base.sql` **[Primer corte]**
  - RF: RNF-103 (según plan §3.2); habilita RF-105, RF-108 y RF-109 (GRANT mínimos y rol de retención)
  - Depende de: T001-12
  - Hecho cuando: `api/migraciones/0001_base.sql` crea de forma idempotente `sigecat_migrador`, `sigecat_api` y `sigecat_retencion` (NOLOGIN, con `sigecat_api` como miembro), ejecuta `REVOKE ALL ON SCHEMA public FROM PUBLIC`, fija `ALTER DEFAULT PRIVILEGES` y la zona horaria `America/Lima`; el test `infra: 0001 crea los roles de BD y sigecat_api puede SET ROLE sigecat_retencion` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-14** Escribir la verificación de migraciones inmutables para CI **[Primer corte]**
  - RF: habilita todos los RF con modelo de datos (principio 6, D-114)
  - Depende de: T001-05
  - Hecho cuando: `api/scripts/verificar-migraciones.ts` recibe los cambios frente a `origin/main` y falla si un archivo existente de `api/migraciones/` se modificó o se borró, o si un archivo nuevo no sigue `SSNN_descripcion.sql`; los tests `infra: verificar-migraciones rechaza modificar o borrar una migración de main` e `infra: verificar-migraciones acepta una migración nueva bien numerada` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-15** Escribir el informe de cobertura de requisitos **[Primer corte]**
  - RF: habilita la cobertura de RF-101 a RNF-105 (principio 2, §9.6)
  - Depende de: T001-02
  - Hecho cuando: `scripts/verificar-cobertura-rf.mjs` extrae los `RF-NNN` y `RNF-NNN` de cada `specs/*/spec.md`, los busca en los nombres de `test`/`it`/`describe` e imprime la tabla con salida 0 (modo informe); con `--bloquear 001` sale con 1 si falta alguno de 001; el test `infra: verificar-cobertura detecta un RF sin test` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-16** Crear `main.bicep`, los parámetros de producción y el Key Vault **[Primer corte]**
  - RF: habilita RF-101 (clave JWT) y RNF-104 (costo cero); D-113
  - Depende de: T001-01
  - Hecho cuando: existen `infra/main.bicep` (grupo de recursos `rg-sigecat-prod`, parámetro `ubicacion`), `infra/prod.bicepparam` e `infra/modulos/secretos.bicep` (Key Vault Standard con RBAC y secretos `jwt-clave` y `bd-clave-api` generados); `az bicep build --file infra/main.bicep` termina sin errores ni advertencias; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-17** Crear el módulo Bicep de almacenamiento **[Primer corte]**
  - RF: RNF-103; habilita RF-106 y RF-108 (bandeja de borrado de blobs) y la spec 004
  - Depende de: T001-16
  - Hecho cuando: `infra/modulos/almacenamiento.bicep` crea una cuenta LRS Hot con `supportsHttpsTrafficOnly: true`, `minimumTlsVersion: 'TLS1_2'` y `allowBlobPublicAccess: false`, más el contenedor de despliegue de Flex y el contenedor privado `evidencias`; `az bicep build --file infra/main.bicep` termina sin errores; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-18** Crear el módulo Bicep de PostgreSQL Flexible **[Primer corte]**
  - RF: RNF-103 (D-112)
  - Depende de: T001-16
  - Hecho cuando: `infra/modulos/postgres.bicep` crea un Flexible Server B1ms con PostgreSQL 16, `require_secure_transport = ON`, firewall "permitir servicios de Azure", BD `sigecat` y contraseña de administración desde Key Vault; `az bicep build --file infra/main.bicep` termina sin errores; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-19** Crear el módulo Bicep de la Function App Flex Consumption **[Primer corte]**
  - RF: RNF-103, RF-101 (D-111, D-113)
  - Depende de: T001-16, T001-17
  - Hecho cuando: `infra/modulos/funciones.bicep` crea una Function App Flex Consumption (Linux, Node 22, `maximumInstanceCount: 10`, `httpsOnly: true`, TLS mínimo 1.2) con identidad administrada y los roles `Key Vault Secrets User`, `Storage Blob Data Contributor` y `Storage Blob Delegator`, y la configuración con referencias a Key Vault; `az bicep build --file infra/main.bicep` termina sin errores; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-20** Crear los módulos Bicep de Static Web Apps y monitoreo **[Primer corte]**
  - RF: RNF-103, RNF-101 (riesgo R-10)
  - Depende de: T001-16
  - Hecho cuando: `infra/modulos/web.bicep` crea Static Web Apps Free e `infra/modulos/monitoreo.bicep` crea Application Insights con muestreo, tope diario de ingesta y sin captura de cuerpos; `az bicep build --file infra/main.bicep` termina sin errores; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-21** Crear el módulo Bicep de API Management Consumo **[Primer corte]**
  - RF: RF-101, RNF-101, RNF-103 (D-116)
  - Depende de: T001-16, T001-19
  - Hecho cuando: `infra/modulos/apim.bicep` crea APIM Consumo solo HTTPS, la API `sigecat` con operaciones comodín `GET|POST|PUT|PATCH|DELETE /*` hacia la Function App, los productos `app-movil` y `web-familias`, los valores con nombre `jwt-clave` y `clave-host-funciones` desde Key Vault y el diagnóstico con 0 bytes de cuerpo; `az bicep build --file infra/main.bicep` termina sin errores; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-22** Escribir las políticas de APIM **[Primer corte]**
  - RF: RF-101, RNF-104
  - Depende de: T001-21
  - Hecho cuando: `infra/politicas/api.xml` define `cors` (origen de Static Web Apps; `http://localhost:8081` solo con el parámetro de desarrollo), `validate-jwt` HS256 con `iss=sigecat` y `aud=sigecat-api` dentro de un `<choose>` que excluye `/acceso/*`, y `set-header x-functions-key`; `producto-app.xml` y `producto-web.xml` aplican `rate-limit` parametrizado (1 200 y 300 llamadas cada 60 s); `apim.bicep` los carga con `loadTextContent`; `az bicep build --file infra/main.bicep` termina sin errores; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-23** Probar la plantilla Bicep compilada **[Primer corte]**
  - RF: RF-101, RNF-103
  - Depende de: T001-05, T001-17, T001-18, T001-19, T001-20, T001-22
  - Hecho cuando: `api/test/unit/infra/plantilla.test.ts` compila `infra/main.bicep` con `az bicep build --stdout` (si falta la CLI de Bicep, falla con un mensaje claro) y los tests `RF-101: la plantilla compilada aplica validate-jwt a todo salvo /acceso/*` y `RNF-103: la plantilla Bicep exige HTTPS y TLS 1.2 en todos los recursos` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-24** Crear el workflow de CI **[Primer corte]**
  - RF: habilita todos los RF y RNF (principios 2, 4 y 6)
  - Depende de: T001-03, T001-10, T001-12, T001-14, T001-15, T001-23
  - Hecho cuando: `.github/workflows/ci.yml` corre en PR y push: `npm ci`, typecheck, lint, `test:rapido`, integración con `services: postgres:16`, `az bicep build`, `verificar-migraciones` contra `origin/main` y `verificar-cobertura-rf` en modo informe; `actionlint` no da errores; un PR de prueba queda en verde y otro que edita `0001_base.sql` ya fusionada queda en rojo; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-25** Crear el workflow de despliegue con OIDC **[Primer corte]**
  - RF: RNF-104, RNF-103 (D-113)
  - Depende de: T001-06, T001-12, T001-24
  - Hecho cuando: `.github/workflows/despliegue.yml` (push a `main` y `workflow_dispatch`) hace login con `azure/login` por credencial federada sin secretos, `az deployment group what-if` y `create`, abre una regla temporal de firewall para la IP del runner, ejecuta `npm run migrar` como `sigecat_migrador`, borra la regla aunque falle un paso, publica `api/dist` con `Azure/functions-action` y la web (`expo export -p web`) con `Azure/static-web-apps-deploy`; `actionlint` no da errores y existe una entrada `workflow_dispatch` que solo ejecuta `what-if`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-26** Desplegar la infraestructura base en Azure **[Primer corte]** **[Requiere cuenta externa]**
  - RF: RNF-103, RNF-104, RF-101
  - Depende de: T001-13, T001-25
  - Hecho cuando: con la suscripción de crédito educativo se crean `rg-sigecat-prod`, la aplicación de Entra con credencial federada para el repo y sus roles de despliegue; `az deployment group what-if` no muestra recursos fuera de la §8 del plan; `despliegue.yml` termina en verde; `curl -i https://<apim>.azure-api.net/v1/yo` responde 401 (rechazo de `validate-jwt`); la misma URL por `http://` no se sirve; `psql` con `sslmode=disable` es rechazado; `esquema_migracion` contiene `0001`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-27** Publicar las skills `nueva-migracion` y `verificacion` **[Primer corte]**
  - RF: habilita todos los RF con modelo de datos (principio 11, S-20)
  - Depende de: T001-12, T001-14
  - Hecho cuando: `skills/nueva-migracion/SKILL.md` (numeración `SSNN` por bloque, GRANT explícito a `sigecat_api`, FK hacia bloques mayores, checksum e inmutabilidad) y `skills/verificacion/SKILL.md` (`npm test`, typecheck, lint y cobertura) existen con frontmatter `name` y `description` válidos; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-28** Añadir la plantilla de PR y documentar los comandos en `AGENTS.md` **[Primer corte]**
  - RF: habilita todos los RF (principios 9 y 10)
  - Depende de: T001-05, T001-12, T001-23
  - Hecho cuando: `.github/pull_request_template.md` pide el id de tarea `T001-NN`, los RF cubiertos y el registro Agent Trace; `AGENTS.md` documenta `npm test`, `npm run test:rapido`, `npm run migrar`, `docker compose -f api/docker-compose.yml up -d` y la CLI de Bicep como requisito; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## F1 — Acceso

### Dominio puro (`src/lib/seguridad/`)

- [ ] **T001-29** Mover `roles.ts` a `src/lib/seguridad/` con los cinco roles **[Primer corte]**
  - RF: RF-102
  - Depende de: T001-02, T001-03
  - Hecho cuando: `src/lib/seguridad/roles.ts` define `ROLES = ['administracion','coordinacion','catequista','familia','supervision']`, `type Rol` y `esRolEquipo`; `src/lib/domain/roles.ts` reexporta lo nuevo marcado `@deprecated`; los usos de `src/app` y `src/components` compilan; el test `RF-102: ROLES tiene los cinco roles y esRolEquipo excluye solo familia` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-30** Mover `Cuenta`, `IdentidadReal` y `Consentimiento` desde `modelo.ts` **[Primer corte]**
  - RF: RF-111, RNF-104 (sin correo ni teléfono), RF-105
  - Depende de: T001-29
  - Hecho cuando: `src/lib/seguridad/` define `Cuenta` (antes `Usuario`, sin `telefono` ni `correo`), `IdentidadReal` y `Consentimiento`, y `src/lib/domain/modelo.ts` los reexporta como `@deprecated`; el test `RF-111: una Cuenta no admite correo ni teléfono` (con `@ts-expect-error`) compila y pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-31** Definir `ContextoAcceso` y `rolesEfectivos` **[Primer corte]**
  - RF: RF-102, RF-104
  - Depende de: T001-29
  - Hecho cuando: `src/lib/seguridad/contexto-acceso.ts` define `ContextoAcceso` (sin nombres de personas) y `rolesEfectivos(ctx)`; los tests `RF-102: rolesEfectivos devuelve los roles propios sin duplicados` y `RF-104: rolesEfectivos agrega coordinacion si hay delegación vigente` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-32** Crear la matriz de permisos con las acciones de seguridad **[Primer corte]**
  - RF: RF-102, RF-105
  - Depende de: T001-31
  - Hecho cuando: `src/lib/seguridad/matriz-permisos.ts` define `Accion`, `Alcance` (`'ciclo' | 'grupos' | 'apoderados' | 'ninguno'`), la marca de escritura por acción y las filas `cuentas:gestionar` (ADM; COORD solo CAT y FAM, S-19), `roles:asignar-equipo` (ADM), `identidad-real:leer` (ADM), `delegacion:gestionar` (COORD-propia y ADM, S-01 y S-02), `consentimiento:registrar`, `consentimiento:retirar`, `auditoria:leer` (ADM, S-08), `aviso:publicar` (COORD) y `avisos-coordinacion:leer` (COORD); el test `RF-102: identidad-real:leer y auditoria:leer son solo de administración` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-33** Añadir a la matriz las acciones de lectura de los módulos y las excepciones de asistencia **[Primer corte]**
  - RF: RF-102, RF-103, RF-107
  - Depende de: T001-32
  - Hecho cuando: la matriz incluye `nomina:leer`, `asistencia:escanear` y `asistencia:pasar-lista` (CAT: ciclo), `asistencia:leer`, `justificacion:leer`, `avance:leer` y `aptitud:leer` (COORD y SUP: ciclo; CAT: grupos; FAM: apoderados según S-04), `restringido:leer` y `restringido:escribir` (COORD: ciclo; CAT: grupos) y `evidencia:leer` (COORD y SUP: ciclo; CAT: grupos); los tests `RF-102: supervisión no tiene ninguna acción de escritura`, `RF-103: CAT(g) puede leer faltas, justificaciones y avance de su grupo sin acción de COORD` y `RF-107: restringido:* solo se concede a COORD y a CAT de sus grupos` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-34** Implementar `autorizar` por rol **[Primer corte]**
  - RF: RF-102, RF-107
  - Depende de: T001-33
  - Hecho cuando: `src/lib/seguridad/autorizacion.ts` expone `autorizar(ctx, accion, recurso?)` con `Decision`; una tabla de casos rol × acción × recurso cubre los tests `RF-102: catequista solo de sus grupos, salvo escaneo y lista de cualquier grupo`, `RF-102: familia solo de sus hijos`, `RF-102: supervisión consulta asistencia, justificaciones con evidencia y aptitud sin modificar`, `RF-107: SUP puede leer evidencia y no datos restringidos del perfil` y `RF-107: los datos restringidos solo llegan a COORD, delegado y CAT(g)`, y todos pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-35** Implementar la unión de alcances con varios roles y con delegación **[Primer corte]**
  - RF: RF-102, RF-104
  - Depende de: T001-34
  - Hecho cuando: `autorizar` une los alcances de todos los roles efectivos; los tests `RF-102: unión de alcances con varios roles`, `RF-102: una cuenta con catequista y familia ve la unión de sus alcances y nada más`, `RF-102: un catequista con dos grupos ve ambos y se le deniega un tercero` y `RF-104: autorizar da al delegado exactamente los permisos de coordinación` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-36** Implementar la construcción y lectura de enlaces **[Primer corte]**
  - RF: RF-110, RF-111
  - Depende de: T001-02
  - Hecho cuando: `src/lib/seguridad/enlaces.ts` expone `construirUrlEnlace(base, tipo, token)` (`https://<web>/acceso/<tipo>#t=<token>`), `extraerTokenDeUrl(url)` y `LONGITUD_TOKEN_BYTES = 32`; los tests `RF-110: el enlace lleva el token en el fragmento #t= y extraerTokenDeUrl lo recupera` y `RF-111: construirUrlEnlace distingue equipo y familia` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-37** Implementar las reglas del PIN **[Primer corte]**
  - RF: RF-111
  - Depende de: T001-02
  - Hecho cuando: `src/lib/seguridad/pin.ts` expone `validarFormatoPin`, `verificadorPin(pin, sal, hash)` con la función de hash inyectada, `INTENTOS_MAXIMOS = 5` y `registrarIntento`; los tests `RF-111: el PIN acepta de 4 a 6 dígitos`, `RF-111: con 5 fallos seguidos el estado queda bloqueado` y `RF-111: un acierto reinicia los intentos fallidos` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-38** Implementar el estado de la sesión local de 14 días **[Primer corte]**
  - RF: RF-112
  - Depende de: T001-02
  - Hecho cuando: `src/lib/seguridad/sesion-local.ts` expone `estadoSesionLocal` (usa `max(ahora, instanteMaximoVisto)`), `puedeRegistrarSinConexion` y `DIAS_SESION_SIN_CONEXION = 14`; con reloj inyectado pasan los tests `RF-112: el PIN desbloquea sin conexión hasta el día 14`, `RF-112: el día 15 se impiden registros nuevos` y `RF-112: atrasar el reloj del celular no extiende la sesión`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-39** Implementar el orden de reconexión **[Primer corte]**
  - RF: RF-112
  - Depende de: T001-02
  - Hecho cuando: `src/lib/seguridad/reconexion.ts` expone `alReconectar(puertos)`; con puertos falsos que registran el orden pasan los tests `RF-112: al reconectar se renueva antes de enviar` y `RF-112: con la credencial terminada se descartan los pendientes y se informa la cantidad`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-40** Implementar el seudónimo y la validación de alta **[Primer corte]**
  - RF: RF-105
  - Depende de: T001-30
  - Hecho cuando: `src/lib/seguridad/seudonimo.ts` expone `nombreVisible(cuenta)` y `validarAlta({ esMenor, identidadOperativa, identidadReal })`; los tests `RF-105: nombreVisible devuelve siempre la identidad operativa` y `RF-105: un menor exige identidad operativa distinta de su nombre real` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-41** Definir los contratos de petición y respuesta de seguridad **[Primer corte]**
  - RF: RF-101, RF-105
  - Depende de: T001-30, T001-31
  - Hecho cuando: `src/lib/seguridad/contratos.ts` define los tipos de `acceso/*`, `yo`, `cuentas`, `enlaces` y `avisos-coordinacion`; el test `RF-105: los contratos de respuesta no exponen la identidad real` (con `@ts-expect-error` sobre `nombres` y `apellidos`) compila y pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

### API: base de seguridad

- [ ] **T001-42** Generar y resumir los tokens de enlace en el servidor **[Primer corte]**
  - RF: RF-110, RF-111 (D-102)
  - Depende de: T001-05
  - Hecho cuando: `api/src/modulos/seguridad/dominio/tokens.ts` expone `generarToken()` (32 bytes de `crypto.randomBytes` en base64url) y `hashToken()` (SHA-256), y `dominio/index.ts` reexporta `@/lib/seguridad`; el test `RF-110: el token tiene 256 bits y solo se guarda su SHA-256` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-43** Firmar y verificar el JWT con `jose` **[Primer corte]**
  - RF: RF-101, RF-110, RF-111 (D-105)
  - Depende de: T001-08, T001-42
  - Hecho cuando: `jose` está instalado en `api/`; `infraestructura/firmador-jwt.ts` firma HS256 con `kid`, `iss=sigecat`, `aud=sigecat-api` y `exp` de 15 min (equipo) o 30 min (familia), y verifica todo eso; los tests `RF-101: un JWT con firma, iss, aud o exp inválidos se rechaza` y `RF-110: el JWT de familia dura 30 minutos y el de equipo 15` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-44** Escribir la migración `0101_cuentas_y_credenciales.sql` **[Primer corte]**
  - RF: RF-101, RF-102, RF-105, RF-110, RF-111, RF-112
  - Depende de: T001-13
  - Hecho cuando: `0101` crea `cuenta` (sin teléfono ni correo), `identidad_real` sin GRANT para `sigecat_api` con las funciones `SECURITY DEFINER` `guardar_identidad_real` y `leer_identidad_real` (la segunda exige ADM en la BD, D-108), `rol_cuenta` con el trigger que impide quitar o desactivar la última cuenta ADM activa (S-09), `credencial` con el índice único parcial por cuenta y tipo, y `sesion_renovacion`, con GRANT explícitos; los tests de integración `RF-111: solo hay una credencial vigente por cuenta y tipo`, `RF-102: no se puede quitar ni desactivar la última cuenta de administración`, `RF-105: sigecat_api no puede leer identidad_real` y `RF-105: leer_identidad_real solo responde a un solicitante con administración` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-45** Escribir la migración `0102_auditoria.sql` **[Primer corte]**
  - RF: RF-109, RF-102
  - Depende de: T001-44
  - Hecho cuando: `0102` crea `evento_auditoria` con sus índices, concede a `sigecat_api` solo `INSERT, SELECT` y define `purgar_auditoria(antes)` con `SECURITY DEFINER`; el test de integración `RF-109: la API no puede modificar ni borrar eventos` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-46** Implementar `auditar` y su repositorio **[Primer corte]**
  - RF: RF-109
  - Depende de: T001-11, T001-45
  - Hecho cuando: `infraestructura/repositorio-auditoria.ts` y `aplicacion/auditar.ts` insertan eventos con autor, credencial, acción, recurso, `catequizando_id` y resultado, y rechazan `detalle` con claves de campos restringidos; el test `RF-109: auditar guarda autor, acción, recurso y resultado sin valores restringidos` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-47** Definir el puerto `FuenteAlcance` y su falso en memoria **[Primer corte]**
  - RF: RF-102
  - Depende de: T001-05, T001-31
  - Hecho cuando: `infraestructura/fuente-alcance.ts` define `FuenteAlcance { gruposACargo(cuentaId), alcanceFamilia(cuentaId) }`; `api/test/soporte/` tiene un falso y una batería de contrato reutilizable; el test `RF-102: la fuente de alcance falsa cumple el contrato` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-48** Crear las fábricas de datos y el reloj falso de pruebas **[Primer corte]**
  - RF: habilita RF-101 a RF-112 (tests HTTP y e2e)
  - Depende de: T001-07, T001-43, T001-44, T001-45
  - Hecho cuando: `api/test/soporte/fabricas.ts` crea cuentas por rol con su credencial y su JWT y `reloj-falso.ts` permite avanzar el tiempo; el test `infra: las fábricas crean una cuenta por rol con su JWT` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-49** Cargar el `ContextoAcceso` desde la BD en una consulta **[Primer corte]**
  - RF: RF-101, RF-102 (D-104)
  - Depende de: T001-44, T001-47, T001-48
  - Hecho cuando: `infraestructura/repositorio-cuentas.ts`, `repositorio-credenciales.ts` (lectura) y `aplicacion/cargar-contexto-acceso.ts` cargan con una sola consulta indexada la cuenta activa, la credencial no terminada con su dispositivo y los roles, y completan el alcance con `FuenteAlcance`; los tests de integración `RF-101: no hay contexto si la cuenta está desactivada, la credencial terminada o el dispositivo no coincide` y `RF-102: el contexto trae los roles y el alcance de la fuente` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-50** Implementar `conAcceso`: JWT, contexto y autorización **[Primer corte]**
  - RF: RF-101, RF-102
  - Depende de: T001-35, T001-43, T001-46, T001-49
  - Hecho cuando: `api/src/compartido/http/con-acceso.ts` verifica el JWT, carga el contexto en cada petición, llama a `autorizar` y, si deniega, inserta un evento `denegado` y responde 403; `api/test/soporte/manejador-sonda.ts` registra una Function de prueba protegida; los tests HTTP `RF-101: sin token responde 401 genérico` y `RF-102: una petición fuera de alcance responde 403 y queda registrada` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-51** Completar `conAcceso` con auditoría en cierre de falla y `no-store` **[Primer corte]**
  - RF: RF-109, RNF-101 (D-109)
  - Depende de: T001-50
  - Hecho cuando: el manejador recibe `auditar` y, si el registro falla, la petición falla; las respuestas marcadas como restringidas salen con `Cache-Control: no-store`; los tests `RF-109: si la auditoría falla, la lectura falla` y `RNF-101: las respuestas restringidas llevan Cache-Control no-store` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-52** Validar entradas con `zod` en modo estricto **[Primer corte]**
  - RF: RF-107
  - Depende de: T001-08, T001-50
  - Hecho cuando: `api/src/compartido/http/validar-cuerpo.ts` aplica un esquema `zod` `.strict()` y responde 422 ante campos desconocidos; el test `RF-107: la API rechaza campos fuera del catálogo` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

### API: acceso

- [ ] **T001-53** Implementar el caso de uso de activación del enlace del equipo **[Primer corte]**
  - RF: RF-111
  - Depende de: T001-42, T001-49
  - Hecho cuando: `aplicacion/activar-enlace-equipo.ts` busca la credencial por `sha256(token)`, la ata al `dispositivoId`, la pasa a `activa`, crea `sesion_renovacion` con el hash del token de renovación y `expira_en` a 14 días, y es idempotente para el mismo dispositivo; los tests de integración `RF-111: la primera activación ata la credencial al dispositivo` y `RF-111: reactivar desde el mismo dispositivo devuelve una sesión nueva` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-54** Exponer `POST /acceso/equipo/activar` **[Primer corte]**
  - RF: RF-101, RF-111
  - Depende de: T001-36, T001-52, T001-53
  - Hecho cuando: `http/acceso.ts` registra la Function anónima en `api/src/index.ts` y devuelve `{ jwt, tokenRenovacion, ultimaRenovacion, contexto }`; los tests `RF-111: el mismo enlace en otro celular responde 401`, `RF-101: un enlace inexistente, revocado o ya usado en otro celular responde exactamente lo mismo` (estado y cuerpo idénticos) y el 422 con campo desconocido pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-55** Implementar y exponer `POST /acceso/familia/entrar` **[Primer corte]**
  - RF: RF-101, RF-110
  - Depende de: T001-42, T001-49, T001-52
  - Hecho cuando: `aplicacion/entrar-familia.ts` y su Function devuelven `{ jwt, contexto }` con una credencial de familia no terminada, sin atarla al dispositivo; los tests `RF-110: el enlace de familia funciona desde cualquier dispositivo hasta que se revoca`, `RF-110: el enlace de familia no vence por tiempo` (reloj falso + 400 días) y `RF-110: un solo enlace de familia ve a todos los hijos vinculados` (fuente falsa) pasan, junto con el 401 idéntico; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-56** Escribir `0106_aviso_coordinacion.sql` y el puerto `crearAvisoCoordinacion` **[Primer corte]**
  - RF: RF-112
  - Depende de: T001-44
  - Hecho cuando: `0106_aviso_coordinacion.sql` crea `aviso_coordinacion` (ver Notas: `aviso_grupo` va en `0107`) y `crearAvisoCoordinacion(tipo, datos)` lo inserta; el test `RF-112: crearAvisoCoordinacion guarda tipo, cuenta relacionada y cantidad` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-57** Implementar la renovación con rotación y ventana de reconexión **[Primer corte]**
  - RF: RF-112 (D-106, D-119)
  - Depende de: T001-53
  - Hecho cuando: `aplicacion/renovar-sesion.ts` acepta `hash_actual` o `hash_anterior`, rota el token, fija `expira_en` a 14 días y acepta un token vencido dentro de `VENTANA_RECONEXION_DIAS = 60` (S-13); los tests `RF-112: renovar acepta el token anterior hasta que se use el nuevo`, `RF-112: renovar rota el token y fija la expiración a 14 días` y `RF-112: un token vencido se acepta dentro de la ventana de reconexión y no después` pasan; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-58** Rechazar la renovación con credencial terminada y avisar a la coordinación **[Primer corte]**
  - RF: RF-112, RF-101
  - Depende de: T001-56, T001-57
  - Hecho cuando: `POST /acceso/renovar` responde 401 `{ codigo: 'credencial_terminada' }` si la credencial está terminada o la cuenta desactivada y, con `pendientes > 0`, crea un `aviso_coordinacion` `pendientes_rechazados` (S-14); los tests `RF-112: con la credencial terminada se rechazan los pendientes y COORD recibe la cantidad` y `RF-101: renovar con la cuenta desactivada responde 401 credencial_terminada` pasan, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-59** Exponer `POST /acceso/bloqueo` **[Primer corte]**
  - RF: RF-111
  - Depende de: T001-57
  - Hecho cuando: `aplicacion/reportar-bloqueo.ts` y su Function terminan la credencial con `motivo_fin='bloqueo_pin'`; el test `RF-111: el bloqueo reportado termina la credencial con motivo bloqueo_pin` pasa, junto con el 401 idéntico; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-60** Exponer `GET /yo` **[Primer corte]**
  - RF: RF-102
  - Depende de: T001-41, T001-50
  - Hecho cuando: `GET /yo` devuelve el contexto, los roles efectivos y la `identidad_operativa`; el test `RF-102: GET /yo devuelve los roles efectivos y la identidad operativa` pasa, junto con el 401; `npm test`, `npm run typecheck` y `npm run lint` pasan.

### API: cuentas y enlaces

- [ ] **T001-61** Exponer `POST /cuentas` **[Primer corte]**
  - RF: RF-102, RF-105, RF-111, RNF-105
  - Depende de: T001-40, T001-44, T001-50, T001-52
  - Hecho cuando: `aplicacion/gestionar-cuentas.ts` y `http/cuentas.ts` crean la cuenta idempotente por `id`, guardan la identidad real con `guardar_identidad_real` y aplican `validarAlta`; los tests `RF-111: el alta y la activación no piden correo ni teléfono`, `RF-102: COORD solo crea cuentas de catequista o familia` (S-19) y `RF-105: COORD puede guardar la identidad real pero no leerla` pasan, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-62** Exponer `GET /cuentas` y `GET /cuentas/{id}` **[Primer corte]**
  - RF: RF-105, RF-102
  - Depende de: T001-61
  - Hecho cuando: ADM ve todas las cuentas y COORD solo las de CAT y FAM, siempre con `identidad_operativa`; el test `RF-105: los listados de cuentas muestran solo la identidad operativa` pasa, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-63** Exponer `PUT /cuentas/{id}/roles` **[Primer corte]**
  - RF: RF-102, RF-109
  - Depende de: T001-61
  - Hecho cuando: el endpoint reemplaza el conjunto de roles, lo audita y respeta el trigger del último ADM; los tests `RF-102: ADM asigna cualquier rol y COORD solo catequista y familia` y `RF-109: el cambio de roles deja un evento de auditoría` pasan, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-64** Exponer `POST /cuentas/{id}/desactivar` **[Primer corte]**
  - RF: RF-101, RF-105
  - Depende de: T001-61
  - Hecho cuando: el endpoint pone `activa=false` y termina las credenciales con `motivo_fin='cuenta_desactivada'`; los tests `RF-101: una cuenta desactivada recibe 401 en la petición siguiente` y `RF-105: los registros de una cuenta desactivada siguen mostrando su seudónimo` pasan, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-65** Emitir y reemitir enlaces con `POST /cuentas/{id}/enlaces` **[Primer corte]**
  - RF: RF-110, RF-111, RNF-104
  - Depende de: T001-36, T001-42, T001-61
  - Hecho cuando: `aplicacion/emitir-enlace.ts` termina la credencial anterior del mismo tipo (`reemision`), crea una nueva, guarda solo el hash y devuelve `{ url }` una sola vez; los tests `RF-110: el alta de un apoderado genera un enlace que se devuelve una sola vez`, `RF-111: un enlace reemitido deja sin efecto al anterior en la petición siguiente` y `RNF-104: emitir un enlace no llama a ningún servicio externo de mensajería` pasan, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-66** Revocar enlaces con `POST /cuentas/{id}/enlaces/revocar` **[Primer corte]**
  - RF: RF-110, RF-111
  - Depende de: T001-65
  - Hecho cuando: `aplicacion/revocar-enlace.ts` termina la credencial vigente con `motivo_fin='revocacion'`; los tests `RF-110: un enlace revocado responde 401 y se puede emitir uno nuevo`, `RF-110: revocar el enlace de un apoderado no afecta al del otro apoderado` y `RF-111: revocar el enlace del equipo surte efecto en la petición siguiente` pasan, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-67** Publicar los puertos internos de `seguridad` para otros módulos **[Primer corte]**
  - RF: RF-110, RF-109, RF-112
  - Depende de: T001-46, T001-56, T001-65, T001-66
  - Hecho cuando: `api/src/modulos/seguridad/index.ts` exporta `auditar`, `crearCuentaFamilia(tx, apoderadoId)`, `emitirEnlace`, `revocarEnlace` (con `sin_vinculos`, S-18) y `crearAvisoCoordinacion`; el test `RF-110: crearCuentaFamilia crea la cuenta con rol familia y su enlace en la misma transacción` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-68** Exponer los avisos del sistema para la coordinación **[Primer corte]**
  - RF: RF-112
  - Depende de: T001-50, T001-56
  - Hecho cuando: `http/avisos-coordinacion.ts` expone `GET /avisos-coordinacion` y `POST /avisos-coordinacion/{id}/leido` para COORD; el test `RF-112: COORD lista los pendientes rechazados con el seudónimo de la cuenta y los marca como leídos` pasa, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

### API: semillas y extremo a extremo

- [ ] **T001-69** Escribir el script de la administración inicial **[Primer corte]**
  - RF: RF-111, RF-102 (S-09)
  - Depende de: T001-12, T001-65
  - Hecho cuando: `api/scripts/crear-administracion-inicial.ts` crea la primera cuenta ADM (`creada_por` NULL) y muestra su enlace una sola vez; el test `RF-111: la administración inicial se crea una sola vez y su enlace se muestra una sola vez` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-70** Escribir la semilla de credenciales de ejemplo por rol **[Primer corte]**
  - RF: RF-102
  - Depende de: T001-69
  - Hecho cuando: `api/scripts/sembrar-demo.ts` crea ADM, COORD, CAT mayor, CAT menor con seudónimo, SUP, FAM y una cuenta CAT + FAM, e imprime sus enlaces; el test `RF-102: sembrar-demo crea credenciales de ejemplo para cada rol y una cuenta con dos roles` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-71** Escribir el extremo a extremo de acceso de la API **[Primer corte]**
  - RF: RF-101, RF-102, RF-110, RF-111, RF-112
  - Depende de: T001-54, T001-55, T001-58, T001-64, T001-66, T001-70
  - Hecho cuando: `api/test/e2e/flujo-acceso.test.ts` recorre los pasos 1–5, 7 y 8 de la §9.5 del plan (el paso 6 lo añade T001-108) con la Function sonda y la fuente de alcance falsa, y el test `RF-102: flujo de acceso de extremo a extremo` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-72** Conectar `FuenteAlcance` a los puertos reales de 002 **[Primer corte]**
  - RF: RF-102
  - Depende de: T001-47, T002 (puertos `gruposACargo` y `alcanceFamilia`, fase 1 del plan 002)
  - Hecho cuando: el adaptador real de `fuente-alcance.ts` usa `gruposACargo` y `alcanceFamilia`; la batería de contrato de T001-47 pasa también contra él y el test HTTP `RF-102: un catequista con dos grupos ve ambos y recibe 403 en un tercero` pasa sobre tablas reales de 002; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-73** Ampliar la semilla con grupos y niños ficticios **[Primer corte]**
  - RF: RF-102
  - Depende de: T001-70, T001-72, T002 (grupos, inscripción y vínculo con apoderado, fase 1 del plan 002)
  - Hecho cuando: `sembrar-demo.ts` asigna grupos al CAT, vincula al FAM con dos hijos ficticios y el test `RF-102: con la semilla cada rol ve exactamente su alcance` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

### Cliente

- [ ] **T001-74** Instalar `expo-secure-store` y `expo-crypto` y configurar `app.json` **[Primer corte]**
  - RF: RF-111, RF-112
  - Depende de: T001-01
  - Hecho cuando: ambos paquetes están instalados con `npx expo install`; `app.json` tiene `android.package` y el plugin de `expo-secure-store` con la copia de seguridad de Android excluida (verificado en la documentación v57); `npx expo config --type public` muestra el plugin; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-75** Implementar el almacén seguro del celular **[Primer corte]**
  - RF: RF-111, RF-112, RNF-102
  - Depende de: T001-74
  - Hecho cuando: `src/plataforma/seguridad/almacen-seguro.ts` gestiona `sigecat.dispositivo`, `sigecat.cuentas` y `sigecat.sesion.<cuentaId>`; con SecureStore simulado pasan `RF-111: dispositivoId se genera una sola vez y se reutiliza`, `RF-112: la sesión guardada no contiene nombres y pesa menos de 2 KB` y `RNF-102: sigecat.cuentas lista las cuentas registradas en el celular`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-76** Implementar el cliente HTTP con renovación automática **[Primer corte]**
  - RF: RF-101, RNF-103
  - Depende de: T001-41, T001-74
  - Hecho cuando: `src/plataforma/api/cliente.ts` inyecta el JWT y la clave de suscripción, renueva una vez ante un 401 y reintenta, y lleva a `acceso/sin-acceso` ante `credencial_terminada`; con `fetch` falso pasan `RF-101: ante 401 el cliente renueva una vez y reintenta`, `RF-101: con credencial_terminada el cliente lleva a sin-acceso` y `RNF-103: el cliente rechaza una URL base sin HTTPS fuera de desarrollo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-77** Implementar la activación y el PIN en la sesión del celular **[Primer corte]**
  - RF: RF-111
  - Depende de: T001-37, T001-75, T001-76
  - Hecho cuando: `src/plataforma/seguridad/sesion.ts` activa el enlace, fija el PIN (sal de 16 bytes y SHA-256 con `expo-crypto`, D-103) y solo entonces guarda la credencial; pasan `RF-111: la credencial se guarda en SecureStore solo después de fijar el PIN` y `RF-111: el PIN nunca se envía al servidor`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-78** Implementar el desbloqueo y el bloqueo por PIN en el celular **[Primer corte]**
  - RF: RF-111, RF-112
  - Depende de: T001-38, T001-77
  - Hecho cuando: `sesion.ts` desbloquea con `estadoSesionLocal` y, al quinto fallo, borra el token de renovación y el verificador, marca `bloqueada` y llama a `/acceso/bloqueo` si hay red; pasan `RF-111: con 5 fallos seguidos el celular queda bloqueado y borra el token`, `RF-111: al bloquear con red se reporta el bloqueo al servidor` y `RF-112: el PIN desbloquea sin conexión si no pasaron 14 días desde la última renovación`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-79** Crear el proveedor de contexto de sesión **[Primer corte]**
  - RF: RF-102
  - Depende de: T001-77
  - Hecho cuando: `src/plataforma/seguridad/contexto-sesion.tsx` expone el tipo de sesión (`ninguna`, `equipo`, `familia`), su estado y el contexto; el test RNTL `RF-102: el proveedor de sesión expone los roles efectivos del contexto` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-80** Proteger las rutas con `Stack.Protected` y moverlas a sus grupos **[Primer corte]**
  - RF: RF-102
  - Depende de: T001-79
  - Hecho cuando: `src/app/_layout.tsx` usa `Stack.Protected` con `guard` (sin `redirectTo`, que exige SDK 58), existen `src/app/(equipo)/_layout.tsx` y `src/app/(familia)/_layout.tsx`, y `asistencia.tsx`, `coordinacion.tsx` y `familia.tsx` están en su grupo sin cambiar la URL; pasan `RF-102: sin sesión no se muestran las rutas de (equipo) ni de (familia)` y `RF-102: una sesión de familia no muestra rutas de (equipo)`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-81** Adaptar la pantalla de inicio a la entrada por enlace **[Primer corte]**
  - RF: RF-101
  - Depende de: T001-80
  - Hecho cuando: `src/app/index.tsx` muestra "Abre tu enlace personal" sin sesión (y "Pegar enlace" en Android) y redirige al inicio del rol con sesión; el test RNTL `RF-101: sin sesión el inicio pide abrir el enlace personal` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-82** Crear la pantalla de activación del equipo **[Primer corte]**
  - RF: RF-111
  - Depende de: T001-36, T001-77, T001-80
  - Hecho cuando: `src/app/acceso/equipo.tsx` lee el token con `expo-linking`, llama a `activar` y pasa a `fijar-pin`; sin red indica que la activación necesita conexión y en escritorio o sin la app explica cómo instalarla; pasa el test RNTL `RF-111: abrir el enlace del equipo activa la credencial y pasa a fijar el PIN`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-83** Crear el teclado de PIN y la pantalla para fijarlo **[Primer corte]**
  - RF: RF-111
  - Depende de: T001-37, T001-82
  - Hecho cuando: `src/components/seguridad/teclado-pin.tsx` y `src/app/acceso/fijar-pin.tsx` piden el PIN dos veces con `validarFormatoPin`; el test RNTL `RF-111: fijar-pin rechaza 3 o 7 dígitos y exige confirmar el PIN` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-84** Crear la pantalla de desbloqueo **[Primer corte]**
  - RF: RF-111, RF-112
  - Depende de: T001-78, T001-83
  - Hecho cuando: `src/app/acceso/desbloquear.tsx` muestra "Te quedan N días sin conexión", en `requiere-conexion` solo deja consultar y al quinto fallo muestra "Pide un enlace nuevo a la coordinación"; pasan los tests RNTL `RF-112: desbloquear muestra los días restantes sin conexión`, `RF-112: en requiere-conexion no se permiten registros nuevos` y `RF-111: al quinto fallo se pide un enlace nuevo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-85** Crear la entrada web de familias **[Primer corte]**
  - RF: RF-110 (D-117)
  - Depende de: T001-36, T001-76, T001-80
  - Hecho cuando: `src/app/acceso/familia.tsx` lee `#t=`, llama a `entrar`, borra el fragmento con `history.replaceState`, guarda el token solo en memoria y reemplaza la ruta por `(familia)/`; el test `RF-110: la entrada de familia borra el fragmento de la URL y no guarda el token en almacenamiento` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-86** Crear la pantalla genérica de acceso denegado **[Primer corte]**
  - RF: RF-101, RF-112
  - Depende de: T001-80
  - Hecho cuando: `src/app/acceso/sin-acceso.tsx` muestra el mismo mensaje para enlace inválido, revocado o cuenta desactivada y, si hubo pendientes rechazados, "N registros no pudieron enviarse"; pasan `RF-101: sin-acceso muestra el mismo mensaje sea cual sea la causa` y `RF-112: sin-acceso informa cuántos registros no pudieron enviarse`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-87** Crear la lista y la ficha de cuentas **[Primer corte]**
  - RF: RNF-105, RF-105
  - Depende de: T001-62, T001-80
  - Hecho cuando: `src/app/(equipo)/cuentas/index.tsx` y `[id].tsx` muestran las cuentas con su `identidad_operativa`, roles y estado; el test RNTL `RNF-105: COORD ve desde el celular las cuentas que gestiona` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-88** Crear el alta de cuentas en el celular **[Primer corte]**
  - RF: RF-102, RF-105, RNF-105
  - Depende de: T001-61, T001-87
  - Hecho cuando: `src/app/(equipo)/cuentas/nueva.tsx` genera el `id` con `randomUUID`, ofrece solo los roles permitidos y trata la identidad real como campo que se escribe pero no se lee; pasan `RF-105: el alta exige seudónimo si la persona es menor` y `RF-102: COORD solo puede elegir los roles catequista y familia`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-89** Generar, compartir y revocar enlaces desde la ficha **[Primer corte]**
  - RF: RF-110, RF-111, RNF-104, RNF-105
  - Depende de: T001-65, T001-66, T001-87
  - Hecho cuando: `src/components/seguridad/compartir-enlace.tsx` comparte la URL con `Share.share` del núcleo de RN y la ficha permite generar y revocar con confirmación; pasan `RF-110: compartir usa la hoja de compartir del sistema, sin servicio de mensajería` y `RF-111: revocar desde la ficha pide confirmación y llama al endpoint`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-90** Crear la pantalla de avisos del sistema **[Primer corte]**
  - RF: RF-112
  - Depende de: T001-68, T001-80
  - Hecho cuando: `src/app/(equipo)/avisos-sistema.tsx` muestra "Se rechazaron N registros del celular de <seudónimo>" y permite marcarlo como leído; el test RNTL `RF-112: avisos-sistema muestra la cantidad rechazada y el seudónimo` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-91** Probar la administración de cuentas desde el celular **[Primer corte]**
  - RF: RNF-105
  - Depende de: T001-88, T001-89
  - Hecho cuando: el test de pantalla con RNTL y servidor falso `RNF-105: COORD crea una cuenta, asigna el rol y genera el enlace desde la app` pasa (la delegación la añade T001-107); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-92** Configurar App Links y la cabecera de seguridad de Static Web Apps **[Primer corte]**
  - RF: RF-111, RNF-103
  - Depende de: T001-74
  - Hecho cuando: `app.json` declara `intentFilters` con `autoVerify` para `/acceso/`; existen `public/.well-known/assetlinks.json` (con la huella de EAS como parámetro a completar en T001-96) y `public/staticwebapp.config.json` (fallback de navegación, `Referrer-Policy: no-referrer`, CSP y HSTS); el test `RNF-103: staticwebapp.config.json declara HSTS y Referrer-Policy no-referrer` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-93** Escribir el extremo a extremo de sesión del cliente **[Primer corte]**
  - RF: RF-111, RF-112
  - Depende de: T001-39, T001-78
  - Hecho cuando: `src/plataforma/seguridad/__tests__/flujo-sesion.test.tsx` cubre los pasos 1, 2, 3 y 5 de la §9.5 (activar y fijar PIN, desbloquear el día 13 y el día 15, cinco fallos, renovación antes del push con puertos falsos) y el test `RF-112: flujo de sesión del celular de extremo a extremo` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-94** Conectar `alReconectar` con el orquestador de sincronización de 003 **[Primer corte]**
  - RF: RF-112
  - Depende de: T001-39, T001-93, T003 (orquestador de sincronización y conteo de pendientes por cuenta, fase 1 del plan 003)
  - Hecho cuando: al reconectar, el orquestador de 003 llama primero a `alReconectar` con `pendientes` = cantidad de pendientes de la cuenta y solo después hace push; el test `RF-112: al reconectar, la renovación ocurre antes del push` pasa con el orquestador real y un servidor falso; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-95** Permitir al equipo con iPhone entrar por la web solo en línea **[Bloqueada por aclaración]**
  - RF: RF-111, RF-101
  - Depende de: T001-76, T001-82
  - Bloqueo: S-16 (¿hay catequistas con iPhone?). Solo se implementa si la respuesta es sí.
  - Hecho cuando: en la web, `acceso/equipo.tsx` permite entrar con enlace sin sesión de 14 días, con la sesión solo en memoria y el aviso "Solo funciona con conexión"; el test `RF-111: en la web el equipo entra solo en línea y no guarda la credencial` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-96** Desplegar F1 y verificar el acceso en un dispositivo real **[Primer corte]** **[Requiere cuenta externa]**
  - RF: RF-101, RF-110, RF-111, RF-112
  - Depende de: T001-26, T001-71, T001-84, T001-85, T001-92
  - Hecho cuando: con una compilación de desarrollo de EAS y la huella real en `assetlinks.json`, la lista manual de la §9.5 queda marcada aquí: (a) el App Link `https://<web>/acceso/equipo#t=…` abre la app en un Android de gama baja y el token llega (R-11; si el fragmento no llega, se aplica la alternativa `?t=` y se actualiza el plan); (b) un catequista entra sin correo con enlace y PIN; (c) con modo avión desbloquea con el PIN; (d) la web de familia funciona en un celular sin la app; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## F1b — Consentimiento mínimo (S-12)

- [ ] **T001-97** Implementar las reglas del consentimiento **[Primer corte]**
  - RF: RF-106
  - Depende de: T001-30
  - Hecho cuando: `src/lib/seguridad/consentimiento.ts` expone `inscripcionTieneConsentimiento`, `efectoRetiro` y `textoCumpleRequisitos`; pasan `RF-106: una inscripción sin consentimiento vigente no puede completarse`, `RF-106: basta el consentimiento de un apoderado para inscribir` (S-15), `RF-106: textoCumpleRequisitos exige la cláusula de constancia sin vencimiento` y `RF-106: efectoRetiro borra lo restringido y conserva asistencia anonimizada y constancia`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-98** Escribir la migración `0104_consentimiento.sql` con el texto v1 **[Primer corte]**
  - RF: RF-106
  - Depende de: T001-44
  - Hecho cuando: `0104` crea `texto_consentimiento` (solo inserción, `CHECK (incluye_clausula_constancia)`) y `consentimiento` (sin FK a 002, que las agrega), y siembra la v1 marcada "borrador pendiente de aprobación" (S-17); pasan `RF-106: el texto vigente incluye la cláusula de constancia sin vencimiento` y `RF-106: texto_consentimiento no admite modificaciones`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-99** Implementar `registrarConsentimiento` para 002 **[Primer corte]**
  - RF: RF-106
  - Depende de: T001-97, T001-98
  - Hecho cuando: `infraestructura/repositorio-consentimientos.ts` y `aplicacion/registrar-consentimiento.ts` registran dentro de una transacción ajena, de forma idempotente por `id`, y `seguridad/index.ts` exporta `registrarConsentimiento(tx, datos)`; el test `RF-106: registrar el consentimiento guarda quién, cuándo y la versión del texto` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-100** Exponer el texto vigente y el registro presencial de consentimientos **[Primer corte]**
  - RF: RF-106
  - Depende de: T001-50, T001-52, T001-99
  - Hecho cuando: `http/consentimientos.ts` expone `GET /consentimientos/texto-vigente` (COORD y FAM) y `POST /consentimientos` (COORD, canal `presencial`); el test `RF-106: COORD registra un consentimiento presencial con la versión vigente` pasa, junto con los cuatro casos HTTP de cada endpoint; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-101** Crear el componente de consentimiento presencial **[Primer corte]**
  - RF: RF-106
  - Depende de: T001-80, T001-100
  - Hecho cuando: `src/components/seguridad/consentimiento.tsx` muestra el texto vigente completo y el botón "El apoderado acepta", listo para el asistente de inscripción de 002; el test RNTL `RF-106: el componente muestra el texto vigente completo y registra la aceptación` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## F2 — Continuidad y seudónimo

- [ ] **T001-102** Implementar las reglas de delegación
  - RF: RF-104
  - Depende de: T001-31
  - Hecho cuando: `src/lib/seguridad/delegacion.ts` expone `delegacionVigente` y `validarNuevaDelegacion` (sin mirar `esMenor`); pasan `RF-104: delegacionVigente respeta el borde de hasta`, `RF-104: delegar a un menor está permitido` y `RF-104: no se puede delegar a uno mismo ni redelegar` (S-02); `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-103** Escribir la migración `0103_delegacion.sql`
  - RF: RF-104
  - Depende de: T001-44
  - Hecho cuando: `0103` crea `delegacion` con sus `CHECK`, columnas de revocación y cierre, e índice `(delegado_id, desde, hasta)`; el test de integración `RF-104: se registran delegante, delegado, periodo y revocación` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-104** Incluir la delegación vigente en el contexto y en `GET /yo`
  - RF: RF-104
  - Depende de: T001-49, T001-60, T001-102, T001-103
  - Hecho cuando: `cargar-contexto-acceso` trae la delegación vigente con `now()` de la BD y `GET /yo` la devuelve; pasan `RF-104: al pasar hasta pierde los permisos sin intervención` y `RF-104: el contexto respeta una delegación en el borde de hasta`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-105** Exponer `GET /delegaciones` y `POST /delegaciones`
  - RF: RF-104, RF-109
  - Depende de: T001-52, T001-104
  - Hecho cuando: `aplicacion/delegar.ts` y `http/delegaciones.ts` crean la delegación de forma idempotente y la auditan; pasan `RF-104: el delegado tiene exactamente los permisos de coordinación durante el periodo`, `RF-104: coordinación y delegado tienen permisos a la vez durante el periodo`, `RF-104: un delegado menor de edad lee datos restringidos de todos los grupos durante el periodo` y `RF-104: ADM puede delegar en nombre de la coordinación` (S-01), junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-106** Exponer `POST /delegaciones/{id}/revocar`
  - RF: RF-104
  - Depende de: T001-105
  - Hecho cuando: `aplicacion/revocar-delegacion.ts` fija `revocada_en` y `revocada_por`; el test `RF-104: una revocación surte efecto en la petición siguiente` pasa, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-107** Crear las pantallas de delegación
  - RF: RF-104, RNF-105
  - Depende de: T001-87, T001-106
  - Hecho cuando: `src/app/(equipo)/delegaciones/index.tsx` y `nueva.tsx` listan delegaciones vigentes y pasadas, crean una con `hasta` = fin del día en Lima y permiten revocarla; pasan `RNF-105: COORD delega desde la app` y `RF-104: la lista muestra delegante, delegado, periodo y revocación`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-108** Añadir la delegación al extremo a extremo de la API
  - RF: RF-104
  - Depende de: T001-71, T001-106
  - Hecho cuando: `flujo-acceso.test.ts` incluye el paso 6 de la §9.5 (COORD delega, el CAT lee datos restringidos, se revoca y el CAT recibe 403 en la petición siguiente) y el test `RF-104: flujo de delegación de extremo a extremo` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-109** Calcular `es_menor` al inicio del ciclo
  - RF: RF-105
  - Depende de: T001-40, T001-61, T008 (M1, tabla `ciclo` y ciclo abierto)
  - Hecho cuando: `seudonimo.ts` expone `esMenorAlInicioDeCiclo(fechaNacimiento, inicioCiclo)` y `POST /cuentas` calcula `es_menor` con la fecha de nacimiento y el inicio del ciclo abierto (S-05); pasa `RF-105: el seudónimo se mantiene hasta el cierre aunque cumpla 18`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-110** Exponer `GET /cuentas/{id}/identidad-real` solo para ADM
  - RF: RF-105, RF-109
  - Depende de: T001-44, T001-46, T001-50
  - Hecho cuando: el endpoint lee con `leer_identidad_real`, audita la lectura y responde como restringido (`no-store`); el test `RF-105: solo ADM obtiene la identidad real y la lectura se audita` pasa, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-111** Asegurar que solo ADM ve la identidad real en la API y en la app
  - RF: RF-105
  - Depende de: T001-87, T001-110
  - Hecho cuando: un ayudante de tests revisa todas las respuestas de los tests HTTP de `seguridad`, la ficha `[id].tsx` muestra "Ver identidad real" solo a ADM, y pasan `RF-105: ninguna respuesta de seguridad incluye la identidad real salvo la lectura de ADM` y `RF-105: solo ADM ve el botón de identidad real`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-112** Implementar las reglas de avisos de grupo
  - RF: RF-103
  - Depende de: T001-33
  - Hecho cuando: `src/lib/avisos/avisos.ts` expone `validarAviso` (1 a 500 caracteres) y `avisosVisibles(avisos, ctx)` (S-06); pasan `RF-103: un aviso publicado para un grupo llega a todos sus catequistas y a nadie más` y `RF-103: validarAviso rechaza textos vacíos o de más de 500 caracteres`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-113** Escribir la migración `0107_aviso_grupo.sql`
  - RF: RF-103
  - Depende de: T001-44, T003 (columnas de sincronización del plan 003), T002 (tabla `grupo`; la FK la agrega una migración de 002)
  - Hecho cuando: `0107` crea `aviso_grupo` con las columnas de sincronización de 003 y GRANT explícitos (ver Notas); el test de integración `RF-103: aviso_grupo limita el texto a 500 caracteres` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-114** Exponer la publicación y el retiro de avisos de grupo
  - RF: RF-103
  - Depende de: T001-50, T001-112, T001-113
  - Hecho cuando: el módulo `api/src/modulos/avisos/` expone `POST /avisos` y `POST /avisos/{id}/retirar` para COORD; el test `RF-103: solo la coordinación publica y retira avisos de grupo` pasa, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-115** Distribuir los avisos de grupo por el pull de sincronización
  - RF: RF-103, RF-105 (D-120)
  - Depende de: T001-114, T003 (registro de tablas de sincronización, plan 003)
  - Hecho cuando: `aviso_grupo` está registrada como colección de solo pull filtrada por los grupos asignados y con `autor_visible` = `identidad_operativa`; pasan `RF-103: el pull entrega a CAT(g) solo los avisos de sus grupos` y `RF-103: el aviso muestra el seudónimo del autor`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-116** Crear la tabla local y las pantallas de avisos de grupo
  - RF: RF-103
  - Depende de: T001-115, T003 (mecanismo de extensión del esquema local, §3.3 del plan 003)
  - Hecho cuando: el esquema WatermelonDB tiene `aviso_grupo` mediante un paso nuevo de migración local y `src/app/(equipo)/avisos/…` permite a COORD publicar y a CAT leer sin conexión; el test RNTL `RF-103: CAT ve los avisos de su grupo sin conexión` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-117** Implementar el plan de cierre de sesión
  - RF: RNF-102 (D-118)
  - Depende de: T001-30
  - Hecho cuando: `src/lib/seguridad/cierre-sesion.ts` expone `planCierreSesion(cuentaId)`; el test `RNF-102: el cierre purga todo salvo los pendientes de la cuenta y conserva la credencial` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-118** Implementar "Cerrar sesión" en ajustes
  - RF: RNF-102
  - Depende de: T001-80, T001-117, T003 (`purgarExceptoPendientes(cuentaId)`, plan 003)
  - Hecho cuando: `src/app/(equipo)/ajustes.tsx` ejecuta el plan de cierre (llama a `purgarExceptoPendientes` y borra el JWT); el test `RNF-102: al cerrar sesión quedan solo los pendientes de la cuenta` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-119** Separar los pendientes de varias cuentas en un mismo celular
  - RF: RNF-102
  - Depende de: T001-75, T001-118, T003 (pendientes con `cuenta_id` y `credencial_id`, plan 003)
  - Hecho cuando: `desbloquear.tsx` permite elegir entre las cuentas de `sigecat.cuentas` y el push solo envía los pendientes de la cuenta activa; pasan `RNF-102: otra cuenta en el mismo celular no ve ni envía pendientes ajenos` y `RNF-102: la misma cuenta envía sus pendientes al volver a entrar`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-120** Añadir el cierre de sesión al extremo a extremo del cliente
  - RF: RNF-102
  - Depende de: T001-93, T001-119
  - Hecho cuando: `flujo-sesion.test.tsx` incluye el paso 4 de la §9.5 y el test `RNF-102: flujo de cierre de sesión de extremo a extremo` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## F3 — Protección de datos

- [ ] **T001-121** Crear el catálogo de datos personales
  - RF: RF-107, RNF-101
  - Depende de: T001-33
  - Hecho cuando: `src/lib/seguridad/catalogo-datos.ts` define `CATALOGO` con clasificación y finalidad, incluye los campos de `cuenta` e `identidad_real` y expone `camposRestringidos()` (S-07: el resto lo aporta cada plan dueño); el test `RF-107: los campos de cuenta no incluyen teléfono ni correo y cada uno tiene finalidad` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-122** Comparar el catálogo con las columnas de las migraciones
  - RF: RF-107
  - Depende de: T001-12, T001-121
  - Hecho cuando: un test de integración recorre `information_schema.columns` tras aplicar todas las migraciones y exige que cada columna figure en `CATALOGO` o en la lista `COLUMNAS_TECNICAS` (ids, marcas de tiempo y sincronización); el test `RF-107: todo campo personal de las migraciones figura en el catálogo con su finalidad` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-123** Verificar que el esquema local no guarda datos restringidos
  - RF: RNF-101, RF-112
  - Depende de: T001-121, T003 (esquema WatermelonDB, plan 003)
  - Hecho cuando: pasan `RNF-101: ninguna columna del esquema WatermelonDB es un campo restringido` y `RF-112: todo registro pendiente del esquema local lleva cuenta_id y credencial_id`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-124** Implementar las reglas de fechas de retención
  - RF: RF-108, RF-109
  - Depende de: T001-02
  - Hecho cuando: `src/lib/seguridad/retencion.ts` expone `fechaVencimientoRetencion` (cierre + 2 años; el 29 de febrero pasa al 28), `ciclosPorAnonimizar` y `DIAS_CONSERVACION_AUDITORIA = 730` (S-08); pasan `RF-108: un ciclo cerrado hace 2 años menos 1 día no se toca`, `RF-108: el vencimiento de un cierre el 29 de febrero cae el 28 de febrero` y `RF-108: un ciclo ya ejecutado no vuelve a elegirse`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-125** Escribir la migración `0105_retencion.sql`
  - RF: RF-106, RF-108
  - Depende de: T001-44
  - Hecho cuando: `0105` crea `ejecucion_retencion` con `UNIQUE (tipo, objetivo_id)` y `borrado_blob_pendiente`; el test de integración `RF-108: ejecucion_retencion es única por tipo y objetivo` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-126** Implementar el motor de retención con registro de participantes
  - RF: RF-106, RF-108 (D-110)
  - Depende de: T001-11, T001-13, T001-124, T001-125
  - Hecho cuando: `aplicacion/motor-retencion.ts` expone `registrarParticipanteRetencion`, `retirarConsentimiento(catequizandoId, tx)` y `vencerCiclo(cicloId)`, abre una transacción con `SET LOCAL ROLE sigecat_retencion` y `SET LOCAL sigecat.contexto` (convención C-4 del plan 008), ejecuta los participantes en orden, guarda conteos y encola blobs; pasan `RF-106: si un participante falla no se borra nada`, `RF-108: el motor guarda los conteos de cada participante` y `RF-108: una segunda ejecución sobre el mismo objetivo no hace nada`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-127** Exigir un participante de retención por cada tabla con `catequizando_id`
  - RF: RF-106 (riesgo R-9)
  - Depende de: T001-126
  - Hecho cuando: `ParticipanteRetencion` declara sus tablas y un test de integración compara `information_schema` con lo declarado; el test `RF-106: todas las tablas con catequizando_id tienen participante de retención` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-128** Implementar el participante de retención de `seguridad`
  - RF: RF-108, RF-110
  - Depende de: T001-126, T002 (vínculos de apoderado, plan 002), T008 (M1, tabla `ciclo`)
  - Hecho cuando: al vencer un ciclo, el participante borra `identidad_real` de cuentas desactivadas sin ciclos posteriores y termina las credenciales de familia sin vínculos (S-18); pasan `RF-108: al vencer un ciclo se borra la identidad real de las cuentas desactivadas sin ciclos posteriores` y `RF-110: se terminan las credenciales de familia que se quedan sin vínculos`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-129** Implementar el retiro del consentimiento por la coordinación
  - RF: RF-106
  - Depende de: T001-99, T001-100, T001-126
  - Hecho cuando: `aplicacion/retirar-consentimiento.ts` y `POST /consentimientos/{id}/retirar` marcan el retiro y ejecutan el motor en la misma transacción; con participantes falsos pasan `RF-106: al retirarlo, todos los participantes borran en la misma transacción y el niño queda inactivo`, `RF-106: el retiro de cualquiera de los dos apoderados aplica el borrado` (S-15) y `RF-106: al retirar el consentimiento la justificación queda sin evidencia y el blob entra en la bandeja`, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-130** Borrar los blobs de la bandeja tras el commit y reintentar
  - RF: RF-106, RF-108
  - Depende de: T001-17, T001-126
  - Hecho cuando: el motor borra los blobs encolados justo después del commit mediante el puerto `BorradorBlobs` (falso en tests; el real lo aporta 004) y la Function de temporizador `borradosPendientes` (`0 */15 * * * *`) reintenta; con reloj falso pasan `RF-106: los blobs se borran justo después del commit` y `RF-108: los blobs que fallan se reintentan`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-131** Crear la pantalla de consentimiento de un niño para la coordinación
  - RF: RF-106
  - Depende de: T001-87, T001-129
  - Hecho cuando: `src/app/(equipo)/consentimiento/[catequizandoId].tsx` muestra el historial y el botón "Retirar consentimiento" con un aviso explícito de lo que se borra; el test RNTL `RF-106: retirar el consentimiento exige confirmar el aviso de borrado` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-132** Permitir a la familia retirar el consentimiento desde su enlace
  - RF: RF-106
  - Depende de: T001-85, T001-129
  - Hecho cuando: `POST /consentimientos/{id}/retirar` acepta a FAM(n) y `src/app/(familia)/consentimiento.tsx` muestra el consentimiento y permite retirarlo; pasan `RF-106: FAM retira el consentimiento de su hijo y recibe 403 con otro niño` y el test RNTL `RF-106: la familia ve el texto aceptado y puede retirarlo`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-133** Programar el temporizador `retencionDiaria`
  - RF: RF-108
  - Depende de: T001-124, T001-126, T008 (M1, tabla `ciclo` con fecha de cierre)
  - Hecho cuando: `http/temporizadores.ts` registra `retencionDiaria` (`0 0 8 * * *`) que aplica `ciclosPorAnonimizar` y `vencerCiclo`; con reloj falso pasa `RF-108: un ciclo cerrado hace 2 años se anonimiza una sola vez`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-134** Auditar automáticamente las lecturas y escrituras restringidas
  - RF: RF-109
  - Depende de: T001-51
  - Hecho cuando: `conAcceso` audita sin intervención del manejador las acciones `restringido:*` y `evidencia:leer`; con la Function sonda pasa `RF-109: crear, modificar y leer un dato restringido deja un evento`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-135** Verificar la auditoría en los endpoints restringidos de 002 y 004
  - RF: RF-109
  - Depende de: T001-134, T002 (perfil con condiciones, fase 3 del plan 002), T004 (emisión de SAS de evidencias, plan 004)
  - Hecho cuando: el test de integración `RF-109: leer condiciones de salud y una evidencia deja un evento cada una` pasa contra los endpoints reales; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-136** Programar la purga mensual de auditoría
  - RF: RF-109
  - Depende de: T001-45, T001-124
  - Hecho cuando: `purgaAuditoria` (`0 0 9 1 * *`) ejecuta `purgar_auditoria(now() - 730 días)`; con reloj falso pasa `RF-109: la purga elimina solo los eventos de más de 730 días`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-137** Exponer la consulta de auditoría para ADM
  - RF: RF-109, RF-105
  - Depende de: T001-40, T001-46, T001-50
  - Hecho cuando: `http/auditoria.ts` expone `GET /auditoria?catequizandoId&desde&hasta` solo para ADM, con `nombreVisible` del autor; pasan `RF-105: la auditoría y los avisos muestran el seudónimo` y `RF-109: solo administración consulta la auditoría`, junto con los cuatro casos HTTP; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-138** Crear la pantalla de auditoría
  - RF: RF-109
  - Depende de: T001-80, T001-137
  - Hecho cuando: `src/app/(equipo)/auditoria.tsx` filtra por niño y fechas y muestra seudónimos; el test RNTL `RF-109: ADM consulta los eventos de un niño por fechas` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-139** Añadir el pie de retención y la auditoría de exportaciones
  - RF: RF-108, RF-109 (S-10)
  - Depende de: T001-33, T001-124
  - Hecho cuando: `retencion.ts` expone `pieExportacion(fecha)` ("Contiene datos de menores; elimínese al cierre del ciclo + 2 años") y la matriz incluye `exportacion:generar`, para que 003, 006 y 008 lo usen; el test `RF-108: el pie de exportación indica la fecha y el plazo de eliminación` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-140** Probar el motor con los participantes reales de las demás specs
  - RF: RF-106, RF-108
  - Depende de: T001-128, T001-129, T001-133, T002 (`eliminarDatosRestringidos` y `anonimizarCatequizando`), T003 (asistencia anonimizable), T004 (`depurarEvidencias`), T008 (manejador `retencionCiclos` y constancia)
  - Hecho cuando: un test de integración retira un consentimiento y vence un ciclo con los participantes reales, y pasan `RF-106: se conservan la asistencia anonimizada y la constancia` y `RF-108: la constancia se conserva`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

## F4 — Cierre y endurecimiento

- [ ] **T001-141** Implementar los servicios de cierre para delegaciones y enlaces de familia
  - RF: RF-104, RF-110
  - Depende de: T001-66, T001-103
  - Hecho cuando: `aplicacion/servicios-cierre.ts` exporta `terminarDelegacionesVigentes()` y `revocarEnlacesFamilia(cuentaIds)` para el plan 008; pasan `RF-104: el cierre de ciclo termina las delegaciones vigentes` y `RF-110: el cierre de ciclo revoca los enlaces de quienes no se reinscriben`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-142** Implementar `recalcularMinoria` para el inicio del nuevo ciclo
  - RF: RF-105
  - Depende de: T001-109
  - Hecho cuando: `servicios-cierre.ts` exporta `recalcularMinoria(inicioNuevoCiclo)`, que actualiza `es_menor` (S-05); el test `RF-105: recalcularMinoria actualiza es_menor solo con el inicio del nuevo ciclo` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-143** Permitir rotar la clave JWT con `kid`
  - RF: RF-101 (D-105)
  - Depende de: T001-21, T001-43
  - Hecho cuando: `firmador-jwt.ts` firma con la clave actual y acepta la anterior por `kid`; `secretos.bicep` y `apim.bicep` tienen `jwt-clave-anterior`; `az bicep build` pasa; el test `RF-101: un JWT con la clave anterior se acepta durante la rotación y uno con kid desconocido no` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-144** Añadir la alerta de presupuesto en Bicep
  - RF: RNF-104 (riesgo R-1)
  - Depende de: T001-16
  - Hecho cuando: `main.bicep` crea un presupuesto mensual de US$ 5 con alerta por correo al responsable; `az bicep build --file infra/main.bicep` termina sin errores; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-145** Probar la carga de 50 clientes contra las Functions locales
  - RF: RF-112, RF-101 (riesgo R-2)
  - Depende de: T001-58, T001-71
  - Hecho cuando: un test con 50 clientes concurrentes que renuevan y llaman a `GET /yo` contra Functions locales con el pool de 3 conexiones termina sin errores de conexión y deja el p95 en el informe del PR; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-146** Sembrar la versión aprobada del texto de consentimiento **[Bloqueada por aclaración]**
  - RF: RF-106
  - Depende de: T001-98
  - Bloqueo: S-17 (¿quién redacta el texto del consentimiento?) y S-11 (normativa diocesana).
  - Hecho cuando: una migración nueva del bloque `01` inserta la versión aprobada con la cláusula de constancia, la v1 queda como historial y `GET /consentimientos/texto-vigente` devuelve la versión nueva; pasa el test `RF-106: el texto vigente es la versión aprobada y conserva la cláusula de constancia`; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-147** Cerrar la lista de datos necesarios del catálogo **[Bloqueada por aclaración]**
  - RF: RF-107
  - Depende de: T001-122
  - Bloqueo: S-07 (lista cerrada de datos necesarios que hace verificable la minimización).
  - Hecho cuando: `CATALOGO` contiene exactamente la lista aprobada por el equipo (con las entradas de 002 a 008) y el test `RF-107: el catálogo coincide con la lista cerrada de datos necesarios aprobada` pasa; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-148** Desplegar F2 a F4 en Azure **[Requiere cuenta externa]**
  - RF: RF-104, RF-106, RF-108, RF-109, RNF-104
  - Depende de: T001-26, T001-138, T001-140, T001-143, T001-144
  - Hecho cuando: `despliegue.yml` aplica las migraciones `0103` a `0107` y el código; en el portal aparecen los temporizadores `retencionDiaria`, `borradosPendientes` y `purgaAuditoria` y el presupuesto de US$ 5; `GET /v1/auditoria` sin token responde 401; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-149** Verificar a mano los criterios de finalización de la spec **[Requiere cuenta externa]**
  - RF: RF-101 a RF-112, RNF-101 a RNF-105
  - Depende de: T001-73, T001-96, T001-107, T001-120, T001-132, T001-148
  - Hecho cuando: los nueve criterios de finalización de la spec quedan marcados con la semilla de ejemplo en un Android real y en la web de familia, incluido que ninguna vista, reporte ni exportación muestra el nombre real de un catequista menor; `npm test`, `npm run typecheck` y `npm run lint` pasan.

- [ ] **T001-150** Hacer bloqueante la cobertura de requisitos de 001
  - RF: RF-101 a RF-112, RNF-101 a RNF-105 (principio 2)
  - Depende de: T001-15, T001-149
  - Hecho cuando: `ci.yml` ejecuta `verificar-cobertura-rf.mjs --bloquear 001` y sale con 0 porque cada RF y RNF de 001 tiene al menos un test con su id en el nombre; `npm test`, `npm run typecheck` y `npm run lint` pasan.

---

## Cobertura

| Requisito | Tareas |
| --- | --- |
| RF-101 Acceso autenticado | T001-08, T001-21, T001-22, T001-23, T001-26, T001-41, T001-43, T001-49, T001-50, T001-54, T001-55, T001-58, T001-64, T001-71, T001-76, T001-81, T001-86, T001-95, T001-96, T001-143, T001-145, T001-149, T001-150 |
| RF-102 Roles y alcance por dato | T001-29, T001-31, T001-32, T001-33, T001-34, T001-35, T001-44, T001-45, T001-47, T001-49, T001-50, T001-60, T001-61, T001-62, T001-63, T001-69, T001-70, T001-71, T001-72, T001-73, T001-79, T001-80, T001-88, T001-149, T001-150 |
| RF-103 Consulta descentralizada | T001-33, T001-112, T001-113, T001-114, T001-115, T001-116, T001-149, T001-150 |
| RF-104 Delegación de la coordinación | T001-31, T001-35, T001-102, T001-103, T001-104, T001-105, T001-106, T001-107, T001-108, T001-141, T001-148, T001-149, T001-150 |
| RF-105 Seudónimo de catequistas menores | T001-30, T001-32, T001-40, T001-41, T001-44, T001-61, T001-62, T001-64, T001-87, T001-88, T001-109, T001-110, T001-111, T001-115, T001-137, T001-142, T001-149, T001-150 |
| RF-106 Consentimiento informado | T001-97, T001-98, T001-99, T001-100, T001-101, T001-125, T001-126, T001-127, T001-129, T001-130, T001-131, T001-132, T001-140, T001-146, T001-148, T001-149, T001-150 |
| RF-107 Minimización de datos | T001-33, T001-34, T001-52, T001-121, T001-122, T001-147, T001-149, T001-150 |
| RF-108 Retención | T001-124, T001-125, T001-126, T001-128, T001-130, T001-133, T001-139, T001-140, T001-148, T001-149, T001-150 |
| RF-109 Auditoría | T001-45, T001-46, T001-51, T001-63, T001-67, T001-105, T001-110, T001-124, T001-134, T001-135, T001-136, T001-137, T001-138, T001-139, T001-148, T001-149, T001-150 |
| RF-110 Enlace personal de familia | T001-36, T001-42, T001-43, T001-55, T001-65, T001-66, T001-67, T001-71, T001-85, T001-89, T001-96, T001-128, T001-141, T001-149, T001-150 |
| RF-111 Enlace personal y PIN del equipo | T001-30, T001-36, T001-37, T001-42, T001-43, T001-44, T001-53, T001-54, T001-59, T001-61, T001-65, T001-66, T001-69, T001-71, T001-74, T001-75, T001-77, T001-78, T001-82, T001-83, T001-84, T001-89, T001-92, T001-93, T001-95, T001-96, T001-149, T001-150 |
| RF-112 Sesión sin conexión | T001-38, T001-39, T001-44, T001-56, T001-57, T001-58, T001-67, T001-68, T001-71, T001-74, T001-75, T001-78, T001-84, T001-86, T001-90, T001-93, T001-94, T001-96, T001-123, T001-145, T001-149, T001-150 |
| RNF-101 Datos sensibles fuera del celular | T001-07, T001-08, T001-20, T001-21, T001-51, T001-121, T001-123, T001-149, T001-150 |
| RNF-102 Celular compartido | T001-75, T001-117, T001-118, T001-119, T001-120, T001-149, T001-150 |
| RNF-103 Canal cifrado | T001-13, T001-17, T001-18, T001-19, T001-20, T001-21, T001-23, T001-25, T001-26, T001-76, T001-92, T001-149, T001-150 |
| RNF-104 Costo cero | T001-16, T001-22, T001-25, T001-26, T001-30, T001-65, T001-89, T001-144, T001-148, T001-149, T001-150 |
| RNF-105 Administración mínima | T001-61, T001-87, T001-88, T001-89, T001-91, T001-107, T001-149, T001-150 |

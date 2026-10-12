# Backend 001–003: desarrollo e integración local

Rama `backend/001-003`. Node **22**, npm, Docker con Compose y Azure Functions Core Tools **v4**. Comandos desde la raíz. El principal verificó host real local Core Tools4.15.2 con extensionBundle4.38.1 en caché fuera del repo. La pausa npm terminó; los resultados finales integrales los adjunta el principal. Verificación local no implica despliegue Azure.

## 1. Instalar ambos proyectos

```bash
npm install
npm --prefix api install
```

La raíz instala tests cliente y dominio; `api/` instala Functions/pg/jose/zod/Blob y herramientas de desarrollo. `tsx` ejecuta scripts TS puros, `@types/node` proporciona tipos de Node22. Ambos están justificados en spec 001 antes de la siguiente instalación; la instalación preliminar anterior a esa nota queda registrada como desviación del orden, sin fingir aprobación retroactiva. No instalar dependencias extra para verificar OpenAPI.

## 2. PostgreSQL y Azurite locales

```bash
export PUERTO_POSTGRES=55432
docker compose -f api/docker-compose.yml up -d
docker compose -f api/docker-compose.yml ps
export BD_PRUEBAS_URL="postgresql://postgres:postgres@localhost:${PUERTO_POSTGRES}/sigecat"
```

PostgreSQL16 publica `127.0.0.1:${PUERTO_POSTGRES:-55432}` → puerto interno 5432. Para evitar un puerto ocupado, cambiar `PUERTO_POSTGRES` **antes de levantar Compose** y actualizar las URLs. Azurite publica 10000–10002. `postgres:postgres` son las credenciales de este contenedor local, nunca de producción; no usarlas en Azure. Volumen `datos-postgres` conserva la BD; las migraciones aplicadas mantienen checksum.

Compose y CI arrancan Azurite con `--skipApiVersionCheck`: el SDK Blob instalado utiliza una versión de API 2026 que el emulador 3.35.0 aún no reconoce. Es compatibilidad **solo del emulador local/CI**, no una opción de Azure cloud. Las pruebas efectivamente crean y borran blobs en Azurite; no se omiten ni se reemplaza el borrador real por un falso para pasar.

`BD_PRUEBAS_URL` apunta a una conexión local con permiso **CREATE DATABASE**, no a `sigecat_api`. `globalSetup` crea `sigecat_prueba_<pid>`, aplica todas las migraciones y teardown elimina esa BD. No omitir integración si la URL falta; falla explícitamente. No conectar la suite de integración a producción ni a una base compartida.

## 3. Checks y OpenAPI

```bash
node api/scripts/verificar-openapi.mjs
npm test
npm run typecheck
npm run lint
npm --prefix api run build
```

- `npm test`: `test:app` con jest-expo y API con proyectos `unit` (incluye HTTP) e `integracion` (PostgreSQL y e2e).
- `npm run typecheck`: raíz y API. `npm run lint`: código del workspace según ESLint.
- `npm --prefix api run build`: esbuild Node22, alias `@/lib` al dominio compartido, salida `api/dist/index.js`.
- `node api/scripts/verificar-openapi.mjs`: JSON/OpenAPI3.1, rutas y métodos registrados actuales, referencias locales, schemas tipados/objetos cerrados, ejemplos, parámetros, seguridad y configuración/alias. Sin instalaciones adicionales; verificador del subconjunto usado, no certificación de toda la meta-spec ni test de handlers.
- `npm run test:rapido` y `npm --prefix api run test:integracion` son útiles para diagnóstico; no sustituyen `npm test` al cerrar la integración.

Después de cambios de DTO/handler actualizar OpenAPI y guía. Sync conserva claves nativas; query tiene adaptación negociada descrita en la guía frontend. `_status`/`_changed` se ignoran antes de validar/huella, solo en filas de entrada; no llegan a SQL/pull. OpenAPI mantiene otros campos estrictos y verifica ejemplos de reenvío con metadata distinta.

## 4. Aplicar migraciones al entorno de desarrollo

El bootstrap prepara propietarios y contraseñas **antes** de migrar. Administrador configura roles; migrador aplica SQL como propietario; API sirve peticiones con permisos limitados.

```bash
export BD_ADMIN_URL="postgresql://postgres:postgres@localhost:${PUERTO_POSTGRES}/sigecat"
read -r -s -p "Clave local sigecat_api: " BD_API_CLAVE
export BD_API_CLAVE
read -r -s -p "Clave local sigecat_migrador: " BD_MIGRADOR_CLAVE
export BD_MIGRADOR_CLAVE
npm --prefix api run configurar:roles
export BD_MIGRACIONES_URL="$(node -e 'const u = new URL(process.env.BD_ADMIN_URL); u.username = "sigecat_migrador"; u.password = process.env.BD_MIGRADOR_CLAVE; process.stdout.write(u.href)')"
npm --prefix api run migrar
export BD_URL="$(node -e 'const u = new URL(process.env.BD_ADMIN_URL); u.username = "sigecat_api"; u.password = process.env.BD_API_CLAVE; process.stdout.write(u.href)')"
```

`configurar:roles` ejecuta `api/scripts/configurar-roles.ts` con `BD_ADMIN_URL`, `BD_API_CLAVE`, `BD_MIGRADOR_CLAVE`. Crea roles limitados, asigna propiedad de BD/esquema a `sigecat_migrador`, concede membresías de retención y fija contraseñas sin registrarlas. Usa administrador solo para este paso. Las asignaciones de URL usan `URL.password` para codificar caracteres especiales; no imprimir las URLs ni las claves.

`migrar` ejecuta `tsx scripts/migrar.ts`; prioriza `BD_MIGRACIONES_URL` y usa `BD_URL` solo como fallback. El flujo anterior **mantiene `BD_MIGRACIONES_URL` con rol migrador, no API ni administrador**. Aplica SQL/checksum, con bloqueo de concurrentes. `0002` precede operativas y `0801` añade FK. El principal verificó migraciones persistentes en PostgreSQL55432 con este rol propietario; no editar una ya aplicada. Runtime usa `BD_URL`/`Values.BD_URL` del rol `sigecat_api`. Las tres URLs de administración/migración/runtime no son intercambiables.

Las pruebas mantienen `BD_PRUEBAS_URL` administrador con CREATE DATABASE. No hay dependencia `dotenv` ni carga automática `.env` en los scripts actuales: estos leen `process.env`; **exportar variables en la shell antes de npm**. Core Tools carga `api/local.settings.json` para `func start`, no para `tsx scripts/migrar.ts` lanzado separadamente. No mezclar las tres URLs/roles.

## 5. Configurar y arrancar Functions

Crear `api/local.settings.json` local tomando las claves de `api/local.settings.example.json` y sustituyendo marcadores; no versionarlo. Puede hacerse con el editor; la guía no incorpora secretos reales.

| Variable | Contrato actual |
| --- | --- |
| `BD_URL` | URL runtime PostgreSQL; pool 3 por proceso; puerto local configurado |
| `BD_ADMIN_URL` | Solo configurar roles, permiso administrador; no usar como conexión del servidor |
| `BD_API_CLAVE`, `BD_MIGRADOR_CLAVE` | Secretos locales del bootstrap de roles; no imprimir/versionar |
| `BD_MIGRACIONES_URL` | URL `sigecat_migrador`, dueño de objetos; también CLI de administración inicial; fallback `BD_URL` si falta |
| `BD_PRUEBAS_URL` | Solo integración, CREATE DATABASE local |
| `JWT_KID` | ID clave actual, predeterminado `v1` |
| `JWT_CLAVE` | Clave local aleatoria ≥32 bytes; fallback cuando no existe `JWT_CLAVES` |
| `JWT_CLAVES` | JSON `{ kid: clave }` para rotación; clave actual `JWT_KID` debe existir; no agregar al repositorio |
| `RENOVACION_CLAVE` | Otra clave aleatoria ≥32 bytes para sucesor de token de renovación |
| `URL_WEB` | Base HTTPS para enlaces; `WEB_URL` es alias compatible de fallback, preferir nombre canónico |
| `AzureWebJobsStorage` | `UseDevelopmentStorage=true` para Azurite local |
| `BLOBS_CONEXION` | Azurite local `UseDevelopmentStorage=true`; adaptador Blob de retención exige conexión |
| `FUNCTIONS_WORKER_RUNTIME` | `node` |
| `LIMITE_BUSQUEDAS_APODERADOS` | 1–60/min/cuenta, predeterminado 10; contador PostgreSQL atómico |
| `PUERTO_POSTGRES` | Compose, predeterminado 55432; no variable que el driver descubra automáticamente |

```bash
npm --prefix api start
```

Ejecuta build y `func start`, base local `http://localhost:7071/api`. La URL pública APIM es HTTPS `/v1`; no añadir `/v1` a Functions local. APIM usa clave de suscripción por producto y Function key del gateway; seguridad de usuario JWT se valida también en handlers. El canje de enlace no pide JWT previo; los endpoints de datos sí. No enviar PIN/password: PIN es local.

El principal confirmó inventario Node de las 65 rutas **y smoke HTTP de host real** con `api/scripts/verificar-host.mjs`: `GET /api/yo` y activación de enlace inválido responden 401 genérico, conectado con `BD_URL` API a PostgreSQL local. Core Tools4.15.2/caché extensionBundle4.38.1 están fuera del repo; la descarga inicial bloqueada se resolvió precargando bundle desde CDN en el entorno temporal del principal. Para repetir: `FUNC_BIN` apunta al ejecutable, `PUERTO_HOST_PRUEBA` default7079; construir API, levantar PostgreSQL/Azurite y proporcionar `BD_URL` API. El script genera claves JWT/renovación locales efímeras. Evidencia local, no Azure ni cliente físico.

## 6. Administración inicial, demo y verificadores

Una vez migrada la BD y fijadas claves/URL HTTPS locales en el entorno:

```bash
npm --prefix api run crear:administracion -- "Administración local"
npm --prefix api run sembrar:demo
npm run verificar:migraciones
npm run verificar:cobertura
```

- `crear:administracion` ejecuta `crear-administracion-inicial.ts` y prioriza `BD_MIGRACIONES_URL` sobre `BD_URL`. Creación privilegiada de la primera ADM, una vez; reintento devuelve aviso de existente, sin reemitir enlace. Identidad operativa opcional como argumento (default “Administración inicial”). El principal verificó idempotencia con PostgreSQL real.
- `sembrar:demo` ejecuta `sembrar-demo.ts` con **`BD_URL` de rol API**: cuentas por rol y mixta, catequista menor con seudónimo, grupo y dos niños/apoderado ficticios. Imprime solo `enlacesNuevos`; el principal verificó repetir sin enlaces nuevos. No usar en producción ni introducir datos reales. Enlaces son credenciales: salida para el operador local, nunca logs de servidor.
- `verificar:migraciones` ejecuta `api/scripts/verificar-migraciones.mjs`, base `origin/main` por defecto. Para otra referencia existente: `npm run verificar:migraciones -- <referencia>`. Rechaza modificar/borrar migraciones de base, números duplicados o nombres inválidos; no sustituye checksum de la BD aplicada.
- `verificar:cobertura` ejecuta `scripts/verificar-cobertura-rf.mjs`; informe por spec. Modo bloqueante: `npm run verificar:cobertura -- --bloquear 001` (análogamente 002/003). Citar un RF en el nombre no prueba todos sus criterios UI/campo.
- `npm run adr:build` genera el sitio ADR con Log4brains1.1.0. Status de sustitución usa slug sin `.md`, no enlace Markdown. Esta corrección se verificó con build real de 16 ADRs.

Validación de configuración actual: `api/src/compartido/config.ts` comprueba la URL PostgreSQL al llamar `configuracionBaseDatos()`; pool y claves se obtienen **al necesitar conexión/firma/renovación**, sin exigir secretos Azure al importar módulos de tests/registrar Functions. Errores nombran variable sin valor secreto; la última pasada de tests la registra el principal. Cron de purga es temporizador, no endpoint OpenAPI.

El timer `depurarMetadatos` está registrado a `0 30 9 * * *` UTC y aplica rol/contexto de retención para lápidas vencidas (60 días), luego limpia contadores/referencias. El principal reporta su prueba PostgreSQL en verde; el scheduler de host/cloud conserva su verificación externa.

## Evidencia de cierre

Principal registra fecha, comando, resultado y fuente de cada check en [seguimiento](backend-implementacion.md); esta guía no sustituye ejecutar tests. UI/WatermelonDB JSI, App Links, QR en gama baja, piloto, k6/Azure y proveedores externos 004–008 mantienen sus verificaciones propias. Flex acordado: pool3/proceso, worker1, max5 **por grupo**, HTTP10, 2048MB, always-ready0, timers UTC; no tomar una consulta de timer como garantía de precalentamiento HTTP.

# Demo del 12 de noviembre: arranque, orden y plan B

Una página para exponer SIGECAT de punta a punta con datos sintéticos: **003** (pasar lista sin conexión), **004** (la familia justifica con foto y la coordinación aprueba), **007** (el riesgo baja) y el **asistente**.

Todo corre en tu PC con Windows. Para el detalle de la red y el celular, `docs/demo-asistencia.md`; para Azure, `docs/despliegue-azure.md`.

## 1. Una sola vez (antes de la exposición)

| Necesitas | Cómo |
|---|---|
| Node 22 o 24.3+ | `node -v` |
| Docker Desktop encendido | trae PostgreSQL 16 y Azurite |
| Azure Functions Core Tools v4 | `winget install --id Microsoft.Azure.FunctionsCoreTools --exact`; abre una terminal nueva |
| Dependencias | `npm ci` y `npm --prefix api ci` |
| Expo Go (celular) | compatible con SDK 57; celular y PC en la misma red |
| Regla de firewall 7071 y 8081 | `docs/demo-asistencia.md` §2 |

## 2. Arranque (45 segundos)

En la raíz del repo, en PowerShell. Las claves de abajo son **solo para esta base local**; no las uses en Azure.

```powershell
# 1. Base de datos y Azurite
$env:PUERTO_POSTGRES = "55432"
docker compose -f api/docker-compose.yml up -d

# 2. Variables de esta terminal (no se guardan; hay que repetirlas en cada terminal nueva)
$IP = "192.168.1.77"                      # la IP de tu PC en la red
$env:BD_ADMIN_URL         = "postgresql://postgres:postgres@localhost:55432/sigecat"
$env:BD_API_CLAVE         = "clave-local-api-12345"
$env:BD_MIGRADOR_CLAVE    = "clave-local-migrador-12345"
$env:BD_MIGRACIONES_URL   = "postgresql://sigecat_migrador:$($env:BD_MIGRADOR_CLAVE)@localhost:55432/sigecat"
$env:BD_URL               = "postgresql://sigecat_api:$($env:BD_API_CLAVE)@localhost:55432/sigecat"
$env:BLOBS_CONEXION       = "UseDevelopmentStorage=true"
$env:JWT_CLAVE            = "clave-jwt-local-de-al-menos-32-bytes-0001"
$env:RENOVACION_CLAVE     = "clave-renovacion-local-de-32-bytes-0002"
$env:URL_WEB              = "https://$($IP):8081"          # los enlaces exigen https
$env:URL_APP_EXPO         = "exp://$($IP):8081/--"

# 3. Roles (solo la primera vez en esta base), migraciones y datos de demo, con los 3 enlaces
npm --prefix api run configurar:roles
npm run preparar-demo
```

`preparar-demo` migra, siembra y **imprime los tres enlaces una sola vez** (catequista, coordinación, familia). Cópialos a un bloc de notas. Cada ejecución emite enlaces nuevos y deja sin efecto los anteriores, así que **repítela justo antes de exponer**.

Deja la siembra así: el catequista con *Grupo demo* (8 niños), tres niños en riesgo (2, 3 y 4 faltas) y una familia con ausencias justificables del domingo pasado. *Niño ficticio 2* está en **alerta de retiro con 4 faltas**; sus dos ausencias del último domingo se pueden justificar.

Terminal 2, la API:

```powershell
cd api
npm run build
# Con CORS solo para la web local: agrega a api/local.settings.json (no se versiona) el bloque "Host": { "CORS": "*" }
func start --address 0.0.0.0 --port 7071
```

Terminal 3, la app (celular por Expo Go y web):

```powershell
$env:EXPO_PUBLIC_URL_API = "http://$($IP):7071/api"
npx expo start --lan
```

Comprobación rápida: `curl http://127.0.0.1:7071/api/yo` responde **401** (es lo correcto) y `npm run verificar-demo` termina en «Guion completo sin duplicados» (vuelve a ejecutar `npm run preparar-demo` después).

## 3. Orden de la demo (7 a 8 minutos)

| # | Quién | Qué mostrar | Qué debe verse |
|---|---|---|---|
| 1 | Catequista (celular, Expo Go) | Abre su enlace de Expo Go, fija el PIN, entra a *Grupo demo*, marca 1 ausente, activa modo avión y **Confirmar lista** | «9 registros por enviar». Al quitar el modo avión se sincroniza solo y sin duplicar |
| 2 | Familia (web) | Abre `http://localhost:8081/acceso/familia#t=…` (el mismo enlace con `http://localhost:8081` en lugar de `https://…`) | Ve las ausencias del domingo. Elige las de *Niño ficticio 2*, el motivo *Salud del niño* y una foto, y envía: «Recibimos tu justificación» |
| 3 | Familia | Mis justificaciones | Las dos salen «En revisión» y no se ve la foto |
| 4 | Coordinación (web o celular) | Abre su enlace → **Justificaciones** | El lote con 2 ausencias. Tocar → **Ver evidencia** (URL temporal) → **Aprobar todo el lote** |
| 5 | Coordinación | **Riesgo de deserción** | *Niño ficticio 2* bajó de «Alerta de retiro, 4 faltas» a «Citación, 3 faltas»; el texto lista qué faltas suman |
| 6 | Cualquiera | **Asistente de catequesis** | «¿Qué es el bautismo?» responde con *Documento · Sección*. «¿Quién ganó el mundial?» se abstiene. «¿Cuántas faltas tiene Juan?» rechaza por datos personales |
| 7 | Familia | Volver a Mis justificaciones | Las dos salen «Aprobada» |

Para volver a empezar la parte 004/007 sin reiniciar nada: `npm run preparar-demo` (emite enlaces nuevos).

## 4. Qué decir con honestidad

- 004 se mostró en **web local**, no en un celular real ni desplegado.
- La foto se sube por la API (no por SAS directa al almacenamiento): desviación D-402 anotada en `docs/backend-implementacion.md`.
- Quedan fuera de este corte: justificación anticipada, plazo configurable por HTTP, registro en nombre de un apoderado y la pantalla de avisos de asistencia (módulo 003 «Avisos» sigue en Próximamente).
- El despliegue en Azure: web publicada y `/v1/estado` si se logró; si no, `infra/scripts/preparar-azure.sh --simular`, el workflow y `docs/despliegue-azure.md` con el estado al 2026-11-12.
- Los datos son sintéticos y el asistente usa solo material público.

## 5. Plan B si algo falla

| Falla | Qué hacer |
|---|---|
| `func start` no arranca o no instalaste Core Tools | `npm run verificar-004` recorre 004 y 007 contra la BD y Azurite sin Core Tools y escribe cada paso con OK. Es evidencia en vivo del flujo completo; después ejecuta `npm run preparar-demo` |
| Sin red en el aula | Usa el hotspot de tu celular; la API y la app corren en tu PC |
| La web no llega a la API | Falta CORS en `local.settings.json` (sección 2) o `EXPO_PUBLIC_URL_API` apunta a otra IP |
| El enlace ya no sirve | Se usó o se volvió a sembrar: `npm run preparar-demo` y copia los nuevos |
| El celular quedó bloqueado (5 PIN fallidos) | Vuelve a sembrar: sale un enlace nuevo |
| Docker apagado | Enciéndelo y repite `docker compose -f api/docker-compose.yml up -d` |
| Todo cae | Muestra las capturas y el video corto grabados en el ensayo, el flujograma y `docs/mockups/` |

## 6. Verificaciones que respaldan esta demo (2026-11-12)

`npm run typecheck`, `npm run lint`, `npm test` (cliente y API con PostgreSQL y Azurite), `node api/scripts/verificar-openapi.mjs`, `npm --prefix api run build` y `npx expo export --platform web`. El recorrido real de 004 y 007 lo ejecuta `npm run verificar-004`.

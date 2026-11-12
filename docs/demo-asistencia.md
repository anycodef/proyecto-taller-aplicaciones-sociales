# Demo de asistencia dominical (spec 003) — guion local

Pasar lista **sin conexión** en el celular y **sincronizar** al volver la red.
Todo corre en esta PC: PostgreSQL local, Azure Functions Core Tools local y la
app en Expo Go. **Nada de Docker, nada de Azure en la nube.**

- Fecha de la última verificación: 2026-11-12.
- Equipo verificado: Windows, Expo Go, API local y PostgreSQL local.
- Alcance verificado: **el guion completo contra la API real** (`npm run verificar-demo`).
- **No verificado en un teléfono real**: la parte del celular (activación, PIN,
  modo avión y reconexión) no se puede automatizar aquí. Hay que repasarla a mano
  antes de la exposición.

---

## 1. Requisitos de esta PC

| Pieza | Estado | Nota |
| --- | --- | --- |
| Node 22 o superior | instalado | `node --version` |
| Azure Functions Core Tools v4 | **4.16.0** | `winget install --id Microsoft.Azure.FunctionsCoreTools --exact`. Queda en `C:\Program Files\Microsoft\Azure Functions Core Tools\func.exe` y en el PATH del sistema (abre una terminal nueva para que lo vea) |
| PostgreSQL local | servicio `postgresql-x64-18` | Escucha en el **puerto 5433** (no es el 5432 por defecto). Base `sigecat` |
| Expo Go en el celular | instalado | Debe ser una versión compatible con SDK 57 |
| Celular y PC en la misma red | — | La IP de esta PC es `192.168.1.77` (Ethernet). Si cambia, cambiala en todos los comandos |

### Dependencias del proyecto (no se instala nada nuevo para la demo)

Ya instaladas y **funcionan en Expo Go** (verificado en la documentación del
SDK 57): `expo-file-system` 57.0.7, `expo-crypto` 57.0.4,
`@react-native-community/netinfo` 12.0.1, `expo-secure-store`,
`expo-router`, `expo-linking`, `expo-clipboard`, `react-native` 0.86.3.

**No se usan** en la demo (requieren build nativo o aprobación): `expo-camera`
(escáner APP-20), `expo-dev-client`, `@nozbe/watermelondb`, `expo-sqlite`.
El almacén local de la demo es el archivo `sigecat-asistencia.json` que escribe
`expo-file-system`.

---

## 2. Permitir el tráfico desde el celular (una vez, como administrador)

El firewall de Windows bloquea por defecto los puertos entrantes. Abre
**PowerShell como administrador** y ejecuta:

```powershell
New-NetFirewallRule -DisplayName "SIGECAT demo API (7071)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 7071 -Profile Private -RemoteAddress LocalSubnet
New-NetFirewallRule -DisplayName "SIGECAT demo Metro (8081)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8081 -Profile Private -RemoteAddress LocalSubnet
```

- `7071` es la API. `8081` es el servidor de desarrollo de Expo (el celular lo
  necesita para cargar el bundle).
- `RemoteAddress LocalSubnet` deja entrar solo a la red local.
- Para quitarlos después: `Remove-NetFirewallRule -DisplayName "SIGECAT demo API (7071)","SIGECAT demo Metro (8081)"`.

---

## 3. Comandos exactos desde cero

Abre **dos** terminales en `D:\Documents\proyecto-taller-aplicaciones-sociales`.

### 3.1 Base de datos (una vez, y de nuevo si se cambia la base)

```powershell
$env:BD_ADMIN_URL="postgresql://postgres:postgres@127.0.0.1:5433/sigecat"
$env:BD_API_CLAVE="demo-local-api-clave-2026"
$env:BD_MIGRADOR_CLAVE="demo-local-migrador-clave-2026"
npm --prefix api run configurar:roles
$env:BD_MIGRACIONES_URL="postgresql://sigecat_migrador:demo-local-migrador-clave-2026@127.0.0.1:5433/sigecat"
npm --prefix api run migrar
```

### 3.2 Configuración local de la API (archivo ignorado por git)

Crea `api/local.settings.json` (no se versiona) con este contenido:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "BD_URL": "postgresql://sigecat_api:demo-local-api-clave-2026@127.0.0.1:5433/sigecat",
    "JWT_CLAVE": "c9f1e2a4b7d3568012c4e9f7a6b3d5e8c1a47f2096b3d8e5c2a7f0194b6d3e85c",
    "JWT_KID": "v1",
    "RENOVACION_CLAVE": "5b8e3d1f7a2c46e9b0d5f3a8c1e47d9b6f2a05c8e3d714b9c6a2f5d8e1c3b7a49",
    "URL_WEB": "https://192.168.1.77:8081",
    "BLOBS_CONEXION": ""
  }
}
```

### 3.3 Levantar la API (terminal 1)

```powershell
cd D:\Documents\proyecto-taller-aplicaciones-sociales
npm --prefix api run build
cd api
func start --address 0.0.0.0 --port 7071 --functions activarEquipo renovarSesion yo sincronizacionPull sincronizacionPush
```

- `--address 0.0.0.0` hace que la API escuche en **todas las interfaces**, para
  que el celular la alcance por `192.168.1.77`.
- `--functions ...` carga **solo las cinco rutas de la demo**. Es la decisión
  tomada para esta demo: los temporizadores del servidor exigen
  `AzureWebJobsStorage` (Azurite) y, sin contenedor y sin Azurite por npm, el
  host no arranca. Con `--functions` no se registra ningún temporizador, así que
  **no hace falta Azurite ni Docker**. El aviso
  `webjobs.storage Unhealthy` del log es esperable y no afecta a las rutas.
- Debe verse en el log: `activarEquipo`, `renovarSesion`, `sincronizacionPull`,
  `sincronizacionPush` y `yo`.
- Comprobación rápida: `Invoke-WebRequest http://127.0.0.1:7071/api/yo` responde
  **401** (es correcto: sin token no hay sesión).

### 3.4 Sembrar los datos de la demo (terminal 2, justo antes de exponer)

```powershell
cd D:\Documents\proyecto-taller-aplicaciones-sociales
$env:BD_URL="postgresql://sigecat_api:demo-local-api-clave-2026@127.0.0.1:5433/sigecat"
$env:URL_WEB="https://192.168.1.77:8081"
$env:URL_APP_EXPO="exp://192.168.1.77:8081/--"
npm run sembrar-demo
```

Imprime el bloque `demo` con el **enlace de activación** del catequista y el
**enlace de Expo Go**:

```
"enlace":      "https://192.168.1.77:8081/acceso/equipo#t=...",
"enlaceExpo":  "exp://192.168.1.77:8081/--/acceso/equipo#t=..."
```

La siembra crea: ciclo abierto, **Grupo demo** con **8 niños**, la **sesión de
catequesis de hoy** (ventana de todo el día) y el enlace de la cuenta
*Catequista demo*. **Se puede repetir**: no duplica nada y siempre deja un
enlace nuevo (invalida el anterior). Repítela el mismo día de la exposición.

### 3.5 Ensayo automático del guion (opcional pero recomendado)

```powershell
$env:URL_API="http://127.0.0.1:7071/api"
$env:BD_URL="postgresql://sigecat_api:demo-local-api-clave-2026@127.0.0.1:5433/sigecat"
npm run verificar-demo
```

Debe terminar así:

```
1. Enlace activado: Catequista demo (catequista)
2. Nomina bajada: 1 grupo(s), 8 ninos, 106 sesion(es)
3. Lista preparada: 7 presentes, 1 ausente(s), 8 marcas
4. Primer envio: aceptados=9 rechazados=0
5. Reenvio del mismo lote: aceptados=9 rechazados=0
6. En el servidor: 8 marcas, 1 lista(s), 8 ninos distintos
Guion completo sin duplicados en el servidor
```

Vuelve a sembrar después del ensayo (para dejar la sesión limpia).

### 3.6 Levantar la app (terminal 2)

```powershell
cd D:\Documents\proyecto-taller-aplicaciones-sociales
$env:EXPO_PUBLIC_URL_API="http://192.168.1.77:7071/api"
npx expo start --lan
```

- `EXPO_PUBLIC_URL_API` es la dirección de la API **tal como la ve el celular**
  (por la IP de la red local, no `localhost`).
- Metro **inyecta** esa variable al empaquetar: si la cambias, reinicia Metro con
  `npx expo start --lan -c`.
- Escanea el código QR con el celular (Expo Go) o escribe a mano
  `exp://192.168.1.77:8081`.

---

## 4. Guion paso a paso

| # | En el celular | Qué se ve |
| --- | --- | --- |
| 1 | Abre `exp://192.168.1.77:8081/--/acceso/equipo#t=...` (o copia el enlace y pulsa **Pegar enlace** en la portada, en Android) | "Abriendo tu enlace…" y luego la pantalla de **fijar el PIN** |
| 2 | Fija un PIN de 4 dígitos (p. ej. `1234`) y confírmalo | Entra al menú **Pasar lista** con la insignia "Conectado" |
| 3 | Toca **Grupo demo** | La lista de catequesis: los 8 niños, todos con **Presente** |
| 4 | Toca a un niño | Ese niño pasa a **Ausente** (un toque) |
| 5 | **Activa el modo avión** (en el celular) | La insignia cambia a "Sin conexión" y aparece el aviso "Sin conexión. La lista se guarda en el celular y se envía al volver la red." |
| 6 | Toca **Confirmar lista** | "Lista guardada en el celular." y arriba "Sesión del 2026-11-12" |
| 7 | Vuelve al menú | **"9 registros por enviar"** (1 lista + 8 marcas) |
| 8 | Toca **9 registros por enviar** | "Por enviar" con **"9 registros esperando señal"**, la lista de los niños y el aviso "Se envían solos cuando vuelve la conexión" |
| 9 | **Desactiva el modo avión** | En unos segundos la app sincroniza sola: el menú deja de mostrar "9 registros por enviar" y "Por enviar" dice "No hay registros esperando" |
| 10 | Opcional: `npm run verificar-demo` otra vez, o la consulta de abajo | El servidor tiene 8 marcas y 1 lista de la sesión, sin duplicados |

> **Aviso importante.** En modo avión el celular pierde **también el servidor de
> Expo**: no cierres ni recargues la app (no arrastres el dedo para refrescar ni
> cierres la app de Expo Go) mientras estés sin conexión. El bundle ya cargado
> sigue corriendo y la lista se guarda igual; si recargas, la app pierde la
> pantalla y con ella la demostración. Lo mismo con el modo avión en el
> **servidor**: no apagues la red de la PC.

Verificación en la base (PowerShell):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -p 5433 -U postgres -d sigecat -tAc "select count(*) from marca_asistencia where tipo_registro='lista';"
```

Debe dar **8** (una por niño), y `select count(*) from lista_asistencia;` da **1**.

---

## 5. Si algo falla

| Síntoma | Causa probable | Qué hacer |
| --- | --- | --- |
| El celular no conecta con la API (todo en "Sin conexión") | Regla de firewall o IP equivocada | Repite §2 como administrador; confirma que `EXPO_PUBLIC_URL_API` usa `192.168.1.77` y reinicia Metro con `-c` |
| La app no carga el bundle | Metro no es alcanzable | Regla de firewall del 8081; prueba `http://192.168.1.77:8081` desde el navegador del celular |
| "Hoy no hay catequesis de este grupo" en la lista | La sesión de demo es de otro día | Repite §3.4 (crea la sesión de hoy) y vuelve a sincronizar |
| La lista no deja confirmar | No hay sesión de catequesis en el celular | Sincroniza primero (el menú tiene **Sincronizar ahora**) y abre la lista después |
| "El servidor rechazó algunas marcas" | El registro se hizo **antes** de activar la credencial, o el reloj del celular va atrasado | Espera unos segundos entre activar y pasar lista; mira el motivo en la base: `select detalle->>'motivo', count(*) from aviso_asistencia group by 1;` |
| El celular quedó bloqueado (5 PIN fallidos) | PIN incorrecto | Vuelve a sembrar (§3.4): sale un enlace nuevo |
| `func start` dice que no encuentra el host | El PATH de la terminal es viejo | Abre una terminal nueva (Core Tools se agregó al PATH del sistema) o llama a `"C:\Program Files\Microsoft\Azure Functions Core Tools\func.exe"` |
| El host no levanta con otro comando | Los temporizadores exigen almacenamiento | Vuelve a usar `--functions` con las cinco rutas de la demo (§3.3) |
| El puerto 7071 está ocupado | Otra instancia del host | `Get-NetTCPConnection -LocalPort 7071` y cierra la otra terminal |
| `npm run verificar-demo` dice "El servidor rechazó registros" | La sesión ya tiene marcas de un intento anterior | Vuelve a sembrar (§3.4): la siembra limpia las marcas de la sesión de demo |

---

## 6. Qué quedó sin comprobar

- **El teléfono real**: activación, PIN, modo avión, reconexión y el conteo en
  pantalla se han probado contra la API real y con las pruebas automáticas del
  cliente, pero no en un dispositivo físico.
- El escáner de carnés (APP-20) y sus cuatro resultados: fuera de la demo
  porque `expo-camera` necesita aprobación.
- La base local con WatermelonDB o `expo-sqlite`: fuera de la demo; el
  almacén actual es el archivo local con `expo-file-system`.
- APP-30 (elegir grupo) como pantalla propia: el guion usa la lista de grupos
  del menú.
- Pruebas de campo, mediciones en dispositivo y el resto de la spec 003
  (T003-02 a T003-05, T003-67 a T003-72, T003-94 como e2e de dos celulares).

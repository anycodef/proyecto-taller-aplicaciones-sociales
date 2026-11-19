# Despliegue de SIGECAT en Azure

Guía para dejar la API, la base de datos y la web en Azure, verificar la seguridad,
comprobar que una caída se detecta y avisa, y conectar las pantallas. Se ejecuta en
orden; cada paso indica cómo comprobar que salió bien.

- **Arquitectura y decisiones:** spec 001 (`specs/001-acceso-y-roles/plan.md` §8) y
  `infra/README.md`.
- **Lo que agrega esta guía:** spec 012 (`specs/012-despliegue-y-recorrido/`).

| Paso | Quién | Necesita |
|---|---|---|
| 0–3 | Responsable del despliegue | Cuenta de Azure con la suscripción de crédito educativo (Owner de la suscripción) y administración del repositorio en GitHub |
| Aprobar despliegues | Revisores del entorno `prod` | Cuenta de GitHub en la lista `REVISORES` |
| 5, ensayo de caída | Responsable del despliegue, con el equipo avisado | Ventana acordada sin usuarios reales |
| 6–7 | Responsable del despliegue y dueños de 003, 004 y 007 | Pantallas unidas a `main` |

Ningún comando de esta guía imprime secretos, salvo el enlace de la administración
inicial del paso 2.4, que es una credencial: ábrelo enseguida y no lo pegues en chats.

## 0. Antes de empezar

1. **Herramientas en tu equipo:**

   ```sh
   sudo pacman -S azure-cli        # o la instalación de tu sistema
   az version && gh --version && node --version   # Node 22 o superior
   ```

2. **Inicia sesión en Azure** con la cuenta que tiene el crédito educativo y elige la
   suscripción:

   ```sh
   az login --use-device-code
   az account list --output table
   az account set --subscription "<nombre o id>"
   ```

3. **Comprueba que el CI de `main` está en verde.** `despliegue.yml` no despliega con
   CI en rojo. Une primero la rama `despliegue/azure-prod`, que corrige las dos causas
   del fallo (spec 012, T012-01).

   ```sh
   gh run list --workflow ci.yml --branch main --limit 1
   ```

4. **Decide tres cosas antes del paso 1:**
   - El correo que recibirá el aviso de presupuesto y la alerta de caída.
   - Los logins de GitHub que aprobarán despliegues.
   - Si quien despliega también aprueba. Si es así, usa `IMPEDIR_AUTOAPROBACION=no`;
     si no, otra persona tiene que aprobar cada despliegue.

## 1. Preparación única de Azure y GitHub

`infra/scripts/preparar-azure.sh` hace, sin duplicar nada si se repite:
- Comprueba la región y que Functions Flex esté disponible en ella.
- Registra los proveedores de recursos y crea `rg-sigecat-prod`.
- Crea la identidad `id-sigecat-github` con una credencial federada válida solo para
  `repo:<repo>:environment:prod`.
- Le asigna, solo sobre el grupo y sin Owner:
  - Contributor.
  - Key Vault Secrets Officer.
  - Role Based Access Control Administrator, limitado a los cuatro roles que asigna
    la plantilla.
- Crea el entorno `prod` en GitHub (solo rama `main`, con revisores) y sus
  variables.

1. **Mira primero qué hará, sin cambiar nada:**

   ```sh
   CORREO_PRESUPUESTO=<correo> REVISORES=<login1>,<login2> infra/scripts/preparar-azure.sh --simular
   ```

2. **Ejecútalo de verdad.** Con `--what-if`, el script además previsualiza los recursos
   de la plantilla con una clave ficticia que no se guarda:

   ```sh
   CORREO_PRESUPUESTO=<correo> CORREO_ALERTAS=<correo-operación> REVISORES=<login1>,<login2> \
     infra/scripts/preparar-azure.sh --what-if
   ```

3. **Comprueba:**

   ```sh
   gh api repos/anycodef/proyecto-taller-aplicaciones-sociales/environments/prod --jq '.name, [.protection_rules[].type]'
   gh variable list --env prod --repo anycodef/proyecto-taller-aplicaciones-sociales
   az role assignment list --resource-group rg-sigecat-prod --query "[].roleDefinitionName" --output tsv
   ```

**Si algo falla:**
- **El what-if responde `RequestDisallowedByAzure`:** la suscripción no permite esa
  región. Repite con otra: `UBICACION=<región> UBICACION_WEB=<región> …`. La lista de
  regiones con Flex la muestra el propio script.
- **No puedes crear identidades administradas:** la alternativa es un registro de
  aplicación en Entra con la misma credencial federada. Se crea en Portal → Entra ID →
  Registros de aplicaciones → Certificados y secretos → Credenciales federadas →
  GitHub Actions, entorno `prod`. Asigna los mismos tres roles y pon su
  `AZURE_CLIENT_ID` en el entorno `prod`.

## 2. Desplegar la API y la base de datos

El primer despliegue va con `solo_plan=false`. El modo plan necesita una bóveda y
secretos que todavía no existen. El what-if del paso 1 y la aprobación del entorno
`prod` hacen de revisión previa.

1. **Lanza el workflow y apruébalo** en GitHub → Actions → la ejecución → *Review
   deployments*:

   ```sh
   gh workflow run despliegue.yml --ref main -f solo_plan=false
   gh run watch "$(gh run list --workflow despliegue.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
   ```

   `.github/workflows/despliegue.yml`, junto con `infra/scripts/desplegar.py`, hace
   esto en orden:
   1. Ejecuta el CI completo.
   2. Crea Key Vault y genera ahí las claves (nunca en GitHub).
   3. Hace el what-if y crea PostgreSQL 16, Storage, Functions Flex, APIM,
      Application Insights, la web y el presupuesto.
   4. Abre en el firewall una regla temporal para el runner.
   5. Prepara los roles de PostgreSQL y aplica las migraciones con el migrador.
   6. Cierra la regla del firewall, aunque haya fallado algo.
   7. Publica la API y guarda la clave de host en Key Vault.
   8. Activa las políticas de APIM: JWT, CORS, límites, sonda y alerta.

2. **Anota las salidas** que usan los pasos siguientes:

   ```sh
   az deployment group show --resource-group rg-sigecat-prod --name sigecat-prod \
     --query "properties.outputs.{api:urlApi.value, estado:urlEstado.value, web:urlWeb.value, nombreWeb:nombreWeb.value, apim:nombreApim.value, funciones:nombreFunciones.value, boveda:nombreBoveda.value, postgres:nombrePostgres.value}" --output json
   ```

3. **Comprobación rápida:** `curl -i <estado>` debe responder `200` con
   `{"estado":"disponible"}` y `Cache-Control: no-store`.

4. **Crea la cuenta de administración inicial.** Es la única cuenta que se crea
   fuera de la app; las demás se crean desde la pantalla Cuentas. Necesitas leer un
   secreto de Key Vault y una regla de firewall temporal para tu IP:

   ```sh
   GRUPO=rg-sigecat-prod
   BOVEDA=<boveda>; POSTGRES=<postgres>; WEB=<web>
   az role assignment create --assignee "$(az ad signed-in-user show --query id --output tsv)" \
     --role "Key Vault Secrets User" --scope "$(az keyvault show --name "$BOVEDA" --query id --output tsv)"
   MI_IP=$(curl -s https://api.ipify.org)
   az postgres flexible-server firewall-rule create --resource-group "$GRUPO" --name "$POSTGRES" \
     --rule-name administracion-local --start-ip-address "$MI_IP" --end-ip-address "$MI_IP"
   npm --prefix api ci
   BD_URL="$(az keyvault secret show --vault-name "$BOVEDA" --name bd-url-migrador --query value --output tsv)" \
     URL_WEB="$WEB" npm --prefix api run crear:administracion -- "Administración parroquial"
   az postgres flexible-server firewall-rule delete --resource-group "$GRUPO" --name "$POSTGRES" \
     --rule-name administracion-local --yes
   ```

   El comando imprime `{"cuentaId": …, "url": …}`. La administración abre esa `url`
   en su celular y fija su PIN. Si el enlace se pierde, se emite otro con el mismo
   entorno y `npm --prefix api run reemitir:administracion`, que ejecuta
   `api/scripts/reemitir-administracion.ts`.

   **Datos de demostración (opcional, solo antes de cargar datos reales):** con el
   mismo entorno, `npm --prefix api run sembrar:demo` y luego
   `npm --prefix api run sembrar:riesgo` crean cuentas, grupos y niños ficticios e
   imprimen sus enlaces. Lo hacen `api/scripts/sembrar-demo.ts` y
   `api/scripts/sembrar-riesgo-demo.ts`.

Los despliegues siguientes usan el mismo workflow. Desde el segundo despliegue
puedes previsualizar con `-f solo_plan=true`.

## 3. Publicar la web

La web es la exportación estática de Expo y se publica en Static Web Apps. Necesita,
al compilarse, la URL de la API y una clave del producto `web-familias` de APIM. Esa
clave queda visible en el JavaScript público; la protección real es el JWT y los
límites por suscripción y por cuenta.

1. **Crea la suscripción de APIM de la web** y guarda su clave directamente como
   secreto de GitHub, sin imprimirla:

   ```sh
   GRUPO=rg-sigecat-prod; APIM=<apim>; SUSCRIPCION=$(az account show --query id --output tsv)
   BASE="https://management.azure.com/subscriptions/$SUSCRIPCION/resourceGroups/$GRUPO/providers/Microsoft.ApiManagement/service/$APIM"
   az rest --method put --url "$BASE/subscriptions/web-familias?api-version=2024-05-01" \
     --body "{\"properties\":{\"scope\":\"$BASE/products/web-familias\",\"displayName\":\"web-familias\",\"state\":\"active\"}}" --output none
   az rest --method post --url "$BASE/subscriptions/web-familias/listSecrets?api-version=2024-05-01" --query primaryKey --output tsv \
     | gh secret set CLAVE_APIM_WEB --repo anycodef/proyecto-taller-aplicaciones-sociales
   ```

   Para la app móvil se hace lo mismo con `app-movil`; esa clave va en
   `EXPO_PUBLIC_CLAVE_APIM` al compilar la app.

2. **Configura las variables** (`<api>` y `<nombreWeb>` son las salidas del paso 2.2):

   ```sh
   R=anycodef/proyecto-taller-aplicaciones-sociales
   gh variable set URL_API_PUBLICA --body "<api>" --repo "$R"
   gh variable set AZURE_NOMBRE_WEB --env prod --body "<nombreWeb>" --repo "$R"
   gh variable set FRONTEND_HABILITADO --body true --repo "$R"
   ```

3. **Genera el artefacto y publícalo.** El job `web` de `.github/workflows/ci.yml`
   exporta la web en cada push a `main`. Para forzarlo sin push:

   ```sh
   gh workflow run ci.yml --ref main
   EJECUCION=$(gh run list --workflow ci.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
   gh run watch "$EJECUCION"
   gh workflow run despliegue-web.yml --ref main -f ejecucion_frontend="$EJECUCION"
   ```

   `.github/workflows/despliegue-web.yml` rechaza artefactos que no vengan de una
   ejecución exitosa de `ci.yml` en `main`. Pide aprobación del entorno `prod`.

4. **Comprueba** que `https://<web>` abre la pantalla de inicio y que
   `https://<web>/acceso/equipo` también carga.

| Nombre | Tipo | Dónde | Lo define |
|---|---|---|---|
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | Variable | Entorno `prod` | Paso 1 |
| `AZURE_UBICACION`, `AZURE_UBICACION_WEB` | Variable | Entorno `prod` | Paso 1 |
| `CORREO_PRESUPUESTO`, `INICIO_PRESUPUESTO`, `CORREO_ALERTAS` | Variable | Entorno `prod` | Paso 1 |
| `AZURE_NOMBRE_WEB` | Variable | Entorno `prod` | Paso 3 |
| `URL_API_PUBLICA`, `FRONTEND_HABILITADO` | Variable | Repositorio | Paso 3 |
| `CLAVE_APIM_WEB` | Secreto | Repositorio | Paso 3 |

## 4. Verificar seguridad

`infra/scripts/verificar-despliegue.mjs` comprueba lo publicado y termina con
código 1 si algo falla. La clave se lee de una variable de entorno para que no
quede en el historial:

```sh
VERIFICAR_CLAVE_APIM="$(az rest --method post --url "$BASE/subscriptions/web-familias/listSecrets?api-version=2024-05-01" --query primaryKey --output tsv)" \
  node infra/scripts/verificar-despliegue.mjs --api "<api>" --web "https://<web>" --evidencia verificacion-$(date -u +%F).json
```

| Comprobación | Esperado | Si falla |
|---|---|---|
| `estado` | 200, `no-store`, `{"estado":"disponible"}` | Revisar la API y PostgreSQL; `az functionapp log` o Application Insights |
| `sin-credencial` | 401 sin clave ni JWT | La API `sigecat` de APIM debe exigir suscripción |
| `sin-jwt` | 401 con clave y sin JWT | La política `validate-jwt` no está activa: repetir `despliegue.yml` |
| `solo-https` | Ningún 2xx por HTTP | La API de APIM debe tener solo el protocolo `https` |
| `cors-web` / `cors-ajeno` | Permite solo el origen de la web | La política global debe usar la `urlWeb` real |
| `web-cabeceras` | HSTS, CSP, `nosniff`, `no-referrer` | `public/staticwebapp.config.json` no llegó al artefacto |
| `web-ruta-interna` | 200 en `/acceso/equipo` | `navigationFallback` de Static Web Apps |

Comprobaciones adicionales en Azure (solo imprimen nombres o estados, nunca valores):

```sh
az keyvault show --name "$BOVEDA" --query "properties.{rbac:enableRbacAuthorization, purga:enablePurgeProtection}"
az functionapp config appsettings list --resource-group "$GRUPO" --name <funciones> \
  --query "[?starts_with(value, '@Microsoft.KeyVault')].name" --output tsv     # los secretos son referencias a Key Vault
az postgres flexible-server parameter show --resource-group "$GRUPO" --server-name "$POSTGRES" \
  --name require_secure_transport --query value --output tsv                   # on
curl -s -o /dev/null -w '%{http_code}\n' "https://<funciones>.azurewebsites.net/api/estado"   # 401: el origen exige clave de host
az consumption budget list --resource-group "$GRUPO" --query "[].{nombre:name, monto:amount}" --output table
```

Guarda el JSON de evidencia en la entrega, no en el repositorio.

## 5. Monitoreo y ensayo de caída

**Qué hay desplegado:**
- Application Insights: muestreo del 10 %, tope diario de ingesta, sin cuerpos de
  peticiones.
- Sonda estándar `sigecat-disponibilidad-prod`: llama a `/estado/` cada 5 minutos desde
  Virginia, Texas y California y valida TLS, el 200 y el cuerpo.
- Alerta `sigecat-disponibilidad-prod-caida`: se evalúa cada minuto sobre 5 minutos y
  dispara cuando fallan 2 ubicaciones. Avisa por correo al grupo de acciones
  `sigecat-disponibilidad-prod-operacion` y se resuelve sola al recuperarse.

1. **Comprueba que la sonda y la alerta están activas:**

   ```sh
   az resource list --resource-group "$GRUPO" --resource-type Microsoft.Insights/webtests --query "[].name" --output tsv
   az monitor metrics alert show --resource-group "$GRUPO" --name sigecat-disponibilidad-prod-caida --query "{activa:enabled, severidad:severity}"
   ```

2. **Prueba el canal de correo:** Portal → Monitor → Alertas → Grupos de acciones →
   `sigecat-disponibilidad-prod-operacion` → *Probar*. Confirma que llega, revisando
   también la carpeta de spam. Esto solo demuestra que el correo llega, no que se
   detecte una caída.

3. **Ensayo de caída.** Avisa al equipo y elige una ventana sin usuarios reales. El
   script `infra/scripts/ensayo-caida.mjs` hace lo siguiente:
   1. Comprueba que la API responde y que la alerta no está disparada.
   2. Detiene la Function App y espera a que `/estado/` falle.
   3. Espera la alerta disparada, hasta 30 minutos.
   4. Te pide la hora de llegada del correo.
   5. Reinicia la Function App **siempre**, también ante error o Ctrl+C.
   6. Espera la recuperación y la resolución de la alerta.
   7. Guarda las horas UTC de cada paso.

   ```sh
   node infra/scripts/ensayo-caida.mjs --confirmar --evidencia ensayo-caida-$(date -u +%F).json
   ```

   Con estos valores, la alerta suele tardar varios minutos (del orden de 5 a 15) y
   el correo algo más. El valor real es el que registra el ensayo; no prometas un
   plazo menor. Si el script se corta sin reiniciar:
   `az functionapp start --resource-group rg-sigecat-prod --name <funciones>`.

   La evidencia cierra T001-156 y T012-09 si incluye la caída observada, la alerta
   disparada, la hora del correo, la recuperación y la resolución.

## 6. Conectar pantallas

Los paneles de entrada leen los módulos de `src/lib/navegacion/modulos.ts`. Un módulo
aparece como enlace solo si:
- está marcado `disponible`,
- su pantalla existe en `src/app`, y
- el rol tiene el permiso en `MATRIZ_PERMISOS`.

Si falta cualquiera de las tres cosas, aparece en «Próximamente».

**Estado al 2026-11-12:**

| Módulo | Ruta | Estado |
|---|---|---|
| 003 Pasar lista | `/asistencia` | Conectado: es el inicio del catequista y una opción del panel de coordinación |
| 003 Avisos de asistencia | `/coordinacion/avisos-asistencia` | Pendiente: no existe la pantalla (la coordinación ve hoy «Avisos del sistema» en `/avisos-sistema`) |
| 004 Justificaciones (coordinación) | `/coordinacion/justificaciones` | Conectado: bandeja por lote, detalle con evidencia, aprobar y rechazar con motivo. API con 8 operaciones (`docs/backend-implementacion.md`) |
| 004 Justificar una ausencia (familia) | `/familia/justificar` | Conectado: ausencias, motivo, foto, envío y «Mis justificaciones». Sin conexión muestra «No se envió» y no guarda la foto |
| 007 Riesgo de deserción | `/riesgo` | Conectado para coordinación (panel) y catequista (menú de asistencia), con las faltas que originan cada paso |
| Asistente de catequesis | `/asistente` | Conectado para coordinación, catequista y familia (no usa el registro de módulos: es una ruta compartida) |

Las pantallas internas de 003 (lista del grupo y «Por enviar») las enlaza la propia
pantalla de asistencia de la rama `frontend-001_003`. Al unir esa rama a `main`
quedan conectadas sin tocar el registro. El contador de alertas abiertas junto al
acceso a Riesgo (RF-707) es parte de la spec 007.

**Para conectar una pantalla terminada:**
1. Une su rama a `main`.
2. En `src/lib/navegacion/modulos.ts`, cambia su `estado` a `"disponible"`. Si su spec
   creó un permiso nuevo, comprueba que `accion` lo nombre.
3. Ejecuta `npm run test:app`. La prueba RF-1206 falla si la ruta no existe o el
   permiso no está en la matriz.
4. Haz push a `main`: el CI genera la web nueva y la publicas con el paso 3.3.

## 7. Recorrido completo

Se hace en la web y la app publicadas, con datos sintéticos, cuando los módulos estén
conectados (T012-10).

- [ ] **001:** la administración entra por su enlace y crea las cuentas de
  coordinación, catequista y familia, cada una con su enlace.
- [ ] **003:** el catequista pasa lista y marca a un niño ausente. El registro aparece
  como enviado en «Por enviar».
- [ ] **004:** la familia entra por su enlace, ve la ausencia y la justifica con foto.
- [ ] **004:** coordinación abre Justificaciones y aprueba el lote.
- [ ] **007:** en Riesgo, la falta deja de contar y el paso del niño se actualiza.
- [ ] **Monitoreo:** Application Insights registra las peticiones sin cuerpos y la
  sonda sigue en verde.

## 8. Reversión

| Situación | Acción |
|---|---|
| Web defectuosa | `gh workflow run despliegue-web.yml --ref main -f ejecucion_frontend=<id de una ejecución anterior>` |
| API defectuosa | Revertir el commit en `main` y repetir `despliegue.yml`. Las migraciones aplicadas no se editan: se corrige con una migración nueva |
| Pausar para ahorrar crédito | `az functionapp stop -g rg-sigecat-prod -n <funciones>` y `az postgres flexible-server stop -g rg-sigecat-prod -n <postgres>`. PostgreSQL vuelve a arrancar solo a los 7 días. Con la API detenida, la alerta de caída se dispara |
| Secreto expuesto | Rotar en Key Vault con el responsable de seguridad (JWT con `JWT_KID_ANTERIOR`, ver `infra/README.md`) y repetir `despliegue.yml` |
| Retirar todo | `az group delete --name rg-sigecat-prod`. **Es irreversible:** borra datos y recursos, y la bóveda queda en borrado temporal con su nombre reservado |

## 9. Costos

Todo se factura contra el crédito de la suscripción.
- El presupuesto mensual de US$5 avisa al 80 % por correo, pero no detiene nada.
- El consumo se revisa en Portal → Cost Management → Análisis de costos, filtrando por
  `rg-sigecat-prod`.
- Antes del despliegue real, consulta los precios de la región elegida.

| Recurso | Plan | Qué se cobra |
|---|---|---|
| PostgreSQL Flexible | B1ms, 32 GB | Horas encendido y almacenamiento. Es el mayor costo fijo: detenerlo cuando no se use |
| Functions | Flex Consumption, sin instancias siempre listas | Ejecuciones y memoria por segundo, sobre la concesión gratuita |
| API Management | Consumo | Llamadas, sobre la cuota gratuita mensual |
| Prueba de disponibilidad estándar | 3 ubicaciones cada 5 min (unas 864 al día) | Cada ejecución |
| Application Insights / Log Analytics | Muestreo del 10 %, tope diario | Ingesta |
| Key Vault, Storage, Static Web Apps Free | — | Operaciones y almacenamiento mínimos; Static Web Apps Free no cuesta |

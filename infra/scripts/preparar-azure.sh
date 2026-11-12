#!/usr/bin/env bash
# Preparacion unica de Azure y GitHub para despliegue.yml (RF-1205, T001-26).
# Crea el grupo, registra proveedores, crea una identidad administrada con
# credencial federada solo para el entorno prod del repositorio y le da roles de
# minimo privilegio en el grupo (sin Owner). Despues configura el entorno prod de
# GitHub. Es idempotente. No guarda ni imprime secretos (RNF-1202).
#
# Uso:
#   CORREO_PRESUPUESTO=correo@dominio REVISORES=login1,login2 infra/scripts/preparar-azure.sh [--simular] [--what-if] [--sin-github]
#
# Variables (todas opcionales salvo CORREO_PRESUPUESTO):
#   REPO               propietario/repositorio (por defecto, el del directorio actual)
#   GRUPO              rg-sigecat-prod
#   UBICACION          eastus2      UBICACION_WEB  eastus2
#   IDENTIDAD          id-sigecat-github
#   CORREO_ALERTAS     correo de la alerta de caida (vacio: CORREO_PRESUPUESTO)
#   INICIO_PRESUPUESTO primer dia del mes en ISO UTC (por defecto, el mes actual)
#   REVISORES          logins de GitHub que aprueban despliegues, separados por coma
#   IMPEDIR_AUTOAPROBACION  si|no (por defecto si: quien lanza no puede aprobarse)
set -euo pipefail

SIMULAR=0
WHAT_IF=0
GITHUB=1
for argumento in "$@"; do
  case "$argumento" in
    --simular) SIMULAR=1 ;;
    --what-if) WHAT_IF=1 ;;
    --sin-github) GITHUB=0 ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "Argumento desconocido: $argumento" >&2; exit 2 ;;
  esac
done

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$RAIZ"
GRUPO=${GRUPO:-rg-sigecat-prod}
UBICACION=${UBICACION:-eastus2}
UBICACION_WEB=${UBICACION_WEB:-eastus2}
IDENTIDAD=${IDENTIDAD:-id-sigecat-github}
CORREO_ALERTAS=${CORREO_ALERTAS:-}
INICIO_PRESUPUESTO=${INICIO_PRESUPUESTO:-$(date -u +%Y-%m-01T00:00:00Z)}
REVISORES=${REVISORES:-}
IMPEDIR_AUTOAPROBACION=${IMPEDIR_AUTOAPROBACION:-si}
EMISOR_GITHUB=https://token.actions.githubusercontent.com
AUDIENCIA=api://AzureADTokenExchange
PROVEEDORES=(Microsoft.Web Microsoft.ApiManagement Microsoft.DBforPostgreSQL Microsoft.KeyVault Microsoft.Storage
  Microsoft.Insights Microsoft.OperationalInsights Microsoft.AlertsManagement Microsoft.Consumption Microsoft.ManagedIdentity)
# Unicos roles que infra/modulos/permisos.bicep asigna a Functions y APIM.
ROLES_DELEGABLES="ba92f5b4-2d11-453d-a403-e96b0029c9fe, 974c5e8b-45b9-4653-ba55-5f855dd0fb88, 0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3, 4633458b-17de-408a-b874-0445c86b69e6"
CONDICION="((!(ActionMatches{'Microsoft.Authorization/roleAssignments/write'})) OR (@Request[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {$ROLES_DELEGABLES})) AND ((!(ActionMatches{'Microsoft.Authorization/roleAssignments/delete'})) OR (@Resource[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {$ROLES_DELEGABLES}))"

paso() { printf '\n== %s\n' "$*"; }
# Consulta de solo lectura. En simulacion devuelve el valor de ejemplo del primer argumento.
leer_az() { local ejemplo=$1; shift; if [[ $SIMULAR == 1 ]]; then echo "$ejemplo"; else az "$@" --only-show-errors; fi; }
mostrar() { printf '+'; printf ' %q' "$@"; printf '\n'; }
cambiar_az() { if [[ $SIMULAR == 1 ]]; then mostrar az "$@"; else az "$@" --only-show-errors --output none; fi; }
leer_gh() { local ejemplo=$1; shift; if [[ $SIMULAR == 1 ]]; then echo "$ejemplo"; else gh "$@"; fi; }
cambiar_gh() { if [[ $SIMULAR == 1 ]]; then mostrar gh "$@"; else gh "$@"; fi; }

if [[ -z ${CORREO_PRESUPUESTO:-} ]]; then
  if [[ $SIMULAR == 1 ]]; then CORREO_PRESUPUESTO=responsable@example.org; else
    echo "Define CORREO_PRESUPUESTO (correo que recibe el aviso de presupuesto y, si no hay otro, la alerta de caida)." >&2; exit 2
  fi
fi
REPO=${REPO:-$(leer_gh propietario/repositorio repo view --json nameWithOwner --jq .nameWithOwner)}

paso "Cuenta de Azure"
SUSCRIPCION=$(leer_az 00000000-0000-0000-0000-000000000000 account show --query id --output tsv)
INQUILINO=$(leer_az 11111111-1111-1111-1111-111111111111 account show --query tenantId --output tsv)
echo "Suscripcion: $(leer_az 'Azure for Students' account show --query name --output tsv) ($SUSCRIPCION)"
echo "Repositorio: $REPO — entorno prod"

paso "Regiones"
PERMITIDAS=$( { leer_az '' policy assignment list --disable-scope-strict-match --query "[].parameters.listOfAllowedLocations.value[]" --output tsv 2>/dev/null || true; } | sort -u | tr '\n' ' ')
if [[ -n ${PERMITIDAS//[[:space:]]/} ]]; then
  echo "Regiones permitidas por politica: $PERMITIDAS"
  for region in "$UBICACION" "$UBICACION_WEB"; do
    [[ " $PERMITIDAS " == *" $region "* ]] || { echo "La region $region no esta permitida; elige otra con UBICACION/UBICACION_WEB." >&2; exit 1; }
  done
else
  echo "Sin politica de regiones visible. Las suscripciones de estudiante pueden aplicarla igual (RequestDisallowedByAzure): usa --what-if para comprobarlo."
fi
FLEX=$(leer_az "$UBICACION" functionapp list-flexconsumption-locations --query "[].name" --output tsv | tr '[:upper:]' '[:lower:]' | tr -d ' ')
if ! grep -qx "$(tr -d ' ' <<<"${UBICACION,,}")" <<<"$FLEX"; then
  echo "Functions Flex Consumption no esta disponible en $UBICACION. Regiones con Flex: $(tr '\n' ' ' <<<"$FLEX")" >&2; exit 1
fi
echo "Functions Flex disponible en $UBICACION."

paso "Proveedores de recursos"
for proveedor in "${PROVEEDORES[@]}"; do
  estado=$(leer_az NotRegistered provider show --namespace "$proveedor" --query registrationState --output tsv)
  if [[ $estado == Registered ]]; then echo "  $proveedor ya registrado"; else cambiar_az provider register --namespace "$proveedor"; fi
done

paso "Grupo de recursos $GRUPO"
cambiar_az group create --name "$GRUPO" --location "$UBICACION"
ALCANCE="/subscriptions/$SUSCRIPCION/resourceGroups/$GRUPO"

paso "Identidad de despliegue $IDENTIDAD"
cambiar_az identity create --resource-group "$GRUPO" --name "$IDENTIDAD" --location "$UBICACION"
CLIENTE=$(leer_az 22222222-2222-2222-2222-222222222222 identity show --resource-group "$GRUPO" --name "$IDENTIDAD" --query clientId --output tsv)
PRINCIPAL=$(leer_az 33333333-3333-3333-3333-333333333333 identity show --resource-group "$GRUPO" --name "$IDENTIDAD" --query principalId --output tsv)
SUJETO="repo:$REPO:environment:prod"
if [[ $SIMULAR == 0 ]] && az identity federated-credential show --resource-group "$GRUPO" --identity-name "$IDENTIDAD" --name github-prod --only-show-errors --output none 2>/dev/null; then
  echo "  credencial federada github-prod ya existe"
else
  cambiar_az identity federated-credential create --resource-group "$GRUPO" --identity-name "$IDENTIDAD" --name github-prod \
    --issuer "$EMISOR_GITHUB" --subject "$SUJETO" --audiences "$AUDIENCIA"
fi

paso "Roles de minimo privilegio en $GRUPO"
asignar_rol() {
  local rol=$1 condicion=${2:-}
  if [[ $SIMULAR == 0 ]] && [[ -n $(az role assignment list --assignee "$PRINCIPAL" --scope "$ALCANCE" --role "$rol" --query "[0].id" --output tsv --only-show-errors) ]]; then
    echo "  ya asignado: $rol"; return
  fi
  local argumentos=(role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal --role "$rol" --scope "$ALCANCE")
  [[ -n $condicion ]] && argumentos+=(--condition "$condicion" --condition-version 2.0)
  # Una identidad recien creada tarda en replicarse en Entra.
  for intento in 1 2 3 4 5 6; do
    if cambiar_az "${argumentos[@]}"; then return; fi
    echo "  reintento $intento de 6 para $rol…"; sleep 10
  done
  echo "No se pudo asignar $rol." >&2; return 1
}
asignar_rol Contributor
asignar_rol "Key Vault Secrets Officer"
asignar_rol "Role Based Access Control Administrator" "$CONDICION"

if [[ $WHAT_IF == 1 ]]; then
  paso "What-if de la plantilla (no crea recursos)"
  if [[ $SIMULAR == 1 ]]; then
    echo "+ az deployment group what-if --resource-group $GRUPO --template-file infra/main.bicep --parameters @<temporal 0600>"
  else
    temporal=$(mktemp)
    chmod 600 "$temporal"
    trap 'rm -f "$temporal"' EXIT
    # Clave de administracion ficticia: el what-if no la guarda y desplegar.py genera la real en Key Vault.
    UBICACION="$UBICACION" UBICACION_WEB="$UBICACION_WEB" CORREO_PRESUPUESTO="$CORREO_PRESUPUESTO" \
      CORREO_ALERTAS="$CORREO_ALERTAS" INICIO_PRESUPUESTO="$INICIO_PRESUPUESTO" python3 - "$temporal" <<'PARAMETROS'
import json, os, secrets, sys
valores = {"ubicacion": os.environ["UBICACION"], "ubicacionWeb": os.environ["UBICACION_WEB"],
           "correoPresupuesto": os.environ["CORREO_PRESUPUESTO"], "correoAlertas": os.environ["CORREO_ALERTAS"],
           "inicioPresupuesto": os.environ["INICIO_PRESUPUESTO"], "claveAdministracion": "SgC9!" + secrets.token_urlsafe(32)}
json.dump({"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#", "contentVersion": "1.0.0.0",
           "parameters": {k: {"value": v} for k, v in valores.items()}}, open(sys.argv[1], "w"))
PARAMETROS
    az deployment group what-if --resource-group "$GRUPO" --template-file "$RAIZ/infra/main.bicep" --parameters "@$temporal" \
      --result-format ResourceIdOnly --only-show-errors
    rm -f "$temporal"
  fi
fi

if [[ $GITHUB == 1 ]]; then
  paso "Entorno prod en GitHub ($REPO)"
  REVISORES_JSON=""
  for login in ${REVISORES//,/ }; do
    id=$(leer_gh 1 api "users/$login" --jq .id)
    REVISORES_JSON+="${REVISORES_JSON:+,}{\"type\":\"User\",\"id\":$id}"
  done
  AUTOAPROBACION=false
  [[ -n $REVISORES_JSON && $IMPEDIR_AUTOAPROBACION == si ]] && AUTOAPROBACION=true
  [[ -z $REVISORES_JSON ]] && echo "  Aviso: sin REVISORES, los despliegues a prod no piden aprobacion."
  CUERPO="{\"prevent_self_review\":$AUTOAPROBACION,\"reviewers\":[$REVISORES_JSON],\"deployment_branch_policy\":{\"protected_branches\":false,\"custom_branch_policies\":true}}"
  if [[ $SIMULAR == 1 ]]; then echo "+ gh api --method PUT repos/$REPO/environments/prod $CUERPO"; else
    gh api --method PUT "repos/$REPO/environments/prod" --input - <<<"$CUERPO" >/dev/null
  fi
  RAMAS=$(leer_gh "" api "repos/$REPO/environments/prod/deployment-branch-policies" --jq '.branch_policies[].name')
  if grep -qx main <<<"$RAMAS"; then echo "  rama main ya autorizada"; else
    cambiar_gh api --method POST "repos/$REPO/environments/prod/deployment-branch-policies" -f name=main -f type=branch --silent
  fi
  definir() { cambiar_gh variable set "$1" --env prod --body "$2" --repo "$REPO"; }
  definir AZURE_CLIENT_ID "$CLIENTE"
  definir AZURE_TENANT_ID "$INQUILINO"
  definir AZURE_SUBSCRIPTION_ID "$SUSCRIPCION"
  definir AZURE_UBICACION "$UBICACION"
  definir AZURE_UBICACION_WEB "$UBICACION_WEB"
  definir CORREO_PRESUPUESTO "$CORREO_PRESUPUESTO"
  definir INICIO_PRESUPUESTO "$INICIO_PRESUPUESTO"
  [[ -n $CORREO_ALERTAS ]] && definir CORREO_ALERTAS "$CORREO_ALERTAS"
fi

paso "Listo"
cat <<SIGUIENTE
Identidad: $IDENTIDAD (clientId $CLIENTE), sujeto federado $SUJETO.
Siguiente paso: ejecutar el workflow «Despliegue backend prod» desde main con solo_plan=false
(gh workflow run despliegue.yml --ref main -f solo_plan=false) y aprobarlo en el entorno prod.
Guia completa: docs/despliegue-azure.md
SIGUIENTE

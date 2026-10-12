using './main.bicep'

param ubicacion = 'eastus2'
param ubicacionWeb = 'eastus2'
param entorno = 'prod'
param prefijo = 'sigecat'
param correoPresupuesto = 'responsable@example.org'
param inicioPresupuesto = '2026-10-01T00:00:00Z'
param jwtKid = 'prod-1'
param jwtKidAnterior = ''
// Ejemplo compilable: sustituir por referencia Key Vault al operar fuera del workflow.
// Nunca crear ni versionar un prod.bicepparam con una contraseña real.
param claveAdministracion = readEnvironmentVariable('SIGECAT_CLAVE_ADMINISTRACION')

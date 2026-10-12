param nombre string
param ubicacion string
param nombreAlmacen string
param paquetesUri string
param bovedaUri string
param conexionTelemetria string

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${nombre}-plan'
  location: ubicacion
  kind: 'functionapp'
  sku: { name: 'FC1', tier: 'FlexConsumption' }
  properties: { reserved: true }
}
resource funciones 'Microsoft.Web/sites@2024-04-01' = {
  name: nombre
  location: ubicacion
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    functionAppConfig: {
      runtime: { name: 'node', version: '22' }
      deployment: {
        storage: {
          type: 'blobContainer'
          value: paquetesUri
          authentication: { type: 'SystemAssignedIdentity' }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 5 // Azure aplica este techo a CADA grupo, no al total.
        instanceMemoryMB: 2048
        alwaysReady: []
        triggers: { http: { perInstanceConcurrency: 10 } }
      }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      appSettings: [
        // Flex gestiona host v4/worker; FUNCTIONS_WORKER_PROCESS_COUNT es invalido en Azure 2026.
        { name: 'PG_POOL_MAX', value: '3' }
        { name: 'AzureWebJobsStorage__accountName', value: nombreAlmacen }
        { name: 'AzureWebJobsStorage__credential', value: 'managedidentity' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: conexionTelemetria }
        { name: 'URL_WEB', value: '@Microsoft.KeyVault(SecretUri=${bovedaUri}secrets/url-web/)' }
        { name: 'AzureFunctionsJobHost__logging__applicationInsights__httpAutoCollectionOptions__enableHttpTriggerExtendedInfoCollection', value: 'false' }
        { name: 'AzureFunctionsJobHost__logging__applicationInsights__enableDependencyTracking', value: 'false' }
        { name: 'AzureFunctionsJobHost__logging__applicationInsights__enableLiveMetrics', value: 'false' }
        { name: 'BD_URL', value: '@Microsoft.KeyVault(SecretUri=${bovedaUri}secrets/bd-url/)' }
        { name: 'JWT_CLAVE', value: '@Microsoft.KeyVault(SecretUri=${bovedaUri}secrets/jwt-clave/)' }
        { name: 'JWT_CLAVES', value: '@Microsoft.KeyVault(SecretUri=${bovedaUri}secrets/jwt-claves/)' }
        { name: 'JWT_KID', value: '@Microsoft.KeyVault(SecretUri=${bovedaUri}secrets/jwt-kid/)' }
        { name: 'RENOVACION_CLAVE', value: '@Microsoft.KeyVault(SecretUri=${bovedaUri}secrets/renovacion-clave/)' }
        { name: 'BLOBS_CONEXION', value: '@Microsoft.KeyVault(SecretUri=${bovedaUri}secrets/blobs-conexion/)' }
      ]
    }
  }
}
output nombre string = funciones.name
output identidad string = funciones.identity.principalId
output url string = 'https://${funciones.properties.defaultHostName}/api'

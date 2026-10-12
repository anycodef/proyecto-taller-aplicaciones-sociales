param nombre string
param ubicacion string

resource boveda 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: nombre
  location: ubicacion
  properties: {
    tenantId: tenant().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Enabled'
    networkAcls: { bypass: 'AzureServices', defaultAction: 'Allow' }
  }
}

output nombre string = boveda.name
output uri string = boveda.properties.vaultUri

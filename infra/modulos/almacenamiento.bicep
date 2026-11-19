param nombre string
param ubicacion string
@description('Orígenes web que suben y leen evidencias con SAS (spec 004).')
param origenesCors array = []

resource almacen 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: nombre
  location: ubicacion
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true // BLOBS_CONEXION usa el SDK aprobado; el host y OneDeploy usan identidad.
  }
}
resource servicio 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: almacen
  name: 'default'
  properties: {
    // Sin versionado ni eliminación temporal: el borrado por consentimiento debe ser inmediato (RF-106, RF-407).
    isVersioningEnabled: false
    deleteRetentionPolicy: { enabled: false }
    containerDeleteRetentionPolicy: { enabled: false }
    cors: {
      corsRules: empty(origenesCors) ? [] : [
        {
          allowedOrigins: origenesCors
          allowedMethods: ['PUT', 'GET']
          allowedHeaders: ['x-ms-blob-type', 'content-type']
          exposedHeaders: []
          maxAgeInSeconds: 300
        }
      ]
    }
  }
}
resource contenedores 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [for nombreContenedor in ['flexpackages']: { // 'evidencias' vive en evidencias.bicep
  parent: servicio
  name: nombreContenedor
  properties: { publicAccess: 'None' }
}]
output nombre string = almacen.name
output blobUri string = almacen.properties.primaryEndpoints.blob
output paquetesUri string = '${almacen.properties.primaryEndpoints.blob}flexpackages'

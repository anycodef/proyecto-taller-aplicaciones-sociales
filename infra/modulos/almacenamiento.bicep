param nombre string
param ubicacion string

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
  properties: {}
}
resource contenedores 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [for nombreContenedor in ['flexpackages', 'evidencias']: {
  parent: servicio
  name: nombreContenedor
  properties: { publicAccess: 'None' }
}]
output nombre string = almacen.name
output paquetesUri string = '${almacen.properties.primaryEndpoints.blob}flexpackages'

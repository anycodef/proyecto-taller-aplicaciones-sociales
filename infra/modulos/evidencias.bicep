// Evidencias de justificaciones (spec 004): contenedor privado y permisos mínimos de la Function App.
param nombreAlmacen string
param identidadFunciones string

resource almacen 'Microsoft.Storage/storageAccounts@2023-05-01' existing = { name: nombreAlmacen }
resource servicio 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = {
  parent: almacen
  name: 'default'
}
resource evidencias 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: servicio
  name: 'evidencias'
  properties: { publicAccess: 'None' }
}
var colaboradorDatosBlob = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var delegadorBlob = 'db58b8e5-c6ad-4a2a-8342-4190687cbf4a'
// Leer, confirmar y borrar evidencias; el alcance es solo el contenedor.
resource datosEvidencias 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(evidencias.id, identidadFunciones, colaboradorDatosBlob)
  scope: evidencias
  properties: { roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', colaboradorDatosBlob), principalId: identidadFunciones, principalType: 'ServicePrincipal' }
}
// getUserDelegationKey solo existe a nivel de cuenta; sin este rol no hay SAS de usuario delegado.
resource delegacion 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(almacen.id, identidadFunciones, delegadorBlob)
  scope: almacen
  properties: { roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', delegadorBlob), principalId: identidadFunciones, principalType: 'ServicePrincipal' }
}
output contenedor string = evidencias.name

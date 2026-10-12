param nombreAlmacen string
param nombreBoveda string
param identidadFunciones string
param identidadApim string

resource almacen 'Microsoft.Storage/storageAccounts@2023-05-01' existing = { name: nombreAlmacen }
resource boveda 'Microsoft.KeyVault/vaults@2023-07-01' existing = { name: nombreBoveda }
var rolesAlmacen = [
  'ba92f5b4-2d11-453d-a403-e96b0029c9fe' // Blob Data Contributor: paquetes y host.
  '974c5e8b-45b9-4653-ba55-5f855dd0fb88' // Queue Data Contributor: host.
  '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3' // Table Data Contributor: host.
]
resource permisosAlmacen 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for rol in rolesAlmacen: {
  name: guid(almacen.id, identidadFunciones, rol)
  scope: almacen
  properties: { roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', rol), principalId: identidadFunciones, principalType: 'ServicePrincipal' }
}]
resource lecturaSecretos 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for identidad in [identidadFunciones, identidadApim]: {
  name: guid(boveda.id, identidad, 'secretos-lectura')
  scope: boveda
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: identidad
    principalType: 'ServicePrincipal'
  }
}]

param ubicacion string = resourceGroup().location
param prefijo string = 'sigecat'
module secretos 'modulos/secretos.bicep' = {
  name: 'secretos'
  params: { nombre: '${prefijo}-prod-${take(uniqueString(resourceGroup().id), 6)}', ubicacion: ubicacion }
}
output nombreBoveda string = secretos.outputs.nombre

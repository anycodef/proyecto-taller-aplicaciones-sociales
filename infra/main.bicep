targetScope = 'resourceGroup'
param ubicacion string = resourceGroup().location
param ubicacionWeb string = 'eastus2'
@allowed(['prod'])
param entorno string = 'prod'
@minLength(3)
@maxLength(10)
param prefijo string = 'sigecat'
@minLength(3)
param correoPresupuesto string
param inicioPresupuesto string
param jwtKid string = 'prod-1'
param jwtKidAnterior string = ''
param publicarPoliticas bool = true
@secure()
param claveAdministracion string

var sufijo = uniqueString(resourceGroup().id)
var nombreBoveda = '${prefijo}-${entorno}-${take(sufijo, 6)}'
module secretos 'modulos/secretos.bicep' = {
  name: 'secretos'
  params: { nombre: nombreBoveda, ubicacion: ubicacion }
}
module almacenamiento 'modulos/almacenamiento.bicep' = {
  name: 'almacenamiento'
  params: { nombre: '${prefijo}${entorno}${take(sufijo, 8)}', ubicacion: ubicacion }
}
module postgres 'modulos/postgres.bicep' = {
  name: 'postgres'
  params: { nombre: '${prefijo}-bd-${entorno}-${sufijo}', ubicacion: ubicacion, claveAdministracion: claveAdministracion }
}
module web 'modulos/web.bicep' = {
  name: 'web'
  params: { nombre: '${prefijo}-web-${entorno}', ubicacion: ubicacionWeb }
}
module monitoreo 'modulos/monitoreo.bicep' = {
  name: 'monitoreo'
  params: { nombre: '${prefijo}-telemetria-${entorno}', ubicacion: ubicacion, correoPresupuesto: correoPresupuesto, inicioPresupuesto: inicioPresupuesto }
}
module funciones 'modulos/funciones.bicep' = {
  name: 'funciones'
  params: {
    nombre: '${prefijo}-funciones-${entorno}-${sufijo}'
    ubicacion: ubicacion
    nombreAlmacen: almacenamiento.outputs.nombre
    paquetesUri: almacenamiento.outputs.paquetesUri
    bovedaUri: secretos.outputs.uri
    conexionTelemetria: monitoreo.outputs.conexion
  }
}
module apim 'modulos/apim.bicep' = {
  name: 'apim'
  params: {
    nombre: '${prefijo}-api-${entorno}-${sufijo}'
    ubicacion: ubicacion
    correo: correoPresupuesto
    urlFunciones: funciones.outputs.url
    urlWeb: web.outputs.url
    bovedaUri: secretos.outputs.uri
    claveInstrumentacion: monitoreo.outputs.claveInstrumentacion
    jwtKid: jwtKid
    jwtKidAnterior: jwtKidAnterior
    publicarPoliticas: publicarPoliticas
  }
}
module permisos 'modulos/permisos.bicep' = {
  name: 'permisos'
  params: {
    nombreAlmacen: almacenamiento.outputs.nombre
    nombreBoveda: secretos.outputs.nombre
    identidadFunciones: funciones.outputs.identidad
    identidadApim: apim.outputs.identidad
  }
}
output nombreBoveda string = secretos.outputs.nombre
output nombreAlmacen string = almacenamiento.outputs.nombre
output nombrePostgres string = postgres.outputs.nombre
output dominioPostgres string = postgres.outputs.dominio
output nombreFunciones string = funciones.outputs.nombre
output nombreApim string = apim.outputs.nombre
output nombreWeb string = web.outputs.nombre
output urlApi string = apim.outputs.url
output urlWeb string = web.outputs.url

param nombre string
param ubicacion string
param correo string
param urlFunciones string
param urlWeb string
param bovedaUri string
param claveInstrumentacion string
param jwtKid string
param jwtKidAnterior string = ''
param publicarPoliticas bool = true
param limiteApp int = 1200
param limiteWeb int = 300

resource apim 'Microsoft.ApiManagement/service@2024-05-01' = {
  name: nombre
  location: ubicacion
  sku: { name: 'Consumption', capacity: 0 }
  identity: { type: 'SystemAssigned' }
  properties: { publisherEmail: correo, publisherName: 'SIGECAT' }
}
var secretosApim = concat(['jwt-clave-apim', 'clave-host-funciones'], empty(jwtKidAnterior) ? [] : ['jwt-clave-anterior-apim'])
resource valores 'Microsoft.ApiManagement/service/namedValues@2024-05-01' = [for secreto in secretosApim: if (publicarPoliticas) {
  parent: apim
  name: secreto
  properties: {
    displayName: secreto
    secret: true
    keyVault: { secretIdentifier: '${bovedaUri}secrets/${secreto}' }
  }
}]
resource politicaGlobal 'Microsoft.ApiManagement/service/policies@2024-05-01' = if (publicarPoliticas) {
  parent: apim
  name: 'policy'
  properties: { format: 'rawxml', value: replace(loadTextContent('../politicas/global.xml'), '__URL_WEB__', urlWeb) }
  dependsOn: [valores]
}
resource api 'Microsoft.ApiManagement/service/apis@2024-05-01' = {
  parent: apim
  name: 'sigecat'
  properties: {
    displayName: 'SIGECAT'
    path: 'v1'
    protocols: ['https']
    serviceUrl: urlFunciones
    subscriptionRequired: true
  }
}
resource operaciones 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = [for metodo in ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']: {
  parent: api
  name: toLower(metodo)
  properties: { displayName: metodo, method: metodo, urlTemplate: '/*', responses: [] }
}]
resource politicaApi 'Microsoft.ApiManagement/service/apis/policies@2024-05-01' = if (publicarPoliticas) {
  parent: api
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: replace(replace(loadTextContent('../politicas/api.xml'), '__JWT_KID__', jwtKid), '__CLAVE_ANTERIOR__', empty(jwtKidAnterior) ? '' : '<key id="${jwtKidAnterior}">{{jwt-clave-anterior-apim}}</key>')
  }
  dependsOn: [politicaGlobal]
}
var definicionesProductos = [
  { nombre: 'app-movil', politica: replace(loadTextContent('../politicas/producto-app.xml'), '__LIMITE__', string(limiteApp)) }
  { nombre: 'web-familias', politica: replace(loadTextContent('../politicas/producto-web.xml'), '__LIMITE__', string(limiteWeb)) }
]
resource productos 'Microsoft.ApiManagement/service/products@2024-05-01' = [for producto in definicionesProductos: {
  parent: apim
  name: producto.nombre
  properties: { displayName: producto.nombre, subscriptionRequired: true, approvalRequired: true, state: 'published' }
}]
resource politicasProducto 'Microsoft.ApiManagement/service/products/policies@2024-05-01' = [for (producto, indice) in definicionesProductos: {
  parent: productos[indice]
  name: 'policy'
  properties: { format: 'rawxml', value: producto.politica }
}]
resource enlacesProducto 'Microsoft.ApiManagement/service/products/apis@2024-05-01' = [for (_, indice) in definicionesProductos: {
  parent: productos[indice]
  name: api.name
}]
resource registrador 'Microsoft.ApiManagement/service/loggers@2024-05-01' = {
  parent: apim
  name: 'telemetria'
  properties: { loggerType: 'applicationInsights', credentials: { instrumentationKey: claveInstrumentacion }, isBuffered: true }
}
resource diagnostico 'Microsoft.ApiManagement/service/diagnostics@2024-05-01' = {
  parent: apim
  name: 'applicationinsights'
  properties: {
    loggerId: registrador.id
    alwaysLog: 'allErrors'
    sampling: { samplingType: 'fixed', percentage: 10 }
    logClientIp: false
    verbosity: 'error'
    frontend: { request: { headers: [], body: { bytes: 0 } }, response: { headers: [], body: { bytes: 0 } } }
    backend: { request: { headers: [], body: { bytes: 0 } }, response: { headers: [], body: { bytes: 0 } } }
  }
}
output nombre string = apim.name
output identidad string = apim.identity.principalId
output url string = '${apim.properties.gatewayUrl}/v1'

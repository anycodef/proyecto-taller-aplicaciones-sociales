param nombre string
param ubicacion string
resource web 'Microsoft.Web/staticSites@2023-12-01' = {
  name: nombre
  location: ubicacion
  sku: { name: 'Free', tier: 'Free' }
  properties: { allowConfigFileUpdates: true }
}
output nombre string = web.name
output url string = 'https://${web.properties.defaultHostname}'

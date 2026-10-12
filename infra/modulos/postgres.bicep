param nombre string
param ubicacion string
@secure()
param claveAdministracion string

resource servidor 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: nombre
  location: ubicacion
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: 'administracion'
    administratorLoginPassword: claveAdministracion
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
    authConfig: { passwordAuth: 'Enabled', activeDirectoryAuth: 'Disabled' }
  }
}
resource base 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: servidor
  name: 'sigecat'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}
resource tls 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: servidor
  name: 'require_secure_transport'
  properties: { value: 'ON', source: 'user-override' }
}
resource azure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: servidor
  name: 'servicios-azure'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}
output nombre string = servidor.name
output dominio string = servidor.properties.fullyQualifiedDomainName

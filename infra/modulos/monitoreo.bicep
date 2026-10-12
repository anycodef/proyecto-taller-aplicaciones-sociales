param nombre string
param ubicacion string
param correoPresupuesto string
param inicioPresupuesto string

resource registros 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${nombre}-registros'
  location: ubicacion
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: json('0.1') }
  }
}
resource telemetria 'Microsoft.Insights/components@2020-02-02' = {
  name: nombre
  location: ubicacion
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: registros.id
    IngestionMode: 'LogAnalytics'
    SamplingPercentage: 10
    DisableIpMasking: false
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}
resource presupuesto 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: 'presupuesto-sigecat-prod'
  properties: {
    category: 'Cost'
    amount: 5
    timeGrain: 'Monthly'
    timePeriod: { startDate: inicioPresupuesto, endDate: '2036-10-01T00:00:00Z' }
    notifications: {
      aviso: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: [correoPresupuesto]
      }
    }
  }
}
output conexion string = telemetria.properties.ConnectionString
output claveInstrumentacion string = telemetria.properties.InstrumentationKey

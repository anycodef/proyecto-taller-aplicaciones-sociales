param nombre string
param ubicacion string
param telemetriaId string
param urlEstado string
param correo string
param habilitada bool

resource receptor 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: '${nombre}-operacion'
  location: 'global'
  properties: {
    groupShortName: 'SIGECAT'
    enabled: true
    emailReceivers: [
      { name: 'responsable-operacion', emailAddress: correo, useCommonAlertSchema: true }
    ]
  }
}
resource sonda 'Microsoft.Insights/webtests@2022-06-15' = {
  name: nombre
  location: ubicacion
  kind: 'standard'
  tags: { 'hidden-link:${telemetriaId}': 'Resource' }
  properties: {
    Name: nombre
    SyntheticMonitorId: nombre
    Kind: 'standard'
    Enabled: habilitada
    Frequency: 300
    Timeout: 30
    RetryEnabled: true
    Locations: [
      { Id: 'us-va-ash-azr' }
      { Id: 'us-tx-sn1-azr' }
      { Id: 'us-ca-sjc-azr' }
    ]
    Request: {
      RequestUrl: urlEstado
      HttpVerb: 'GET'
      FollowRedirects: false
      ParseDependentRequests: false
    }
    ValidationRules: {
      ExpectedHttpStatusCode: 200
      IgnoreHttpStatusCode: false
      SSLCheck: true
      ContentValidation: {
        ContentMatch: '{"estado":"disponible"}'
        IgnoreCase: false
        PassIfTextFound: true
      }
    }
  }
}
resource alerta 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${nombre}-caida'
  location: 'global'
  properties: {
    description: 'SIGECAT no disponible por APIM. Revisar API y PostgreSQL segun el procedimiento operativo.'
    severity: 1
    enabled: habilitada
    autoMitigate: true
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    scopes: [sonda.id, telemetriaId]
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.WebtestLocationAvailabilityCriteria'
      webTestId: sonda.id
      componentId: telemetriaId
      failedLocationCount: 2
    }
    actions: [{ actionGroupId: receptor.id }]
  }
}

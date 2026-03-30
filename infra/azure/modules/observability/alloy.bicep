@description('Container Apps Environment ID.')
param environmentId string

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Internal FQDN of the Loki Container App.')
param lokiFqdn string

@description('Internal FQDN of the Prometheus Container App.')
param prometheusFqdn string

@description('Internal FQDN of the Tempo Container App.')
param tempoFqdn string

resource alloyApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'project-starter-alloy'
  location: location
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 4318
        transport: 'http'
        additionalPortMappings: [
          {
            external: false
            targetPort: 4317
          }
          {
            external: false
            targetPort: 12345
          }
        ]
      }
    }
    template: {
      containers: [
        {
          name: 'alloy'
          image: 'grafana/alloy:v1.12.0'
          command: ['run', '/etc/alloy/config.alloy', '--server.http.listen-addr=0.0.0.0:12345']
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'LOKI_URL', value: 'http://${lokiFqdn}:3100' }
            { name: 'PROMETHEUS_URL', value: 'http://${prometheusFqdn}:9090' }
            { name: 'TEMPO_URL', value: 'http://${tempoFqdn}:4318' }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

output fqdn string = alloyApp.properties.configuration.ingress.fqdn
output name string = alloyApp.name

@description('Container Apps Environment ID.')
param environmentId string

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Internal FQDN of the Prometheus Container App.')
param prometheusFqdn string

var storageMountName = 'tempo-storage'

resource tempoApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'project-starter-tempo'
  location: location
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 3200
        transport: 'http'
        additionalPortMappings: [
          {
            external: false
            targetPort: 4317
          }
          {
            external: false
            targetPort: 4318
          }
        ]
      }
    }
    template: {
      containers: [
        {
          name: 'tempo'
          image: 'grafana/tempo:2.8.2'
          command: [
            '-config.file=/etc/tempo/tempo.yaml'
            '-config.expand-env=true'
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'PROMETHEUS_REMOTE_WRITE_URL'
              value: 'http://${prometheusFqdn}:9090/api/v1/write'
            }
          ]
          volumeMounts: [
            {
              volumeName: storageMountName
              mountPath: '/var/tempo'
            }
          ]
        }
      ]
      volumes: [
        {
          name: storageMountName
          storageType: 'AzureFile'
          storageName: storageMountName
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

output fqdn string = tempoApp.properties.configuration.ingress.fqdn
output name string = tempoApp.name

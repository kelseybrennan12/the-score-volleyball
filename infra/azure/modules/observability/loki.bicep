@description('Container Apps Environment ID.')
param environmentId string

@description('Location for all resources.')
param location string = resourceGroup().location

var storageMountName = 'loki-storage'

resource lokiApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'project-starter-loki'
  location: location
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 3100
        transport: 'http'
      }
    }
    template: {
      containers: [
        {
          name: 'loki'
          image: 'grafana/loki:3.2.1'
          command: ['-config.file=/etc/loki/loki-config.yml']
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          volumeMounts: [
            {
              volumeName: storageMountName
              mountPath: '/loki'
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

output fqdn string = lokiApp.properties.configuration.ingress.fqdn
output name string = lokiApp.name

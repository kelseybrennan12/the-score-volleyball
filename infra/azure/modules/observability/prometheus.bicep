@description('Container Apps Environment ID.')
param environmentId string

@description('Location for all resources.')
param location string = resourceGroup().location

var storageMountName = 'prometheus-storage'

resource prometheusApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'project-starter-prometheus'
  location: location
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 9090
        transport: 'http'
      }
    }
    template: {
      containers: [
        {
          name: 'prometheus'
          image: 'prom/prometheus:v2.53.2'
          command: [
            '--config.file=/etc/prometheus/prometheus.yml'
            '--storage.tsdb.path=/prometheus'
            '--web.enable-remote-write-receiver'
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          volumeMounts: [
            {
              volumeName: storageMountName
              mountPath: '/prometheus'
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

output fqdn string = prometheusApp.properties.configuration.ingress.fqdn
output name string = prometheusApp.name

@description('Container Apps Environment ID.')
param environmentId string

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Container image to deploy.')
param image string

@description('User-assigned managed identity resource ID.')
param identityId string

@description('Minimum number of replicas.')
param minReplicas int = 1

@description('Maximum number of replicas.')
param maxReplicas int = 1

@description('ACR login server (e.g. crprojectstarter.azurecr.io).')
param acrLoginServer string

@description('API upstream URL for edge proxy (for example http://<api-fqdn>).')
param apiUpstream string

resource edgeApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'project-starter-edge'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: identityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'edge'
          image: image
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'EDGE_PORT', value: '8080' }
            { name: 'API_UPSTREAM', value: apiUpstream }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output fqdn string = edgeApp.properties.configuration.ingress.fqdn
output name string = edgeApp.name

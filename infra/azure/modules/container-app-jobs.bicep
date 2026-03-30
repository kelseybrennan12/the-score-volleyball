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

@description('Key Vault URI (e.g. https://kv-project-starter-staging.vault.azure.net/).')
param keyVaultUri string

@description('OTEL collector endpoint (Alloy internal FQDN).')
param otelEndpoint string

@description('Environment name for OTEL resource attributes.')
param envName string

resource jobsApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'project-starter-jobs'
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
      registries: [
        {
          server: acrLoginServer
          identity: identityId
        }
      ]
      secrets: [
        {
          name: 'database-url'
          keyVaultUrl: '${keyVaultUri}secrets/database-url'
          identity: identityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'jobs'
          image: image
          command: ['pnpm', 'run', 'app:worker']
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'JOBS_PORT', value: '3001' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'OTEL_SERVICE_NAME', value: 'project-starter-jobs' }
            { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', value: otelEndpoint }
            { name: 'OTEL_EXPORTER_OTLP_PROTOCOL', value: 'http/protobuf' }
            {
              name: 'OTEL_RESOURCE_ATTRIBUTES'
              value: 'deployment.environment=${envName}'
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

output name string = jobsApp.name

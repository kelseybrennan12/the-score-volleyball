@description('Container Apps Environment ID.')
param environmentId string

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Container image to deploy.')
param image string

@description('Container image tag (commit SHA).')
param imageTag string

@description('User-assigned managed identity resource ID.')
param identityId string

@description('ACR login server (e.g. crprojectstarter.azurecr.io).')
param acrLoginServer string

@description('Key Vault URI (e.g. https://kv-project-starter-staging.vault.azure.net/).')
param keyVaultUri string

@description('OTEL collector endpoint (Alloy internal FQDN).')
param otelEndpoint string

@description('Environment name for OTEL resource attributes.')
param envName string

resource bootstrapJob 'Microsoft.App/jobs@2024-03-01' = {
  name: 'project-starter-db-bootstrap'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    environmentId: environmentId
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 1800
      replicaRetryLimit: 0
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: acrLoginServer
          identity: identityId
        }
      ]
      secrets: [
        { name: 'database-url', keyVaultUrl: '${keyVaultUri}secrets/database-url', identity: identityId }
      ]
    }
    template: {
      containers: [
        {
          name: 'db-bootstrap'
          image: image
          command: ['pnpm', 'run', 'app:bootstrap']
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'APP_STARTUP_SEED_PACK', value: 'none' }
            { name: 'JOBS_GRAPHILE_SCHEMA', value: 'graphile_worker' }
            { name: 'APP_IMAGE_TAG', value: imageTag }
            { name: 'OTEL_SERVICE_NAME', value: 'project-starter-db-bootstrap' }
            { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', value: otelEndpoint }
            { name: 'OTEL_EXPORTER_OTLP_PROTOCOL', value: 'http/protobuf' }
            {
              name: 'OTEL_RESOURCE_ATTRIBUTES'
              value: 'deployment.environment=${envName}'
            }
          ]
        }
      ]
    }
  }
}

output name string = bootstrapJob.name

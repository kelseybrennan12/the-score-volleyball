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

@description('Allowed browser origin for API CORS/session flows.')
param frontendOrigin string

@description('Entra auth provider config.')
param authTenantId string
param authClientId string
param authIssuer string
param authAudience string = authClientId
param authRedirectUri string
param authPostLoginRedirect string
param authPostLogoutRedirect string

@description('Entra security group object ID that maps to the admin role.')
param authAdminGroupId string = ''

@description('Entra security group object ID that maps to the user role.')
param authUserGroupId string = ''

@description('OTEL collector endpoint (Alloy internal FQDN).')
param otelEndpoint string

@description('Environment name for OTEL resource attributes.')
param envName string

@description('Storage account name for blob uploads.')
param storageAccountName string

@description('Blob container name for uploads.')
param storageContainerName string

@description('Client ID of the user-assigned managed identity (for DefaultAzureCredential).')
param identityClientId string

@description('Blob container name for user-uploaded files.')
param userUploadsContainerName string

resource apiApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'project-starter-api'
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
        external: false
        targetPort: 3000
        transport: 'http'
        allowInsecure: true
      }
      registries: [
        {
          server: acrLoginServer
          identity: identityId
        }
      ]
      secrets: [
        { name: 'database-url', keyVaultUrl: '${keyVaultUri}secrets/database-url', identity: identityId }
        { name: 'auth-client-secret', keyVaultUrl: '${keyVaultUri}secrets/auth-client-secret', identity: identityId }
        {
          name: 'auth-session-encryption-key'
          keyVaultUrl: '${keyVaultUri}secrets/auth-session-encryption-key'
          identity: identityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: image
          command: ['pnpm', 'run', 'app:api']
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'API_PORT', value: '3000' }
            { name: 'FRONTEND_ORIGIN', value: frontendOrigin }
            { name: 'APP_DEPLOYMENT_ENV', value: envName }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'AUTH_PROVIDER', value: 'entra' }
            { name: 'AUTH_ISSUER', value: authIssuer }
            { name: 'AUTH_CLIENT_ID', value: authClientId }
            { name: 'AUTH_CLIENT_SECRET', secretRef: 'auth-client-secret' }
            { name: 'AUTH_AUDIENCE', value: authAudience }
            { name: 'AUTH_SCOPE', value: 'openid profile email offline_access' }
            { name: 'AUTH_TENANT_ID', value: authTenantId }
            { name: 'AUTH_REDIRECT_URI', value: authRedirectUri }
            { name: 'AUTH_POST_LOGIN_REDIRECT', value: authPostLoginRedirect }
            { name: 'AUTH_POST_LOGOUT_REDIRECT', value: authPostLogoutRedirect }
            { name: 'AUTH_SESSION_COOKIE_NAME', value: 'project-starter-session' }
            { name: 'AUTH_COOKIE_SECURE', value: 'true' }
            { name: 'AUTH_SESSION_ENCRYPTION_KEY', secretRef: 'auth-session-encryption-key' }
            { name: 'AUTH_ADMIN_GROUP_ID', value: authAdminGroupId }
            { name: 'AUTH_USER_GROUP_ID', value: authUserGroupId }
            { name: 'AZURE_STORAGE_ACCOUNT_NAME', value: storageAccountName }
            { name: 'AZURE_STORAGE_CONTAINER_NAME', value: storageContainerName }
            { name: 'AZURE_CLIENT_ID', value: identityClientId }
            { name: 'AZURE_USER_UPLOADS_CONTAINER_NAME', value: userUploadsContainerName }
            { name: 'OTEL_SERVICE_NAME', value: 'project-starter-api' }
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

output fqdn string = apiApp.properties.configuration.ingress.fqdn
output name string = apiApp.name

@description('Container Apps Environment ID.')
param environmentId string

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Internal FQDN of the Prometheus Container App.')
param prometheusFqdn string

@description('Internal FQDN of the Loki Container App.')
param lokiFqdn string

@description('Internal FQDN of the Tempo Container App.')
param tempoFqdn string

@description('Entra tenant ID for Azure AD authentication.')
param authTenantId string

@description('Entra app client ID for Azure AD authentication.')
param authClientId string

@description('User-assigned managed identity resource ID.')
param identityId string

@description('Key Vault URI (e.g. https://kv-project-starter-staging.vault.azure.net/).')
param keyVaultUri string

@description('Public root URL of the Grafana instance (for OAuth redirect).')
param grafanaRootUrl string

var storageMountName = 'grafana-storage'

resource grafanaApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'project-starter-grafana'
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
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'auth-client-secret'
          keyVaultUrl: '${keyVaultUri}secrets/auth-client-secret'
          identity: identityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'grafana'
          image: 'grafana/grafana:11.6.0'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'GF_AUTH_ANONYMOUS_ENABLED', value: 'false' }
            { name: 'GF_AUTH_DISABLE_LOGIN_FORM', value: 'true' }
            { name: 'GF_USERS_DEFAULT_THEME', value: 'light' }
            { name: 'GF_SERVER_ROOT_URL', value: grafanaRootUrl }
            { name: 'GF_AUTH_AZUREAD_ENABLED', value: 'true' }
            { name: 'GF_AUTH_AZUREAD_NAME', value: 'Azure AD' }
            { name: 'GF_AUTH_AZUREAD_CLIENT_ID', value: authClientId }
            { name: 'GF_AUTH_AZUREAD_CLIENT_SECRET', secretRef: 'auth-client-secret' }
            { name: 'GF_AUTH_AZUREAD_SCOPES', value: 'openid email profile' }
            {
              name: 'GF_AUTH_AZUREAD_AUTH_URL'
              value: '${environment().authentication.loginEndpoint}${authTenantId}/oauth2/v2.0/authorize'
            }
            {
              name: 'GF_AUTH_AZUREAD_TOKEN_URL'
              value: '${environment().authentication.loginEndpoint}${authTenantId}/oauth2/v2.0/token'
            }
            { name: 'GF_AUTH_AZUREAD_ALLOWED_ORGANIZATIONS', value: authTenantId }
            { name: 'GF_AUTH_AZUREAD_ROLE_ATTRIBUTE_STRICT', value: 'true' }
            { name: 'GF_USERS_AUTO_ASSIGN_ORG_ROLE', value: 'Editor' }
            {
              name: 'GF_INSTALL_PLUGINS'
              value: 'https://storage.googleapis.com/integration-artifacts/grafana-exploretraces-app/grafana-exploretraces-app-latest.zip;grafana-traces-app'
            }
            { name: 'GF_PLUGINS_DISABLE_PLUGINS', value: 'grafana-pyroscope-app,grafana-metricsdrilldown-app' }
            { name: 'PROMETHEUS_URL', value: 'http://${prometheusFqdn}:9090' }
            { name: 'LOKI_URL', value: 'http://${lokiFqdn}:3100' }
            { name: 'TEMPO_URL', value: 'http://${tempoFqdn}:3200' }
          ]
          volumeMounts: [
            {
              volumeName: storageMountName
              mountPath: '/var/lib/grafana'
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

output fqdn string = grafanaApp.properties.configuration.ingress.fqdn
output name string = grafanaApp.name

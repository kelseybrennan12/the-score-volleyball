targetScope = 'resourceGroup'

// ── Parameters ──────────────────────────────────────────────────────────────

@description('Environment name (e.g. staging, prod).')
param envName string

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Container image tag (commit SHA).')
param imageTag string

@description('ACR name (e.g. crprojectstarter).')
param acrName string

@description('Subscription ID where the shared ACR lives.')
param acrSubscriptionId string = subscription().subscriptionId

@description('Resource group containing the shared ACR.')
param acrResourceGroup string

@description('PostgreSQL SKU name.')
param postgresSkuName string = 'Standard_B1ms'

@description('PostgreSQL SKU tier.')
param postgresSkuTier string = 'Burstable'

@description('Edge app minimum replicas.')
param edgeMinReplicas int = 1

@description('Edge app maximum replicas.')
param edgeMaxReplicas int = 1

@description('API app minimum replicas.')
param apiMinReplicas int = 1

@description('API app maximum replicas.')
param apiMaxReplicas int = 1

@description('Jobs app minimum replicas.')
param jobsMinReplicas int = 1

@description('Jobs app maximum replicas.')
param jobsMaxReplicas int = 1

@description('Entra tenant ID.')
param authTenantId string

@description('Entra app client ID.')
param authClientId string

@description('Entra security group object ID that maps to the admin role.')
param authAdminGroupId string = ''

@description('Entra security group object ID that maps to the user role.')
param authUserGroupId string = ''

@description('Custom domain for edge app (optional).')
param customDomain string = ''

@description('Deploy the manual database bootstrap job.')
param deployBootstrapJob bool = true

@description('Deploy the API runtime.')
param deployApi bool = true

@description('Deploy the jobs runtime.')
param deployJobs bool = true

@description('Deploy the edge runtime.')
param deployEdge bool = true

// ── Existing Key Vault (created by bootstrap) ───────────────────────────────

var keyVaultName = 'kv-project-starter-${envName}'
var acrLoginServer = '${acrName}.azurecr.io'
var containerAppsEnvironmentName = 'cae-project-starter-${envName}'
var apiImage = '${acrLoginServer}/project-starter-app:${imageTag}'
var edgeImage = '${acrLoginServer}/project-starter-edge:${imageTag}'
var deployApiModule = deployApi || deployEdge
var edgeHost = customDomain != '' ? customDomain : 'project-starter-edge.${containerAppsEnv.outputs.defaultDomain}'
var frontendOrigin = 'https://${edgeHost}'
var authRedirectUri = '${frontendOrigin}/api/auth/callback'
var authPostLoginRedirect = '${frontendOrigin}/dashboard'
var authPostLogoutRedirect = '${frontendOrigin}/'

resource existingKeyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// ── Storage ─────────────────────────────────────────────────────────────────

var storageAccountName = 'saprojectstarter${envName}'

module storage 'modules/storage.bicep' = {
  name: 'storage-${envName}'
  params: {
    location: location
    storageAccountName: storageAccountName
    identityPrincipalId: identity.outputs.identityPrincipalId
  }
}

var storageAccountKey = listKeys(resourceId('Microsoft.Storage/storageAccounts', storageAccountName), '2023-05-01').keys[0].value

// ── Identity ────────────────────────────────────────────────────────────────

module identity 'modules/identity.bicep' = {
  name: 'identity-${envName}'
  params: {
    envName: envName
    location: location
    keyVaultName: keyVaultName
  }
}

module acrPullRole 'modules/acr-pull-role.bicep' = {
  name: 'acr-pull-${envName}'
  scope: resourceGroup(acrSubscriptionId, acrResourceGroup)
  params: {
    acrName: acrName
    principalId: identity.outputs.identityPrincipalId
    identityId: identity.outputs.identityId
  }
}

// ── Container Apps Environment ──────────────────────────────────────────────

module containerAppsEnv 'modules/container-apps-env.bicep' = {
  name: 'cae-${envName}'
  params: {
    envName: envName
    location: location
  }
}

// ── Environment Storage Mounts ──────────────────────────────────────────────

resource lokiStorageMount 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  name: '${containerAppsEnvironmentName}/loki-storage'
  properties: {
    azureFile: {
      accountName: storageAccountName
      accountKey: storageAccountKey
      shareName: 'loki-data'
      accessMode: 'ReadWrite'
    }
  }
}

resource prometheusStorageMount 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  name: '${containerAppsEnvironmentName}/prometheus-storage'
  properties: {
    azureFile: {
      accountName: storageAccountName
      accountKey: storageAccountKey
      shareName: 'prometheus-data'
      accessMode: 'ReadWrite'
    }
  }
}

resource tempoStorageMount 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  name: '${containerAppsEnvironmentName}/tempo-storage'
  properties: {
    azureFile: {
      accountName: storageAccountName
      accountKey: storageAccountKey
      shareName: 'tempo-data'
      accessMode: 'ReadWrite'
    }
  }
}

resource grafanaStorageMount 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  name: '${containerAppsEnvironmentName}/grafana-storage'
  properties: {
    azureFile: {
      accountName: storageAccountName
      accountKey: storageAccountKey
      shareName: 'grafana-data'
      accessMode: 'ReadWrite'
    }
  }
}

// ── PostgreSQL ──────────────────────────────────────────────────────────────

module postgres 'modules/postgres.bicep' = {
  name: 'postgres-${envName}'
  params: {
    envName: envName
    location: location
    skuName: postgresSkuName
    skuTier: postgresSkuTier
    adminPassword: existingKeyVault.getSecret('postgres-admin-password')
  }
}

// ── Observability ───────────────────────────────────────────────────────────

module loki 'modules/observability/loki.bicep' = {
  name: 'loki-${envName}'
  dependsOn: [lokiStorageMount]
  params: {
    environmentId: containerAppsEnv.outputs.environmentId
    location: location
  }
}

module prometheus 'modules/observability/prometheus.bicep' = {
  name: 'prometheus-${envName}'
  dependsOn: [prometheusStorageMount]
  params: {
    environmentId: containerAppsEnv.outputs.environmentId
    location: location
  }
}

module tempo 'modules/observability/tempo.bicep' = {
  name: 'tempo-${envName}'
  dependsOn: [tempoStorageMount]
  params: {
    environmentId: containerAppsEnv.outputs.environmentId
    location: location
    prometheusFqdn: prometheus.outputs.fqdn
  }
}

module alloy 'modules/observability/alloy.bicep' = {
  name: 'alloy-${envName}'
  params: {
    environmentId: containerAppsEnv.outputs.environmentId
    location: location
    lokiFqdn: loki.outputs.fqdn
    prometheusFqdn: prometheus.outputs.fqdn
    tempoFqdn: tempo.outputs.fqdn
  }
}

module grafana 'modules/observability/grafana.bicep' = {
  name: 'grafana-${envName}'
  dependsOn: [grafanaStorageMount]
  params: {
    environmentId: containerAppsEnv.outputs.environmentId
    location: location
    prometheusFqdn: prometheus.outputs.fqdn
    lokiFqdn: loki.outputs.fqdn
    tempoFqdn: tempo.outputs.fqdn
    authTenantId: authTenantId
    authClientId: authClientId
    identityId: identity.outputs.identityId
    keyVaultUri: existingKeyVault.properties.vaultUri
    grafanaRootUrl: 'https://project-starter-grafana.${containerAppsEnv.outputs.defaultDomain}'
  }
}

// ── Auth Config ─────────────────────────────────────────────────────────────

var authIssuer = '${environment().authentication.loginEndpoint}${authTenantId}/v2.0'

// ── Application Container Apps ──────────────────────────────────────────────

module bootstrapJob 'modules/container-app-db-bootstrap-job.bicep' = if (deployBootstrapJob) {
  name: 'db-bootstrap-${envName}'
  params: {
    environmentId: containerAppsEnv.outputs.environmentId
    location: location
    image: apiImage
    imageTag: imageTag
    identityId: identity.outputs.identityId
    acrLoginServer: acrLoginServer
    keyVaultUri: existingKeyVault.properties.vaultUri
    otelEndpoint: 'http://${alloy.outputs.fqdn}:4318'
    envName: envName
  }
}

module api 'modules/container-app-api.bicep' = if (deployApiModule) {
  name: 'api-${envName}'
  params: {
    environmentId: containerAppsEnv.outputs.environmentId
    location: location
    image: apiImage
    identityId: identity.outputs.identityId
    minReplicas: apiMinReplicas
    maxReplicas: apiMaxReplicas
    acrLoginServer: acrLoginServer
    keyVaultUri: existingKeyVault.properties.vaultUri
    storageAccountName: storageAccountName
    storageContainerName: storage.outputs.blobContainerName
    identityClientId: identity.outputs.identityClientId
    userUploadsContainerName: storage.outputs.userUploadsContainerName
    frontendOrigin: frontendOrigin
    authTenantId: authTenantId
    authClientId: authClientId
    authIssuer: authIssuer
    authRedirectUri: authRedirectUri
    authPostLoginRedirect: authPostLoginRedirect
    authPostLogoutRedirect: authPostLogoutRedirect
    authAdminGroupId: authAdminGroupId
    authUserGroupId: authUserGroupId
    otelEndpoint: 'http://${alloy.outputs.fqdn}:4318'
    envName: envName
  }
}

module edge 'modules/container-app-edge.bicep' = if (deployEdge) {
  name: 'edge-${envName}'
  params: {
    environmentId: containerAppsEnv.outputs.environmentId
    location: location
    image: edgeImage
    identityId: identity.outputs.identityId
    minReplicas: edgeMinReplicas
    maxReplicas: edgeMaxReplicas
    acrLoginServer: acrLoginServer
    apiUpstream: 'https://${api!.outputs.fqdn}'
  }
}

module jobs 'modules/container-app-jobs.bicep' = if (deployJobs) {
  name: 'jobs-${envName}'
  params: {
    environmentId: containerAppsEnv.outputs.environmentId
    location: location
    image: apiImage
    identityId: identity.outputs.identityId
    minReplicas: jobsMinReplicas
    maxReplicas: jobsMaxReplicas
    acrLoginServer: acrLoginServer
    keyVaultUri: existingKeyVault.properties.vaultUri
    otelEndpoint: 'http://${alloy.outputs.fqdn}:4318'
    envName: envName
  }
}

// ── Outputs ─────────────────────────────────────────────────────────────────

output edgeFqdn string = deployEdge ? edge!.outputs.fqdn : ''
output apiFqdn string = deployApiModule ? api!.outputs.fqdn : ''
output grafanaFqdn string = grafana.outputs.fqdn
output postgresServerFqdn string = postgres.outputs.serverFqdn
output environmentDefaultDomain string = containerAppsEnv.outputs.defaultDomain
output authRedirectUri string = authRedirectUri
output grafanaRedirectUri string = 'https://project-starter-grafana.${containerAppsEnv.outputs.defaultDomain}/login/azuread'
output dbBootstrapJobName string = deployBootstrapJob ? bootstrapJob!.outputs.name : ''

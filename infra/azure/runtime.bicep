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

// ── Existing Shared Infrastructure ──────────────────────────────────────────

var keyVaultName = 'kv-project-starter-${envName}'
var storageAccountName = 'saprojectstarter${envName}'
var identityName = 'id-project-starter-${envName}'
var containerAppsEnvironmentName = 'cae-project-starter-${envName}'

resource existingKeyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource existingStorageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource existingIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: identityName
}

resource existingContainerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: containerAppsEnvironmentName
}

resource existingAlloyApp 'Microsoft.App/containerApps@2024-03-01' existing = {
  name: 'project-starter-alloy'
}

resource existingApiApp 'Microsoft.App/containerApps@2024-03-01' existing = {
  name: 'project-starter-api'
}

// ── Derived Runtime Wiring ──────────────────────────────────────────────────

var acrLoginServer = '${acrName}.azurecr.io'
var apiImage = '${acrLoginServer}/project-starter-app:${imageTag}'
var edgeImage = '${acrLoginServer}/project-starter-edge:${imageTag}'
var edgeHost = customDomain != '' ? customDomain : 'project-starter-edge.${existingContainerAppsEnv.properties.defaultDomain}'
var frontendOrigin = 'https://${edgeHost}'
var authRedirectUri = '${frontendOrigin}/api/auth/callback'
var authPostLoginRedirect = '${frontendOrigin}/dashboard'
var authPostLogoutRedirect = '${frontendOrigin}/'
var authIssuer = '${environment().authentication.loginEndpoint}${authTenantId}/v2.0'
var otelEndpoint = 'http://${existingAlloyApp.properties.configuration.ingress.fqdn}:4318'
var apiUpstream = deployApi ? 'https://${api!.outputs.fqdn}' : 'https://${existingApiApp.properties.configuration.ingress.fqdn}'

// ── Runtime ACA Resources ───────────────────────────────────────────────────

module bootstrapJob 'modules/container-app-db-bootstrap-job.bicep' = if (deployBootstrapJob) {
  name: 'db-bootstrap-runtime-${envName}'
  params: {
    environmentId: existingContainerAppsEnv.id
    location: location
    image: apiImage
    imageTag: imageTag
    identityId: existingIdentity.id
    acrLoginServer: acrLoginServer
    keyVaultUri: existingKeyVault.properties.vaultUri
    otelEndpoint: otelEndpoint
    envName: envName
  }
}

module api 'modules/container-app-api.bicep' = if (deployApi) {
  name: 'api-runtime-${envName}'
  params: {
    environmentId: existingContainerAppsEnv.id
    location: location
    image: apiImage
    identityId: existingIdentity.id
    minReplicas: apiMinReplicas
    maxReplicas: apiMaxReplicas
    acrLoginServer: acrLoginServer
    keyVaultUri: existingKeyVault.properties.vaultUri
    storageAccountName: existingStorageAccount.name
    storageContainerName: 'uploads'
    identityClientId: existingIdentity.properties.clientId
    userUploadsContainerName: 'user-uploads'
    frontendOrigin: frontendOrigin
    authTenantId: authTenantId
    authClientId: authClientId
    authIssuer: authIssuer
    authRedirectUri: authRedirectUri
    authPostLoginRedirect: authPostLoginRedirect
    authPostLogoutRedirect: authPostLogoutRedirect
    authAdminGroupId: authAdminGroupId
    authUserGroupId: authUserGroupId
    otelEndpoint: otelEndpoint
    envName: envName
  }
}

module edge 'modules/container-app-edge.bicep' = if (deployEdge) {
  name: 'edge-runtime-${envName}'
  params: {
    environmentId: existingContainerAppsEnv.id
    location: location
    image: edgeImage
    identityId: existingIdentity.id
    minReplicas: edgeMinReplicas
    maxReplicas: edgeMaxReplicas
    acrLoginServer: acrLoginServer
    apiUpstream: apiUpstream
  }
}

module jobs 'modules/container-app-jobs.bicep' = if (deployJobs) {
  name: 'jobs-runtime-${envName}'
  params: {
    environmentId: existingContainerAppsEnv.id
    location: location
    image: apiImage
    identityId: existingIdentity.id
    minReplicas: jobsMinReplicas
    maxReplicas: jobsMaxReplicas
    acrLoginServer: acrLoginServer
    keyVaultUri: existingKeyVault.properties.vaultUri
    otelEndpoint: otelEndpoint
    envName: envName
  }
}

// ── Outputs ─────────────────────────────────────────────────────────────────

output authRedirectUri string = authRedirectUri
output grafanaRedirectUri string = 'https://project-starter-grafana.${existingContainerAppsEnv.properties.defaultDomain}/login/azuread'
output dbBootstrapJobName string = deployBootstrapJob ? bootstrapJob!.outputs.name : 'project-starter-db-bootstrap'
output apiFqdn string = deployApi ? api!.outputs.fqdn : ''
output edgeHost string = edgeHost

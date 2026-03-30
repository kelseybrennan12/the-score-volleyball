@description('Environment name suffix for resource naming.')
param envName string

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Key Vault name for secret reader role assignment.')
param keyVaultName string

//https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
@description('Role definition ID (GUID) for Key Vault Secrets User.')
param keyVaultSecretsUserRoleDefinitionId string = '4633458b-17de-408a-b874-0445c86b69e6'

var identityName = 'id-project-starter-${envName}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

// Key Vault Secrets User role (default built-in GUID)
resource kvSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, managedIdentity.id, keyVaultSecretsUserRoleDefinitionId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      keyVaultSecretsUserRoleDefinitionId
    )
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output identityId string = managedIdentity.id
output identityPrincipalId string = managedIdentity.properties.principalId
output identityClientId string = managedIdentity.properties.clientId

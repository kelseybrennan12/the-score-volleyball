@description('Environment name suffix for resource naming.')
param envName string

@description('Location for all resources.')
param location string = resourceGroup().location

@secure()
@description('Entra app client secret.')
param authClientSecret string

@secure()
@description('Base64-encoded 32-byte session encryption key.')
param authSessionEncryptionKey string

@secure()
@description('PostgreSQL admin password.')
param postgresAdminPassword string

@description('Object ID of the Entra app service principal that deploys infrastructure.')
param deployerSpObjectId string

// Not a secret — public built-in role GUID: https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
@description('Role definition ID (GUID) for Key Vault Secrets Officer.')
#disable-next-line secure-secrets-in-params
param keyVaultSecretsOfficerRoleDefinitionId string = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'

var vaultName = 'kv-project-starter-${envName}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenant().tenantId
    enableRbacAuthorization: true
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 7
  }
}

resource secretAuthClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'auth-client-secret'
  properties: {
    value: authClientSecret
  }
}

resource secretSessionKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'auth-session-encryption-key'
  properties: {
    value: authSessionEncryptionKey
  }
}

resource secretPostgresPassword 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'postgres-admin-password'
  properties: {
    value: postgresAdminPassword
  }
}

// Key Vault Secrets Officer role for deployer SP (default built-in GUID)
resource kvSecretsOfficerRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, deployerSpObjectId, keyVaultSecretsOfficerRoleDefinitionId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      keyVaultSecretsOfficerRoleDefinitionId
    )
    principalId: deployerSpObjectId
    principalType: 'ServicePrincipal'
  }
}

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri

targetScope = 'resourceGroup'

@description('Environment name (e.g. staging, prod).')
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

module keyVault 'modules/key-vault.bicep' = {
  name: 'key-vault-${envName}'
  params: {
    envName: envName
    location: location
    authClientSecret: authClientSecret
    authSessionEncryptionKey: authSessionEncryptionKey
    postgresAdminPassword: postgresAdminPassword
    deployerSpObjectId: deployerSpObjectId
  }
}

output keyVaultName string = keyVault.outputs.keyVaultName
output keyVaultUri string = keyVault.outputs.keyVaultUri

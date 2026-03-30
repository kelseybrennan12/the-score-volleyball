@description('Location for all resources.')
param location string = resourceGroup().location

@description('Storage account name (lowercase alphanumeric, 3-24 chars).')
param storageAccountName string

@description('Principal ID of the managed identity that needs blob read/write access.')
param identityPrincipalId string

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource fileServices 'Microsoft.Storage/storageAccounts/fileServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

var shareNames = ['grafana-data', 'loki-data', 'prometheus-data', 'tempo-data']

resource fileShares 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = [
  for shareName in shareNames: {
    parent: fileServices
    name: shareName
    properties: {
      shareQuota: 5
    }
  }
]

// ── Blob ─────────────────────────────────────────────────────────────────────

resource blobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource uploadsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'uploads'
  properties: {
    publicAccess: 'None'
  }
}

resource userUploadsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'user-uploads'
  properties: {
    publicAccess: 'None'
  }
}

var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource blobDataContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, identityPrincipalId, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      storageBlobDataContributorRoleId
    )
    principalId: identityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output storageAccountName string = storageAccount.name
output blobContainerName string = uploadsContainer.name
output userUploadsContainerName string = userUploadsContainer.name

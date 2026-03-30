@description('ACR name to grant pull access on.')
param acrName string

@description('Principal ID of the managed identity to grant AcrPull.')
param principalId string

@description('Managed identity resource ID (used for deterministic role assignment name).')
param identityId string

//https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
@description('Role definition ID (GUID) for AcrPull.')
param acrPullRoleDefinitionId string = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identityId, acrPullRoleDefinitionId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleDefinitionId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

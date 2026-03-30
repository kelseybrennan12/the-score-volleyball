using './main.bicep'

param envName = ''
param imageTag = ''
param acrName = 'crprojectstarter'
param postgresSkuName = 'Standard_B1ms'
param postgresSkuTier = 'Burstable'
param edgeMinReplicas = 1
param edgeMaxReplicas = 1
param apiMinReplicas = 1
param apiMaxReplicas = 1
param jobsMinReplicas = 1
param jobsMaxReplicas = 1
param authTenantId = ''
param authClientId = ''
param customDomain = ''

@description('Environment name suffix for resource naming.')
param envName string

@description('Location for all resources.')
param location string = resourceGroup().location

@description('PostgreSQL SKU name.')
param skuName string = 'Standard_B1ms'

@description('PostgreSQL SKU tier.')
param skuTier string = 'Burstable'

@description('PostgreSQL admin username.')
param adminUsername string = 'projectstarteradmin'

@secure()
@description('PostgreSQL admin password.')
param adminPassword string

var serverName = 'psql-project-starter-${envName}'
var databaseName = 'project_starter'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: '16'
    administratorLogin: adminUsername
    administratorLoginPassword: adminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allow Azure services to connect (Container Apps)
resource firewallAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output serverFqdn string = postgresServer.properties.fullyQualifiedDomainName
output databaseName string = databaseName
output adminUsername string = adminUsername

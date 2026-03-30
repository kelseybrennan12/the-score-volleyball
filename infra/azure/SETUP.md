# Azure Global Infrastructure Setup

Optional one-time setup for the Azure provider pack that lives alongside the starter's local-first path.

## Prerequisites

- Azure CLI installed and authenticated with `az login`
- Permission to create resources at subscription scope
- The GitHub repository slug that will run Actions, in the form `<github-owner>/<github-repo>`

## 1. Create Global Resource Group

The shared Azure Container Registry can live in a central resource group, commonly in the prod subscription.

```bash
az group create \
  --name project-starter-global \
  --location centralus \
  --subscription <prodSubscriptionId>
```

## 2. Create Azure Container Registry

```bash
az acr create \
  --resource-group project-starter-global \
  --name crprojectstarter \
  --sku Basic \
  --admin-enabled false \
  --subscription <prodSubscriptionId>
```

> ACR names must be globally unique and alphanumeric only. Adjust `crprojectstarter` if needed, then keep the same value
> in GitHub Actions variables.

## 3. Create Entra App Registration

Use one Entra app registration for both GitHub OIDC federation and deployed application auth.

```bash
az ad app create --display-name "project-starter"
az ad sp create --id <appId>
```

Capture:

- `appId`: used as `AZURE_CLIENT_ID` and `AUTH_CLIENT_ID`
- service principal object ID: used for Azure role assignments and bootstrap

### 3a. Add Federated Credentials for GitHub Actions

The checked-in JSON files in `infra/azure/federation/` are starter templates for environment-specific CD credentials.
Replace `<github-owner>/<github-repo>` in each `subject` field with the actual repository slug before applying them.

For `staging`, `prod`, or any additional deployment environment, follow `infra/azure/federation/README.md`.

### 3b. Assign Roles

Grant the deployer service principal Contributor on each subscription that will host environments.

```bash
MSYS_NO_PATHCONV=1 az role assignment create \
  --assignee <servicePrincipalObjectId> \
  --role Contributor \
  --scope /subscriptions/<devSubscriptionId>

MSYS_NO_PATHCONV=1 az role assignment create \
  --assignee <servicePrincipalObjectId> \
  --role Contributor \
  --scope /subscriptions/<prodSubscriptionId>
```

Grant ACR push on the shared registry:

```bash
MSYS_NO_PATHCONV=1 az role assignment create \
  --assignee <servicePrincipalObjectId> \
  --role AcrPush \
  --scope $(az acr show --name crprojectstarter --resource-group project-starter-global --query id -o tsv)
```

### 3c. Configure Application Auth

Set the sign-in audience:

```bash
az ad app update --id <appId> --sign-in-audience AzureADMyOrg
```

Generate a client secret:

```bash
az ad app credential reset --id <appId> --display-name "project-starter-auth-secret"
```

Save the generated secret value securely. It becomes the repo-level `AUTH_CLIENT_SECRET` secret in GitHub and the
`auth-client-secret` value in Azure Key Vault during bootstrap.

Configure token claims:

```bash
az ad app update --id <appId> --optional-claims '{
  "idToken": [
    { "name": "email", "essential": false },
    { "name": "preferred_username", "essential": false }
  ]
}'
```

### 3d. Configure RBAC Condition for Infrastructure Role Assignments

The Bicep templates assign these built-in roles to managed identities:

- `Key Vault Secrets Officer`
- `Key Vault Secrets User`
- `AcrPull`
- `Storage Blob Data Contributor`

Grant the deployer service principal `Role Based Access Control Administrator` with a condition that limits new role
assignments to those exact roles.

```bash
CONDITION=$'((!(ActionMatches{\'Microsoft.Authorization/roleAssignments/write\'})) OR (@Request[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {b86a8fe4-44ce-4948-aee5-eccb2c155cd7, 4633458b-17de-408a-b874-0445c86b69e6, 7f951dda-4ed3-4680-a7ca-43fe172d538d, ba92f5b4-2d11-453d-a403-e96b0029c9fe} AND @Request[Microsoft.Authorization/roleAssignments:PrincipalType] ForAnyOfAnyValues:StringEqualsIgnoreCase {\'ServicePrincipal\'}))'

MSYS_NO_PATHCONV=1 az role assignment create \
  --assignee-object-id '<servicePrincipalObjectId>' \
  --assignee-principal-type 'ServicePrincipal' \
  --role 'Role Based Access Control Administrator' \
  --scope '/subscriptions/<subscriptionId>' \
  --condition "$CONDITION" \
  --condition-version '2.0'
```

Verify:

```bash
az role assignment list \
  --assignee <servicePrincipalObjectId> \
  --all \
  --query "[?roleDefinitionName=='Role Based Access Control Administrator'].{condition:condition}" \
  --output json
```

## 4. Configure GitHub Actions Secrets and Variables

### Repository-level secrets

| Secret               | Description                          |
| -------------------- | ------------------------------------ |
| `AUTH_CLIENT_SECRET` | Entra app client secret from step 3c |

### Environment-level secrets

Each GitHub environment should provide its own runtime secrets:

| Secret                        | Value                     | Description            |
| ----------------------------- | ------------------------- | ---------------------- |
| `POSTGRES_ADMIN_PASSWORD`     | Strong random password    | Unique per environment |
| `AUTH_SESSION_ENCRYPTION_KEY` | `openssl rand -base64 32` | Unique per environment |

These values are written into Azure Key Vault during the first bootstrap deploy.

### Repository-level variables

| Variable                | Example value            | Description                                                  |
| ----------------------- | ------------------------ | ------------------------------------------------------------ |
| `AZURE_CLIENT_ID`       | `<appId>`                | Entra app registration client ID                             |
| `AZURE_TENANT_ID`       | `<tenantId>`             | Entra tenant ID                                              |
| `AZURE_SUBSCRIPTION_ID` | `<devSubscriptionId>`    | Default non-prod subscription                                |
| `ACR_NAME`              | `crprojectstarter`       | Shared ACR name                                              |
| `ACR_RESOURCE_GROUP`    | `project-starter-global` | Resource group containing the shared ACR                     |
| `ACR_SUBSCRIPTION_ID`   | `<prodSubscriptionId>`   | Optional when ACR lives outside the environment subscription |
| `AUTH_ADMIN_GROUP_ID`   | `<groupObjectId>`        | Optional Entra group mapped to admin access                  |
| `AUTH_USER_GROUP_ID`    | `<groupObjectId>`        | Optional Entra group mapped to user access                   |

### Optional environment-level variables

Set these only when an environment should diverge from the defaults:

| Variable                | Default                          | Description                                                |
| ----------------------- | -------------------------------- | ---------------------------------------------------------- |
| `AZURE_SUBSCRIPTION_ID` | repo default                     | Override for prod or any separate environment subscription |
| `ACR_NAME`              | repo default                     | Override only if the registry name differs                 |
| `ACR_RESOURCE_GROUP`    | repo default                     | Override only if the registry group differs                |
| `ACR_SUBSCRIPTION_ID`   | repo default or env subscription | Use for cross-subscription registry lookups                |
| `POSTGRES_SKU_NAME`     | `Standard_B1ms`                  | PostgreSQL compute SKU                                     |
| `POSTGRES_SKU_TIER`     | `Burstable`                      | PostgreSQL SKU tier                                        |
| `EDGE_MIN_REPLICAS`     | `1`                              | Edge minimum replicas                                      |
| `EDGE_MAX_REPLICAS`     | `1`                              | Edge maximum replicas                                      |
| `API_MIN_REPLICAS`      | `1`                              | API minimum replicas                                       |
| `API_MAX_REPLICAS`      | `1`                              | API maximum replicas                                       |
| `JOBS_MIN_REPLICAS`     | `1`                              | Jobs minimum replicas                                      |
| `JOBS_MAX_REPLICAS`     | `1`                              | Jobs maximum replicas                                      |
| `CUSTOM_DOMAIN`         | _(none)_                         | Custom domain for the edge app                             |

The Azure CD workflow is manual-only. Trigger `.github/workflows/cd.yml` with `workflow_dispatch` after your chosen
release path has already published the target image tag to ACR.

## 5. Verify Setup

```bash
az acr show --name crprojectstarter --resource-group project-starter-global --query name
az ad app show --id <appId> --query displayName
az ad app federated-credential list --id <appId>
az role assignment list --assignee <servicePrincipalObjectId> --all --output table --subscription <devSubscriptionId>
az role assignment list --assignee <servicePrincipalObjectId> --all --output table --subscription <prodSubscriptionId>
```

## 6. Configure Redirect URI Automation

The manual CD workflow syncs redirect URIs on the shared Entra app registration after each deploy. This requires a
one-time Microsoft Graph permission grant so the deployer service principal can update its own app registration.

```bash
APP_ID="<appId>"
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)
APP_OBJECT_ID=$(az ad app show --id "$APP_ID" --query id -o tsv)

az ad app owner add --id "$APP_OBJECT_ID" --owner-object-id "$SP_OBJECT_ID"

GRAPH_SP_ID=$(az ad sp list \
  --filter "appId eq '00000003-0000-0000-c000-000000000000'" \
  --query '[0].id' -o tsv)

az rest \
  --method POST \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/$SP_OBJECT_ID/appRoleAssignments" \
  --headers Content-Type=application/json \
  --body "{
    \"principalId\": \"$SP_OBJECT_ID\",
    \"resourceId\": \"$GRAPH_SP_ID\",
    \"appRoleId\": \"18a4783c-866b-4cc7-a460-3d5e5662c884\"
  }"
```

Until this is configured, the CD redirect-sync step logs a warning and skips the update.

## 7. Configure Security Group Access Restriction

If you want Entra to block sign-in for unassigned users, enable group assignment on the service principal and assign the
permitted groups.

### 7a. Require Group Assignment

```bash
APP_ID="<appId>"
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

az rest --method PATCH \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/$SP_OBJECT_ID" \
  --headers Content-Type=application/json \
  --body '{"appRoleAssignmentRequired": true}'
```

### 7b. Assign Permitted Security Groups

```bash
GROUP_1_ID="<group1ObjectId>"
GROUP_2_ID="<group2ObjectId>"

for GROUP_ID in "$GROUP_1_ID" "$GROUP_2_ID"; do
  az rest --method POST \
    --url "https://graph.microsoft.com/v1.0/servicePrincipals/$SP_OBJECT_ID/appRoleAssignedTo" \
    --headers Content-Type=application/json \
    --body "{
      \"principalId\": \"$GROUP_ID\",
      \"resourceId\": \"$SP_OBJECT_ID\",
      \"appRoleId\": \"00000000-0000-0000-0000-000000000000\"
    }"
done
```

### 7c. Add Groups Claim to ID Tokens

```bash
az ad app update --id "$APP_ID" --optional-claims '{
  "idToken": [
    { "name": "email", "essential": false },
    { "name": "preferred_username", "essential": false },
    { "name": "groups", "essential": false }
  ]
}'
```

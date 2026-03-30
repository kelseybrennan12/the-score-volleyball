# GitHub OIDC Federation Credentials

These JSON files define federated credentials that allow GitHub Actions to authenticate to Azure without stored secrets.

Each JSON file in this folder is a starter template for an environment-scoped CD credential. Replace
`<github-owner>/<github-repo>` in the `subject` field with the actual GitHub repository slug before applying the
credential in Entra.

## New environment checklist

When you create a new GitHub Actions environment for CD (e.g. `staging`, `prod`), follow these steps. Infrastructure
defaults (PostgreSQL SKU, replica counts, etc.) are managed by the Bicep templates — you only need to configure identity
and secrets.

> `<appId>` below refers to the Entra app registration ID (see the `project-starter` app in the Azure Portal or
> `AZURE_CLIENT_ID` in the GitHub repo secrets).

### Steps

- [ ] **Copy** [github-env-example.json](github-env-example.json) to a new file named `github-env-<env>.json`.

- [ ] **Replace** all instances of `<ENV_NAME>` in the new file with your environment name.
- [ ] **Replace** `<github-owner>/<github-repo>` with the repository slug that will run the workflow.

- [ ] **Apply the federated credential:**

  ```bash
  az ad app federated-credential create --id <appId> --parameters infra/azure/federation/github-env-<env>.json
  ```

- [ ] **Create GitHub Actions environment** — `Settings > Environments > New environment` with the name matching `<env>`
      above.

- [ ] **Add environment variable overrides (if needed):**

  | Variable                | Value                                                                    |
  | ----------------------- | ------------------------------------------------------------------------ |
  | `AZURE_SUBSCRIPTION_ID` | Only for prod (non-prod environments inherit the repo-level dev default) |

  > `AUTH_CLIENT_SECRET` stays repo-level. `POSTGRES_ADMIN_PASSWORD` and `AUTH_SESSION_ENCRYPTION_KEY` are typically
  > environment-level so each environment keeps its own database/admin and session boundary.

- [ ] **Deploy** — trigger the CD workflow via `workflow_dispatch`, select the new environment, and provide an image tag
      that has already been published to ACR by your chosen release path. The first deploy bootstraps the Key Vault and
      provisions all infrastructure.

- [ ] **Verify Entra redirect URIs** — the CD pipeline syncs redirect URIs automatically after each deploy. If the
      deploy logs show a Graph permissions warning, complete the one-time setup in
      [SETUP.md](../SETUP.md#6-configure-redirect-uri-automation) and re-deploy.

  ```bash
  az ad app show --id <appId> --query web.redirectUris -o json
  ```

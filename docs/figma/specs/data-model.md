# Data Model

Starter-facing UI entities and example shapes used across the current design docs.

## Entities

### RuntimeStatus

| Field    | Type                                              | Description                 |
| -------- | ------------------------------------------------- | --------------------------- |
| `label`  | string                                            | Human-readable status label |
| `state`  | `"healthy" \| "pending" \| "warning" \| "failed"` | Presentation state          |
| `detail` | string?                                           | Optional helper copy        |

### DatabaseStatus

| Field          | Type    | Description                                  |
| -------------- | ------- | -------------------------------------------- |
| `reachable`    | boolean | Whether the backend could reach the database |
| `databaseName` | string? | Current database name when available         |
| `schemaName`   | string? | Active app schema when available             |
| `checkedAt`    | string  | ISO timestamp for the status read            |

### DatabaseMetadataEntry

| Field   | Type    | Description             |
| ------- | ------- | ----------------------- |
| `key`   | string  | Metadata key or label   |
| `value` | string  | Rendered metadata value |
| `group` | string? | Optional grouping label |

### ExampleJobRun

| Field            | Type                                               | Description                                       |
| ---------------- | -------------------------------------------------- | ------------------------------------------------- |
| `id`             | string                                             | Job or run identifier                             |
| `taskIdentifier` | string                                             | Graphile task name, currently `example.db_ping`   |
| `state`          | `"queued" \| "running" \| "succeeded" \| "failed"` | Rendered run state                                |
| `createdAt`      | string                                             | ISO timestamp when the job was created            |
| `updatedAt`      | string?                                            | ISO timestamp for the latest visible state change |
| `detail`         | string?                                            | Optional message or summary                       |

### SessionSummary

| Field         | Type     | Description                  |
| ------------- | -------- | ---------------------------- |
| `userId`      | string   | Stable user identifier       |
| `email`       | string   | Displayed email or username  |
| `displayName` | string?  | Optional friendly name       |
| `roles`       | string[] | Visible role or group labels |

### EnvironmentSummary

| Field                   | Type    | Description                                          |
| ----------------------- | ------- | ---------------------------------------------------- |
| `deploymentEnvironment` | string  | Local, staging, prod, or equivalent deployment label |
| `authProvider`          | string  | Active auth mode                                     |
| `apiOrigin`             | string? | Optional API/runtime origin shown for debugging      |

## Relationships

```
Dashboard -> RuntimeStatus
Database -> DatabaseStatus + DatabaseMetadataEntry[]
Jobs -> ExampleJobRun[]
Settings -> SessionSummary + EnvironmentSummary
```

## Enums

### UI State

- `healthy`
- `pending`
- `warning`
- `failed`

### Job Run State

- `queued`
- `running`
- `succeeded`
- `failed`

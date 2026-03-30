# Page Specs

Per-page design guidance for the current starter screens.

## Dashboard

**Path:** `/dashboard`

**Purpose:** Give new users a quick orientation to the starter and confirm the runtime is healthy.

**Data:**

- backend health status
- database availability summary
- recent example job status summary

**Interactions:**

- Navigate to Database and Jobs from summary cards or action links
- Refresh or revisit the page without losing orientation

**Layout:**

- Intro or hero section that explains what the starter demonstrates
- Small status card grid for API, database, and jobs
- Short next-steps or starter-capabilities section

## Database

**Path:** `/database`

**Purpose:** Prove the app can safely read metadata from Postgres through the backend.

**Data:**

- connection status
- current schema or database metadata
- lightweight table or extension metadata when available

**Interactions:**

- Read-only inspection only
- No destructive actions or business CRUD examples

**Layout:**

- Page heading with a short explanation of the prove-out
- Status summary card
- Metadata table or grouped key-value sections
- Empty or error state that clearly distinguishes "DB unavailable" from "no extra metadata"

## Jobs

**Path:** `/jobs`

**Purpose:** Demonstrate the Graphile-backed worker architecture with one example job.

**Data:**

- enqueue status for `example.db_ping`
- recent Graphile job runs or queued jobs

**Interactions:**

- Trigger the example job
- View recent run history and status updates
- Reload and still see persisted job state

**Layout:**

- Primary action area for enqueueing the example job
- Recent-runs or queue-status section below
- Clear success, pending, and failure presentation

## Settings

**Path:** `/settings`

**Purpose:** Show the smallest authenticated and user-context example in the starter.

**Data:**

- current session or user summary
- deployment or environment information useful in dev or staging

**Interactions:**

- Read-only inspection of session and environment context
- No account-management workflow beyond the current-session prove-out

**Layout:**

- User or session card
- Environment or runtime details card
- Helpful notes about auth and session behavior in local vs deployed environments

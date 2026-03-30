# Visual Parity Capture

Captures paired screenshots from:

- a design reference app or prototype
- the running starter app

Artifacts are intended as review input for layout and control parity, not strict pixel-gated regression tests.

## Run

```bash
mise run visual-parity:capture
```

Artifacts are written to `artifacts/visual-parity/latest` by default, including a route-indexed `report.md`.

## Route Config

`scripts/visual-parity/routes.json` supports:

- `id` (required)
- `label` (required)
- `figmaPath` (required)
- `appPath` (required)
- `figmaClickLabels` (optional): ordered labels to click after navigation
- `appClickLabels` (optional): ordered labels to click after navigation

## Optional Environment

- `VISUAL_PARITY_OUTPUT_DIR` default `artifacts/visual-parity/latest`
- `VISUAL_PARITY_ROUTES_FILE` default `scripts/visual-parity/routes.json`
- `VISUAL_PARITY_VIEWPORT` default `1728x1117`
- `VISUAL_PARITY_WAIT_MS` default `900`
- `VISUAL_PARITY_TIMEOUT_MS` default `60000`
- `VISUAL_PARITY_APP_BASE_URL` default `http://localhost:8080`
- `VISUAL_PARITY_FIGMA_BASE_URL` default `http://localhost:4173`
- `VISUAL_PARITY_STORAGE_STATE` optional Playwright storage-state path for authenticated app capture
- `VISUAL_PARITY_PLAYWRIGHT_MODULE` optional absolute module path for Playwright import fallback

If your starter app requires authentication for the compared routes, provide `VISUAL_PARITY_STORAGE_STATE` with a valid
Playwright storage-state file.

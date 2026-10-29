# Implementation plan — medusa-storefront

| Milestone | Tasks | What lands | Done when |
|---|---|---|---|
| MS0 — the spec | MS-1 | intent (placeholder workspace), ci.yml (turso-starter's, byte for byte bar the provider comment), the shared TypeScript/ESLint config and the wrangler renderer, the spec index, this doc set, the task contracts | merged; ci.yml plans nothing while the workspace is `ws_CHANGE_ME` |
| MS1 — the storefront on Workers | MS-2 | `apps/web` (upstream `apps/storefront`, OpenNext config, wrangler config, the sample Store API), `tests/web` (the sample API, the mode switch, the middleware, site helpers) | typecheck, lint, test and build green; `wrangler dev` serves the sample catalogue, the cart and every route; the dry run fits 3 MiB gzipped |
| MS2 — ready to instantiate | MS-3 | README (run, test, preview, deploy, connect Medusa and payments, how it maps to Medusa Cloud), upstream's licence beside the storefront, the as-built status | a reader can do all of it from the README |
| MS3 — a baseline | MS-4 | blueprint.yaml, repo-blueprint.yaml (01-product, 02-docs), BOOTSTRAP.md, `.baseline/`, the rebrand and bootstrap tooling, `testing/`, baseline.yml and tag.yml, the context pack, generated component docs | Baseline CI green; `baseline-v1` cut |

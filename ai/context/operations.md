# medusa-storefront — operating contract (for humans and agents)

This is the standing guide to how this storefront is deployed and operated.
Instance facts (live URLs, workspace, the secrets it uses) live in
[deployment.md](deployment.md), rendered from probed reality by the
bootstrap's `02-docs` phase; this file is the contract that stays true
between deployments. It is written to give an agent with repository read
access enough context to reason about and operate the storefront without any
other source.

## What this system is

Medusa's DTC starter storefront, selling the products of a
[Medusa](https://medusajs.com) v2 backend, served from Cloudflare, expressed
as an Orun component-native desired-state repo.

- **`apps/web`** — Next.js built by `@opennextjs/cloudflare` into one Worker
  plus Static Assets. Every route renders per request against the backend's
  Store API (no data cache); the region middleware maps each URL's country
  to a region; the cart and accounts are server actions; `/api/health`
  reports the mode and whether the backend answers.
- **`tests/web`** — vitest over the sample Store API and its search, the
  sample cart through the storefront's own data layer, the mode switch, the
  region middleware and the health route. No lane lints or runs the tests:
  a pull request builds and dry-deploys the storefront, so run `pnpm
  typecheck && pnpm lint && pnpm test` before you push.
- **`tooling/*`** — shared TypeScript and ESLint configuration, and the
  wrangler renderer for a deployable that comes to take wiring.

There is no infrastructure component: the Medusa backend is a service the
storefront reads over HTTPS (Medusa Cloud or a server its owner runs), not
something this repository provisions.

Environments: **`stage`** and **`prod`** are deployed; **`dev` is
verify-only by design** — lanes build and dry-deploy, nothing deploys.

## Medusa: connected, or the sample catalogue

The storefront reads ONE Medusa backend, fixed at build time (`next build`
inlines its URL and publishable key). Until a build has both it is in
**sample mode**: `sdk.client.fetch` answers from the catalogue bundled in
`apps/web/src/lib/sample` (two regions, six products, a sale and a sold-out
variant), the cart lives in the shopper's `_medusa_sample_cart` cookie, a
"Sample store" banner says so, and checkout and sign-in say a backend is
needed. Nothing fails: a sample-mode storefront deploys, passes its smoke
test and serves.

To connect it, per deployed environment:

```bash
# 1. the backend and its publishable key (public values; the next build reads them)
orun secrets set MEDUSA_BACKEND_URL     --env stage    # prompts for the value
orun secrets set MEDUSA_PUBLISHABLE_KEY --env stage
# …and the same with --env prod

# 2. redeploy apps/web: the values are read when it BUILDS, and setting a
#    secret builds nothing. Deploy by hand (below), or change the stamp on
#    the last line of apps/web/component.yaml (`# orun: redeploy <reason> <stamp>`)
#    and merge.
```

And once per backend: add each Worker URL
(`https://medusa-storefront-web-<env>.your-workers-subdomain.workers.dev`,
and any custom domain) to its `STORE_CORS` — the store listing's search
calls the Store API from the browser. The listing reads the product index
the DTC starter's backend defines (`/store/search`); a backend without it
shows an empty listing and the rest of the store.

The secrets are read best-effort (`optionalSecretEnv` in
`apps/web/component.yaml`): a key nobody has stored is skipped, never a
failed lane. A wrong URL or key IS caught at deploy: connected,
`/api/health` answers 503 unless the backend lists its regions for the key,
and the smoke test reads it. The optional settings — `DEFAULT_REGION`,
`BASE_URL`, `STRIPE_PUBLISHABLE_KEY`, `MEDUSA_PAYMENTS_PUBLISHABLE_KEY`,
`MEDUSA_PAYMENTS_ACCOUNT_ID` — are set and redeployed the same way.

## Identity and tenancy

Every remote operation runs against ONE Orun workspace, declared in
`intent.yaml` under `execution.state.workspace` — committed, enforced, and
what CI uses. Do not remove it; headless credentials depend on it. If it
reads `ws_SET_ME`, the bootstrap had no workspace to write: set the real one
before anything else.

## How deployment works

1. Merge (or push) to `main`.
2. CI (`.github/workflows/ci.yml`) runs `orun plan --changed` — only
   components whose files changed are planned — then runs each planned lane
   with `orun run --remote-state`, authenticated by GitHub OIDC (the
   exchange resolves this repository's linked workspace server-side).
3. `apps/web` checks its committed `wrangler.jsonc` is there, builds once per
   environment with that environment's backend (if any), `wrangler deploy`
   ships `medusa-storefront-web-<env>`, and a smoke test fetches `/`, then
   requires `/api/health` to report `"ok":true` — proof the Worker's server
   code answers, and, connected, that the backend does too.
4. `prod` deploys after `stage` has converged on the same commit
   (`environments.prod.promotion` in intent.yaml).
5. **The convergence run is the deployment.** A green run means every
   planned lane passed. Failed lanes are retried with
   `gh run rerun --failed`, which resumes the same execution.

On a pull request nothing deploys: the storefront builds and dry-deploys.

Caveats that matter:

- A push that touches no component files plans zero lanes — that run is
  green and deployed nothing. Never treat "latest run green" as "storefront
  converged"; probe the URLs instead.
- Catalogue changes need no deploy: the storefront reads the Store API on
  every request, so a product published in the Medusa Admin shows at once.
- A change to `intent.yaml`'s `environments`, or to an Orun secret, maps to
  no component and redeploys nothing on its own. Land it with a change under
  `apps/web`.

## Secrets model

- **Brokered provider secrets**: `CLOUDFLARE_API_TOKEN` (the
  `workers-deploy` scope) and `CLOUDFLARE_ACCOUNT_ID` — pointers minted per
  run from the workspace's Cloudflare connection. No long-lived values at
  rest; nothing to rotate by hand.
- **The Medusa backend**: `MEDUSA_BACKEND_URL` and `MEDUSA_PUBLISHABLE_KEY`
  on `stage` and `prod`, stored by the owner, read by the build — and the
  optional `DEFAULT_REGION`, `BASE_URL` and payment keys. Public values,
  kept as secrets so each environment can name its own. Nothing is read at
  request time.
- Inspect by NAME only: `orun secrets list --org <ws> --env stage|prod`. No
  tooling in this repository prints a secret value, and no document in
  `ai/context/` may contain one.

## Verifying the system

```bash
# the storefront on each environment (also recorded, probed, in deployment.md);
# the health route says which mode it is in, and whether the backend answers
curl -s -o /dev/null -w '%{http_code}\n' https://medusa-storefront-web-stage.your-workers-subdomain.workers.dev/
curl -s https://medusa-storefront-web-stage.your-workers-subdomain.workers.dev/api/health   # {"ok":true,"mode":"sample"|"connected",…}
curl -s https://medusa-storefront-web-prod.your-workers-subdomain.workers.dev/api/health

# workspace readiness
orun secrets list --org <ws> --env stage && orun secrets list --org <ws> --env prod
orun integrations list --org <ws> --json && orun cloud check --org <ws>
```

## Common operations

| task | how |
|---|---|
| connect a Medusa backend | "Medusa: connected, or the sample catalogue" above |
| add or change products, prices, regions | the Medusa Admin of the connected backend; no deploy needed |
| change the storefront's code | edit `apps/web` (its name: `apps/web/src/lib/util/store-name.ts`), merge |
| change the sample catalogue | `apps/web/src/lib/sample/catalogue.ts` and `apps/web/public/sample`, then `pnpm test` |
| deploy a change | merge to `main`; watch the run; failed lanes → `gh run rerun --failed` |
| deploy by hand | Orunbase's Deploy button, or `gh workflow run ci.yml --ref main -f environment=<env> [-f component=<a,b>]` — the named components (blank: every one) run in that environment as a merge runs them; started off `main` it is refused |
| redeploy without a change | edit the last line of `apps/web/component.yaml` (`# orun: redeploy <reason> <stamp>`) and merge — it is a deploy trigger, nothing reads it |
| serve a custom domain | attach it to the Worker in Cloudflare (README, "Custom domain"), add it to the backend's `STORE_CORS`, then replace the placeholder `medusa-storefront.example.com` in `intent.yaml`'s `BASE_DOMAIN` (dev, stage and prod) with it |
| headless credentials | `ORUN_TOKEN` (workspace-scoped) + `GITHUB_TOKEN` |

The deployment record is the bootstrap's `02-docs` phase. Re-running it (the
Orun console's Retry on that phase, or `orun new … --phase 02-docs`)
re-probes the URLs and re-renders [deployment.md](deployment.md); it is
idempotent.

## Evolution

Structural changes follow the same contract that deployed the storefront: add a
component under `apps/`, `infra/` or `packages/` with a `component.yaml`,
land it as a pull request, and the convergence run deploys it. A component
under `infra/` whose wiring the Worker reads is declared in `apps/web`'s
`dependsOn` (enforced on `main`), so it is applied first.

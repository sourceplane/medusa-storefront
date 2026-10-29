# medusa-storefront

Medusa's [DTC starter storefront](https://github.com/medusajs/dtc-starter/tree/main/apps/storefront)
— a Next.js 16 shop front end for a Medusa v2 backend: regions and countries,
the catalogue with collections, categories, search and refinements, a cart
and a multi-step checkout with Stripe or Medusa Payments, customer accounts
with orders and addresses, Markdown product pages for agents and the
Universal Commerce Protocol endpoints — running on **Cloudflare Workers +
Static Assets** through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare),
and packaged as an **Orun baseline**: one command takes a new storefront from
nothing to live on stage and prod, in its own repository, under its own name,
in ONE landing — before its owner has a Medusa backend at all.

The template's code is the code and the Medusa backend stays wherever its
owner runs it (Medusa Cloud or any Medusa server); the storefront reaches it
over the Store API with a publishable key. What the port adds is the Workers
build, the monorepo wrapper, a test package, a health route and the deploy
contract — and what makes it deployable with no backend: until one is
connected, the one function every Store API call goes through
(`sdk.client.fetch`) answers from a **bundled sample catalogue**, so a fresh
deploy is a working, browsable shop with a cart, under a "Sample store"
banner, instead of a storefront that cannot start. What the baseline adds is
everything needed to make a copy of it somebody else's — built the way
[cirrus-baseline](https://github.com/sourceplane/cirrus-baseline) builds its
product since baseline-v22: one landing, one convergence. See
[`specs/epics/medusa-storefront`](specs/epics/medusa-storefront/README.md)
for the design, the milestones and the as-built status.

## Instantiating a storefront

```bash
git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/medusa-storefront
cd medusa-storefront
orun new --blueprint repo-blueprint.yaml --out ~/stores/acme-shop --run-hooks --resume \
  --set reponame=acme-shop --set productname="Acme Shop" \
  --set githuborg=acme-inc --set subdomain=<workers-dev-subdomain>
```

Or, once the platform's registry lists it, from the Orun console (Baselines →
`medusa-storefront` → Build). Two phases — `01-product` (the repository, its
CI and the whole storefront in one pull request, deployed to stage and prod
by one convergence, smoke-tested) and `02-docs` (the live deployment
recorded) — each landing one pull request in the new repository.
**[BOOTSTRAP.md](BOOTSTRAP.md)** is the operator guide;
[docs/phases/](docs/phases/README.md) has a page per phase.

The new repository receives the **storefront only** — the app, its tests,
its CI, its tooling, a README of its own and its operating contract — renamed
throughout to the store's name, repository and Cloudflare Worker. None of
this repository's machinery ships, and nothing that ships names it.

The only provider the bootstrap asks for is Cloudflare. **Medusa is not a
provider the platform brokers**, so the storefront is built without a
backend and its owner connects one afterwards: two optional Orun secrets
(`MEDUSA_BACKEND_URL`, `MEDUSA_PUBLISHABLE_KEY`), the Worker URLs in the
backend's `STORE_CORS`, and a redeploy. The store's README, "Connecting
Medusa" (`.baseline/product/README.md` here), has the steps.

| What makes it a baseline | Where |
|---|---|
| The console card (inputs, secrets, programme) | `blueprint.yaml` |
| The build document (modules, phases, hooks) | `repo-blueprint.yaml` |
| This tree's identity, and the bootstrap's task contracts | `.baseline/` |
| The rename engine (and its seam, the store's name) | `tooling/rebrand/rebrand.mjs`, `apps/web/src/lib/util/store-name.ts` |
| The bootstrap's helpers (deferrals, redeploy marker, work-tree strip) | `tooling/bootstrap/` |
| The deployment-record renderer | `hooks/render-deployment-docs.sh` |
| The store's README and context pack | `.baseline/product/README.md`, `ai/context/` |
| The baseline's tests: contract, leak, offline bootstrap, end to end | `testing/`, `.github/workflows/baseline.yml` |
| Cutting a `baseline-vN` tag | `.github/workflows/tag.yml` |

## What is here (the storefront)

| Surface | Where |
|---|---|
| The storefront: home, `/store`, collections, categories, products (and their Markdown at `.md`), search, cart, the checkout, accounts, orders, policies | `apps/web/src/app/[countryCode]` |
| `llms.txt`, the sitemap, robots, the UCP endpoints (`/ucp/v1`, `/ucp/mcp`, `/.well-known/ucp`), `/buy/[items]` | `apps/web/src/app` |
| The data layer (Store API reads, cart and account server actions) and the SDK | `apps/web/src/lib/data`, `apps/web/src/lib/config.ts` |
| The region middleware (which country a URL is in) | `apps/web/src/middleware.ts` |
| The sample catalogue, its Store API and search, the cookie cart, the mode switch | `apps/web/src/lib/sample`, `apps/web/public/sample` |
| The health route the deploy's smoke reads | `apps/web/src/app/api/health/route.ts` |
| Pages and components | `apps/web/src/modules` |
| Workers build and deploy contract | `apps/web/next.config.js`, `open-next.config.ts`, `wrangler.jsonc`, `component.yaml` |
| The store's name (the rename's seam) | `apps/web/src/lib/util/store-name.ts` |
| Tests | `tests/web` (vitest) |

## Getting started

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build                          # next build + opennextjs-cloudflare build → apps/web/.open-next
pnpm --filter @app/web preview      # wrangler dev over the built Worker
```

With no backend configured both the build and the preview are the sample
store: a banner says so, browsing, search and the cart work, and checkout and
sign-in say a backend is needed. `GET /api/health` answers
`{"ok":true,"mode":"sample",…}`.

To work against a backend with Next's dev server:

```bash
cp apps/web/.env.template apps/web/.env.local   # set NEXT_PUBLIC_MEDUSA_BACKEND_URL and NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
pnpm --filter @app/web dev                       # http://localhost:8000
```

For the Worker, the settings are read at build time:

```bash
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.example.com NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_… pnpm build
pnpm --filter @app/web preview
```

| Variable | Orun secret (per environment) | What it does |
|---|---|---|
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | `MEDUSA_BACKEND_URL` | The backend's URL. With it and the key set the storefront is connected; with either missing it serves the sample catalogue. |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | `MEDUSA_PUBLISHABLE_KEY` | The publishable API key (Medusa Admin → Settings → Publishable API Keys), scoped to the sales channel the store sells in. |
| `NEXT_PUBLIC_DEFAULT_REGION` | `DEFAULT_REGION` | Optional. The country a URL without one is sent to; `dk` when unset, or the first country the backend's regions list. |
| `NEXT_PUBLIC_BASE_URL` | `BASE_URL` | Optional. The canonical origin for canonical URLs, JSON-LD, robots, the sitemap and UCP; the request's origin when unset. |
| `NEXT_PUBLIC_STRIPE_KEY` | `STRIPE_PUBLISHABLE_KEY` | Optional. Stripe's publishable key, for a backend with the Stripe payment provider. |
| `NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY`, `NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID` | `MEDUSA_PAYMENTS_PUBLISHABLE_KEY`, `MEDUSA_PAYMENTS_ACCOUNT_ID` | Optional. Medusa Payments, for a Medusa Cloud backend that has it. |

All of them are public values `next build` inlines into the server and the
browser bundles; none is a secret in the cryptographic sense, and none is read
at request time.

## Connecting Medusa

1. **Run a Medusa v2 backend** with at least one region and some products:
   a [Medusa Cloud](https://cloud.medusajs.com) project, or the DTC starter's
   [`apps/backend`](https://github.com/medusajs/dtc-starter/tree/main/apps/backend)
   anywhere you run Node and Postgres. The store listing and the search
   drawer read the product index that backend defines
   (`src/search/product.ts`, served at `/store/search` by
   `src/api/middlewares.ts`); a backend without it shows the rest of the
   store and an empty listing.
2. **Create a publishable API key** in the Medusa Admin (Settings →
   Publishable API Keys) and add the sales channel the products are in.
3. **Allow the storefront's origins** in the backend's `STORE_CORS`: the
   listing's search runs in the browser and calls the Store API directly.
   Add `https://medusa-storefront-web-stage.your-workers-subdomain.workers.dev`,
   `https://medusa-storefront-web-prod.your-workers-subdomain.workers.dev` and
   any custom domain.
4. **Give the build the backend**, once per deployed environment:

   ```bash
   orun secrets set MEDUSA_BACKEND_URL     --env stage   # prompts for the value
   orun secrets set MEDUSA_PUBLISHABLE_KEY --env stage
   orun secrets set MEDUSA_BACKEND_URL     --env prod
   orun secrets set MEDUSA_PUBLISHABLE_KEY --env prod
   ```

   Then **redeploy**: a secret is read when the storefront builds, and setting
   one builds nothing. From that deploy on the banner is gone, the region
   middleware maps the backend's regions, and `/api/health` answers
   `{"ok":true,"mode":"connected",…}` only when the backend lists its regions
   for that key — the deploy's smoke test reads it, so a wrong URL or key
   fails the deploy instead of the first shopper.

## Payments

Checkout uses whatever payment providers the backend's region has. For
Stripe, enable the Stripe provider on the backend and set
`STRIPE_PUBLISHABLE_KEY`; for Medusa Payments on Medusa Cloud, set
`MEDUSA_PAYMENTS_PUBLISHABLE_KEY` and `MEDUSA_PAYMENTS_ACCOUNT_ID`. Both are
read at build time, so redeploy after setting them. Redirect-based methods
(iDEAL, Bancontact, …) return to `/api/payment-return`, which the Worker
answers.

## How it maps to Medusa Cloud

| Medusa Cloud | Here |
|---|---|
| The storefront deployed beside the backend (Next.js hosting: server components, server actions, route handlers, middleware) | One Cloudflare Worker (`.open-next/worker.js`) + Static Assets (`ASSETS`), per environment |
| The backend: the Medusa server, its database, the Admin | Not here. Medusa Cloud or any Medusa server the owner runs; the storefront reaches it over HTTPS |
| The storefront's environment, filled in by the Cloud project (backend URL, publishable key) | Optional Orun secrets, inlined by `next build` — and, unset, the bundled sample catalogue instead of a storefront that cannot start |
| Next's data cache: `force-cache` Store API reads tagged per visitor, `revalidateTag` after a cart or account change | No data cache: every read goes to the Store API, so no page shows a stale cart; the region map is cached per isolate for an hour, as upstream does |
| ISR for the home, product and policy pages (`force-static`, `revalidate = 60`) | Rendered on every request |
| `next/image` over the backend's file storage | Unchanged: upstream already serves images unoptimised |
| Deploy on push | Orun deploys `medusa-storefront-web-{stage,prod}` on merge to `main` and smoke-tests it (`apps/web/component.yaml`) |

## CI

| Workflow | What it runs | Ships to a store |
|---|---|---|
| `ci.yml` | the Orun pipeline, and the only workflow a store carries: `orun plan --changed`, then one job per lane. A pull request runs the verify lanes (the storefront built and dry-deployed per environment; they do not lint or run the tests), except the bootstrap's own landings (`orun/BASE-*`), where `plan` alone is the check; a merge deploys stage → prod and smoke-tests it. It plans nothing while `intent.yaml` names the placeholder workspace `ws_CHANGE_ME`, as this repository does. A manual run (Orunbase's Deploy button, or Run workflow on `main`) plans the environment and components it names under the push-to-main trigger, so they deploy as a merge deploys them | yes |
| `baseline.yml` | the baseline's own tiers: contract tests and the component docs' drift check, the blueprint read by the pinned orun, the leak gate, the offline bootstrap with the product's own plan, each landing installed, type-checked, linted, tested and built, then the storefront built in a staged job tree, dry-deployed, served, browsed and added to the cart with no Medusa backend | no |
| `tag.yml` | cuts a `baseline-vN` tag (manual) | no |

## License

The storefront is Medusa's, MIT, © 2022 Medusa — see
[the upstream licence](https://github.com/medusajs/dtc-starter/blob/main/LICENSE)
and `apps/web/LICENSE`.

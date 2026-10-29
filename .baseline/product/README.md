# medusa-storefront

Medusa's [DTC starter storefront](https://github.com/medusajs/dtc-starter/tree/main/apps/storefront)
— a Next.js 16 shop front end for a Medusa v2 backend: regions and countries,
the catalogue with collections, categories, search and refinements, a cart
and a multi-step checkout with Stripe or Medusa Payments, customer accounts
with orders and addresses, Markdown product pages for agents and the
Universal Commerce Protocol endpoints — running on **Cloudflare Workers +
Static Assets** through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).
Your Medusa backend stays where you run it (Medusa Cloud or any Medusa
server); the storefront reaches it over the Store API with a publishable key.

## Live deployment

<!-- 02-docs:begin -->
Not recorded yet. The bootstrap's last phase writes the live URLs, the
workspace and the secrets the storefront uses into
[ai/context/deployment.md](ai/context/deployment.md); how the storefront
deploys and how to operate it is in
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## Connecting Medusa

The storefront deploys and serves before it has a backend: until its build is
given a backend URL and a publishable key it shows a **sample catalogue**
bundled with it, under a "Sample store" banner. Browsing, search and the cart
work (the cart is kept in the shopper's cookie); checkout and sign-in say a
backend is needed. `/api/health` answers `{"ok":true,"mode":"sample",…}`. To
sell your own products:

1. **Run a Medusa v2 backend** with at least one region and some products:
   a [Medusa Cloud](https://cloud.medusajs.com) project, or the DTC starter's
   [`apps/backend`](https://github.com/medusajs/dtc-starter/tree/main/apps/backend)
   anywhere you run Node and Postgres. The store listing and the search
   drawer read the product index that backend defines
   (`src/search/product.ts`, served at `/store/search` by
   `src/api/middlewares.ts`); a backend without it shows the rest of the
   store and an empty listing.
2. **Create a publishable API key** in the Medusa Admin (Settings →
   Publishable API Keys) and add the sales channel your products are in.
3. **Allow the storefront's origins** in the backend's `STORE_CORS`: the
   listing's search runs in the browser and calls the Store API directly.
   Add `https://medusa-storefront-web-stage.your-workers-subdomain.workers.dev`,
   `https://medusa-storefront-web-prod.your-workers-subdomain.workers.dev` and
   any custom domain.
4. **Give the build your backend**, once per deployed environment. Both are
   public values `next build` bakes in, stored as this repository's Orun
   secrets so stage and prod can each name their own:

   ```bash
   orun secrets set MEDUSA_BACKEND_URL     --env stage   # prompts for the value
   orun secrets set MEDUSA_PUBLISHABLE_KEY --env stage
   orun secrets set MEDUSA_BACKEND_URL     --env prod
   orun secrets set MEDUSA_PUBLISHABLE_KEY --env prod
   ```

   Then **redeploy the storefront**: a secret is read when the storefront
   builds, and setting one builds nothing. Use **Deploy by hand** below, or
   change the stamp on the last line of `apps/web/component.yaml`
   (`# orun: redeploy …`) and merge. From that deploy on the banner is gone,
   the region middleware maps your regions, and `/api/health` answers
   `{"ok":true,"mode":"connected",…}` only when the backend lists its regions
   for that key — the deploy's smoke test reads it, so a wrong URL or key
   fails the deploy instead of the first shopper.

Optional, the same way: `DEFAULT_REGION` (the country a URL without one is
sent to; `dk` when unset, or the first country your regions list) and
`BASE_URL` (the canonical origin; the request's own when unset).

## Payments

Checkout uses whatever payment providers the backend's region has. For
Stripe, enable the Stripe provider on the backend and set the
`STRIPE_PUBLISHABLE_KEY` secret; for Medusa Payments on Medusa Cloud, set
`MEDUSA_PAYMENTS_PUBLISHABLE_KEY` and `MEDUSA_PAYMENTS_ACCOUNT_ID`. Both are
read at build time, so redeploy after setting them. Redirect-based methods
(iDEAL, Bancontact, …) return to `/api/payment-return`, which the Worker
answers.

## What is here

| Surface | Where |
|---|---|
| The storefront: home, `/store`, collections, categories, products (and their Markdown at `.md`), search, cart, the checkout, accounts, orders, policies | `apps/web/src/app/[countryCode]` |
| `llms.txt`, the sitemap, robots, the UCP endpoints (`/ucp/v1`, `/ucp/mcp`, `/.well-known/ucp`), `/buy/[items]` | `apps/web/src/app` |
| The data layer (Store API reads, cart and account server actions) and the SDK | `apps/web/src/lib/data`, `apps/web/src/lib/config.ts` |
| The region middleware (which country a URL is in) | `apps/web/src/middleware.ts` |
| The sample catalogue, its Store API and search, the cookie cart, the mode switch | `apps/web/src/lib/sample`, `apps/web/public/sample` |
| The health route the deploy's smoke reads | `apps/web/src/app/api/health/route.ts` |
| The store's name | `apps/web/src/lib/util/store-name.ts` |
| Pages and components | `apps/web/src/modules` |
| Workers build and deploy contract | `apps/web/next.config.js`, `open-next.config.ts`, `wrangler.jsonc`, `component.yaml` |
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

That needs no backend, and is what to run before you push: a pull request
builds the storefront but does not lint or run its tests. With a backend:

```bash
cp apps/web/.env.template apps/web/.env.local   # NEXT_PUBLIC_MEDUSA_BACKEND_URL, NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
pnpm --filter @app/web dev                       # http://localhost:8000
```

For the Worker locally, the settings are read at build time:

```bash
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.example.com NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_… pnpm build
pnpm --filter @app/web preview
```

| Variable | Orun secret (per environment) | What it does |
|---|---|---|
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | `MEDUSA_BACKEND_URL` | The backend's URL. With it and the key set the storefront is connected; with either missing it serves the sample catalogue. |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | `MEDUSA_PUBLISHABLE_KEY` | The publishable API key, scoped to the sales channel the store sells in. |
| `NEXT_PUBLIC_DEFAULT_REGION` | `DEFAULT_REGION` | Optional. The country a URL without one is sent to. |
| `NEXT_PUBLIC_BASE_URL` | `BASE_URL` | Optional. The canonical origin for canonical URLs, JSON-LD, robots, the sitemap and UCP. |
| `NEXT_PUBLIC_STRIPE_KEY` | `STRIPE_PUBLISHABLE_KEY` | Optional. Stripe's publishable key. |
| `NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY`, `NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID` | `MEDUSA_PAYMENTS_PUBLISHABLE_KEY`, `MEDUSA_PAYMENTS_ACCOUNT_ID` | Optional. Medusa Payments. |

All of them are public values `next build` inlines into the server and the
browser bundles; none is read at request time.

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. The storefront builds once per
environment, with that environment's backend (if any), and deploys — to
`stage`, then to `prod` once stage has converged on the same commit; `dev`
only verifies. The Worker is `medusa-storefront-web-<env>` on your account's
workers.dev subdomain, and every deploy is smoke-tested over HTTP: the home
page must answer and `/api/health` must report `"ok":true`. A pull request
runs the same pipeline's verify lanes: the storefront built and dry-deployed
for each environment, with nothing deployed. They do not lint or run the
tests, so run `pnpm typecheck`, `pnpm lint` and `pnpm test` before you push.
(A push to `main` builds, deploys and smoke-tests.)

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The
Cloudflare token and account id are brokered per run from the workspace's
Cloudflare connection; nothing provider-shaped is stored in the repository
or in GitHub.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after setting
or rotating a secret, say. A component with nothing to run in that
environment (a test suite in `prod`) is left out with a notice.

## Custom domain

The storefront answers on workers.dev from its first deploy. To serve it on
your own domain, add the domain to the Cloudflare account the storefront
deploys into and attach it to the Worker (dashboard → Workers & Pages →
`medusa-storefront-web-prod` → Settings → Domains & Routes → Add → Custom
domain), then add it to the backend's `STORE_CORS`. Canonical URLs, robots,
the sitemap and UCP use the origin a request was made to, so nothing else
has to change; to pin them to the domain, set the `BASE_URL` secret and
redeploy. The repository names the domain in one place, `BASE_DOMAIN` in
`intent.yaml` (dev, stage and prod), which the storefront was born with as
the reserved placeholder `medusa-storefront.example.com`. Replace it with
your domain in the same change that records it.

## How it maps to Medusa Cloud

| Medusa Cloud | Here |
|---|---|
| The storefront deployed beside the backend (Next.js hosting: server components, server actions, route handlers, middleware) | One Cloudflare Worker (`.open-next/worker.js`) + Static Assets (`ASSETS`), per environment |
| The backend: the Medusa server, its database, the Admin | Not here. Medusa Cloud or any Medusa server you run; the storefront reaches it over HTTPS |
| The storefront's environment, filled in by the Cloud project (backend URL, publishable key) | Optional Orun secrets, inlined by `next build` — and, unset, the bundled sample catalogue instead of a storefront that cannot start |
| Next's data cache: `force-cache` Store API reads tagged per visitor, `revalidateTag` after a cart or account change | No data cache: every read goes to the Store API, so no page shows a stale cart; the region map is cached per isolate for an hour, as upstream does |
| ISR for the home, product and policy pages (`force-static`, `revalidate = 60`) | Rendered on every request |
| Deploy on push | Orun deploys `medusa-storefront-web-{stage,prod}` on merge to `main` and smoke-tests it (`apps/web/component.yaml`) |

## License

The storefront is Medusa's, MIT, © 2022 Medusa — `apps/web/LICENSE`.

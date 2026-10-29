# medusa-storefront (MS) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md` or from the upstream storefront.

| Milestone | State | PR |
|---|---|---|
| MS0 — the spec | ✅ Shipped | [#1](https://github.com/sourceplane/medusa-storefront/pull/1) |
| MS1 — the storefront on Workers | ✅ Shipped | [#2](https://github.com/sourceplane/medusa-storefront/pull/2) |
| MS2 — ready to instantiate | ✅ Shipped | [#3](https://github.com/sourceplane/medusa-storefront/pull/3) |
| MS3 — a baseline | ✅ Shipped | [#4](https://github.com/sourceplane/medusa-storefront/pull/4) (MS-4), tagged `baseline-v1` |

## Departures from the upstream storefront

`apps/web` is upstream's `apps/storefront` at the commit the port was taken
from; these are the only changes. Upstream's MIT licence (© 2022 Medusa) is
`apps/web/LICENSE`, verbatim, and the README credits the template.

### Sample mode: the Store API answered from a bundled catalogue

With `NEXT_PUBLIC_MEDUSA_BACKEND_URL` or `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`
unset (`src/lib/sample/mode.ts`), the `sdk.client.fetch` wrapper upstream
already had in `src/lib/config.ts` answers from `src/lib/sample/store-api.ts`
instead of the network. Every Store API call goes through it — the data layer,
the SDK's cart, product and auth helpers, the store listing's search adapter
and the UCP endpoints — so no page or component changed for it. The catalogue
(`catalogue.ts`: two regions in EUR and USD, two collections, four categories,
six products with options, a sale and a sold-out variant; SVGs in
`public/sample`) and the product index behind `POST /store/search`
(`search.ts`) work; checkout, payment, promotions, accounts and orders answer
the error a backend would, saying a backend is needed.

The cart lives in the visitor's `_medusa_sample_cart` cookie, beside
upstream's `_medusa_cart_id`, written and read by two server functions
(`cart-cookie.ts`). They are server functions so `config.ts` — which client
components import for the search — never pulls `next/headers` into a browser
bundle; that also makes them callable server actions, so both refuse to do
anything once a backend is connected and re-validate every state (known
variants, 1–100 of each, at most 20 lines) — a visitor can only ever write
their own cart.

### The region middleware maps the sample regions without a backend

`src/middleware.ts` threw when `NEXT_PUBLIC_MEDUSA_BACKEND_URL` was unset, so a
deploy without a backend answered every page with a 500. In sample mode it
maps the sample catalogue's regions instead; connected, it is upstream's.

### `check-env-variables.js` warns instead of exiting

Upstream's `next build` exited without a publishable key. It now warns that
the build is in sample mode and names both settings; `.env.template` says the
key is optional.

### A banner, and notices on checkout and sign-in

`modules/layout/components/sample-mode-banner` (rendered by the root layout)
says on every page that the catalogue is a sample; in sample mode the checkout
page shows the cart's summary beside `modules/common/components/sample-mode-notice`
instead of the checkout form, and the sign-in page shows the notice instead of
the login and register forms. None of them render once a backend is connected.

### `GET /api/health`

New: `{ ok, mode }`, uncached and read-only — `ok` always in sample mode, and
connected only when the backend lists its regions for the publishable key the
build inlined (503 otherwise). The deploy's smoke test reads it.

### Next.js on Workers

`next.config.js` adds `output: "standalone"` and `outputFileTracingRoot` (the
monorepo root), which `@opennextjs/cloudflare` bundles. `open-next.config.ts`
keeps the adapter's default caches: there is no incremental cache, tag cache
or queue, so every Store API read goes to the backend (upstream's
`force-cache` reads and `revalidateTag` calls are no-ops) and no page shows a
stale cart. One side effect: the `force-static` routes (the home page, product
pages, the policy pages) have no stored per-segment prefetch data, so the
router's segment prefetches of the page a visitor is on answer 404; a
navigation fetches the page dynamically instead, so nothing a visitor sees
changes (`risks-and-open-questions.md` MS-D).

### `package.json`

Named `@app/web`; upstream's author, description and `medusa-storefront`
keyword go (the rename engine would rewrite the keyword), and so do `pg` and
`@types/pg`, which nothing imports. `build` runs `next build` and then the
OpenNext build; `preview` and `typecheck` are new; `@opennextjs/cloudflare`
and `wrangler` are added.

### Lint

Upstream's own ESLint config reported ten errors it never ran in CI; they are
fixed in place — unused parameters of the stubbed gift-card helpers prefixed
`_`, three `any`s typed, and two `@ts-ignore`s removed from
`language-select` (nothing under them is a type error). The config ignores
`.open-next/**` and `.wrangler/**`, the build's output. The 28 warnings are
upstream's and stay.

### The store's name is one constant (MS3)

Upstream spelled "Medusa Store" in the navbar, the footer, the side menu, the
checkout header, the register form, four page titles and two descriptions,
and kept `STORE_NAME` in `lib/util/site.ts` (server-only) for the rest. The
constant moves to `src/lib/util/store-name.ts`, importable by client
components, `site.ts` re-exports it, and every one of those places reads it;
the home page's title is the store's name instead of "Medusa Next.js Starter
Template". It is the rebrand's seam: instantiating the store under a new name
rewrites that one line. (Upstream's category titles carry the name twice,
`X | Medusa Store | Medusa Store`; kept as written.)

## Departures from the factory it was built from (MS3)

The baseline machinery — the card, the build document, `.baseline/`, the
rename engine, the bootstrap helpers, the deployment-record renderer, the
context pack and `testing/` — is cms-sanity's (the same infra-free shape:
one Worker, optional build-time settings as Orun secrets, a sample mode until
a SaaS is connected), with commerce's storefront e2e (the build's own
server-action id, the cookie cart). Beyond the renames:

- **The leak and placement gates read provenance prose in the pages written
  for the owner** (the README, `operations.md`, `deployment.md`), as
  turso-starter's do. Their older form read every shipped file, and the
  shared `ci.yml` — byte for byte turso-starter's — describes the pipeline
  every starter carries in those words. The factory-path check still reads
  every shipped file.
- **A factory path inside an import is the app's own directory**: both gates'
  factory-path pattern no longer matches `hooks/` after `/` or `@`, so
  upstream's `@lib/hooks/…` imports are not read as the factory's `hooks/`.
- **The deployment record probes `/` and `/api/health`**, and records each
  environment's mode (sample, connected, or connected with a backend that
  does not answer for the key) from the health route.
- **The e2e shops the storefront** instead of reading a blog: the home page
  under the store's own name and the sample banner, prices in both regions'
  currencies, `addToCart` twice by the id the build gave it and `/cart/add`
  once, the cart's lines and total, checkout's and sign-in's notices, search,
  the listing, a collection, a category, the Markdown product page, llms.txt,
  robots, the sitemap, UCP, two 404s, the assets and `/api/health`.

## Verified (MS3)

Locally, on the branch's head, every tier `baseline.yml` runs:

- `manifest`, `phases`, `coverage`, `rebrand`, `retouch`, `bootstrap-defer`
  and `tooling/catalog/gen-component-docs.py --check`: green.
- `orun new --blueprint repo-blueprint.yaml --status` and `orun catalog
  validate` (orun 2.89.0): green, no error (one warning: the catalog does not
  interpret `optionalSecretEnv`).
- `leak.test.sh`: 335 files derived across both phases, none of the factory.
- `placement.test.sh`: the offline bootstrap of both phases with the
  blueprint's own hooks, 335 tracked files branded as "Sam's Shirts & Mugs" /
  `acme-medusa-storefront`, re-tenanted, the gates restored, the record
  rendered; the product's own `orun plan` for the 01-product merge deploys
  `web` to stage and prod side by side with every Medusa ref optional; a
  `--resume` places nothing.
- `e2e.test.sh`: both landings installed, type-checked, linted, tested and
  built; the stage lane's five run steps in a staged job tree, its build on
  Turbopack and its dry run bundling `acme-medusa-storefront-web-stage` at
  9,717 KiB / 2,204 KiB gzipped; the component's smoke and the planned smoke
  step green on the served Worker (and refusing a path that is not the
  storefront); then the shopper's walk: / under the store's name and the
  sample banner, /us in dollars, addToCart twice by the build's action id and
  /dk/cart/add once, the cart at 2 × Cloud Tee + 1 × Cache Mug = €65,
  checkout's and sign-in's notices, search, the listing, a collection, a
  category, the Markdown product page, llms.txt, robots, the sitemap, UCP, two
  404s, the assets and `/api/health`.

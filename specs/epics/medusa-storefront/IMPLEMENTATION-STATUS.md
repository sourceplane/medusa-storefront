# medusa-storefront (MS) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md` or from the upstream storefront.

| Milestone | State | PR |
|---|---|---|
| MS0 — the spec | ✅ Shipped | [#1](https://github.com/sourceplane/medusa-storefront/pull/1) |
| MS1 — the storefront on Workers | ✅ Shipped | [#2](https://github.com/sourceplane/medusa-storefront/pull/2) |
| MS2 — ready to instantiate | ✅ Shipped | [#3](https://github.com/sourceplane/medusa-storefront/pull/3) |
| MS3 — a baseline | Not started | — |

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

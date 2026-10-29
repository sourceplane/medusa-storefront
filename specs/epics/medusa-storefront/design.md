# Design — medusa-storefront

## What maps to what

| Upstream (Vercel + Medusa Cloud) | Here |
|---|---|
| Next.js 16 on Vercel | One Cloudflare Worker + Static Assets built by `@opennextjs/cloudflare` |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` in `.env` | Optional Orun secrets `MEDUSA_BACKEND_URL`, `MEDUSA_PUBLISHABLE_KEY` per environment, handed to `next build` (both are public values the storefront inlines) |
| A required publishable key (`check-env-variables.js` exits) | A warning: with no backend the storefront builds in **sample mode** |
| A Medusa backend answering the Store API | The owner's Medusa backend once connected; until then the sample Store API (`lib/sample/`) answers at `sdk.client.fetch` and in the region middleware |
| Next's data cache (`cache: "force-cache"`, per-visitor tags, `revalidateTag` after cart changes) | No persistent data cache: OpenNext's static-assets incremental cache serves the build's few static files and every Store API read is fresh. The tags are per visitor (`_medusa_cache_id`), so an R2 cache would write an object per visitor per page; reads stay correct without it |
| Stripe / Medusa Payments publishable keys | Optional Orun secrets, inlined as upstream does |
| `next/image` (unoptimized upstream) | unchanged — Workers serves the original URLs |

## The sample mode

The data layer (`src/lib/data/*`), the UCP operations and the search adapter all reach Medusa through `sdk.client.fetch`, which upstream already wraps (for the locale header). With no backend URL or no publishable key, that wrapper hands the call to `lib/sample/store-api.ts`: a small in-process Store API over a bundled catalogue (two regions, collections, categories, products with options, variants and prices) that answers the paths the storefront calls with the shapes Medusa returns. The cart is a cookie (variant ids and quantities; prices always read back from the catalogue), written only by the server actions that already change the cart. Checkout, sign-in and orders answer with an error that says a Medusa backend is needed; the pages show a notice saying the catalogue is a sample and how to connect one. The region middleware reads the same sample regions instead of fetching `/store/regions`.

## Out of scope

The Medusa backend itself (it is not a Workers app: Postgres, Redis, workers, the admin), Medusa Cloud's S3 image host config (`MEDUSA_CLOUD_S3_*` stay optional build vars), and IP-based region detection (upstream removed it).

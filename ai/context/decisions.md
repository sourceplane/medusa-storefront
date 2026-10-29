# medusa-storefront — decisions

The choices that shape this repository, one line each, with where the full
reasoning lives. Superseded decisions stay listed, marked, so the history
reads in order.

| # | Decision | Why | Source |
|---|---|---|---|
| 1 | OpenNext on Workers + Static Assets (`cloudflare-workers-assets-turbo`) with the adapter's default caches: no incremental cache, tag cache or queue, no R2 or Durable Objects | The storefront binds nothing but its assets; every Store API read going to the backend keeps carts correct, and the region map is cached per isolate as upstream does | design.md, risk MS-D |
| 2 | Sample mode at `sdk.client.fetch`: with no backend URL or publishable key, the one function every Store API call goes through answers from a bundled catalogue in Medusa's own shapes | The platform brokers Cloudflare, not Medusa, so a bootstrap deploys before the owner has a backend; answering at that seam leaves every page and component as upstream wrote it | design.md, risks MS-B, MS-C |
| 3 | The sample cart lives in the shopper's cookie, written by validated server functions that refuse once a backend is connected | There is nowhere else to keep it; server functions keep `next/headers` out of the browser bundle the search client pulls `config.ts` into | IMPLEMENTATION-STATUS (MS1) |
| 4 | `GET /api/health` is the smoke: `ok` always in sample mode, connected only when the backend lists its regions for the inlined key | A route only the Worker answers, read-only — and a wrong URL or key fails the deploy instead of the first shopper | IMPLEMENTATION-STATUS (MS1) |
| 5 | The backend URL, publishable key, default region, base URL and payment keys are `optionalSecretEnv`, read at build | They are public values `next build` inlines; a required ref fails the lane before its first step on a fresh product | `apps/web/component.yaml` |
| 6 | Setting a Medusa secret redeploys nothing; the owner deploys by hand or bumps the `# orun: redeploy` stamp in `apps/web/component.yaml` | `orun plan --changed` plans a component only when its files change | `.baseline/product/README.md` |
| 7 | The store's name is one constant, `STORE_NAME` in `apps/web/src/lib/util/store-name.ts`, that every place upstream spelled "Medusa Store" reads | The rename's seam: one literal line, importable by client components too | IMPLEMENTATION-STATUS (MS3) |
| 8 | Two phases, one landing (`01-product`, `02-docs`), no infra component | A landing has a fixed cost (cirrus-baseline since baseline-v22); the storefront provisions nothing | `repo-blueprint.yaml` |
| 9 | `ci.yml` is turso-starter's, byte for byte bar one comment; it plans nothing while `intent.yaml` names `ws_CHANGE_ME`; stack-tectonic 0.19.0 | One pipeline across the starters; Turbopack refuses 0.20.0's out-of-tree `node_modules` | IMPLEMENTATION-STATUS (MS0) |
| 10 | Component docs are generated from the manifests and checked in CI | A hand-written copy of the dependency graph and bindings drifts silently | `tooling/catalog/gen-component-docs.py` |
| 11 | The workers.dev subdomain is read from the Cloudflare connection, not asked; the console asks for no domain, and an empty `productdomain` brands the placeholder `<reponame>.example.com` | Both belong to the account or come later; a typed one could only be wrong | `blueprint.yaml`, `repo-blueprint.yaml` |

# medusa-storefront

Medusa's [DTC starter storefront](https://github.com/medusajs/dtc-starter/tree/main/apps/storefront)
— a Next.js shop front end for a Medusa v2 backend: regions, the
catalogue with collections, categories and search, a cart and checkout,
customer accounts, Markdown product pages and the Universal Commerce
Protocol endpoints — on its way to **Cloudflare Workers + Static Assets**
through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), live
on a bundled sample catalogue until a Medusa backend is connected, and
packaged as an **Orun baseline**.

This is MS1: the storefront in `apps/web`, building and serving on Workers,
and its tests in `tests/web`. With no backend configured it serves the bundled
sample catalogue in `apps/web/src/lib/sample`:

```bash
pnpm install
pnpm --filter @app/web build
pnpm --filter @app/web exec wrangler dev
```

The design, the milestones and the as-built status are in
[`specs/epics/medusa-storefront`](specs/epics/medusa-storefront/README.md).

Upstream is MIT, © 2022 Medusa.

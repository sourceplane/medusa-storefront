# medusa-storefront — where this repository stands

The entry page for anyone (or any agent) picking this repository up. It is
this repository's own state and does not ship to a storefront built from it;
the two pages that do are [operations.md](operations.md) and
[deployment.md](deployment.md).

## What it is

Medusa's DTC starter storefront (medusajs/dtc-starter `apps/storefront`,
MIT) on Cloudflare Workers + Static Assets (`@opennextjs/cloudflare`) —
regions, the catalogue with search and refinements, a cart, a multi-step
checkout, customer accounts, Markdown product pages and the UCP endpoints,
reading a Medusa v2 backend over its Store API — packaged as an Orun
baseline: `orun new --blueprint repo-blueprint.yaml` builds a new storefront
in its own repository and takes it to live on stage and prod in one landing
(`01-product`), then records what went live (`02-docs`). It deploys before
its owner has a backend: in sample mode it serves a bundled catalogue with a
working cookie cart under a "Sample store" banner. There is no infra
component; the backend stays wherever its owner runs it.

## Release

| | |
|---|---|
| Latest tag | `baseline-v1` (MS3 — the baseline, one landing) |
| Proven live | No. Everything short of the platform is proven offline in Baseline CI, in sample mode; a live bootstrap (risk MS-F) and a storefront connected to a real backend (risk MS-G) are still to come |

## Where to read

| Question | Page |
|---|---|
| What shipped, and every departure from upstream | `specs/epics/medusa-storefront/IMPLEMENTATION-STATUS.md` |
| Why it is built this way | [decisions.md](decisions.md), then `specs/epics/medusa-storefront/design.md` |
| What could still go wrong | [open-risks.md](open-risks.md), then `specs/epics/medusa-storefront/risks-and-open-questions.md` |
| How to instantiate it | `BOOTSTRAP.md`, `docs/phases/` |
| What each component is | `apps/web/docs/`, `tests/web/docs/` (generated; `python3 tooling/catalog/gen-component-docs.py`) |

## Next

1. Bootstrap one storefront from `baseline-v1` against a workspace, and
   record its timings (closes MS-F).
2. Connect a Medusa backend to it — the DTC starter's own, for the product
   index the listing reads — and take an order through checkout (closes
   MS-G).

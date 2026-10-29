# Epic: medusa-storefront (MS)

**Medusa's DTC starter is two apps: a Medusa v2 backend and a Next.js storefront that talks to it over the Store API with a publishable key. Only the storefront moves. It runs on Cloudflare Workers + Static Assets through `@opennextjs/cloudflare`, and the backend stays where its owner runs it — Medusa Cloud or any Medusa server. Until a backend is connected the storefront answers its own Store API calls from a bundled sample catalogue, at the one function every call already goes through (`sdk.client.fetch`), so a fresh deploy is a working, browsable shop with nothing typed.**

The port keeps the storefront's pages, components, data layer, cart and checkout flow, accounts, Markdown product pages and Universal Commerce Protocol endpoints. It adds the Workers build, the monorepo wrapper, the sample mode, a test package, and the deploy contract.

## Status

| Field | Value |
|-------|-------|
| Status | ✅ MS0–MS3 shipped (#1–#4), MS3 tagged `baseline-v1`. Not yet proven by a live bootstrap (risk MS-F) or against a real backend (risk MS-G) |
| Cluster | **MS** (MS0–MS3) |
| Owner(s) | `apps/web` (the storefront, the sample Store API) · `tests/web` |
| Builds on | `cms-sanity`'s infra-free Workers shape (optional build-time settings as Orun secrets, a sample mode until a SaaS is connected) and `commerce`'s demo catalogue and server-action e2e |
| Upstream | [medusajs/dtc-starter `apps/storefront`](https://github.com/medusajs/dtc-starter/tree/main/apps/storefront) (MIT) |
| Changes | The Workers build, the sample Store API, optional settings as Orun secrets, no `pg` (unused), the env check a warning; page copy unchanged |
| Gate | MS1 is the first user-visible rung. No Terraform root: the storefront binds nothing but its own static assets |

## Read order

1. `design.md` — what maps to what, the sample mode, what is out of scope
2. `implementation-plan.md` — the milestones and what "done" means for each
3. `risks-and-open-questions.md` — what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md` — what actually shipped (kept distinct from intent)

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| MS0 — the spec | intent, CI, tooling, this doc set and the task contracts | merged on `main` |
| MS1 — the storefront on Workers | `apps/web`, the sample Store API, `tests/web` | `wrangler dev` serves the sample catalogue and every route; the Worker fits 3 MiB |
| MS2 — ready to instantiate | README, as-built status | a reader can run, test, preview, deploy and connect it |
| MS3 — a baseline | card, build document, rename, bootstrap tooling, tests | a new storefront goes from nothing to live in one landing; Baseline CI green |

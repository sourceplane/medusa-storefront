// OpenNext Cloudflare adapter config.
//
// No incremental cache, tag cache or queue: the storefront renders every route
// per request and binds nothing but its own static assets. Upstream reads the
// Store API with `cache: "force-cache"` and per-visitor cache tags, and clears
// them with `revalidateTag` after a cart or account change; with the default
// (dummy) caches here every read goes to the backend and every revalidation is
// a no-op, so a page never shows a stale cart. A store that wants Next's data
// cache on Workers swaps in the R2 incremental cache plus the Durable Object
// tag cache and queue (specs/epics/medusa-storefront/risks-and-open-questions.md,
// MS-D) — a Terraform root and Durable Objects this starter does without.
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config"

export default defineCloudflareConfig({})

# Epics

Orun-style work programs. Each epic is a folder carrying `epic.yaml` (the
declaration the platform reads: slug, key prefix, milestones with exit
criteria and task keys) beside its doc set. The pull request that adds the
folder is the adoption; the merge creates the epic in the workspace.

| Epic | Cluster | Status | What it is |
|------|---------|--------|------------|
| [`medusa-storefront/`](./medusa-storefront/) | **MS** | ✅ Shipped (`baseline-v1`) | Medusa's DTC starter storefront, equivalent in code and function, on Cloudflare Workers + Static Assets via OpenNext — live on a sample catalogue until a Medusa backend is connected — and an Orun baseline that instantiates it in one landing |

As-built ≠ intent: what shipped lives in each epic's `IMPLEMENTATION-STATUS.md`.

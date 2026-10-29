# Risks and open questions — medusa-storefront

| ID | Risk | Mitigation / decision |
|---|---|---|
| MS-A | The storefront might not build or run on workerd (Next 16.3, React 19, the region middleware, Server Actions) | **Settled by the spike:** it builds with @opennextjs/cloudflare 1.20 into a 2,175 KiB gzipped Worker and every page renders under `wrangler dev` against a stub Store API |
| MS-B | With no backend, the region middleware throws and every page is a 500 | The middleware reads the sample regions in sample mode; connected, it behaves as upstream |
| MS-C | The sample Store API drifts from Medusa's response shapes, and a component reads a field it lacks | Tests run the upstream data layer over the sample API; the e2e renders every route in sample mode |
| MS-D | Per-request Store API reads are slower than Vercel's data cache | Accepted: reads are correct and the region map is cached per isolate for an hour, as upstream does; an R2 incremental cache is the upgrade path if a store needs it. Measured at MS1: with no incremental cache the `force-static` routes store no per-segment prefetch data, so the segment prefetches of the page a visitor is on answer 404 and a navigation renders the page dynamically instead — nothing a visitor sees changes |
| MS-E | The Worker grows past Workers Free's 3 MiB | Measured on every build's dry run; 2,175 KiB gzipped at the spike, 2,206 KiB at MS1 with the sample catalogue |
| MS-F | A live bootstrap is unproven offline (repository, token, deploy, probes) | Only a live build proves it |
| MS-G | The connected storefront is tested against mocked and stub backends only (checkout, payment, accounts and orders never ran on Workers against a real Medusa backend) | Open until the first connected product takes an order; the region middleware, the data layer and the health route are tested against a mocked backend, and every page rendered against a stub Store API at the spike |

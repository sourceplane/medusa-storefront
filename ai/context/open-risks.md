# medusa-storefront — open risks

What is not yet proven or not yet decided. The full write-up of every risk,
including the accepted and resolved ones, is
`specs/epics/medusa-storefront/risks-and-open-questions.md`; this page lists only
what is still live, so it should be short.

| ID | Risk | State | What closes it |
|---|---|---|---|
| MS-F | Not proven live: repository creation, the brokered token, a real deploy and the probes | OPEN | One bootstrap from a tag against a workspace |
| MS-G | The connected storefront is exercised against mocked and stub backends only: checkout, payment, accounts and orders have never run on Workers against a real Medusa backend | OPEN | The first connected product takes an order through checkout and signs a customer in |

Accepted, and worth knowing before you change them: MS-C (the sample Store
API could drift from Medusa's shapes — the tests run upstream's data layer
over it), MS-D (no data cache; the segment prefetches of a `force-static`
page answer 404 and a navigation renders it dynamically instead), MS-E (the
Worker's size, measured on every dry run).

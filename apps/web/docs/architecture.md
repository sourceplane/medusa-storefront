# web — architecture

Built by the turbo pipeline from `apps/web` and deployed with wrangler.

|                     |                                                 |
| ------------------- | ----------------------------------------------- |
| Worker config       | `apps/web/wrangler.jsonc`                       |
| Entry               | `.open-next/worker.js`                          |
| Compatibility date  | `2026-10-01`                                    |
| Compatibility flags | `nodejs_compat`, `global_fetch_strictly_public` |

## Bindings

| Binding  | Kind          | Source              |
| -------- | ------------- | ------------------- |
| `ASSETS` | Static assets | `.open-next/assets` |

## Secrets resolved by the lane (names only)

- `NEXT_PUBLIC_BASE_URL` (optional)
- `NEXT_PUBLIC_DEFAULT_REGION` (optional)
- `NEXT_PUBLIC_MEDUSA_BACKEND_URL` (optional)
- `NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID` (optional)
- `NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY` (optional)
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (optional)
- `NEXT_PUBLIC_STRIPE_KEY` (optional)

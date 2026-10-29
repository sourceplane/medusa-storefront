// Whether the storefront has a Medusa backend to talk to. Both values are
// public build-time settings `next build` inlines (component.yaml,
// optionalSecretEnv); with either missing the storefront runs in sample mode:
// `sdk.client.fetch` answers from the bundled catalogue (./store-api.ts), the
// region middleware maps the sample regions, and a banner says so.
export const MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
export const MEDUSA_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

export const SAMPLE_MODE = !(
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL &&
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
)

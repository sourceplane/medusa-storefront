import { getLocaleHeader } from "@lib/util/get-locale-header"
import { readSampleCart, writeSampleCart } from "@lib/sample/cart-cookie"
import { SAMPLE_MODE } from "@lib/sample/mode"
import { sampleStoreFetch, SampleCartStore } from "@lib/sample/store-api"
import Medusa, { FetchArgs, FetchInput } from "@medusajs/js-sdk"

// Defaults to standard port for Medusa server
let MEDUSA_BACKEND_URL = "http://localhost:9000"

if (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
}

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})

const originalFetch = sdk.client.fetch.bind(sdk.client)

// A cart is only ever read or written on the server (the data layer's server
// functions and route handlers); the browser's calls are the store listing's
// search and product options, which never touch one.
const sampleCarts: SampleCartStore =
  typeof window === "undefined"
    ? { read: readSampleCart, write: writeSampleCart }
    : {
        read: async () => null,
        write: async () => {},
      }

sdk.client.fetch = async <T>(
  input: FetchInput,
  init?: FetchArgs
): Promise<T> => {
  // No backend connected: answer from the bundled sample catalogue
  // (src/lib/sample), in the Store API's own shapes.
  if (SAMPLE_MODE) {
    return (await sampleStoreFetch(
      input instanceof URL ? input.pathname + input.search : String(input),
      init as Parameters<typeof sampleStoreFetch>[1],
      sampleCarts
    )) as T
  }

  const headers = init?.headers ?? {}
  let localeHeader: Record<string, string | null> | undefined
  try {
    localeHeader = await getLocaleHeader()
    headers["x-medusa-locale"] ??= localeHeader["x-medusa-locale"]
  } catch {}

  const newHeaders = {
    ...localeHeader,
    ...headers,
  }
  init = {
    ...init,
    headers: newHeaders,
  }
  return originalFetch(input, init)
}

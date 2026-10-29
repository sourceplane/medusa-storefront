import { SAMPLE_PRODUCTS, SAMPLE_REGIONS } from "@lib/sample/catalogue"
import {
  MEDUSA_BACKEND_URL,
  MEDUSA_PUBLISHABLE_KEY,
  SAMPLE_MODE,
} from "@lib/sample/mode"

// GET /api/health: which mode the storefront runs in, and — connected — whether
// its Medusa backend answers the Store API with the publishable key it was
// built with. Read-only, uncached, and answered by the Worker alone (the
// region middleware skips /api). It is the deploy's smoke test: `ok` is true
// in sample mode, and in connected mode only when the backend lists its
// regions.
export const dynamic = "force-dynamic"

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  })

export async function GET() {
  if (SAMPLE_MODE) {
    return json({
      ok: true,
      mode: "sample",
      regions: SAMPLE_REGIONS.length,
      products: SAMPLE_PRODUCTS.length,
    })
  }

  try {
    const response = await fetch(
      `${MEDUSA_BACKEND_URL!.replace(/\/$/, "")}/store/regions?fields=id&limit=100`,
      {
        headers: { "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY! },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    )
    if (!response.ok) {
      return json(
        { ok: false, mode: "connected", backend: { status: response.status } },
        503
      )
    }
    const { regions } = (await response.json()) as { regions?: unknown[] }
    return json({ ok: true, mode: "connected", regions: regions?.length ?? 0 })
  } catch {
    return json({ ok: false, mode: "connected", backend: { reachable: false } }, 503)
  }
}

import { InformationCircleSolid } from "@medusajs/icons"

import { SAMPLE_MODE } from "@lib/sample/mode"

/**
 * Says, on every page, that the storefront is showing its bundled sample
 * catalogue because no Medusa backend is connected (src/lib/sample). Renders
 * nothing once one is.
 */
export default function SampleModeBanner() {
  if (!SAMPLE_MODE) {
    return null
  }

  return (
    <div
      className="flex items-center justify-center gap-1 small:p-3 p-2 text-center text-sm bg-ui-bg-subtle text-ui-fg-subtle border-b border-ui-border-base"
      data-testid="sample-mode-banner"
    >
      <InformationCircleSolid className="inline shrink-0" />
      <span>
        Sample store: no Medusa backend is connected, so this is a bundled
        sample catalogue. Browsing and the cart work; checkout and accounts
        need a backend.
      </span>
    </div>
  )
}

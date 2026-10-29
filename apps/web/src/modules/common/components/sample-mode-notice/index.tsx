import { Heading, Text } from "@modules/common/components/ui"

/**
 * Stands in for a flow that needs a Medusa backend — checkout, accounts —
 * while the storefront is serving its sample catalogue (src/lib/sample).
 */
export default function SampleModeNotice({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="flex flex-col gap-y-4 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-6"
      data-testid="sample-mode-notice"
    >
      <Heading level="h2" className="text-2xl">
        {title}
      </Heading>
      <Text className="text-ui-fg-subtle">{children}</Text>
      <Text className="text-ui-fg-subtle">
        Set <code>NEXT_PUBLIC_MEDUSA_BACKEND_URL</code> and{" "}
        <code>NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY</code> (the product&apos;s
        MEDUSA_BACKEND_URL and MEDUSA_PUBLISHABLE_KEY secrets) and redeploy to
        connect one.
      </Text>
    </div>
  )
}

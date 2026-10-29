import { getBaseURL } from "@lib/util/env"
import SampleModeBanner from "@modules/layout/components/sample-mode-banner"
import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <head>
        <link rel="ucp" href="/.well-known/ucp" />
      </head>
      <body>
        <SampleModeBanner />
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}

import { Metadata } from "next"

import { SAMPLE_MODE } from "@lib/sample/mode"
import LoginTemplate from "@modules/account/templates/login-template"
import SampleModeNotice from "@modules/common/components/sample-mode-notice"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Medusa Store account.",
}

export default function Login() {
  if (SAMPLE_MODE) {
    return (
      <div className="w-full px-8 py-8">
        <SampleModeNotice title="Accounts need a Medusa backend">
          This storefront is serving its bundled sample catalogue, so there
          are no customer accounts to sign in to or create.
        </SampleModeNotice>
      </div>
    )
  }

  return <LoginTemplate />
}

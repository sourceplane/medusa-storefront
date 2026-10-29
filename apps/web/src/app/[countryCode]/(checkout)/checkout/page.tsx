import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { SAMPLE_MODE } from "@lib/sample/mode"
import SampleModeNotice from "@modules/common/components/sample-mode-notice"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Checkout",
}

export default async function Checkout() {
  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  // The sample catalogue has no shipping, payment or orders to check out
  // with: the cart's summary, and what connecting a backend takes.
  if (SAMPLE_MODE) {
    return (
      <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
        <SampleModeNotice title="Checkout needs a Medusa backend">
          This storefront is serving its bundled sample catalogue, so there is
          no shipping, payment or order to complete. Your sample cart is kept
          in this browser.
        </SampleModeNotice>
        <CheckoutSummary cart={cart} />
      </div>
    )
  }

  const customer = await retrieveCustomer()

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
      <PaymentWrapper cart={cart}>
        <CheckoutForm cart={cart} customer={customer} />
      </PaymentWrapper>
      <CheckoutSummary cart={cart} />
    </div>
  )
}

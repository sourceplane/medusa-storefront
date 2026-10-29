"use server"

import { cookies as nextCookies } from "next/headers"

import { findSampleVariant } from "./catalogue"
import { SAMPLE_MODE } from "./mode"
import {
  MAX_SAMPLE_LINES,
  MAX_SAMPLE_QUANTITY,
  type SampleCartState,
} from "./store-api"

// Where a sample cart lives: the visitor's own cookie, next to upstream's
// `_medusa_cart_id`, since there is no backend to keep it. Server functions,
// so that src/lib/config.ts — which client components import too, for the
// store listing's search — can reach them without pulling next/headers into a
// client bundle. Neither does anything once a backend is connected, and what
// is read back is re-validated: a visitor can only ever write their own cart.

const COOKIE = "_medusa_sample_cart"

const isState = (value: unknown): value is SampleCartState => {
  const state = value as SampleCartState
  return (
    !!state &&
    typeof state.id === "string" &&
    /^cart_sample_[a-z0-9]{1,32}$/.test(state.id) &&
    typeof state.region_id === "string" &&
    Array.isArray(state.items) &&
    state.items.length <= MAX_SAMPLE_LINES &&
    state.items.every(
      (item) =>
        typeof item?.variant_id === "string" &&
        !!findSampleVariant(item.variant_id) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= MAX_SAMPLE_QUANTITY &&
        typeof item.created_at === "string"
    ) &&
    (state.email === undefined || typeof state.email === "string") &&
    (state.locale === undefined || typeof state.locale === "string")
  )
}

export async function readSampleCart(): Promise<SampleCartState | null> {
  if (!SAMPLE_MODE) {
    return null
  }
  try {
    const value = (await nextCookies()).get(COOKIE)?.value
    const state: unknown = value ? JSON.parse(value) : null
    return isState(state) ? state : null
  } catch {
    return null
  }
}

export async function writeSampleCart(state: SampleCartState): Promise<void> {
  if (!SAMPLE_MODE || !isState(state)) {
    return
  }
  // The same attributes as upstream's cart cookie (src/lib/data/cookies.ts).
  ;(await nextCookies()).set(COOKIE, JSON.stringify(state), {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

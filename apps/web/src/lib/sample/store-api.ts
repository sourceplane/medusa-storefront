import { FetchError } from "@medusajs/js-sdk"
import { HttpTypes } from "@medusajs/types"

import {
  findSampleVariant,
  priceProduct,
  regionById,
  SAMPLE_CATEGORIES,
  SAMPLE_COLLECTIONS,
  SAMPLE_PRODUCTS,
  SAMPLE_REGIONS,
  sampleCurrencyOf,
  SampleProduct,
  variantPrice,
} from "./catalogue"
import { sampleSearch, SearchQuery } from "./search"

// THE SAMPLE STORE API: what `sdk.client.fetch` answers instead of a Medusa
// backend while none is connected (src/lib/config.ts). Every Store API call
// the storefront makes goes through that one function — the data layer in
// src/lib/data, the SDK's cart, product and auth helpers, the store listing's
// search adapter and the UCP endpoints — so answering here, in the Store
// API's own shapes, leaves every page and component as upstream wrote it.
//
// The catalogue, the store's search and the cart work. What needs a backend
// to mean anything — checkout, payment, accounts, orders, promotions — answers
// with an error that says so, which the storefront shows where it would show
// the backend's.

export const CONNECT_A_BACKEND =
  "This storefront is serving its sample catalogue: connect a Medusa backend (README, \"Connecting Medusa\") to"

const refuse = (status: number, what: string): never => {
  throw new FetchError(
    `${CONNECT_A_BACKEND} ${what}.`,
    status === 401 ? "Unauthorized" : "Bad Request",
    status
  )
}

const notFound = (what: string): never => {
  throw new FetchError(`${what} was not found`, "Not Found", 404)
}

/** A sample cart as the visitor's cookie keeps it (src/lib/sample/cart-cookie.ts). */
export type SampleCartState = {
  id: string
  region_id: string
  email?: string
  locale?: string
  items: { variant_id: string; quantity: number; created_at: string }[]
}

export type SampleCartStore = {
  read: () => Promise<SampleCartState | null>
  write: (state: SampleCartState) => Promise<void>
}

export const MAX_SAMPLE_LINES = 20
export const MAX_SAMPLE_QUANTITY = 100

type Query = Record<string, unknown>

const list = (value: unknown): string[] =>
  value === undefined || value === null || value === ""
    ? []
    : (Array.isArray(value) ? value : [value]).map(String)

const page = <T>(items: T[], query: Query) => {
  const limit = Number(query.limit ?? 50) || 50
  const offset = Number(query.offset ?? 0) || 0
  return {
    items: items.slice(offset, offset + limit),
    count: items.length,
    limit,
    offset,
  }
}

const wantsProducts = (query: Query) => String(query.fields ?? "").includes("products")


const matchesText = (product: SampleProduct, q: string) => {
  const haystack = [
    product.title,
    product.subtitle,
    product.description,
    ...(product.tags ?? []).map((t) => t.value),
  ]
    .join(" ")
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

function listProducts(query: Query) {
  const ids = list(query.id)
  const handles = list(query.handle)
  const collections = list(query.collection_id)
  const categories = list(query.category_id)
  const tags = list(query.tag_id)
  const q = typeof query.q === "string" ? query.q : ""
  let products = SAMPLE_PRODUCTS.filter(
    (p) =>
      (!ids.length || ids.includes(p.id)) &&
      (!handles.length || handles.includes(p.handle)) &&
      (!collections.length || collections.includes(p.collection_id ?? "")) &&
      (!categories.length ||
        (p.categories ?? []).some((c) => categories.includes(c.id))) &&
      (!tags.length || (p.tags ?? []).some((t) => tags.includes(t.id))) &&
      (!q || matchesText(p, q))
  )
  const order = typeof query.order === "string" ? query.order : ""
  if (order.replace(/^-/, "") === "created_at") {
    products = [...products].sort((a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? "")
    )
    if (order.startsWith("-")) {
      products.reverse()
    }
  }
  const region = regionById(typeof query.region_id === "string" ? query.region_id : "")
  const { items, ...meta } = page(products, query)
  return { products: items.map((p) => priceProduct(p, region)), ...meta }
}

function buildCart(state: SampleCartState): HttpTypes.StoreCart {
  const region = regionById(state.region_id) ?? SAMPLE_REGIONS[0]!
  const currency = sampleCurrencyOf(region)
  const items = state.items.flatMap((line) => {
    const found = findSampleVariant(line.variant_id)
    if (!found) {
      return []
    }
    const { product, variant } = found
    const priced = priceProduct(product, region)
    const pricedVariant = priced.variants!.find((v) => v.id === variant.id)!
    const { calculated, original } = variantPrice(product.id, variant, currency)
    const subtotal = calculated * line.quantity
    return [
      {
        id: `item_sample_${variant.id.replace("variant_sample_", "")}`,
        cart_id: state.id,
        title: product.title,
        subtitle: variant.title,
        thumbnail: variant.images?.[0]?.url ?? product.thumbnail,
        quantity: line.quantity,
        product_id: product.id,
        product_title: product.title,
        product_description: product.description,
        product_subtitle: product.subtitle,
        product_type: null,
        product_collection: product.collection?.title ?? null,
        product_handle: product.handle,
        variant_id: variant.id,
        variant_sku: variant.sku,
        variant_barcode: null,
        variant_title: variant.title,
        variant_option_values: null,
        requires_shipping: true,
        is_discountable: true,
        is_tax_inclusive: false,
        compare_at_unit_price: original > calculated ? original : null,
        unit_price: calculated,
        tax_lines: [],
        adjustments: [],
        original_total: subtotal,
        original_subtotal: subtotal,
        original_tax_total: 0,
        item_total: subtotal,
        item_subtotal: subtotal,
        item_tax_total: 0,
        total: subtotal,
        subtotal,
        tax_total: 0,
        discount_total: 0,
        discount_tax_total: 0,
        variant: { ...pricedVariant, product: priced },
        product: priced,
        metadata: {},
        created_at: line.created_at,
        updated_at: line.created_at,
      },
    ]
  })
  const itemTotal = items.reduce((sum, item) => sum + item.total, 0)
  return {
    id: state.id,
    region_id: region.id,
    region,
    currency_code: currency,
    email: state.email,
    locale: state.locale,
    customer_id: undefined,
    sales_channel_id: undefined,
    items,
    shipping_methods: [],
    shipping_address: undefined,
    billing_address: undefined,
    promotions: [],
    payment_collection: undefined,
    original_item_total: itemTotal,
    original_item_subtotal: itemTotal,
    original_item_tax_total: 0,
    item_total: itemTotal,
    item_subtotal: itemTotal,
    item_tax_total: 0,
    original_total: itemTotal,
    original_subtotal: itemTotal,
    original_tax_total: 0,
    total: itemTotal,
    subtotal: itemTotal,
    tax_total: 0,
    discount_total: 0,
    discount_tax_total: 0,
    gift_card_total: 0,
    gift_card_tax_total: 0,
    shipping_total: 0,
    shipping_subtotal: 0,
    shipping_tax_total: 0,
    original_shipping_total: 0,
    original_shipping_subtotal: 0,
    original_shipping_tax_total: 0,
    metadata: {},
    completed_at: undefined,
    created_at: state.items[0]?.created_at,
    updated_at: state.items.at(-1)?.created_at,
  } as unknown as HttpTypes.StoreCart
}

const newCartId = () =>
  `cart_sample_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`

async function cartFor(carts: SampleCartStore, id: string) {
  const state = await carts.read()
  if (!state || state.id !== id) {
    notFound(`Cart id ${id}`)
  }
  return state!
}

function setQuantity(state: SampleCartState, variantId: string, quantity: number) {
  if (!findSampleVariant(variantId)) {
    notFound(`Variant id ${variantId}`)
  }
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_SAMPLE_QUANTITY) {
    throw new FetchError(
      `Quantity must be a whole number from 1 to ${MAX_SAMPLE_QUANTITY}`,
      "Bad Request",
      400
    )
  }
  const items = state.items.filter((i) => i.variant_id !== variantId)
  const existing = state.items.find((i) => i.variant_id === variantId)
  if (quantity > 0) {
    if (!existing && items.length >= MAX_SAMPLE_LINES) {
      throw new FetchError(
        `A sample cart holds at most ${MAX_SAMPLE_LINES} lines`,
        "Bad Request",
        400
      )
    }
    items.push({
      variant_id: variantId,
      quantity,
      created_at: existing?.created_at ?? new Date().toISOString(),
    })
    items.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  return { ...state, items }
}

const variantIdOfLine = (lineId: string) =>
  `variant_sample_${lineId.replace(/^item_sample_/, "")}`

async function carts(
  segments: string[],
  method: string,
  body: Record<string, unknown>,
  store: SampleCartStore
): Promise<unknown> {
  const [id, sub, lineId] = segments

  if (!id) {
    if (method !== "POST") {
      notFound("Route")
    }
    const region = regionById(String(body.region_id ?? "")) ?? SAMPLE_REGIONS[0]!
    let state: SampleCartState = {
      id: newCartId(),
      region_id: region.id,
      locale: typeof body.locale === "string" ? body.locale : undefined,
      items: [],
    }
    for (const item of (body.items as { variant_id: string; quantity: number }[]) ?? []) {
      state = setQuantity(state, item.variant_id, item.quantity)
    }
    await store.write(state)
    return { cart: buildCart(state) }
  }

  const state = await cartFor(store, id)

  if (!sub) {
    if (method === "GET") {
      return { cart: buildCart(state) }
    }
    if (list(body.promo_codes).length) {
      refuse(400, "apply promotion codes")
    }
    if (body.shipping_address || body.billing_address) {
      refuse(400, "check out")
    }
    const next: SampleCartState = {
      ...state,
      region_id: regionById(String(body.region_id ?? ""))?.id ?? state.region_id,
      email: typeof body.email === "string" ? body.email : state.email,
      locale: typeof body.locale === "string" ? body.locale : state.locale,
    }
    await store.write(next)
    return { cart: buildCart(next) }
  }

  if (sub === "line-items") {
    let next: SampleCartState
    if (!lineId && method === "POST") {
      const variantId = String(body.variant_id ?? "")
      const current =
        state.items.find((i) => i.variant_id === variantId)?.quantity ?? 0
      next = setQuantity(state, variantId, current + Number(body.quantity ?? 1))
    } else if (lineId && method === "POST") {
      next = setQuantity(state, variantIdOfLine(lineId), Number(body.quantity))
    } else if (lineId && method === "DELETE") {
      next = setQuantity(state, variantIdOfLine(lineId), 0)
      await store.write(next)
      return { id: lineId, object: "line-item", deleted: true, parent: buildCart(next) }
    } else {
      return notFound("Route")
    }
    await store.write(next)
    return { cart: buildCart(next) }
  }

  if (sub === "promotions") {
    return refuse(400, "apply promotion codes")
  }
  if (sub === "customer") {
    return refuse(401, "sign in")
  }
  // shipping-methods, taxes, complete: the checkout.
  return refuse(400, "check out")
}

function categoryWithProducts(
  category: HttpTypes.StoreProductCategory,
  query: Query
) {
  return wantsProducts(query)
    ? {
        ...category,
        products: SAMPLE_PRODUCTS.filter((p) =>
          (p.categories ?? []).some((c) => c.id === category.id)
        ).map((p) => priceProduct(p)),
      }
    : category
}

function collectionWithProducts(
  collection: HttpTypes.StoreCollection,
  query: Query
) {
  return wantsProducts(query)
    ? {
        ...collection,
        products: SAMPLE_PRODUCTS.filter(
          (p) => p.collection_id === collection.id
        ).map((p) => priceProduct(p)),
      }
    : collection
}

/**
 * Answers one Store API request from the sample catalogue, the way
 * `sdk.client.fetch` would answer it from a backend: the parsed JSON on
 * success, a `FetchError` with the status otherwise.
 */
export async function sampleStoreFetch(
  input: string,
  init: { method?: string; query?: Query; body?: unknown } | undefined,
  store: SampleCartStore
): Promise<unknown> {
  const url = new URL(input, "http://sample.invalid")
  const query: Query = {
    ...Object.fromEntries(url.searchParams.entries()),
    ...(init?.query ?? {}),
  }
  const method = (init?.method ?? "GET").toUpperCase()
  const body =
    init?.body && typeof init.body === "object"
      ? (init.body as Record<string, unknown>)
      : typeof init?.body === "string"
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : {}
  const [root, resource, ...rest] = url.pathname.split("/").filter(Boolean)

  if (root === "auth") {
    return refuse(401, "sign in or create an account")
  }
  if (root !== "store") {
    return notFound("Route")
  }

  switch (resource) {
    case "regions": {
      if (rest[0]) {
        const region = regionById(rest[0])
        return region ? { region } : notFound(`Region with id: ${rest[0]}`)
      }
      const { items, ...meta } = page(SAMPLE_REGIONS, query)
      return { regions: items, ...meta }
    }
    case "products": {
      if (rest[0]) {
        const product = SAMPLE_PRODUCTS.find((p) => p.id === rest[0])
        if (!product) {
          return notFound(`Product with id: ${rest[0]}`)
        }
        const region = regionById(String(query.region_id ?? ""))
        return { product: priceProduct(product, region) }
      }
      return listProducts(query)
    }
    case "product-variants": {
      const all = SAMPLE_PRODUCTS.flatMap((product) =>
        priceProduct(product, regionById(String(query.region_id ?? ""))).variants!.map(
          (variant) => ({ ...variant, product_id: product.id })
        )
      )
      if (rest[0]) {
        const variant = all.find((v) => v.id === rest[0])
        return variant ? { variant } : notFound(`Variant with id: ${rest[0]}`)
      }
      const ids = list(query.id)
      const { items, ...meta } = page(
        all.filter((v) => !ids.length || ids.includes(v.id)),
        query
      )
      return { variants: items, ...meta }
    }
    case "product-options":
      return { product_options: [], count: 0, limit: 50, offset: 0 }
    case "collections": {
      if (rest[0]) {
        const collection = SAMPLE_COLLECTIONS.find((c) => c.id === rest[0])
        return collection
          ? { collection: collectionWithProducts(collection, query) }
          : notFound(`Collection with id: ${rest[0]}`)
      }
      const handles = list(query.handle)
      const ids = list(query.id)
      const { items, ...meta } = page(
        SAMPLE_COLLECTIONS.filter(
          (c) =>
            (!handles.length || handles.includes(c.handle)) &&
            (!ids.length || ids.includes(c.id))
        ),
        query
      )
      return {
        collections: items.map((c) => collectionWithProducts(c, query)),
        ...meta,
      }
    }
    case "product-categories": {
      if (rest[0]) {
        const category = SAMPLE_CATEGORIES.find((c) => c.id === rest[0])
        return category
          ? { product_category: categoryWithProducts(category, query) }
          : notFound(`Product category with id: ${rest[0]}`)
      }
      const handles = list(query.handle)
      const ids = list(query.id)
      const parents = list(query.parent_category_id)
      const { items, ...meta } = page(
        SAMPLE_CATEGORIES.filter(
          (c) =>
            (!handles.length || handles.includes(c.handle)) &&
            (!ids.length || ids.includes(c.id)) &&
            (!parents.length ||
              parents.includes(String(c.parent_category_id ?? "null")))
        ),
        query
      )
      return {
        product_categories: items.map((c) => categoryWithProducts(c, query)),
        ...meta,
      }
    }
    case "search": {
      if (method !== "POST") {
        return notFound("Route")
      }
      const queries = Array.isArray(body.queries)
        ? (body.queries as SearchQuery[])
        : [body as SearchQuery]
      return { results: queries.map(sampleSearch) }
    }
    case "carts":
      return carts(rest, method, body, store)
    case "shipping-options":
      return rest[0]
        ? refuse(400, "check out")
        : { shipping_options: [] }
    case "payment-providers":
      return { payment_providers: [], count: 0, limit: 50, offset: 0 }
    case "payment-collections":
      return refuse(400, "check out")
    case "customers":
      return refuse(401, "sign in or create an account")
    case "orders":
      return rest[0] ? notFound(`Order with id: ${rest[0]}`) : refuse(401, "see orders")
    case "locales":
      // A backend without locales configured answers 404, which the storefront
      // reads as "no language picker" (src/lib/data/locales.ts).
      return notFound("Route")
    default:
      return notFound("Route")
  }
}

import { HttpTypes } from "@medusajs/types"

// THE BUNDLED SAMPLE CATALOGUE. The storefront serves it whenever no Medusa
// backend is connected (NEXT_PUBLIC_MEDUSA_BACKEND_URL or
// NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY unset), so a fresh deploy renders a real
// home page, store, product pages and a working cart with no backend at all.
// The shapes are the Store API's own (@medusajs/types), so every page and
// component renders it exactly as it renders a Medusa backend's answers. The
// images are SVGs in public/sample, served by the Worker's static assets.
//
// Replace it by connecting a backend (README, "Connecting Medusa"); nothing
// here is read once one is.

const CREATED_AT = "2026-10-01T00:00:00.000Z"

export const SAMPLE_CURRENCIES = ["eur", "usd"] as const
export type SampleCurrency = (typeof SAMPLE_CURRENCIES)[number]
type Prices = Record<SampleCurrency, number>

const country = (
  iso_2: string,
  iso_3: string,
  num_code: string,
  name: string
): HttpTypes.StoreRegionCountry => ({
  id: iso_2,
  iso_2,
  iso_3,
  num_code,
  name: name.toUpperCase(),
  display_name: name,
})

export const SAMPLE_REGIONS: HttpTypes.StoreRegion[] = [
  {
    id: "reg_sample_europe",
    name: "Europe",
    currency_code: "eur",
    automatic_taxes: true,
    countries: [
      country("dk", "dnk", "208", "Denmark"),
      country("de", "deu", "276", "Germany"),
      country("fr", "fra", "250", "France"),
      country("nl", "nld", "528", "Netherlands"),
      country("se", "swe", "752", "Sweden"),
      country("es", "esp", "724", "Spain"),
      country("it", "ita", "380", "Italy"),
    ],
    metadata: {},
  },
  {
    id: "reg_sample_us",
    name: "United States",
    currency_code: "usd",
    automatic_taxes: true,
    countries: [country("us", "usa", "840", "United States")],
    metadata: {},
  },
]

type Seed = {
  handle: string
  title: string
  subtitle: string
  description: string
  prices: Prices
  // The price before a sale; set, the variants sell at `prices`.
  originalPrices?: Prices
  collection: string
  categories: string[]
  tags: string[]
  createdAt: string
  material: string
  weight: number
  originCountry: string
  // Option title → values; none means a single variant with no options.
  options?: Record<string, string[]>
  // Option combinations that are out of stock, as "Value / Value".
  soldOut?: string[]
  // One image per value of this option (`${handle}-${value}.svg`), or the
  // product's single image.
  imageBy?: string
}

const SEEDS: Seed[] = [
  {
    handle: "cloud-tee",
    title: "Cloud Tee",
    subtitle: "Heavyweight cotton",
    description:
      "A heavyweight cotton tee with a single cloud on the chest. Boxy fit, ribbed collar, printed to order.",
    prices: { eur: 25, usd: 28 },
    collection: "apparel",
    categories: ["tops"],
    tags: ["bestseller"],
    createdAt: "2026-09-01T00:00:00.000Z",
    material: "Cotton",
    weight: 220,
    originCountry: "pt",
    options: { Color: ["Black", "White"], Size: ["S", "M", "L"] },
    imageBy: "Color",
  },
  {
    handle: "edge-hoodie",
    title: "Edge Hoodie",
    subtitle: "Brushed fleece",
    description:
      "A brushed-fleece hoodie for cold server rooms. Kangaroo pocket, lined hood, the edge glyph on the sleeve.",
    prices: { eur: 60, usd: 65 },
    collection: "apparel",
    categories: ["tops"],
    tags: ["new"],
    createdAt: "2026-09-08T00:00:00.000Z",
    material: "Fleece",
    weight: 540,
    originCountry: "pt",
    options: { Size: ["S", "M", "L", "XL"] },
    soldOut: ["XL"],
  },
  {
    handle: "worker-cap",
    title: "Worker Cap",
    subtitle: "Cotton twill",
    description:
      "A six-panel cotton twill cap with an embroidered bolt. One size, adjustable strap.",
    prices: { eur: 22, usd: 24 },
    collection: "apparel",
    categories: ["headwear"],
    tags: [],
    createdAt: "2026-08-20T00:00:00.000Z",
    material: "Cotton",
    weight: 110,
    originCountry: "pt",
  },
  {
    handle: "cache-mug",
    title: "Cache Mug",
    subtitle: "12 oz stoneware",
    description:
      "A 12 oz stoneware mug that keeps the first pour warm. Dishwasher safe; the glaze is the colour of a cache hit.",
    prices: { eur: 15, usd: 16 },
    collection: "accessories",
    categories: ["home-and-office"],
    tags: ["bestseller"],
    createdAt: "2026-09-15T00:00:00.000Z",
    material: "Stoneware",
    weight: 380,
    originCountry: "dk",
  },
  {
    handle: "bucket-tote",
    title: "Bucket Tote",
    subtitle: "Canvas",
    description:
      "A canvas tote with room for everything you meant to put in object storage. Reinforced handles, inside pocket.",
    prices: { eur: 14, usd: 16 },
    originalPrices: { eur: 18, usd: 20 },
    collection: "accessories",
    categories: ["bags"],
    tags: ["sale"],
    createdAt: "2026-07-30T00:00:00.000Z",
    material: "Canvas",
    weight: 260,
    originCountry: "in",
  },
  {
    handle: "origin-sticker-pack",
    title: "Origin Sticker Pack",
    subtitle: "Six die-cut stickers",
    description:
      "Six die-cut vinyl stickers for the laptop that runs the origin. Weatherproof, matte finish.",
    prices: { eur: 6, usd: 7 },
    collection: "accessories",
    categories: ["home-and-office"],
    tags: ["new"],
    createdAt: "2026-09-22T00:00:00.000Z",
    material: "Vinyl",
    weight: 20,
    originCountry: "dk",
  },
]

export const SAMPLE_COLLECTIONS: HttpTypes.StoreCollection[] = [
  { handle: "apparel", title: "Apparel" },
  { handle: "accessories", title: "Accessories" },
].map(({ handle, title }) => ({
  id: `pcol_sample_${handle}`,
  handle,
  title,
  created_at: CREATED_AT,
  updated_at: CREATED_AT,
  deleted_at: null,
  metadata: {},
}))

export const SAMPLE_CATEGORIES: HttpTypes.StoreProductCategory[] = [
  { handle: "tops", name: "Tops", description: "Tees and hoodies." },
  { handle: "headwear", name: "Headwear", description: "Caps." },
  { handle: "bags", name: "Bags", description: "Totes." },
  {
    handle: "home-and-office",
    name: "Home & office",
    description: "Mugs and stickers.",
  },
].map(({ handle, name, description }, rank) => ({
  id: `pcat_sample_${handle.replace(/-/g, "_")}`,
  handle,
  name,
  description,
  rank,
  external_id: null,
  parent_category_id: null,
  parent_category: null,
  category_children: [],
  created_at: CREATED_AT,
  updated_at: CREATED_AT,
  deleted_at: null,
  metadata: {},
}))

export const SAMPLE_TAGS: HttpTypes.StoreProductTag[] = [
  "bestseller",
  "new",
  "sale",
].map((value) => ({
  id: `ptag_sample_${value}`,
  value,
  created_at: CREATED_AT,
  updated_at: CREATED_AT,
  deleted_at: null,
  metadata: {},
}))

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_")

function combinations(options: Record<string, string[]>) {
  let out: { title: string; value: string }[][] = [[]]
  for (const [title, values] of Object.entries(options)) {
    out = out.flatMap((combo) =>
      values.map((value) => [...combo, { title, value }])
    )
  }
  return out
}

/**
 * A sample product as the Store API returns it, before pricing: variants carry
 * no `calculated_price` until `priceProduct` prices them for a region.
 */
export type SampleVariant = HttpTypes.StoreProductVariant & { prices: Prices }
export type SampleProduct = Omit<HttpTypes.StoreProduct, "variants"> & {
  variants: SampleVariant[]
}

function toProduct(seed: Seed): SampleProduct {
  const id = `prod_sample_${slug(seed.handle)}`
  const image = (file: string, rank: number): HttpTypes.StoreProductImage => ({
    id: `img_sample_${slug(file)}`,
    url: `/sample/${file}.svg`,
    rank,
    metadata: {},
  })
  const images = seed.imageBy
    ? seed.options![seed.imageBy]!.map((value, rank) =>
        image(`${seed.handle}-${value.toLowerCase()}`, rank)
      )
    : [image(seed.handle, 0)]

  const options: HttpTypes.StoreProductOption[] = Object.entries(
    seed.options ?? {}
  ).map(([title, values]) => {
    const optionId = `opt_sample_${slug(seed.handle)}_${slug(title)}`
    return {
      id: optionId,
      title,
      product_id: id,
      is_exclusive: true,
      values: values.map((value) => ({
        id: `optval_sample_${slug(seed.handle)}_${slug(title)}_${slug(value)}`,
        value,
        option_id: optionId,
      })),
      metadata: {},
    }
  })

  const optionValue = (title: string, value: string) => {
    const option = options.find((o) => o.title === title)!
    const optionValue = option.values!.find((v) => v.value === value)!
    return { ...optionValue, option: { ...option, values: undefined } }
  }

  const combos = seed.options ? combinations(seed.options) : [[]]
  const variants = combos.map((combo, rank) => {
    const title = combo.length
      ? combo.map((o) => o.value).join(" / ")
      : "Default variant"
    const variantId = combo.length
      ? `variant_sample_${slug(seed.handle)}_${slug(title)}`
      : `variant_sample_${slug(seed.handle)}`
    const imageValue = seed.imageBy
      ? combo.find((o) => o.title === seed.imageBy)?.value
      : undefined
    return {
      id: variantId,
      title,
      sku: ["SAMPLE", seed.handle, ...combo.map((o) => o.value)]
        .join("-")
        .toUpperCase(),
      product_id: id,
      variant_rank: rank,
      options: combo.map((o) => optionValue(o.title, o.value)),
      images: imageValue
        ? images.filter((i) => i.url.endsWith(`-${imageValue.toLowerCase()}.svg`))
        : [],
      manage_inventory: true,
      allow_backorder: false,
      inventory_quantity: (seed.soldOut ?? []).includes(title) ? 0 : 50,
      barcode: null,
      ean: null,
      upc: null,
      hs_code: null,
      mid_code: null,
      material: null,
      origin_country: null,
      weight: null,
      length: null,
      height: null,
      width: null,
      metadata: {},
      created_at: seed.createdAt,
      updated_at: seed.createdAt,
      deleted_at: null,
      prices: seed.prices,
    }
  })

  const collection = SAMPLE_COLLECTIONS.find((c) => c.handle === seed.collection)!

  return {
    id,
    title: seed.title,
    handle: seed.handle,
    subtitle: seed.subtitle,
    description: seed.description,
    is_giftcard: false,
    status: "published",
    thumbnail: images[0]!.url,
    images,
    options,
    variants,
    collection_id: collection.id,
    collection,
    categories: SAMPLE_CATEGORIES.filter((c) => seed.categories.includes(c.handle)),
    tags: SAMPLE_TAGS.filter((t) => seed.tags.includes(t.value)),
    type_id: null,
    type: null,
    discountable: true,
    external_id: null,
    material: seed.material,
    weight: seed.weight,
    length: null,
    height: null,
    width: null,
    hs_code: null,
    mid_code: null,
    origin_country: seed.originCountry,
    metadata: {},
    created_at: seed.createdAt,
    updated_at: seed.createdAt,
    deleted_at: null,
  } as SampleProduct
}

export const SAMPLE_PRODUCTS: SampleProduct[] = SEEDS.map(toProduct)

const ORIGINAL_PRICES = new Map(
  SEEDS.map((seed) => [`prod_sample_${slug(seed.handle)}`, seed.originalPrices])
)

const currencyOf = (region?: HttpTypes.StoreRegion | null): SampleCurrency =>
  region?.currency_code === "usd" ? "usd" : "eur"

/** A variant's sample price in a currency, and the price before any sale. */
export const variantPrice = (
  productId: string,
  variant: { prices: Prices },
  currency: SampleCurrency
) => {
  const calculated = variant.prices[currency]
  const original = ORIGINAL_PRICES.get(productId)?.[currency] ?? calculated
  return { calculated, original }
}

/**
 * The product as the Store API returns it for a region: each variant carries
 * its `calculated_price` in the region's currency, the way Medusa prices a
 * product when the request names a `region_id`. Without a region the variants
 * carry no price, as Medusa's do.
 */
export const priceProduct = (
  product: SampleProduct,
  region?: HttpTypes.StoreRegion | null
): HttpTypes.StoreProduct => {
  const variants = product.variants.map(({ prices, ...variant }) => {
    if (!region) {
      return variant
    }
    const currency = currencyOf(region)
    const { calculated, original } = variantPrice(
      product.id,
      { prices },
      currency
    )
    return {
      ...variant,
      calculated_price: {
        id: `calc_${variant.id}_${currency}`,
        is_calculated_price_price_list: calculated < original,
        is_calculated_price_tax_inclusive: false,
        calculated_amount: calculated,
        is_original_price_price_list: false,
        is_original_price_tax_inclusive: false,
        original_amount: original,
        currency_code: currency,
        calculated_price: {
          id: `price_${variant.id}_${currency}`,
          price_list_id: calculated < original ? "plist_sample_sale" : null,
          price_list_type: calculated < original ? "sale" : null,
          min_quantity: null,
          max_quantity: null,
        },
        original_price: {
          id: `price_${variant.id}_${currency}`,
          price_list_id: null,
          price_list_type: null,
          min_quantity: null,
          max_quantity: null,
        },
      },
    }
  })
  return { ...product, variants } as HttpTypes.StoreProduct
}

export const findSampleVariant = (variantId: string) => {
  for (const product of SAMPLE_PRODUCTS) {
    const variant = product.variants.find((v) => v.id === variantId)
    if (variant) {
      return { product, variant }
    }
  }
  return undefined
}

export const regionById = (id?: string | null) =>
  SAMPLE_REGIONS.find((region) => region.id === id)

export const sampleCurrencyOf = currencyOf

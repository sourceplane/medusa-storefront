import {
  SAMPLE_CURRENCIES,
  SAMPLE_PRODUCTS,
  variantPrice,
} from "./catalogue"

// The store listing's search, from the sample catalogue: what a Medusa
// backend's `POST /store/search` answers for the product index the starter's
// backend defines (apps/backend/src/search/product.ts upstream), so the
// listing's InstantSearch widgets — the search box, the category, label,
// option and price refinements, the sort and the pagination — work unchanged.

type Filter = Record<string, unknown>

export type SearchQuery = {
  entity?: string
  filters?: Filter
  pagination?: {
    skip?: number
    take?: number
    order?: Record<string, "ASC" | "DESC">
  }
  search_options?: {
    facets?: { field: string; type: "value" | "stats"; limit?: number }[]
  }
}

type Document = Record<string, string | number | boolean | string[] | null>

/** One document per product, with the fields the backend's index holds. */
export const SAMPLE_DOCUMENTS: Document[] = SAMPLE_PRODUCTS.map((product) => {
  const document: Document = {
    id: product.id,
    title: product.title,
    description: product.description,
    handle: product.handle,
    thumbnail: product.thumbnail,
    created_at: product.created_at ?? null,
    category: (product.categories ?? []).map((c) => c.name),
    labels: (product.tags ?? []).map((t) => t.value),
    option_values: (product.options ?? []).flatMap((option) =>
      (option.values ?? []).map((v) => `${option.title}:${v.value}`)
    ),
  }
  for (const currency of SAMPLE_CURRENCIES) {
    const prices = product.variants.map((variant) =>
      variantPrice(product.id, variant, currency)
    )
    const cheapest = prices.reduce((a, b) => (b.calculated < a.calculated ? b : a))
    document[`min_price_${currency}`] = cheapest.calculated
    document[`max_price_${currency}`] = Math.max(...prices.map((p) => p.calculated))
    document[`original_price_${currency}`] = cheapest.original
    document[`on_sale_${currency}`] = cheapest.calculated < cheapest.original
  }
  return document
})

const values = (value: unknown) => (Array.isArray(value) ? value : [value])

function matchesOperators(value: unknown, operators: Record<string, unknown>) {
  return Object.entries(operators).every(([operator, operand]) => {
    const vs = values(value)
    switch (operator) {
      case "$eq":
        return vs.some((v) => v === operand)
      case "$ne":
        return vs.every((v) => v !== operand)
      case "$in":
        return vs.some((v) => (operand as unknown[]).includes(v))
      case "$nin":
        return vs.every((v) => !(operand as unknown[]).includes(v))
      case "$gt":
        return typeof value === "number" && value > Number(operand)
      case "$gte":
        return typeof value === "number" && value >= Number(operand)
      case "$lt":
        return typeof value === "number" && value < Number(operand)
      case "$lte":
        return typeof value === "number" && value <= Number(operand)
      default:
        return true
    }
  })
}

function matchesQuery(document: Document, q: string) {
  const haystack = [
    document.title,
    document.description,
    ...values(document.option_values),
    ...values(document.labels),
    ...values(document.category),
  ]
    .join(" ")
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

export function matches(document: Document, filter?: Filter): boolean {
  if (!filter) {
    return true
  }
  return Object.entries(filter).every(([key, condition]) => {
    if (key === "q") {
      return typeof condition !== "string" || matchesQuery(document, condition)
    }
    if (key === "$and") {
      return (condition as Filter[]).every((f) => matches(document, f))
    }
    if (key === "$or") {
      return (condition as Filter[]).some((f) => matches(document, f))
    }
    return matchesOperators(document[key], condition as Record<string, unknown>)
  })
}

export function sampleSearch(query: SearchQuery) {
  let hits = SAMPLE_DOCUMENTS.filter((d) => matches(d, query.filters))

  const order = Object.entries(query.pagination?.order ?? {})
  if (order.length) {
    hits = [...hits].sort((a, b) => {
      for (const [field, direction] of order) {
        const left = a[field] ?? ""
        const right = b[field] ?? ""
        const compared =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right))
        if (compared) {
          return direction === "DESC" ? -compared : compared
        }
      }
      return 0
    })
  }

  const facets: Record<string, unknown> = {}
  for (const facet of query.search_options?.facets ?? []) {
    if (facet.type === "stats") {
      const numbers = hits
        .map((d) => d[facet.field])
        .filter((v): v is number => typeof v === "number")
      if (numbers.length) {
        facets[facet.field] = {
          type: "stats",
          min: Math.min(...numbers),
          max: Math.max(...numbers),
        }
      }
      continue
    }
    const counts = new Map<string, number>()
    for (const document of hits) {
      for (const value of values(document[facet.field])) {
        if (value !== null && value !== undefined && value !== "") {
          counts.set(String(value), (counts.get(String(value)) ?? 0) + 1)
        }
      }
    }
    facets[facet.field] = {
      type: "value",
      values: Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, facet.limit ?? 100)
        .map(([value, count]) => ({ value, count })),
    }
  }

  const skip = query.pagination?.skip ?? 0
  const take = query.pagination?.take ?? 20
  return {
    hits: hits.slice(skip, skip + take).map((document) => ({
      id: String(document.id),
      document,
    })),
    facets,
    metadata: {
      count: hits.length,
      skip,
      take,
      query: typeof query.filters?.q === "string" ? query.filters.q : "",
      processing_time_ms: 0,
    },
  }
}

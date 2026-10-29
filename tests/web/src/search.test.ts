import { describe, expect, it } from "vitest";

import { sampleStoreFetch } from "@lib/sample/store-api";
import { SAMPLE_DOCUMENTS, sampleSearch } from "@lib/sample/search";

// The store listing's InstantSearch widgets post to `/store/search` through
// @medusajs/instantsearch-adapter; the sample answers in the backend's
// shapes, so the adapter turns them into Algolia-style results unchanged.

const noCarts = { read: async () => null, write: async () => {} };

describe("the sample product index", () => {
  it("holds a document per product with the backend index's fields", () => {
    expect(SAMPLE_DOCUMENTS.length).toBe(6);
    const tee = SAMPLE_DOCUMENTS.find((d) => d.handle === "cloud-tee")!;
    expect(tee).toMatchObject({
      title: "Cloud Tee",
      category: ["Tops"],
      labels: ["bestseller"],
      min_price_eur: 25,
      max_price_eur: 25,
      min_price_usd: 28,
      on_sale_eur: false,
    });
    expect(tee.option_values).toContain("Color:Black");
    expect(tee.option_values).toContain("Size:M");
    const tote = SAMPLE_DOCUMENTS.find((d) => d.handle === "bucket-tote")!;
    expect(tote).toMatchObject({ min_price_eur: 14, original_price_eur: 18, on_sale_eur: true });
  });
});

describe("POST /store/search", () => {
  it("answers a batch with one result per query", async () => {
    const answer = (await sampleStoreFetch(
      "/store/search",
      {
        method: "POST",
        body: { queries: [{ entity: "product", pagination: { take: 2, skip: 0 } }, { entity: "product" }] },
      },
      noCarts,
    )) as { results: { hits: unknown[]; metadata: { count: number } }[] };
    expect(answer.results.length).toBe(2);
    expect(answer.results[0]!.hits.length).toBe(2);
    expect(answer.results[0]!.metadata.count).toBe(6);
  });

  it("matches the query text across title, description and options", () => {
    const hoodie = sampleSearch({ filters: { q: "fleece hoodie" } });
    expect(hoodie.hits.map((h) => h.document.handle)).toEqual(["edge-hoodie"]);
    expect(sampleSearch({ filters: { q: "nothing-like-this" } }).metadata.count).toBe(0);
  });

  it("applies facet and numeric filters, with $and and $or", () => {
    const tops = sampleSearch({ filters: { category: { $eq: "Tops" } } });
    expect(tops.metadata.count).toBe(2);
    const cheap = sampleSearch({ filters: { min_price_eur: { $gte: 10, $lte: 20 } } });
    expect(cheap.hits.map((h) => h.document.handle).sort()).toEqual(["bucket-tote", "cache-mug"]);
    const either = sampleSearch({
      filters: { $or: [{ labels: { $eq: "sale" } }, { labels: { $eq: "new" } }] },
    });
    expect(either.metadata.count).toBe(3);
    const both = sampleSearch({
      filters: { $and: [{ labels: { $in: ["new", "bestseller"] } }, { category: { $ne: "Tops" } }] },
    });
    expect(both.hits.map((h) => h.document.handle).sort()).toEqual(["cache-mug", "origin-sticker-pack"]);
    expect(sampleSearch({ filters: { on_sale_usd: { $eq: true } } }).metadata.count).toBe(1);
  });

  it("counts value facets and reports price stats over the matching products", () => {
    const result = sampleSearch({
      filters: { category: { $eq: "Tops" } },
      search_options: {
        facets: [
          { field: "labels", type: "value" },
          { field: "min_price_usd", type: "stats" },
        ],
      },
    });
    expect(result.facets.labels).toEqual({
      type: "value",
      values: [
        { value: "bestseller", count: 1 },
        { value: "new", count: 1 },
      ],
    });
    expect(result.facets.min_price_usd).toEqual({ type: "stats", min: 28, max: 65 });
  });

  it("sorts and pages", () => {
    const byPrice = sampleSearch({ pagination: { order: { min_price_eur: "DESC" }, take: 2, skip: 1 } });
    expect(byPrice.hits.map((h) => h.document.handle)).toEqual(["cloud-tee", "worker-cap"]);
    const byTitle = sampleSearch({ pagination: { order: { title: "ASC" }, take: 1 } });
    expect(byTitle.hits[0]!.document.title).toBe("Bucket Tote");
    expect(byTitle.metadata).toMatchObject({ count: 6, skip: 0, take: 1 });
  });
});

import { describe, expect, it } from "vitest";
import { FetchError } from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";

import {
  CONNECT_A_BACKEND,
  MAX_SAMPLE_LINES,
  sampleStoreFetch,
  type SampleCartState,
  type SampleCartStore,
} from "@lib/sample/store-api";
import { SAMPLE_PRODUCTS } from "@lib/sample/catalogue";

// The sample Store API answers what a Medusa backend would, in its shapes:
// the storefront's pages and components read these answers unchanged.

const memoryCarts = (): SampleCartStore & { state: SampleCartState | null } => {
  const store = {
    state: null as SampleCartState | null,
    read: async () => store.state,
    write: async (state: SampleCartState) => {
      store.state = state;
    },
  };
  return store;
};

type Init = Parameters<typeof sampleStoreFetch>[1];
const api = (path: string, init?: Init, carts = memoryCarts()) =>
  sampleStoreFetch(path, init, carts) as Promise<Record<string, unknown>>;

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as FetchError;
  }
  throw new Error("expected the request to fail");
};

describe("the catalogue", () => {
  it("lists two regions, the default country's first", async () => {
    const { regions, count } = await api("/store/regions");
    const list = regions as HttpTypes.StoreRegion[];
    expect(count).toBe(2);
    expect(list.map((r) => r.currency_code)).toEqual(["eur", "usd"]);
    expect(list[0]!.countries!.map((c) => c.iso_2)).toContain("dk");
    expect(list[1]!.countries!.map((c) => c.iso_2)).toEqual(["us"]);
  });

  it("prices products in the requested region's currency, as Medusa does", async () => {
    const eur = await api("/store/products", {
      query: { handle: "cloud-tee", region_id: "reg_sample_europe" },
    });
    const usd = await api("/store/products", {
      query: { handle: "cloud-tee", region_id: "reg_sample_us" },
    });
    const price = (r: Record<string, unknown>) =>
      (r.products as HttpTypes.StoreProduct[])[0]!.variants![0]!.calculated_price!;
    expect(price(eur).currency_code).toBe("eur");
    expect(price(eur).calculated_amount).toBe(25);
    expect(price(usd).currency_code).toBe("usd");
    expect(price(usd).calculated_amount).toBe(28);
  });

  it("leaves variants unpriced without a region", async () => {
    const { products } = await api("/store/products", { query: { handle: "cache-mug" } });
    const variant = (products as HttpTypes.StoreProduct[])[0]!.variants![0]!;
    expect(variant.calculated_price).toBeUndefined();
    expect(variant).not.toHaveProperty("prices");
  });

  it("marks a sale price as a sale price list, with the original price", async () => {
    const { products } = await api("/store/products", {
      query: { handle: "bucket-tote", region_id: "reg_sample_europe" },
    });
    const price = (products as HttpTypes.StoreProduct[])[0]!.variants![0]!.calculated_price!;
    expect(price.calculated_amount).toBe(14);
    expect(price.original_amount).toBe(18);
    expect(price.calculated_price?.price_list_type).toBe("sale");
  });

  it("filters by collection, category, id and text, and pages", async () => {
    const apparel = await api("/store/products", {
      query: { collection_id: ["pcol_sample_apparel"] },
    });
    expect((apparel.products as HttpTypes.StoreProduct[]).map((p) => p.handle)).toEqual([
      "cloud-tee",
      "edge-hoodie",
      "worker-cap",
    ]);
    const tops = await api("/store/products", { query: { category_id: ["pcat_sample_tops"] } });
    expect(tops.count).toBe(2);
    const byId = await api("/store/products", { query: { id: [SAMPLE_PRODUCTS[3]!.id] } });
    expect((byId.products as HttpTypes.StoreProduct[])[0]!.handle).toBe("cache-mug");
    const text = await api("/store/products", { query: { q: "hoodie" } });
    expect((text.products as HttpTypes.StoreProduct[]).map((p) => p.handle)).toEqual(["edge-hoodie"]);
    const paged = await api("/store/products", { query: { limit: 2, offset: 4 } });
    expect(paged.count).toBe(6);
    expect((paged.products as unknown[]).length).toBe(2);
  });

  it("answers a product, a variant and the variant list by id", async () => {
    const id = SAMPLE_PRODUCTS[0]!.id;
    const { product } = await api(`/store/products/${id}`, { query: { region_id: "reg_sample_us" } });
    expect((product as HttpTypes.StoreProduct).handle).toBe("cloud-tee");
    const variantId = SAMPLE_PRODUCTS[0]!.variants[0]!.id;
    const { variant } = await api(`/store/product-variants/${variantId}`);
    expect((variant as HttpTypes.StoreProductVariant).id).toBe(variantId);
    const { variants } = await api("/store/product-variants", {
      query: { id: [variantId, "variant_missing"] },
    });
    expect((variants as unknown[]).length).toBe(1);
  });

  it("answers collections and categories by handle, with their products when asked", async () => {
    const { collections } = await api("/store/collections", {
      query: { handle: "accessories", fields: "*products" },
    });
    const collection = (collections as HttpTypes.StoreCollection[])[0]!;
    expect(collection.title).toBe("Accessories");
    expect(collection.products?.length).toBe(3);
    const { product_categories } = await api("/store/product-categories", {
      query: { handle: "home-and-office", fields: "*category_children, *products" },
    });
    const category = (product_categories as HttpTypes.StoreProductCategory[])[0]!;
    expect(category.name).toBe("Home & office");
    expect(category.products?.map((p) => p.handle)).toEqual(["cache-mug", "origin-sticker-pack"]);
    const plain = await api("/store/collections", { query: { fields: "id, handle, title" } });
    expect((plain.collections as HttpTypes.StoreCollection[])[0]).not.toHaveProperty("products");
  });

  it("answers 404 for what it does not have, as a backend would", async () => {
    expect((await rejection(api("/store/products/prod_missing"))).status).toBe(404);
    // No locales: the storefront hides its language picker.
    expect((await rejection(api("/store/locales"))).status).toBe(404);
    expect((await rejection(api("/admin/products"))).status).toBe(404);
  });
});

describe("the cart", () => {
  const tee = SAMPLE_PRODUCTS[0]!.variants[0]!.id;
  const mug = SAMPLE_PRODUCTS[3]!.variants[0]!.id;

  it("is created in a region, takes lines, merges a variant's lines and totals them", async () => {
    const carts = memoryCarts();
    const { cart } = await api("/store/carts", { method: "POST", body: { region_id: "reg_sample_us" } }, carts);
    const id = (cart as HttpTypes.StoreCart).id;
    expect(id).toMatch(/^cart_sample_[a-z0-9]{24}$/);
    expect(carts.state).toMatchObject({ id, region_id: "reg_sample_us", items: [] });

    await api(`/store/carts/${id}/line-items`, { method: "POST", body: { variant_id: tee, quantity: 1 } }, carts);
    await api(`/store/carts/${id}/line-items`, { method: "POST", body: { variant_id: tee, quantity: 2 } }, carts);
    const after = await api(`/store/carts/${id}/line-items`, { method: "POST", body: { variant_id: mug, quantity: 1 } }, carts);
    const full = after.cart as HttpTypes.StoreCart;
    expect(full.currency_code).toBe("usd");
    expect(full.items!.map((i) => [i.variant_id, i.quantity])).toEqual([
      [tee, 3],
      [mug, 1],
    ]);
    expect(full.items![0]!.unit_price).toBe(28);
    expect(full.items![0]!.total).toBe(84);
    expect(full.item_total).toBe(84 + 16);
    expect(full.total).toBe(100);
    expect(full.region?.id).toBe("reg_sample_us");
  });

  it("updates and deletes a line by its id, and re-prices on a region change", async () => {
    const carts = memoryCarts();
    const { cart } = await api("/store/carts", { method: "POST", body: { region_id: "reg_sample_europe" } }, carts);
    const id = (cart as HttpTypes.StoreCart).id;
    const added = await api(`/store/carts/${id}/line-items`, { method: "POST", body: { variant_id: tee, quantity: 1 } }, carts);
    const lineId = (added.cart as HttpTypes.StoreCart).items![0]!.id;
    const updated = await api(`/store/carts/${id}/line-items/${lineId}`, { method: "POST", body: { quantity: 4 } }, carts);
    expect((updated.cart as HttpTypes.StoreCart).items![0]!.quantity).toBe(4);
    expect((updated.cart as HttpTypes.StoreCart).total).toBe(100);
    const moved = await api(`/store/carts/${id}`, { method: "POST", body: { region_id: "reg_sample_us" } }, carts);
    expect((moved.cart as HttpTypes.StoreCart).total).toBe(112);
    const deleted = await api(`/store/carts/${id}/line-items/${lineId}`, { method: "DELETE" }, carts);
    expect(deleted.deleted).toBe(true);
    expect((deleted.parent as HttpTypes.StoreCart).items).toEqual([]);
  });

  it("answers 404 for a cart that is not the visitor's", async () => {
    const carts = memoryCarts();
    await api("/store/carts", { method: "POST", body: {} }, carts);
    expect((await rejection(api("/store/carts/cart_sample_someoneelse", undefined, carts))).status).toBe(404);
  });

  it("refuses bad quantities, unknown variants and an unbounded cart", async () => {
    const carts = memoryCarts();
    const { cart } = await api("/store/carts", { method: "POST", body: {} }, carts);
    const id = (cart as HttpTypes.StoreCart).id;
    const add = (variant_id: string, quantity: number) =>
      api(`/store/carts/${id}/line-items`, { method: "POST", body: { variant_id, quantity } }, carts);
    expect((await rejection(add(tee, 1000))).status).toBe(400);
    expect((await rejection(add(tee, 1.5))).status).toBe(400);
    expect((await rejection(add("variant_missing", 1))).status).toBe(404);
    // Every sample variant fits in one cart; the bound is the cookie's.
    const variants = SAMPLE_PRODUCTS.flatMap((p) => p.variants);
    expect(variants.length).toBeLessThanOrEqual(MAX_SAMPLE_LINES);
    for (const variant of variants) {
      await add(variant.id, 1);
    }
    expect(carts.state!.items.length).toBe(variants.length);
  });

  it("refuses checkout, promotions and a customer, saying a backend is needed", async () => {
    const carts = memoryCarts();
    const { cart } = await api("/store/carts", { method: "POST", body: {} }, carts);
    const id = (cart as HttpTypes.StoreCart).id;
    for (const [path, body] of [
      [`/store/carts/${id}/complete`, {}],
      [`/store/carts/${id}/shipping-methods`, { option_id: "so_1" }],
      [`/store/carts/${id}`, { promo_codes: ["SAVE10"] }],
      [`/store/carts/${id}`, { shipping_address: { first_name: "A" } }],
      ["/store/payment-collections", { cart_id: id }],
    ] as const) {
      const error = await rejection(api(path, { method: "POST", body }, carts));
      expect(error).toBeInstanceOf(FetchError);
      expect(error.status).toBe(400);
      expect(error.message.startsWith(CONNECT_A_BACKEND)).toBe(true);
    }
    expect((await rejection(api(`/store/carts/${id}/customer`, { method: "POST" }, carts))).status).toBe(401);
  });
});

describe("accounts", () => {
  it("refuse sign-in, registration and the customer with 401", async () => {
    for (const path of ["/auth/customer/emailpass", "/auth/customer/emailpass/register", "/store/customers/me"]) {
      const error = await rejection(api(path, { method: "POST", body: { email: "a@b.c", password: "x" } }));
      expect(error.status).toBe(401);
      expect(error.message.startsWith(CONNECT_A_BACKEND)).toBe(true);
    }
  });

  it("list no shipping options and no payment providers", async () => {
    expect(await api("/store/shipping-options", { query: { cart_id: "cart_sample_x" } })).toEqual({
      shipping_options: [],
    });
    expect((await api("/store/payment-providers")).payment_providers).toEqual([]);
  });
});

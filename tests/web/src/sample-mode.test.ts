import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The storefront with no Medusa backend — what every fresh deploy is until
// its owner connects one: the data layer answers from the sample catalogue,
// the cart lives in the visitor's cookie, and nothing reaches the network.

const { cookieJar, cookieStore, revalidateTag } = vi.hoisted(() => {
  const cookieJar = new Map<string, string>();
  const cookieStore = {
    get: vi.fn((name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    ),
    set: vi.fn((name: string, value: string) => {
      cookieJar.set(name, value);
    }),
  };
  return { cookieJar, cookieStore, revalidateTag: vi.fn() };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
  headers: async () => new Headers({ host: "shop.example" }),
}));
vi.mock("next/cache", () => ({ revalidateTag }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));

const MEDUSA_ENV = ["NEXT_PUBLIC_MEDUSA_BACKEND_URL", "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"] as const;
const saved: Record<string, string | undefined> = {};
const network = vi.fn(async () => {
  throw new Error("the sample storefront must not reach the network");
});

beforeEach(() => {
  for (const k of MEDUSA_ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  cookieJar.clear();
  vi.stubGlobal("fetch", network);
  vi.resetModules();
});
afterEach(() => {
  for (const k of MEDUSA_ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("the mode (apps/web/src/lib/sample/mode.ts)", () => {
  it("is sample mode with neither setting, and with only one of them", async () => {
    expect((await import("@lib/sample/mode")).SAMPLE_MODE).toBe(true);
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = "https://api.shop.example";
    vi.resetModules();
    expect((await import("@lib/sample/mode")).SAMPLE_MODE).toBe(true);
  });

  it("is connected with a backend URL and a publishable key", async () => {
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = "https://api.shop.example";
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_test";
    expect((await import("@lib/sample/mode")).SAMPLE_MODE).toBe(false);
  });
});

describe("the data layer in sample mode", () => {
  it("lists regions and prices the catalogue for the visitor's country", async () => {
    const { listRegions, getRegion } = await import("@lib/data/regions");
    expect((await listRegions()).length).toBe(2);
    expect((await getRegion("us"))?.currency_code).toBe("usd");
    const { listProducts } = await import("@lib/data/products");
    const { response } = await listProducts({ countryCode: "dk", queryParams: { handle: "edge-hoodie" } });
    const hoodie = response.products[0]!;
    expect(hoodie.title).toBe("Edge Hoodie");
    expect(hoodie.variants!.map((v) => v.calculated_price?.calculated_amount)).toEqual([60, 60, 60, 60]);
    expect(hoodie.variants!.find((v) => v.title === "XL")!.inventory_quantity).toBe(0);
    expect(network).not.toHaveBeenCalled();
  });

  it("adds to a cart kept in the visitor's cookie, through upstream's server actions", async () => {
    const { addToCart, retrieveCart, updateLineItem, deleteLineItem } = await import("@lib/data/cart");
    const { SAMPLE_PRODUCTS } = await import("@lib/sample/catalogue");
    const tee = SAMPLE_PRODUCTS[0]!.variants[1]!;
    const cap = SAMPLE_PRODUCTS[2]!.variants[0]!;

    expect(await retrieveCart()).toBeNull();
    await addToCart({ variantId: tee.id, quantity: 2, countryCode: "dk" });
    await addToCart({ variantId: cap.id, quantity: 1, countryCode: "dk" });

    // Upstream's cart id cookie, and the sample cart beside it.
    const cartId = cookieJar.get("_medusa_cart_id");
    expect(cartId).toMatch(/^cart_sample_/);
    expect(JSON.parse(cookieJar.get("_medusa_sample_cart")!)).toMatchObject({
      id: cartId,
      region_id: "reg_sample_europe",
    });

    const cart = (await retrieveCart())!;
    expect(cart.id).toBe(cartId);
    expect(cart.items!.map((i) => [i.product_handle, i.quantity])).toEqual([
      ["cloud-tee", 2],
      ["worker-cap", 1],
    ]);
    expect(cart.total).toBe(2 * 25 + 22);
    expect(revalidateTag).toHaveBeenCalled();

    await updateLineItem({ lineId: cart.items![0]!.id, quantity: 5 });
    await deleteLineItem(cart.items![1]!.id);
    const after = (await retrieveCart())!;
    expect(after.items!.map((i) => [i.product_handle, i.quantity])).toEqual([["cloud-tee", 5]]);
    expect(after.total).toBe(125);
    expect(network).not.toHaveBeenCalled();
  });

  it("re-prices the cart when the visitor changes country", async () => {
    const { addToCart, retrieveCart, updateRegion } = await import("@lib/data/cart");
    const { SAMPLE_PRODUCTS } = await import("@lib/sample/catalogue");
    await addToCart({ variantId: SAMPLE_PRODUCTS[3]!.variants[0]!.id, quantity: 1, countryCode: "de" });
    await expect(updateRegion("us", "/store")).rejects.toThrow("redirect /us/store");
    const cart = (await retrieveCart())!;
    expect(cart.currency_code).toBe("usd");
    expect(cart.total).toBe(16);
  });

  it("turns a tampered cookie into no cart", async () => {
    const { retrieveCart } = await import("@lib/data/cart");
    cookieJar.set("_medusa_cart_id", "cart_sample_abc");
    for (const tampered of [
      { id: "cart_sample_abc", region_id: "reg_sample_us", items: [{ variant_id: "variant_x", quantity: 1, created_at: "" }] },
      { id: "cart_sample_abc", region_id: "reg_sample_us", items: [{ variant_id: "variant_sample_cache_mug", quantity: 1000, created_at: "" }] },
      { id: "../etc", region_id: "reg_sample_us", items: [] },
      "not json",
    ]) {
      cookieJar.set("_medusa_sample_cart", typeof tampered === "string" ? tampered : JSON.stringify(tampered));
      expect(await retrieveCart()).toBeNull();
    }
  });

  it("refuses to place an order or sign in, saying a backend is needed", async () => {
    const { addToCart, placeOrder } = await import("@lib/data/cart");
    const { login } = await import("@lib/data/customer");
    const { SAMPLE_PRODUCTS } = await import("@lib/sample/catalogue");
    await addToCart({ variantId: SAMPLE_PRODUCTS[3]!.variants[0]!.id, quantity: 1, countryCode: "dk" });
    await expect(placeOrder()).rejects.toThrow(/connect a Medusa backend/);
    const form = new FormData();
    form.set("email", "a@shop.example");
    form.set("password", "secret");
    const state = await login(null, form);
    expect(state).toMatchObject({ state: "error" });
    expect((state as { error: string }).error).toMatch(/connect a Medusa backend/);
    expect(cookieJar.has("_medusa_jwt")).toBe(false);
  });

  it("does nothing with the sample cookie once a backend is connected", async () => {
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = "https://api.shop.example";
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_test";
    const { readSampleCart, writeSampleCart } = await import("@lib/sample/cart-cookie");
    await writeSampleCart({ id: "cart_sample_abc", region_id: "reg_sample_us", items: [] });
    expect(cookieJar.has("_medusa_sample_cart")).toBe(false);
    cookieJar.set("_medusa_sample_cart", JSON.stringify({ id: "cart_sample_abc", region_id: "reg_sample_us", items: [] }));
    expect(await readSampleCart()).toBeNull();
  });
});

describe("connected", () => {
  it("sends the data layer's calls to the backend with the publishable key", async () => {
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = "https://api.shop.example";
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_test";
    const backend = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      void init;
      return Response.json({ regions: [{ id: "reg_owner", countries: [{ iso_2: "gb" }] }], url: String(input) });
    });
    vi.stubGlobal("fetch", backend);
    const { listRegions } = await import("@lib/data/regions");
    const regions = await listRegions();
    expect(regions[0]!.id).toBe("reg_owner");
    const [input, init] = backend.mock.calls[0]!;
    expect(String(input)).toBe("https://api.shop.example/store/regions");
    expect(new Headers(init!.headers).get("x-publishable-api-key")).toBe("pk_test");
  });
});

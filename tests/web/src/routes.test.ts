import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The two pieces of the Worker that answer before any page: the region
// middleware (which country a URL is in) and the health route the deploy's
// smoke test reads. Neither may fail for want of a backend.

const MEDUSA_ENV = [
  "NEXT_PUBLIC_MEDUSA_BACKEND_URL",
  "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_DEFAULT_REGION",
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of MEDUSA_ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  vi.resetModules();
});
afterEach(() => {
  for (const k of MEDUSA_ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

const connect = (url = "https://api.shop.example") => {
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = url;
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_test";
};

const request = (path: string) => new NextRequest(new URL(path, "https://shop.example"));

describe("the region middleware (apps/web/src/middleware.ts) in sample mode", () => {
  it("serves the default country at / without a redirect, and sets the cache id", async () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    const { middleware } = await import("@app-src/middleware");
    const response = await middleware(request("/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://shop.example/dk");
    expect(response.cookies.get("_medusa_cache_id")?.value).toMatch(/[0-9a-f-]{36}/);
    expect(network).not.toHaveBeenCalled();
  });

  it("passes a sample country through and redirects a path without one", async () => {
    const { middleware } = await import("@app-src/middleware");
    const us = await middleware(request("/us/store"));
    expect(us.headers.get("x-middleware-next")).toBe("1");
    const bare = await middleware(request("/store?q=tee"));
    expect(bare.status).toBe(307);
    expect(bare.headers.get("location")).toBe("https://shop.example/dk/store?q=tee");
  });

  it("falls back to the first sample country when the default is not one", async () => {
    process.env.NEXT_PUBLIC_DEFAULT_REGION = "jp";
    const { middleware } = await import("@app-src/middleware");
    const bare = await middleware(request("/cart"));
    expect(bare.headers.get("location")).toBe("https://shop.example/dk/cart");
  });
});

describe("the region middleware, connected", () => {
  it("maps the backend's regions", async () => {
    connect();
    const backend = vi.fn(async () =>
      Response.json({ regions: [{ id: "reg_gb", countries: [{ iso_2: "gb" }] }] }),
    );
    vi.stubGlobal("fetch", backend);
    const { middleware } = await import("@app-src/middleware");
    const bare = await middleware(request("/store"));
    expect(bare.headers.get("location")).toBe("https://shop.example/gb/store");
    expect(String((backend.mock.calls[0] as unknown[])[0])).toBe("https://api.shop.example/store/regions");
  });
});

describe("GET /api/health (apps/web/src/app/api/health/route.ts)", () => {
  it("reports sample mode as healthy, without touching the network", async () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    const { GET } = await import("@app-src/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, mode: "sample", regions: 2, products: 6 });
    expect(network).not.toHaveBeenCalled();
  });

  it("connected, is healthy when the backend lists its regions with the key", async () => {
    // A trailing slash on the URL is tolerated.
    connect("https://api.shop.example/");
    const backend = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      void input;
      void init;
      return Response.json({ regions: [{ id: "reg_1" }, { id: "reg_2" }, { id: "reg_3" }] });
    });
    vi.stubGlobal("fetch", backend);
    const { GET } = await import("@app-src/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, mode: "connected", regions: 3 });
    const [input, init] = backend.mock.calls[0]!;
    expect(String(input)).toBe("https://api.shop.example/store/regions?fields=id&limit=100");
    expect(new Headers(init!.headers).get("x-publishable-api-key")).toBe("pk_test");
  });

  it("connected, is unhealthy (503) when the backend refuses the key or is down", async () => {
    connect();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const { GET } = await import("@app-src/app/api/health/route");
    const refused = await GET();
    expect(refused.status).toBe(503);
    expect(await refused.json()).toEqual({ ok: false, mode: "connected", backend: { status: 401 } });
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    const down = await GET();
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ ok: false, mode: "connected", backend: { reachable: false } });
  });
});

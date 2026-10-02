import { beforeEach, describe, expect, it, vi } from "vitest";

const neonMocks = vi.hoisted(() => ({
  token: vi.fn(),
}));

vi.mock("@/lib/neonAuth", () => ({
  isNeonAuthConfigured: true,
  getNeonAuthClient: () => ({ token: neonMocks.token }),
}));

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  clear() {
    this.data.clear();
  }
}

function jwtExpiringIn(seconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }),
  ).toString("base64url");
  return `header.${payload}.signature`;
}

describe("Neon access-token session cache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", new MemoryStorage());
    vi.stubGlobal("sessionStorage", new MemoryStorage());
  });

  it("retrieves a Neon token and caches it for API requests", async () => {
    const token = jwtExpiringIn(3600);
    neonMocks.token.mockResolvedValue({ data: { token }, error: null });

    const session = await import("@/lib/authSession");

    expect(await session.getAccessToken()).toBe(token);
    expect(session.getCachedAccessToken()).toBe(token);
    expect(neonMocks.token).toHaveBeenCalledTimes(1);

    expect(await session.getAccessToken()).toBe(token);
    expect(neonMocks.token).toHaveBeenCalledTimes(1);
  });

  it("does not reuse an expired cached token after refresh", async () => {
    const expired = jwtExpiringIn(-60);
    const fresh = jwtExpiringIn(3600);
    localStorage.setItem("access_token", expired);
    neonMocks.token.mockResolvedValue({ data: { token: fresh }, error: null });

    const session = await import("@/lib/authSession");

    expect(session.getCachedAccessToken()).toBeNull();
    expect(await session.getAccessToken()).toBe(fresh);
    expect(session.getCachedAccessToken()).toBe(fresh);
  });

  it("deduplicates simultaneous Neon token refresh requests", async () => {
    const token = jwtExpiringIn(3600);
    neonMocks.token.mockResolvedValue({ data: { token }, error: null });

    const session = await import("@/lib/authSession");
    const [first, second, third] = await Promise.all([
      session.getAccessToken(true),
      session.getAccessToken(true),
      session.getAccessToken(true),
    ]);

    expect(first).toBe(token);
    expect(second).toBe(token);
    expect(third).toBe(token);
    expect(neonMocks.token).toHaveBeenCalledTimes(1);
  });
});

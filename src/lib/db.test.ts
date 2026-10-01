import { describe, it, expect, vi, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { transientRetry } from "./db";

// A real Prisma client whose database is unreachable (non-routable address), so
// every connection attempt fails at the connect stage — exactly what a lossy
// network or a waking Neon compute produces.
function unreachableClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: "postgresql://u:p@10.255.255.1:5432/db", connectionTimeoutMillis: 300 }),
  }).$extends(transientRetry);
}

describe("transientRetry extension (real Prisma client)", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  afterEach(() => warn.mockClear());

  it("retries a query whose connection never opened, then surfaces the error", async () => {
    const client = unreachableClient();
    await expect(client.user.count()).rejects.toThrow(/connection timeout|trying to connect/i);
    // 1 attempt + 2 retries.
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toMatch(/retrying User\.count \(attempt 2, connect failure\)/);
    await client.$disconnect();
  }, 20_000);

  it("retries writes too when the connection never opened (nothing was sent)", async () => {
    const client = unreachableClient();
    await expect(client.user.deleteMany({ where: { id: "nope" } })).rejects.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
    await client.$disconnect();
  }, 20_000);

  it("leaves statements inside a transaction alone — the transaction is the unit to retry", async () => {
    const client = unreachableClient();
    await expect(client.$transaction([client.user.count(), client.profile.count()])).rejects.toThrow();
    expect(warn).not.toHaveBeenCalled();
    await client.$disconnect();
  }, 20_000);
});

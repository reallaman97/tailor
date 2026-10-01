import { describe, it, expect, vi } from "vitest";
import { transientKind, withDbRetry } from "./db-retry";

// Error shapes captured from real Prisma 7 + adapter-pg failures against Neon.
function connectTimeout() {
  return Object.assign(new Error("Connection terminated due to connection timeout"), {
    cause: new Error("Connection terminated unexpectedly"),
  });
}
const poolTimeout = () => new Error("timeout exceeded when trying to connect");
const droppedMidQuery = () => new Error("Connection terminated unexpectedly");
function serverTerminated() {
  return Object.assign(new Error("Raw query failed. Code: `57P01`."), {
    code: "P2010",
    meta: { driverAdapterError: { cause: { originalCode: "57P01", kind: "postgres" } } },
  });
}
function uniqueViolation() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

const noSleep = () => Promise.resolve();

describe("transientKind", () => {
  it("classifies connection-stage failures (the query was never sent)", () => {
    expect(transientKind(connectTimeout())).toBe("connect");
    expect(transientKind(poolTimeout())).toBe("connect");
    expect(transientKind(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))).toBe("connect");
  });

  it("classifies failures of an open connection as in-flight", () => {
    expect(transientKind(droppedMidQuery())).toBe("in-flight");
    expect(transientKind(serverTerminated())).toBe("in-flight");
    expect(transientKind(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBe("in-flight");
  });

  it("looks through a wrapping error", () => {
    expect(transientKind(new Error("Invalid `db.user.findMany()` invocation", { cause: poolTimeout() }))).toBe("connect");
  });

  it("ignores real errors", () => {
    expect(transientKind(uniqueViolation())).toBeNull();
    expect(transientKind(new Error("Record not found"))).toBeNull();
    expect(transientKind(undefined)).toBeNull();
  });
});

describe("withDbRetry", () => {
  it("retries a connect failure for any operation, even a write", async () => {
    const work = vi.fn().mockRejectedValueOnce(connectTimeout()).mockResolvedValue("ok");
    await expect(withDbRetry(work, { idempotent: false, sleep: noSleep })).resolves.toBe("ok");
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("retries an in-flight failure only when the work is idempotent", async () => {
    const read = vi.fn().mockRejectedValueOnce(droppedMidQuery()).mockResolvedValue(["row"]);
    await expect(withDbRetry(read, { idempotent: true, sleep: noSleep })).resolves.toEqual(["row"]);

    // A write that died mid-flight may already have been applied — never repeat it.
    const write = vi.fn().mockRejectedValue(droppedMidQuery());
    await expect(withDbRetry(write, { idempotent: false, sleep: noSleep })).rejects.toThrow("terminated unexpectedly");
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("never retries a non-transient error", async () => {
    const work = vi.fn().mockRejectedValue(uniqueViolation());
    await expect(withDbRetry(work, { idempotent: true, sleep: noSleep })).rejects.toThrow("Unique constraint");
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry budget, rethrowing the last error", async () => {
    const work = vi.fn().mockRejectedValue(poolTimeout());
    const onRetry = vi.fn();
    await expect(withDbRetry(work, { idempotent: true, retries: 2, sleep: noSleep, onRetry })).rejects.toThrow(
      "timeout exceeded"
    );
    expect(work).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls.map(([info]) => [info.attempt, info.kind])).toEqual([
      [1, "connect"],
      [2, "connect"],
    ]);
  });

  it("backs off between attempts", async () => {
    const delays: number[] = [];
    const work = vi.fn().mockRejectedValueOnce(poolTimeout()).mockRejectedValueOnce(poolTimeout()).mockResolvedValue(1);
    await withDbRetry(work, {
      idempotent: false,
      backoffMs: [100, 400],
      sleep: async (ms) => void delays.push(ms),
    });
    expect(delays).toEqual([100, 400]);
  });
});

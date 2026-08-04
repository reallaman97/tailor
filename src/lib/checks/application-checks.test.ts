import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { criteriaHash, getCheckCriteria, updateCheckCriteria } from "@/lib/checks/application-checks";

async function ensureSettings() {
  await db.appSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
}

describe("application-checks criteria", () => {
  it("criteriaHash is stable and changes when any criterion changes", () => {
    const base = { country: "US", workStyle: "REMOTE" as const, jobCategory: "Computer Science" };
    const h = criteriaHash(base);
    expect(h).toBe(criteriaHash({ ...base }));
    expect(h).not.toBe(criteriaHash({ ...base, country: "UK" }));
    expect(h).not.toBe(criteriaHash({ ...base, workStyle: "HYBRID" }));
    expect(h).not.toBe(criteriaHash({ ...base, jobCategory: "Sales" }));
  });

  it("criteriaHash ignores case/whitespace on country and category", () => {
    expect(criteriaHash({ country: "US", workStyle: "REMOTE", jobCategory: "CS" })).toBe(
      criteriaHash({ country: "  us ", workStyle: "REMOTE", jobCategory: " cs " })
    );
  });

  it("round-trips criteria through the settings row", async () => {
    await ensureSettings();
    const before = await getCheckCriteria();
    try {
      await updateCheckCriteria({ country: "CA", workStyle: "HYBRID", jobCategory: "Data roles" });
      expect(await getCheckCriteria()).toEqual({ country: "CA", workStyle: "HYBRID", jobCategory: "Data roles" });
    } finally {
      await updateCheckCriteria(before); // restore the shared singleton
    }
  });
});

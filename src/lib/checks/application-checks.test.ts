import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { criteriaHash, getCheckCriteria, updateCheckCriteria, parseTechStack } from "@/lib/checks/application-checks";

async function ensureSettings() {
  await db.appSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
}

describe("application-checks tech-stack criteria", () => {
  it("parses the stack into a clean, de-duplicated list", () => {
    expect(parseTechStack(" Python, React,,AWS ; python\nKubernetes ")).toEqual(["Python", "React", "AWS", "Kubernetes"]);
    expect(parseTechStack("  ")).toEqual([]);
  });

  it("criteriaHash ignores order, case, and spacing, but changes when the stack changes", () => {
    const h = criteriaHash({ techStack: "Python, React, AWS" });
    expect(h).toBe(criteriaHash({ techStack: " aws ,react, PYTHON" }));
    expect(h).not.toBe(criteriaHash({ techStack: "Python, React, GCP" }));
  });

  it("round-trips the stack through the settings row, normalized", async () => {
    await ensureSettings();
    const before = await getCheckCriteria();
    try {
      await updateCheckCriteria({ techStack: " Python,React ,, python " });
      expect(await getCheckCriteria()).toEqual({ techStack: "Python, React" });
    } finally {
      await updateCheckCriteria(before); // restore the shared singleton
    }
  });
});

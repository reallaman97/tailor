import { describe, it, expect } from "vitest";
import { getPrimaryStatus } from "@/lib/resume-status";

describe("getPrimaryStatus", () => {
  it("returns the only status when there's just one", () => {
    expect(getPrimaryStatus(["APPLIED"])).toBe("APPLIED");
  });

  it("prefers a terminal outcome over earlier in-progress stages", () => {
    expect(getPrimaryStatus(["APPLIED", "REPLY", "FAIL"])).toBe("FAIL");
    expect(getPrimaryStatus(["APPLIED", "REPLY", "CANCELED"])).toBe("CANCELED");
  });

  it("prefers OFFER over every other status", () => {
    expect(getPrimaryStatus(["APPLIED", "REPLY", "INTRO", "TECH1", "FINAL", "OFFER"])).toBe("OFFER");
  });

  it("among in-progress stages (no terminal outcome yet), picks the furthest-along one", () => {
    expect(getPrimaryStatus(["APPLIED", "REPLY", "TECH1"])).toBe("TECH1");
    expect(getPrimaryStatus(["APPLIED", "REPLY", "INTRO"])).toBe("INTRO");
    expect(getPrimaryStatus(["DRAFT", "APPLIED"])).toBe("APPLIED");
  });

  it("falls back to the first element for an empty array (defensive default)", () => {
    expect(getPrimaryStatus([])).toBe("DRAFT");
  });
});

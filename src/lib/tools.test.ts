import { describe, it, expect } from "vitest";
import { TOOLS, canAccessTool, toolsForRole, toolStatusFor } from "@/lib/tools";

describe("tools registry", () => {
  it("gives superadmin access to every tool regardless of its role allowlist", () => {
    for (const tool of TOOLS) {
      expect(canAccessTool("SUPERADMIN", tool)).toBe(true);
    }
    expect(toolsForRole("SUPERADMIN")).toHaveLength(TOOLS.length);
  });

  it("gives a bidder access to only the Resume Platform", () => {
    const bidderTools = toolsForRole("BIDDER").map((t) => t.key);
    expect(bidderTools).toEqual(["resume-platform"]);
  });

  it("gives a caller access to Interview Management plus the coming-soon caller tools", () => {
    const callerTools = toolsForRole("CALLER").map((t) => t.key);
    expect(callerTools.sort()).toEqual(
      ["interview-management", "interview-ai", "meeting-calendar", "networking-hub"].sort()
    );
  });

  it("gives a manager access to only Interview Management", () => {
    const managerTools = toolsForRole("MANAGER").map((t) => t.key);
    expect(managerTools).toEqual(["interview-management"]);
  });

  it("marks Interview Management as open for a manager", () => {
    const interview = TOOLS.find((t) => t.key === "interview-management")!;
    expect(toolStatusFor("MANAGER", interview)).toBe("open");
  });

  it("excludes a bidder from tools not on their allowlist", () => {
    const interviewAi = TOOLS.find((t) => t.key === "interview-ai")!;
    expect(canAccessTool("BIDDER", interviewAi)).toBe(false);
  });

  it("excludes a caller from the Resume Platform", () => {
    const resumePlatform = TOOLS.find((t) => t.key === "resume-platform")!;
    expect(canAccessTool("CALLER", resumePlatform)).toBe(false);
  });

  it("marks a released, allowed tool as open", () => {
    const resumePlatform = TOOLS.find((t) => t.key === "resume-platform")!;
    expect(toolStatusFor("BIDDER", resumePlatform)).toBe("open");
  });

  it("marks a released tool this role can't use as restricted, not hidden or coming-soon", () => {
    const resumePlatform = TOOLS.find((t) => t.key === "resume-platform")!;
    expect(toolStatusFor("CALLER", resumePlatform)).toBe("restricted");
  });

  it("marks an unreleased tool as coming-soon even for a role on its allowlist", () => {
    const interviewAi = TOOLS.find((t) => t.key === "interview-ai")!;
    expect(toolStatusFor("CALLER", interviewAi)).toBe("coming-soon");
  });

  it("marks an unreleased tool as coming-soon for superadmin too, since it isn't built yet", () => {
    const interviewAi = TOOLS.find((t) => t.key === "interview-ai")!;
    expect(toolStatusFor("SUPERADMIN", interviewAi)).toBe("coming-soon");
  });
});

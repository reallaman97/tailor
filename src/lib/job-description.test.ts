import { describe, it, expect } from "vitest";
import { compactJobDescription } from "./job-description";

const JD = `Senior Backend Engineer


We build   payment APIs.\r\n\r\nRequirements:\r\n- 5+ years of Python\r\n- AWS and Kafka

Acme is an Equal Opportunity Employer. All qualified applicants will receive consideration without regard to race, color, religion, sex, sexual orientation, gender identity, or national origin.

We participate in E-Verify.

Benefits: medical, dental, 401(k).`;

describe("compactJobDescription", () => {
  const out = compactJobDescription(JD);

  it("keeps the job content and benefits", () => {
    expect(out).toContain("We build payment APIs.");
    expect(out).toContain("- 5+ years of Python");
    expect(out).toContain("Benefits: medical, dental, 401(k).");
  });

  it("drops legal boilerplate paragraphs", () => {
    expect(out).not.toMatch(/Equal Opportunity/);
    expect(out).not.toMatch(/E-Verify/);
  });

  it("normalizes whitespace and blank lines", () => {
    expect(out).not.toContain("\r");
    expect(out).not.toMatch(/\n{3,}/);
    expect(out).not.toContain("  ");
  });

  it("keeps a substantive job paragraph that merely mentions equal opportunity", () => {
    const mixed =
      "You'll design and build Kafka and Python services on AWS, owning reliability end to end. " +
      "We're an equal opportunity team that values experience across stacks. ".repeat(6);
    expect(compactJobDescription(mixed)).toContain("Kafka and Python services");
  });
});

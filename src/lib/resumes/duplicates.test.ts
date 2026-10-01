import { describe, it, expect } from "vitest";
import { companyKey, jobPostingKey, jdFingerprint, shingles, similarity, NEAR_DUPLICATE_THRESHOLD } from "./duplicates";

describe("companyKey", () => {
  it("treats legal suffixes, punctuation, case, domains, and '&' as the same company", () => {
    const amazon = companyKey("Amazon");
    expect(companyKey("Amazon.com, Inc.")).toBe(amazon);
    expect(companyKey("AMAZON LLC")).toBe(amazon);
    expect(companyKey("Johnson & Johnson")).toBe(companyKey("Johnson and Johnson, Inc"));
    expect(companyKey("The Home Depot")).toBe(companyKey("Home Depot Inc."));
    expect(companyKey("Société Générale S.A.")).toBe(companyKey("societe generale"));
    expect(companyKey("Datadog (NYC office)")).toBe(companyKey("Datadog"));
  });

  it("keeps different companies apart", () => {
    expect(companyKey("Amazon")).not.toBe(companyKey("Amazon Web Services"));
    expect(companyKey("Meta")).not.toBe(companyKey("Metabase"));
  });

  it("returns null for placeholder employer names so they never block each other", () => {
    for (const name of ["Confidential", "Stealth Startup", "  undisclosed ", "N/A", "Confidential Company Inc."]) {
      expect(companyKey(name)).toBeNull();
    }
  });

  it("never reduces a name to nothing", () => {
    expect(companyKey("Group")).toBe("group");
    expect(companyKey("The Company LLC")).toBeNull();
  });
});

describe("jobPostingKey", () => {
  it("collapses the many URL shapes of one LinkedIn job to its id", () => {
    const id = "linkedin:3912345678";
    expect(jobPostingKey("https://www.linkedin.com/jobs/view/3912345678/?refId=abc&trackingId=xyz")).toBe(id);
    expect(jobPostingKey("https://www.linkedin.com/jobs/view/senior-engineer-at-acme-3912345678")).toBe(id);
    expect(jobPostingKey("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=3912345678")).toBe(id);
  });

  it("recognizes other job boards' posting ids", () => {
    expect(jobPostingKey("https://boards.greenhouse.io/acme/jobs/4012345")).toBe("greenhouse:4012345");
    expect(jobPostingKey("https://acme.com/careers?gh_jid=4012345&gh_src=x")).toBe("greenhouse:4012345");
    expect(jobPostingKey("https://jobs.lever.co/acme/1B2C3D4E-1111-2222-3333-444455556666/apply")).toBe(
      "lever:1b2c3d4e-1111-2222-3333-444455556666"
    );
    expect(jobPostingKey("https://www.indeed.com/viewjob?jk=ABC123def&from=serp")).toBe("indeed:abc123def");
    expect(jobPostingKey("https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Remote-USA/Senior-Engineer_R-12345")).toBe(
      "workday:acme:r-12345"
    );
  });

  it("falls back to a cleaned URL for other sites", () => {
    expect(jobPostingKey("HTTPS://www.Acme.com/careers/123/?utm_source=x&b=2&a=1#apply")).toBe(
      "url:acme.com/careers/123?a=1&b=2"
    );
    expect(jobPostingKey("acme.com/careers/123")).toBe(jobPostingKey("https://acme.com/careers/123/"));
  });

  it("returns null for empty or non-URL input", () => {
    expect(jobPostingKey("")).toBeNull();
    expect(jobPostingKey(undefined)).toBeNull();
    expect(jobPostingKey("not a url at all")).toBeNull();
  });
});

const JD_A = Array.from({ length: 12 }, (_, i) => `Build and operate Kafka pipeline number ${i} in Python on AWS with strong testing.`).join(" ");

describe("description fingerprint and similarity", () => {
  it("fingerprints identically despite case, punctuation, and spacing", () => {
    expect(jdFingerprint(JD_A)).toBe(jdFingerprint(JD_A.toUpperCase().replace(/\./g, " ;  ")));
    expect(jdFingerprint("Too short to identify anything")).toBeNull();
  });

  it("flags a lightly edited repost as a near-duplicate, but not a different job", () => {
    const repost = `Recruiter note: great opportunity! ${JD_A} Apply today.`;
    expect(similarity(shingles(JD_A), shingles(repost))).toBeGreaterThanOrEqual(NEAR_DUPLICATE_THRESHOLD);

    const different = Array.from({ length: 12 }, (_, i) => `Design React interfaces for dashboard ${i} using TypeScript and GraphQL daily.`).join(" ");
    expect(similarity(shingles(JD_A), shingles(different))).toBeLessThan(0.2);
  });
});

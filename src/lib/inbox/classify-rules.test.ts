import { describe, it, expect } from "vitest";
import { classifyByRules, detectWorkMode, companyFromSenderName, companyFromText } from "./classify-rules";
import { nextStageFor, companyCandidates } from "./match";

const ats = (subject: string, text: string, fromName = "Acme Hiring Team") => ({
  fromAddress: "no-reply@us.greenhouse-mail.io",
  fromName,
  subject,
  text,
});

describe("classifyByRules", () => {
  it("files an ATS 'thanks for applying' as received", () => {
    const c = classifyByRules(ats("Thank you for applying to Acme", "Thank you for applying to the Senior Engineer role at Acme. We have received your application."));
    expect(c?.category).toBe("APPLICATION_RECEIVED");
    expect(c?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(c?.companyName).toBe("Acme");
  });

  it("files a clear ATS rejection — even one that thanks you for your interest", () => {
    const c = classifyByRules(
      ats("Your application to Acme", "Thank you for your interest in Acme. Unfortunately, we have decided to move forward with other candidates.")
    );
    expect(c?.category).toBe("REJECTION");
  });

  it("files an interview invite with a scheduling link as a next step that needs no reply", () => {
    const c = classifyByRules(ats("Next steps with Acme", "We'd like to invite you to an interview. Please select a time here: https://calendly.com/acme/30min"));
    expect(c).toMatchObject({ category: "NEXT_STEP", nextStepKind: "interview", needsReply: false });
  });

  it("asks for a reply when the invite wants availability", () => {
    const c = classifyByRules(ats("Interview — Acme", "We'd like to schedule a phone screen. Could you share your availability for next week?"));
    expect(c).toMatchObject({ category: "NEXT_STEP", needsReply: true });
  });

  it("tells assessments and AI interviews apart", () => {
    expect(classifyByRules(ats("Acme coding challenge", "Please complete the HackerRank assessment within 5 days."))?.nextStepKind).toBe("assessment");
    expect(classifyByRules(ats("Acme next step", "The next step is a HireVue video interview."))?.nextStepKind).toBe("ai_interview");
  });

  it("drops job-board alerts as noise", () => {
    const c = classifyByRules({ fromAddress: "jobalerts-noreply@linkedin.com", fromName: "LinkedIn", subject: "30 new jobs for you", text: "..." });
    expect(c?.category).toBe("OTHER");
  });

  it("leaves a recruiter's personal email to the LLM", () => {
    const c = classifyByRules({
      fromAddress: "dana@talentbridge.com",
      fromName: "Dana Smith",
      subject: "Remote Senior Go role",
      text: "Hi, I came across your profile — are you open to a fully remote Senior Go Engineer contract? Could you send your updated resume in Word format?",
    });
    expect(c).toBeNull();
  });
});

describe("detectWorkMode", () => {
  it("reads remote, hybrid and onsite", () => {
    expect(detectWorkMode("This is a 100% remote position")).toBe("REMOTE");
    expect(detectWorkMode("Hybrid — 3 days a week in office")).toBe("HYBRID");
    expect(detectWorkMode("This role is onsite in Austin")).toBe("ONSITE");
    expect(detectWorkMode("Great team, great pay")).toBe("UNKNOWN");
  });
});

describe("company extraction", () => {
  it("pulls the company from sender names and formulaic text", () => {
    expect(companyFromSenderName("Acme Robotics Talent Acquisition")).toBe("Acme Robotics");
    expect(companyFromText("Your application at Initech", "")).toBe("Initech");
  });

  it("offers the sender's own domain only when it isn't an ATS or webmail", () => {
    expect(companyCandidates({ companyName: null, fromName: null, fromAddress: "jane@acme-robotics.com" })).toContain("acme robotics");
    expect(companyCandidates({ companyName: null, fromName: null, fromAddress: "x@gmail.com" })).toEqual([]);
    expect(companyCandidates({ companyName: null, fromName: null, fromAddress: "no-reply@hire.lever.co" })).toEqual([]);
  });
});

describe("nextStageFor", () => {
  it("closes on rejection, unless already closed", () => {
    expect(nextStageFor(["APPLIED"], "REJECTION", null)).toBe("FAIL");
    expect(nextStageFor(["APPLIED", "OFFER"], "REJECTION", null)).toBeNull();
  });

  it("advances one interview stage per invite", () => {
    expect(nextStageFor(["APPLIED"], "NEXT_STEP", "interview")).toBe("INTRO");
    expect(nextStageFor(["APPLIED", "REPLY"], "NEXT_STEP", "interview")).toBe("INTRO");
    expect(nextStageFor(["APPLIED", "INTRO"], "NEXT_STEP", "interview")).toBe("TECH1");
    expect(nextStageFor(["APPLIED", "INTRO", "TECH1", "TECH2", "FINAL"], "NEXT_STEP", "interview")).toBeNull();
  });

  it("treats an assessment as a reply, without skipping ahead", () => {
    expect(nextStageFor(["APPLIED"], "NEXT_STEP", "assessment")).toBe("REPLY");
    expect(nextStageFor(["APPLIED", "INTRO"], "NEXT_STEP", "assessment")).toBeNull();
  });
});

describe("RESUME_REQUEST", () => {
  it("spots resume requests however they're phrased", async () => {
    const { RESUME_REQUEST } = await import("./classify-rules");
    for (const t of [
      "Could you send your updated resume in Word format?",
      "Please share your latest CV",
      "Can you send over your resume?",
      "I need a Word version of your resume",
    ]) {
      expect(RESUME_REQUEST.test(t), t).toBe(true);
    }
    expect(RESUME_REQUEST.test("Thanks for sending your resume last week")).toBe(false);
  });
});

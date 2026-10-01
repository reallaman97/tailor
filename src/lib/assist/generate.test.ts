import { describe, it, expect, vi, beforeEach } from "vitest";

// Stand-in for the DeepSeek client: each test queues the raw `content` strings
// the model "returns", and inspects the requests that were sent.
const queued: string[] = [];
const sent: { messages: { role: string; content: string }[]; reasoning_effort?: string }[] = [];
vi.mock("@/lib/tailoring/deepseek", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/tailoring/deepseek")>();
  return {
    ...real,
    createDeepSeekClient: () => ({
      chat: {
        completions: {
          create: async (params: { messages: { role: string; content: string }[] }) => {
            sent.push(params);
            return {
              choices: [{ message: { content: queued.shift() ?? "" }, finish_reason: "stop" }],
              usage: { prompt_tokens: 100, prompt_cache_hit_tokens: 80, completion_tokens: 50 },
            };
          },
        },
      },
    }),
  };
});

import { generateCoverLetter, answerApplicationQuestion, AssistOutputError, type AssistContext } from "./generate";

const CTX: AssistContext = {
  resumeText: "Jordan A Rivera\nEXPERIENCE\nSr. AI Engineer — Northwind Analytics | 2020-08 – Present",
  companyName: "ShelfSense",
  jobTitle: "Senior Machine Learning Engineer",
  jobDescription: "Build forecasting systems.",
};

const LETTER = "Dear Hiring Manager,\n\n\n\nI build **forecasting** systems at Northwind Analytics and want to do that at ShelfSense.  \n\nBest regards,\nJordan A Rivera";

beforeEach(() => {
  queued.length = 0;
  sent.length = 0;
});

describe("generateCoverLetter", () => {
  it("returns a tidy plain-text letter (no markdown, no extra blank lines) and reports usage", async () => {
    queued.push(JSON.stringify({ coverLetter: LETTER }));
    const { coverLetter, usage } = await generateCoverLetter(CTX, "");
    expect(coverLetter).toBe(
      "Dear Hiring Manager,\n\nI build forecasting systems at Northwind Analytics and want to do that at ShelfSense.\n\nBest regards,\nJordan A Rivera"
    );
    expect(usage).toEqual({ model: "deepseek-flash", inputTokens: 100, cachedInputTokens: 80, outputTokens: 50 });
  });

  it("sends today's date, the resume, the job, and the applicant's instructions", async () => {
    queued.push(JSON.stringify({ coverLetter: LETTER }));
    await generateCoverLetter(CTX, "Mention relocation to Austin.");
    const user = sent[0].messages.find((m) => m.role === "user")!.content;
    expect(user).toContain(`TODAY'S DATE: ${new Date().toISOString().slice(0, 10)}`);
    expect(user).toContain("SUBMITTED RESUME:\nJordan A Rivera");
    expect(user).toContain("Company: ShelfSense");
    expect(user).toContain("EXTRA INSTRUCTIONS:\nMention relocation to Austin.");
  });

  it("puts the application's context first and per-request parts last, so the prefix is cacheable", async () => {
    queued.push(JSON.stringify({ coverLetter: LETTER }));
    await generateCoverLetter(CTX, "Mention relocation.");
    const user = sent[0].messages.find((m) => m.role === "user")!.content;
    expect(user.startsWith("SUBMITTED RESUME:")).toBe(true);
    expect(user.indexOf("TODAY'S DATE")).toBeGreaterThan(user.indexOf("Build forecasting systems."));
    expect(sent[0].reasoning_effort).toBe("low");
  });

  it("retries DeepSeek's empty JSON-mode replies, making the last attempt without JSON mode", async () => {
    // Whitespace-only content is the real quirk observed from DeepSeek's JSON mode.
    queued.push("   ", "   ", `Here it is:\n${JSON.stringify({ coverLetter: LETTER })}\nHope that helps.`);
    await expect(generateCoverLetter(CTX, "")).resolves.toBeTruthy();
    expect(sent).toHaveLength(3);
    const modes = sent.map((p) => (p as { response_format?: unknown }).response_format);
    expect(modes).toEqual([{ type: "json_object" }, { type: "json_object" }, undefined]);
  });

  it("gives up with a clear error after three unusable replies", async () => {
    queued.push("", "not json", "still not json");
    await expect(generateCoverLetter(CTX, "")).rejects.toThrow(AssistOutputError);
    expect(sent).toHaveLength(3);
  });
});

describe("answerApplicationQuestion", () => {
  it("passes through the model's review flag for facts the resume can't confirm", async () => {
    queued.push(
      JSON.stringify({
        answer: "My expected range is [your salary range].",
        needsReview: true,
        reviewNote: "Add your salary range.",
      })
    );
    const { answer } = await answerApplicationQuestion(CTX, "What are your salary expectations?", "brief", null);
    expect(answer).toEqual({
      answer: "My expected range is [your salary range].",
      needsReview: true,
      reviewNote: "Add your salary range.",
    });
    const user = sent[0].messages.find((m) => m.role === "user")!.content;
    expect(user).toContain("QUESTION:\nWhat are your salary expectations?");
    expect(user).toContain("ANSWER LENGTH: 1–2 sentences");
    expect(user).not.toContain("CHARACTER LIMIT");
  });

  it("flags an answer that's over the form's character limit instead of silently cutting it", async () => {
    queued.push(JSON.stringify({ answer: "x".repeat(120), needsReview: false, reviewNote: "" }));
    const { answer } = await answerApplicationQuestion(CTX, "Describe a project.", "standard", 100);
    expect(answer.answer).toHaveLength(120);
    expect(answer.needsReview).toBe(true);
    expect(answer.reviewNote).toBe("Answer is 120 characters — trim it to 100.");
    expect(sent[0].messages.find((m) => m.role === "user")!.content).toContain("CHARACTER LIMIT: 100 characters");
  });

  it("tolerates a missing review flag", async () => {
    queued.push(JSON.stringify({ answer: "About 10 years." }));
    const { answer } = await answerApplicationQuestion(CTX, "Years with Kubernetes?", "brief", null);
    expect(answer).toEqual({ answer: "About 10 years.", needsReview: false, reviewNote: "" });
  });
});

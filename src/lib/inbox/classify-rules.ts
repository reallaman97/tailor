import type { EmailCategory, WorkMode } from "@/generated/prisma/client";

// The first, free pass over an incoming email: keyword and sender rules. It
// only answers when the email is unambiguous — an ATS "thanks for applying",
// a clear rejection, an interview or assessment invite, job-alert noise.
// Anything else (recruiter outreach, conversations, mixed signals) returns
// null and goes to the LLM (classify-llm.ts).

export type EmailInput = {
  fromAddress: string;
  fromName: string | null;
  subject: string;
  text: string;
};

export type Classification = {
  category: EmailCategory;
  workMode: WorkMode;
  /** 0–1. Tracker updates happen automatically at AUTO_UPDATE_CONFIDENCE or above. */
  confidence: number;
  nextStepKind: "interview" | "assessment" | "ai_interview" | "other" | null;
  /** The recruiter is asking a question or for availability — a reply is expected. */
  needsReply: boolean;
  companyName: string | null;
  jobTitle: string | null;
  summary: string;
};

export const AUTO_UPDATE_CONFIDENCE = 0.8;

/** Applicant-tracking systems: their mail is automated and formulaic. */
const ATS_DOMAINS = [
  "greenhouse.io",
  "greenhouse-mail.io",
  "lever.co",
  "myworkday.com",
  "myworkdayjobs.com",
  "workday.com",
  "ashbyhq.com",
  "smartrecruiters.com",
  "icims.com",
  "jobvite.com",
  "workablemail.com",
  "workable.com",
  "bamboohr.com",
  "breezy.hr",
  "recruitee.com",
  "teamtailor.com",
  "successfactors.com",
  "taleo.net",
  "oraclecloud.com",
  "rippling.com",
  "rippling-ats.com",
  "dover.com",
  "gem.com",
  "paylocity.com",
  "ultipro.com",
  "ukg.com",
  "jazzhr.com",
  "applytojob.com",
  "pinpointhq.com",
  "comeet.co",
  "eightfold.ai",
  "phenom.com",
  "avature.net",
  "hire.lever.co",
];

/** Job boards' automated alerts and digests — noise for this purpose. */
const NOISE_PATTERNS = [
  /jobs?-?(alert|noreply|notification)s?@/i,
  /@(e\.)?(linkedin|indeed|glassdoor|ziprecruiter|dice|monster|wellfound|angel|builtin|otta|welcometothejungle|simplyhired|careerbuilder)\.(com|co)\b/i,
];
const NOISE_SUBJECT = /\b(jobs? (you may|for you|alert|recommendations?)|new jobs?|recommended jobs?|job matches|daily digest|weekly digest|newsletter|is hiring\b.*\bapply now|people are viewing|your weekly|webinar)\b/i;

const REJECTION = [
  /\b(decided|chosen|elected) (not )?to (move|go) forward with (other|another|a different) (candidates?|applicants?)/i,
  /\b(will|would) not be (moving|going) forward\b/i,
  /\bnot (be )?(moving|going) forward with your (application|candidacy)\b/i,
  /\bdecided (not to proceed|to pursue other|not to pursue your)/i,
  /\b(we|have) (regret|are sorry) to inform\b/i,
  /\b(position|role) has (already )?been filled\b/i,
  /\byou (were|have) not been selected\b/i,
  /\bno longer (under consideration|considering your)\b/i,
  /\bother (candidates|applicants) whose (experience|qualifications|background)/i,
  /\bunfortunately,? (we|after careful|at this time|the (position|role))/i,
  /\bwon'?t be (moving|going) forward\b/i,
  /\bnot (a|the right) (fit|match) (for|at) this time\b/i,
];

const RECEIVED = [
  /\bthanks? (you )?for (applying|your application|submitting your application)\b/i,
  /\b(we('ve| have)|have) received your application\b/i,
  /\byour application (has been|was) (received|submitted)\b/i,
  /\bapplication (received|confirmation|submitted)\b/i,
  /\bthank you for your interest in (joining|working|the|a career)/i,
];

const ASSESSMENT = /\b(assessment|coding (challenge|test|exercise)|take[- ]home|technical (test|challenge)|hackerrank|codesignal|codility|testgorilla|coderbyte|karat|qualified\.io|online test)\b/i;
const AI_INTERVIEW = /\b(ai[- ]?(powered )?interview|hirevue|video interview|one[- ]way (video|interview)|recorded (video|interview)|async(hronous)? (video|interview)|willo|spark hire|myinterview|interviewer\.ai|apriora|micro1|mercor)\b/i;
const INTERVIEW = /\b(schedule (an?|your) (interview|call|chat|conversation|phone screen)|invite you to (an? )?(interview|call|chat|next round)|(phone|technical|initial|first|second|final|onsite) (interview|screen|round)|next (step|steps|round) in (our|the) (process|interview)|move (you )?forward (to|with) the next|book (a|your) time|calendly\.com|goodtime\.io|select a time|pick a time)\b/i;
const AVAILABILITY = /\b(your availability|what times? work|times that work|when are you available|available (for|to) (a|an) (call|chat|interview)|share (a few|some) times|let (me|us) know (your|a) (availability|time))\b/i;
export const RESUME_REQUEST = /\b((updated|latest|current|recent) (resume|cv)|resume in (word|\.?docx|doc) format|(word|\.?docx) (version|format|copy) of (your|the) (resume|cv)|(send|share|forward|attach) (over )?(me |us )?(your|an updated|the latest) (resume|cv))\b/i;


function domainOf(address: string): string {
  return address.split("@")[1]?.toLowerCase() ?? "";
}

export function isAtsSender(address: string): boolean {
  const domain = domainOf(address);
  return ATS_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function isAutomatedSender(address: string): boolean {
  return isAtsSender(address) || /^(no-?reply|do-?not-?reply|notifications?|talent|careers|jobs|recruiting|hiring)[@.+-]/i.test(address);
}

/** Remote / hybrid / onsite, from how the email describes the role. */
export function detectWorkMode(text: string): WorkMode {
  const remote = /\b(100% remote|fully remote|remote[- ](first|only|friendly|position|role|opportunity|work)|work from (home|anywhere)|\bremote\b)/i.test(text);
  const hybrid = /\bhybrid\b|\b\d (days?|x) (a|per) week (in|on)[- ]?(site|office)/i.test(text);
  const onsite = /\b(on-?site|in[- ]office|in[- ]person|relocat(e|ion) (to|required))\b/i.test(text);
  if (hybrid) return "HYBRID";
  if (onsite && !remote) return "ONSITE";
  if (remote && !onsite) return "REMOTE";
  return "UNKNOWN";
}

/** A company name from formulaic ATS subjects/bodies ("your application to Acme", "at Acme"). */
export function companyFromText(subject: string, text: string): string | null {
  const patterns = [
    /\b(?:applying|application|interest) (?:to|at|with) ([A-Z][\w&.,' -]{1,60}?)(?:[!.,]| for | -|\n|$)/,
    /\bthank you for applying to ([A-Z][\w&.,' -]{1,60}?)(?:[!.,]| for | -|\n|$)/,
    /\b(?:role|position|opportunity|team) (?:at|with) ([A-Z][\w&.,' -]{1,60}?)(?:[!.,]| -|\n|$)/,
  ];
  for (const re of patterns) {
    const m = subject.match(re) ?? text.slice(0, 1500).match(re);
    if (m) {
      const name = m[1].trim().replace(/[\s,.-]+$/, "");
      if (name.length >= 2 && !/^(the|our|a|an|this|your)$/i.test(name)) return name;
    }
  }
  return null;
}

/** "Acme Recruiting Team" → "Acme" — ATS mail usually carries the company in the sender name. */
export function companyFromSenderName(fromName: string | null): string | null {
  if (!fromName) return null;
  const cleaned = fromName
    .replace(/["']/g, "")
    .replace(/\b(recruiting|recruitment|talent( acquisition)?|careers?|hiring|people( ops)?|hr|team|jobs|notifications?|no-?reply|via \w+)\b/gi, "")
    .replace(/[@|\-–—:]+.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

function firstSentence(text: string, max = 200): string {
  const t = text.replace(/\s+/g, " ").trim();
  const end = t.search(/[.!?](\s|$)/);
  return (end > 20 ? t.slice(0, end + 1) : t).slice(0, max);
}

/**
 * Classifies by rules, or returns null when the email needs the LLM. Only
 * formulaic mail is decided here: noise, and ATS/automated updates whose
 * signals all point the same way.
 */
export function classifyByRules(email: EmailInput): Classification | null {
  const head = `${email.subject}\n${email.text.slice(0, 4000)}`;
  const automated = isAutomatedSender(email.fromAddress);
  const base = {
    workMode: detectWorkMode(head),
    companyName: companyFromText(email.subject, email.text) ?? (automated ? companyFromSenderName(email.fromName) : null),
    jobTitle: null,
    summary: firstSentence(email.text) || email.subject,
  };
  const company = base.companyName ? ` from ${base.companyName}` : "";

  if (NOISE_PATTERNS.some((re) => re.test(email.fromAddress)) || NOISE_SUBJECT.test(email.subject)) {
    return { ...base, category: "OTHER", confidence: 0.9, nextStepKind: null, needsReply: false };
  }

  const rejected = REJECTION.some((re) => re.test(head));
  const received = RECEIVED.some((re) => re.test(head));
  const assessment = ASSESSMENT.test(head);
  const aiInterview = AI_INTERVIEW.test(head);
  const interview = INTERVIEW.test(head);
  const nextStep = assessment || aiInterview || interview;
  const resumeRequest = RESUME_REQUEST.test(head);

  // A personal email (a recruiter writing directly) is rarely formulaic enough
  // to trust keywords — leave it to the LLM, except an unmistakable rejection.
  if (!automated) {
    if (rejected && !nextStep && !resumeRequest) {
      return { ...base, category: "REJECTION", confidence: 0.8, nextStepKind: null, needsReply: false, summary: `Rejection${company} — not moving forward.` };
    }
    return null;
  }

  if (resumeRequest) return null; // usually a person replying from a recruiting address
  if (rejected && !nextStep) {
    return { ...base, category: "REJECTION", confidence: 0.92, nextStepKind: null, needsReply: false, summary: `Rejection${company} — not moving forward.` };
  }
  if (nextStep && !rejected) {
    const kind = aiInterview ? "ai_interview" : assessment ? "assessment" : "interview";
    const needsReply = AVAILABILITY.test(head) && !/calendly\.com|goodtime\.io|select a time|pick a time|book (a|your) time/i.test(head);
    const what = kind === "ai_interview" ? "an AI / video interview" : kind === "assessment" ? "an assessment" : "an interview";
    return {
      ...base,
      category: "NEXT_STEP",
      confidence: 0.85,
      nextStepKind: kind,
      needsReply,
      summary: `Invited to ${what}${company}${needsReply ? " — they ask for your availability." : "."}`,
    };
  }
  if (received && !rejected && !nextStep) {
    return { ...base, category: "APPLICATION_RECEIVED", confidence: 0.92, nextStepKind: null, needsReply: false, summary: `Application received${company}.` };
  }
  return null;
}

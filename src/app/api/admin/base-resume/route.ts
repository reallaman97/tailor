import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { extractTextFromFile, UnsupportedFileTypeError } from "@/lib/base-resume/extract-text";
import { parseBaseResume } from "@/lib/base-resume/parse";
import type { BaseResumeImport } from "@/lib/base-resume/schema";
import {
  MAX_BASE_RESUME_BYTES,
  MAX_BASE_RESUME_CHARS,
  MIN_BASE_RESUME_CHARS,
  normalizeResumeText,
  extractContact,
  checkBulletsVerbatim,
} from "@/lib/base-resume/text";
import { recordUsageEvent } from "@/lib/tailoring/usage";

// A parse is one fast model call (typically 5–20s); leave headroom for long resumes.
export const maxDuration = 120;

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Admin: read an uploaded (PDF/DOCX/TXT) or pasted base resume and parse it
 * into a draft for the review form — used both when creating a profile and
 * when replacing an existing profile's base resume. Nothing is saved here.
 * This is a route handler rather than a server action because server actions
 * cap request bodies at 1MB, and resume PDFs are often larger.
 */
export async function POST(request: Request) {
  const admin = await requireSuperAdmin();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("Upload a file or paste the resume text.");
  }

  const file = form.get("file");
  const pasted = form.get("text");
  let rawText: string;
  let fileName: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BASE_RESUME_BYTES) return error("That file is too large (max 4MB).");
    fileName = file.name || null;
    try {
      rawText = await extractTextFromFile(Buffer.from(await file.arrayBuffer()), file.name, file.type);
    } catch (err) {
      if (err instanceof UnsupportedFileTypeError) return error(err.message);
      return error("Couldn't read text from that file. Try pasting the resume text instead.");
    }
  } else if (typeof pasted === "string" && pasted.trim()) {
    rawText = pasted;
  } else {
    return error("Upload a file or paste the resume text.");
  }

  const sourceText = normalizeResumeText(rawText);
  if (sourceText.length < MIN_BASE_RESUME_CHARS) {
    return error("Almost no text could be read from that resume. If it's a scanned image, paste the text instead.");
  }
  if (sourceText.length > MAX_BASE_RESUME_CHARS) return error("That resume is too long (max 60,000 characters).");

  let parsed;
  try {
    parsed = await parseBaseResume(sourceText);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Couldn't parse the resume.", 502);
  }

  await recordUsageEvent({
    userId: admin.id,
    kind: "resume-import",
    model: parsed.model,
    inputTokens: parsed.inputTokens,
    cachedInputTokens: parsed.cachedInputTokens,
    outputTokens: parsed.outputTokens,
  }).catch(() => {});

  const result: BaseResumeImport = {
    draft: parsed.draft,
    contact: extractContact(sourceText),
    sourceText,
    fileName,
    check: checkBulletsVerbatim(parsed.draft.workHistory.flatMap((w) => w.bullets), sourceText),
  };
  return NextResponse.json(result);
}

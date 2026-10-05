import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export class UnsupportedFileTypeError extends Error {
  constructor() {
    super("Unsupported file type — upload a PDF, DOCX, or TXT file, or paste the text.");
  }
}

type FileKind = "pdf" | "docx" | "txt";

/** Browsers often send an empty or generic MIME type for DOCX, so fall back to the extension. */
function detectKind(fileName: string, mimeType: string): FileKind | null {
  const name = fileName.toLowerCase();
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (mimeType === "text/plain" || name.endsWith(".txt")) return "txt";
  return null;
}

/**
 * All text of a PDF, pages joined in order. Uses unpdf's serverless build of
 * pdf.js, which has no native dependencies — pdf-parse needs the native
 * @napi-rs/canvas binary for DOMMatrix, which isn't present on Vercel, so the
 * route crashed there with "DOMMatrix is not defined".
 */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  // pdf.js takes ownership of (detaches) the buffer it's given — pass a copy.
  const pdf = await getDocumentProxy(new Uint8Array(data));
  try {
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/** Raw text from an uploaded resume file. Throws UnsupportedFileTypeError for anything else (incl. legacy .doc). */
export async function extractTextFromFile(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const kind = detectKind(fileName, mimeType);

  if (kind === "pdf") return extractPdfText(buffer);

  if (kind === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (kind === "txt") return buffer.toString("utf8");

  throw new UnsupportedFileTypeError();
}

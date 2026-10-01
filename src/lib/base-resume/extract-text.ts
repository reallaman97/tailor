import { PDFParse } from "pdf-parse";
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

/** Raw text from an uploaded resume file. Throws UnsupportedFileTypeError for anything else (incl. legacy .doc). */
export async function extractTextFromFile(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const kind = detectKind(fileName, mimeType);

  if (kind === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (kind === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (kind === "txt") return buffer.toString("utf8");

  throw new UnsupportedFileTypeError();
}

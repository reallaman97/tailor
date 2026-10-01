import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Paragraph, TextRun, Packer } from "docx";
import { extractTextFromFile, UnsupportedFileTypeError } from "./extract-text";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function makeTestPdf(text: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 20, y: 350, size: 14, font });
  return Buffer.from(await doc.save());
}

async function makeTestDocx(text: string): Promise<Buffer> {
  const doc = new Document({
    sections: [{ children: [new Paragraph({ children: [new TextRun(text)] })] }],
  });
  return Packer.toBuffer(doc);
}

describe("extractTextFromFile", () => {
  it("extracts text from a PDF", async () => {
    const pdf = await makeTestPdf("Jane Doe - Software Engineer");
    expect(await extractTextFromFile(pdf, "resume.pdf", "application/pdf")).toContain("Jane Doe - Software Engineer");
  });

  it("extracts text from a DOCX, even when the browser sends no MIME type", async () => {
    const docx = await makeTestDocx("Jane Doe - Software Engineer");
    expect(await extractTextFromFile(docx, "resume.docx", DOCX_MIME)).toContain("Jane Doe - Software Engineer");
    expect(await extractTextFromFile(docx, "resume.docx", "")).toContain("Jane Doe - Software Engineer");
  });

  it("reads plain text files", async () => {
    expect(await extractTextFromFile(Buffer.from("Plain resume"), "resume.txt", "text/plain")).toBe("Plain resume");
  });

  it("rejects unsupported file types, including legacy .doc", async () => {
    await expect(extractTextFromFile(Buffer.from("x"), "resume.doc", "application/msword")).rejects.toThrow(
      UnsupportedFileTypeError
    );
    await expect(extractTextFromFile(Buffer.from("x"), "photo.png", "image/png")).rejects.toThrow(
      UnsupportedFileTypeError
    );
  });
});

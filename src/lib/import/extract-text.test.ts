import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Paragraph, TextRun, Packer } from "docx";
import {
  extractTextFromFile,
  UnsupportedFileTypeError,
  PDF_MIME_TYPE,
  DOCX_MIME_TYPE,
} from "./extract-text";

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
    const text = await extractTextFromFile(pdf, PDF_MIME_TYPE);
    expect(text).toContain("Jane Doe - Software Engineer");
  });

  it("extracts text from a DOCX", async () => {
    const docx = await makeTestDocx("Jane Doe - Software Engineer");
    const text = await extractTextFromFile(docx, DOCX_MIME_TYPE);
    expect(text).toContain("Jane Doe - Software Engineer");
  });

  it("rejects unsupported file types", async () => {
    await expect(
      extractTextFromFile(Buffer.from("plain text"), "text/plain")
    ).rejects.toThrow(UnsupportedFileTypeError);
  });
});

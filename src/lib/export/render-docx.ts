import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TabStopType, TextRun } from "docx";
import type { ResumeDocument } from "@/lib/export/build-document";
import { formatMonthYear, formatOptionalDateRange } from "@/lib/export/templates/format-dates";

// The tailored resume as a Word (.docx) file — what recruiters usually ask for.
// A single-column, ATS-friendly layout: real text and headings, no tables,
// text boxes, or images, so their parsers read it cleanly.

const FONT = "Calibri";
const SIZE = 21; // half-points: 10.5pt
const RIGHT_TAB = 10_080; // twips: right edge of a 7" text column (0.75" margins)

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, font: FONT })],
  });
}

/** Left text with a right-aligned part (dates), on one line. */
function splitLine(left: TextRun[], right: string | null): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
    spacing: { before: 120, after: 0 },
    children: right ? [...left, new TextRun({ text: `\t${right}`, size: SIZE, font: FONT })] : left,
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: SIZE, font: FONT })],
  });
}

function plain(text: string, opts: { italics?: boolean; after?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: opts.after ?? 40 },
    children: [new TextRun({ text, size: SIZE, font: FONT, italics: opts.italics })],
  });
}

export async function renderResumeDocx(doc: ResumeDocument): Promise<Buffer> {
  const location = [doc.city, doc.state].filter(Boolean).join(", ");
  const contact = [doc.contactEmail, doc.phone, location, doc.linkedinUrl].filter(Boolean).join("  |  ");

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: doc.fullName, bold: true, size: 36, font: FONT })],
    }),
  ];
  if (doc.headline) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: doc.headline, size: 24, font: FONT })],
      })
    );
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: contact, size: 19, font: FONT })],
    })
  );

  if (doc.summary) {
    children.push(heading("Summary"), plain(doc.summary, { after: 80 }));
  }

  if (doc.skills.length > 0) {
    children.push(heading("Skills"));
    for (const group of doc.skills) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${group.category}: `, bold: true, size: SIZE, font: FONT }),
            new TextRun({ text: group.skills.join(", "), size: SIZE, font: FONT }),
          ],
        })
      );
    }
  }

  if (doc.workHistory.length > 0) {
    children.push(heading("Experience"));
    for (const role of doc.workHistory) {
      children.push(
        splitLine(
          [
            new TextRun({ text: role.jobTitle, bold: true, size: SIZE, font: FONT }),
            new TextRun({ text: `, ${role.company}`, size: SIZE, font: FONT }),
          ],
          `${formatMonthYear(role.startDate)} - ${formatMonthYear(role.endDate)}`
        )
      );
      if (role.location) children.push(plain(role.location, { italics: true }));
      for (const b of role.bullets) children.push(bullet(b));
    }
  }

  if (doc.education.length > 0) {
    children.push(heading("Education"));
    for (const e of doc.education) {
      const title = [e.degree, e.field].filter(Boolean).join(", ");
      children.push(
        splitLine(
          [
            new TextRun({ text: title, bold: true, size: SIZE, font: FONT }),
            new TextRun({ text: `, ${e.institution}`, size: SIZE, font: FONT }),
          ],
          formatOptionalDateRange(e.startDate, e.endDate)
        )
      );
    }
  }

  if (doc.certifications.length > 0) {
    children.push(heading("Certifications"));
    for (const cert of doc.certifications) {
      const meta = [cert.issuer, cert.issueDate ? formatMonthYear(cert.issueDate) : null].filter(Boolean).join(", ");
      children.push(bullet(meta ? `${cert.name} (${meta})` : cert.name));
    }
  }

  const document = new Document({
    creator: doc.fullName,
    title: `${doc.fullName} — Resume`,
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}

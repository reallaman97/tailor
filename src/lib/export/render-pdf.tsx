import { renderToBuffer } from "@react-pdf/renderer";
import { ModernResumeTemplate } from "@/lib/export/templates/modern";
import { ClassicResumeTemplate } from "@/lib/export/templates/classic";
import type { ResumeDocument } from "@/lib/export/build-document";
import type { ResumeTemplate } from "@/generated/prisma/client";

export function renderResumePdf(
  data: ResumeDocument,
  template: ResumeTemplate = "MODERN"
): Promise<Buffer> {
  const Template = template === "CLASSIC" ? ClassicResumeTemplate : ModernResumeTemplate;
  return renderToBuffer(<Template data={data} />);
}

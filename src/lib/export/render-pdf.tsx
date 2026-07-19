import { renderToBuffer } from "@react-pdf/renderer";
import { ResumePdfTemplate } from "@/lib/export/pdf-template";
import type { ResumeDocument } from "@/lib/export/build-document";

export function renderResumePdf(data: ResumeDocument): Promise<Buffer> {
  return renderToBuffer(<ResumePdfTemplate data={data} />);
}

import { renderToBuffer } from "@react-pdf/renderer";
import { StyledResumeTemplate } from "@/lib/export/templates/styled";
import { getResumeStyle } from "@/lib/export/styles";
import type { ResumeDocument } from "@/lib/export/build-document";

/**
 * Renders a resume PDF in the given style (a key from RESUME_STYLES; unknown or
 * omitted falls back to the default). Callers pass the resume's effective style
 * — the profile's chosen style, or the app default — see effectiveStyleKey().
 */
export function renderResumePdf(data: ResumeDocument, styleKey: string = "modern"): Promise<Buffer> {
  const style = getResumeStyle(styleKey);
  return renderToBuffer(<StyledResumeTemplate data={data} style={style} />);
}

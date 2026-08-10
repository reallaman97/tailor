import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { ResumeDocument } from "@/lib/export/build-document";
import type { ResumeStyle } from "@/lib/export/styles";
import { formatMonthYear, formatOptionalDateRange } from "./format-dates";
import { WORKING_STYLE_LABEL, WORKING_TYPE_LABEL } from "@/lib/profile/work-history-constants";

function jobMeta(job: ResumeDocument["workHistory"][number]): string {
  return [
    job.location,
    job.workingType ? WORKING_TYPE_LABEL[job.workingType] : null,
    job.workingStyle ? WORKING_STYLE_LABEL[job.workingStyle] : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Renders inline **bold** emphasis (added by the AI tailoring to highlight the
 * keywords worth enhancing) as bold runs, using the style's bold font. Text is
 * split on `**…**`; those segments render bold, everything else normally. Stray
 * or unbalanced asterisks are stripped so they never show as literal characters.
 * Plain text (e.g. a legacy resume with no markers) is returned unchanged.
 */
function renderRich(text: string, boldFont: string) {
  return text.split(/(\*\*[^*]+?\*\*)/g).map((part, i) =>
    /^\*\*[^*]+?\*\*$/.test(part) ? (
      <Text key={i} style={{ fontFamily: boldFont }}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      part.replace(/\*\*/g, "")
    )
  );
}

/**
 * One ATS-safe resume template parameterized by a ResumeStyle. Single column, no
 * tables/images; only typography, color, and section-heading treatment vary by
 * style. Section order is fixed: Summary → Technical Skills → Experience →
 * Education → Certifications.
 */
function SectionHeading({ style, children }: { style: ResumeStyle; children: string }) {
  const headingSize = style.fontSize + 1;
  const label = style.headingUpper ? children.toUpperCase() : children;
  const base = { fontFamily: style.boldFont, fontSize: headingSize, marginTop: 12, marginBottom: 5 };
  switch (style.headingStyle) {
    case "bar":
      return (
        <View style={{ backgroundColor: style.accent, paddingVertical: 2, paddingHorizontal: 5, marginTop: 12, marginBottom: 6 }}>
          <Text style={{ fontFamily: style.boldFont, fontSize: headingSize, color: "#ffffff" }}>{label}</Text>
        </View>
      );
    case "leftBorder":
      return (
        <Text style={{ ...base, color: style.headingColor, borderLeft: `3pt solid ${style.accent}`, paddingLeft: 6 }}>
          {label}
        </Text>
      );
    case "underline":
      return (
        <Text style={{ ...base, color: style.headingColor, borderBottom: `1pt solid ${style.accent}`, paddingBottom: 2 }}>
          {label}
        </Text>
      );
    case "centeredUnderline":
      return (
        <Text style={{ ...base, color: style.headingColor, textAlign: "center", borderBottom: `0.75pt solid ${style.accent}`, paddingBottom: 3 }}>
          {label}
        </Text>
      );
    case "plain":
    default:
      return <Text style={{ ...base, color: style.headingColor }}>{label}</Text>;
  }
}

export function StyledResumeTemplate({ data, style }: { data: ResumeDocument; style: ResumeStyle }) {
  const s = {
    page: {
      padding: style.pagePadding,
      fontFamily: style.bodyFont,
      fontSize: style.fontSize,
      color: style.textColor,
      lineHeight: 1.35,
    },
    name: {
      fontSize: style.nameSize,
      fontFamily: style.boldFont,
      textAlign: style.nameAlign,
      color: style.textColor,
    },
    headline: {
      fontSize: style.fontSize + 1,
      fontFamily: style.boldFont,
      textAlign: style.nameAlign,
      color: style.accent,
      marginTop: 7,
    },
    contact: {
      fontSize: style.fontSize - 1,
      color: style.mutedColor,
      textAlign: style.nameAlign,
      marginTop: 12,
    },
    divider: { borderBottom: `1pt solid ${style.accent}`, marginTop: 8 },
    entry: { marginBottom: 8 },
    entryTitle: { fontSize: style.fontSize, fontFamily: style.boldFont },
    entryLine: { fontSize: style.fontSize - 0.5, color: style.mutedColor, marginTop: 1 },
    entryDateRow: { flexDirection: "row" as const, justifyContent: "space-between" as const },
    bullet: { fontSize: style.fontSize - 0.5, marginTop: 2, marginLeft: 10 },
    paragraph: { fontSize: style.fontSize - 0.5, lineHeight: 1.45 },
    skillLine: { fontSize: style.fontSize - 0.5, marginTop: 2 },
    skillCategory: { fontFamily: style.boldFont },
    section: { marginTop: 12 },
  };

  const contactParts = [
    data.contactEmail,
    data.phone,
    data.linkedinUrl,
    [data.city, data.state].filter(Boolean).join(", ") || null,
  ].filter((part): part is string => Boolean(part));

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <Text style={s.name}>{style.nameUpper ? data.fullName.toUpperCase() : data.fullName}</Text>
        {data.headline && <Text style={s.headline}>{renderRich(data.headline, style.boldFont)}</Text>}
        <Text style={s.contact}>{contactParts.join("  •  ")}</Text>
        {style.headerDivider && <View style={s.divider} />}

        {data.summary && (
          <View style={s.section}>
            <SectionHeading style={style}>Summary</SectionHeading>
            <Text style={s.paragraph}>{renderRich(data.summary, style.boldFont)}</Text>
          </View>
        )}

        {data.skills.length > 0 && (
          <View style={s.section}>
            <SectionHeading style={style}>Technical Skills</SectionHeading>
            {data.skills.map((group, i) => (
              <Text key={i} style={s.skillLine}>
                <Text style={s.skillCategory}>{group.category}: </Text>
                {group.skills.join(", ")}
              </Text>
            ))}
          </View>
        )}

        {data.workHistory.length > 0 && (
          <View style={s.section}>
            <SectionHeading style={style}>Experience</SectionHeading>
            {data.workHistory.map((job, i) => (
              <View key={i} style={s.entry}>
                <View style={s.entryDateRow}>
                  <Text style={s.entryTitle}>{job.jobTitle}</Text>
                  <Text style={s.entryLine}>
                    {formatMonthYear(job.startDate)} - {formatMonthYear(job.endDate)}
                  </Text>
                </View>
                <Text style={s.entryLine}>
                  {job.company}
                  {jobMeta(job) ? ` — ${jobMeta(job)}` : ""}
                </Text>
                {job.bullets.map((bullet, j) => (
                  <Text key={j} style={s.bullet}>
                    {style.bulletChar} {renderRich(bullet, style.boldFont)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {data.education.length > 0 && (
          <View style={s.section}>
            <SectionHeading style={style}>Education</SectionHeading>
            {data.education.map((edu, i) => (
              <View key={i} style={s.entry}>
                <View style={s.entryDateRow}>
                  <Text style={s.entryTitle}>
                    {edu.degree}
                    {edu.field ? `, ${edu.field}` : ""}
                  </Text>
                  {formatOptionalDateRange(edu.startDate, edu.endDate) && (
                    <Text style={s.entryLine}>{formatOptionalDateRange(edu.startDate, edu.endDate)}</Text>
                  )}
                </View>
                <Text style={s.entryLine}>{edu.institution}</Text>
              </View>
            ))}
          </View>
        )}

        {data.certifications.length > 0 && (
          <View style={s.section}>
            <SectionHeading style={style}>Certifications</SectionHeading>
            {data.certifications.map((cert, i) => (
              <View key={i} style={s.entry}>
                <View style={s.entryDateRow}>
                  <Text style={s.entryTitle}>{cert.name}</Text>
                  {cert.issueDate && <Text style={s.entryLine}>{formatMonthYear(cert.issueDate)}</Text>}
                </View>
                {cert.issuer && <Text style={s.entryLine}>{cert.issuer}</Text>}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

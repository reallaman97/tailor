import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ResumeDocument } from "@/lib/export/build-document";
import { formatMonthYear, formatOptionalDateRange } from "./format-dates";
import { WORKING_STYLE_LABEL, WORKING_TYPE_LABEL } from "@/lib/profile/work-history-constants";

function jobMeta(job: ResumeDocument["workHistory"][number]): string {
  return [
    job.location,
    job.workingType ? WORKING_TYPE_LABEL[job.workingType] : null,
    job.workingStyle ? WORKING_STYLE_LABEL[job.workingStyle] : null,
  ]
    .filter(Boolean)
    .join(", ");
}

// Same ATS-friendly constraint as the Modern template (single column, no
// tables/images) — this is a visual variant only, ordering/content is
// identical to what buildResumeDocument produced.
const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Times-Roman", fontSize: 10.5, color: "#1a1a1a" },
  name: {
    fontSize: 22,
    fontFamily: "Times-Bold",
    textAlign: "center",
  },
  contactLine: {
    fontSize: 9.5,
    color: "#333",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  divider: { borderBottom: "1.5pt solid #1a1a1a", marginBottom: 14 },
  sectionHeading: {
    fontSize: 11,
    fontFamily: "Times-Bold",
    textAlign: "center",
    marginTop: 14,
    marginBottom: 8,
    borderBottom: "0.75pt solid #1a1a1a",
    paddingBottom: 3,
  },
  entry: { marginBottom: 9 },
  entryTitleRow: { flexDirection: "row", justifyContent: "space-between" },
  entryTitle: { fontSize: 10.5, fontFamily: "Times-Bold" },
  entryDate: { fontSize: 9.5, fontFamily: "Times-Italic", color: "#333" },
  entryLine: { fontSize: 9.5, fontFamily: "Times-Italic", color: "#333", marginTop: 1 },
  bullet: { fontSize: 9.5, marginTop: 3, marginLeft: 12 },
  paragraph: { fontSize: 9.5, lineHeight: 1.45, textAlign: "center" },
  skillRow: { flexDirection: "row", fontSize: 9.5, marginTop: 2 },
  skillCategory: { fontFamily: "Times-Bold" },
});

export function ClassicResumeTemplate({ data }: { data: ResumeDocument }) {
  const contactParts = [
    data.contactEmail,
    data.phone,
    data.linkedinUrl,
    [data.city, data.state].filter(Boolean).join(", ") || null,
  ].filter((part): part is string => Boolean(part));

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{data.fullName.toUpperCase()}</Text>
        <Text style={styles.contactLine}>{contactParts.join("  •  ")}</Text>
        <View style={styles.divider} />

        {data.summary && (
          <View>
            <Text style={styles.sectionHeading}>SUMMARY</Text>
            <Text style={styles.paragraph}>{data.summary}</Text>
          </View>
        )}

        {data.skills.length > 0 && (
          <View>
            <Text style={styles.sectionHeading}>TECHNICAL SKILLS</Text>
            {data.skills.map((group, i) => (
              <View key={i} style={styles.skillRow}>
                <Text>
                  <Text style={styles.skillCategory}>{group.category}: </Text>
                  {group.skills.join(", ")}
                </Text>
              </View>
            ))}
          </View>
        )}

        {data.workHistory.length > 0 && (
          <View>
            <Text style={styles.sectionHeading}>EXPERIENCE</Text>
            {data.workHistory.map((job, i) => (
              <View key={i} style={styles.entry}>
                <View style={styles.entryTitleRow}>
                  <Text style={styles.entryTitle}>{job.jobTitle}</Text>
                  <Text style={styles.entryDate}>
                    {formatMonthYear(job.startDate)} - {formatMonthYear(job.endDate)}
                  </Text>
                </View>
                <Text style={styles.entryLine}>
                  {job.company}
                  {jobMeta(job) ? `, ${jobMeta(job)}` : ""}
                </Text>
                {job.bullets.map((bullet, j) => (
                  <Text key={j} style={styles.bullet}>
                    – {bullet}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {data.education.length > 0 && (
          <View>
            <Text style={styles.sectionHeading}>EDUCATION</Text>
            {data.education.map((edu, i) => (
              <View key={i} style={styles.entry}>
                <View style={styles.entryTitleRow}>
                  <Text style={styles.entryTitle}>
                    {edu.degree}
                    {edu.field ? `, ${edu.field}` : ""}
                  </Text>
                  {formatOptionalDateRange(edu.startDate, edu.endDate) && (
                    <Text style={styles.entryDate}>
                      {formatOptionalDateRange(edu.startDate, edu.endDate)}
                    </Text>
                  )}
                </View>
                <Text style={styles.entryLine}>{edu.institution}</Text>
              </View>
            ))}
          </View>
        )}

        {data.certifications.length > 0 && (
          <View>
            <Text style={styles.sectionHeading}>CERTIFICATIONS</Text>
            {data.certifications.map((cert, i) => (
              <View key={i} style={styles.entry}>
                <View style={styles.entryTitleRow}>
                  <Text style={styles.entryTitle}>{cert.name}</Text>
                  {cert.issueDate && <Text style={styles.entryDate}>{formatMonthYear(cert.issueDate)}</Text>}
                </View>
                {cert.issuer && <Text style={styles.entryLine}>{cert.issuer}</Text>}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

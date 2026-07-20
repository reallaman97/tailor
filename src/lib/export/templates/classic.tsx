import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ResumeDocument } from "@/lib/export/build-document";
import { formatMonthYear, formatOptionalDateRange } from "./format-dates";

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
                  {job.location ? `, ${job.location}` : ""}
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

        {data.skills.length > 0 && (
          <View>
            <Text style={styles.sectionHeading}>SKILLS</Text>
            <Text style={styles.paragraph}>{data.skills.join(" • ")}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ResumeDocument } from "@/lib/export/build-document";
import { formatMonthYear, formatOptionalDateRange } from "./format-dates";

// ATS-friendly by construction: single column, no tables, no images, no
// side-by-side text (PDF text extraction follows draw order, not visual
// position, so anything laid out as columns can read out of order to a
// parser) — every field is its own full-width line, standard Helvetica.
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#111" },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  contactLine: { fontSize: 9, color: "#333", marginBottom: 16 },
  sectionHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
    borderBottom: "1pt solid #999",
    paddingBottom: 2,
  },
  entry: { marginBottom: 8 },
  entryTitle: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  entryLine: { fontSize: 9.5, color: "#333", marginTop: 1 },
  bullet: { fontSize: 9.5, marginTop: 3, marginLeft: 10 },
  paragraph: { fontSize: 9.5, lineHeight: 1.4 },
});

export function ModernResumeTemplate({ data }: { data: ResumeDocument }) {
  const contactParts = [
    data.contactEmail,
    data.phone,
    data.linkedinUrl,
    [data.city, data.state].filter(Boolean).join(", ") || null,
  ].filter((part): part is string => Boolean(part));

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{data.fullName}</Text>
        <Text style={styles.contactLine}>{contactParts.join("  |  ")}</Text>

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
                <Text style={styles.entryTitle}>{job.jobTitle}</Text>
                <Text style={styles.entryLine}>
                  {job.company}
                  {job.location ? ` — ${job.location}` : ""}
                </Text>
                <Text style={styles.entryLine}>
                  {formatMonthYear(job.startDate)} - {formatMonthYear(job.endDate)}
                </Text>
                {job.bullets.map((bullet, j) => (
                  <Text key={j} style={styles.bullet}>
                    • {bullet}
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
                <Text style={styles.entryTitle}>
                  {edu.degree}
                  {edu.field ? `, ${edu.field}` : ""}
                </Text>
                <Text style={styles.entryLine}>{edu.institution}</Text>
                {formatOptionalDateRange(edu.startDate, edu.endDate) && (
                  <Text style={styles.entryLine}>
                    {formatOptionalDateRange(edu.startDate, edu.endDate)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {data.skills.length > 0 && (
          <View>
            <Text style={styles.sectionHeading}>SKILLS</Text>
            <Text style={styles.paragraph}>{data.skills.join(", ")}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

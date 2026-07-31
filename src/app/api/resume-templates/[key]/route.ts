import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { renderResumePdf } from "@/lib/export/render-pdf";
import { getResumeStyle } from "@/lib/export/styles";
import type { ResumeDocument } from "@/lib/export/build-document";

/** A representative sample resume used to preview a style in the templates catalog. */
const SAMPLE: ResumeDocument = {
  fullName: "Jordan Avery",
  contactEmail: "jordan.avery@example.com",
  phone: "(555) 010-2048",
  linkedinUrl: "linkedin.com/in/jordanavery",
  city: "Austin",
  state: "TX",
  summary:
    "Senior software engineer with 10+ years building scalable backend systems and cloud-native platforms. Specializes in distributed services, API design, and CI/CD, with a track record of leading cross-functional delivery in fintech and SaaS.",
  skills: [
    { category: "Languages", skills: ["TypeScript", "Python", "Go", "SQL"] },
    { category: "Backend", skills: ["Node.js", "PostgreSQL", "Redis", "gRPC", "REST APIs"] },
    { category: "Cloud & DevOps", skills: ["AWS", "Docker", "Kubernetes", "Terraform", "GitHub Actions"] },
    { category: "Practices", skills: ["Microservices", "Observability", "TDD", "Code Review"] },
  ],
  workHistory: [
    {
      company: "Northwind Labs",
      jobTitle: "Staff Software Engineer",
      location: "Remote",
      workingStyle: "FULL_TIME",
      workingType: "REMOTE",
      startDate: "2021-03",
      endDate: null,
      bullets: [
        "Led the migration of a monolith to event-driven microservices, cutting deploy time by 60%.",
        "Designed public REST and gRPC APIs consumed by 40+ internal teams.",
        "Introduced structured logging and tracing, reducing mean time to resolution for incidents.",
      ],
    },
    {
      company: "Globex",
      jobTitle: "Senior Backend Engineer",
      location: "Austin, TX",
      workingStyle: "FULL_TIME",
      workingType: "HYBRID",
      startDate: "2017-06",
      endDate: "2021-02",
      bullets: [
        "Built a payments service processing millions of transactions per month.",
        "Optimized slow database queries, improving p95 latency across core endpoints.",
      ],
    },
  ],
  education: [
    { institution: "State University", degree: "B.S.", field: "Computer Science", startDate: "2010-09", endDate: "2014-05" },
  ],
  certifications: [
    { name: "AWS Certified Solutions Architect – Associate", issuer: "Amazon Web Services", issueDate: "2022-06" },
  ],
};

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  await requireSuperAdmin();

  const style = getResumeStyle(key);
  const pdf = await renderResumePdf(SAMPLE, style.key);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="sample-${style.key}.pdf"`,
    },
  });
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getResume } from "@/lib/resumes/resumes";
import { getResumeFields } from "@/lib/profile/resume-fields";
import { getTailoredContent } from "@/lib/tailoring/tailor-resume";
import { GenerateButton } from "./generate-button";

export default async function ResumeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const resume = await getResume(user.id, id);
  if (!resume) notFound();

  const [resumeFields, tailoredContent] = await Promise.all([
    getResumeFields(user.id),
    getTailoredContent(user.id, id),
  ]);

  const workHistoryById = new Map((resumeFields?.workHistory ?? []).map((w) => [w.id, w]));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {resume.jobTitle} — {resume.companyName}
        </h1>
        <Link href="/dashboard" className="text-sm underline">
          Back to dashboard
        </Link>
      </div>

      <section className="flex flex-col gap-2 rounded border p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
          <span>Status: {resume.status}</span>
          {resume.jobLink && (
            <a href={resume.jobLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              View posting
            </a>
          )}
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium">Job description</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{resume.jobDescription}</p>
        </details>
      </section>

      {!resumeFields && (
        <p className="rounded border border-dashed p-3 text-sm text-gray-600">
          Save your personal info on your{" "}
          <Link href="/profile" className="underline">
            profile
          </Link>{" "}
          before generating a tailored resume.
        </p>
      )}

      <div className="flex items-center gap-3">
        <GenerateButton resumeId={resume.id} hasContent={!!tailoredContent} />
        {resumeFields && (
          <a
            href={`/resumes/${resume.id}/pdf`}
            className="self-start rounded border px-3 py-2 text-sm"
          >
            Download PDF
          </a>
        )}
      </div>

      {tailoredContent && (
        <section className="flex flex-col gap-4 rounded border p-4">
          <div className="text-xs text-gray-500">
            Generated {resume.generatedAt?.toLocaleString()}
            {resume.modelUsed && ` · model ${resume.modelUsed}`}
          </div>

          <div>
            <h2 className="text-lg font-semibold">Summary</h2>
            <p className="text-sm">{tailoredContent.summary}</p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Work history</h2>
            {tailoredContent.workHistory.map((entry) => {
              const source = workHistoryById.get(entry.entryId);
              return (
                <div key={entry.entryId} className="flex flex-col gap-1">
                  <p className="font-medium">
                    {source ? `${source.jobTitle} — ${source.company}` : "Unknown entry"}
                  </p>
                  <ul className="list-inside list-disc text-sm">
                    {entry.bullets.map((bullet, i) => (
                      <li key={i}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div>
            <h2 className="text-lg font-semibold">Skills</h2>
            <p className="text-sm">{tailoredContent.orderedSkills.join(", ")}</p>
          </div>
        </section>
      )}
    </main>
  );
}

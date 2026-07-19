import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { signOutAction } from "@/lib/auth/actions";
import { listResumes } from "@/lib/resumes/resumes";
import { StatusSelect } from "./status-select";
import { deleteResumeAction } from "./actions";

export default async function DashboardPage() {
  // Real enforcement — proxy.ts only redirects page navigations.
  const user = await requireUser();
  const resumes = await listResumes(user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-600">Signed in as {user.email}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/profile" className="rounded border px-3 py-2 text-sm">
            Edit profile
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="rounded border px-3 py-2 text-sm">
              Log out
            </button>
          </form>
        </div>
      </div>

      <Link
        href="/resumes/new"
        className="self-start rounded bg-black px-3 py-2 text-sm text-white"
      >
        Track a new application
      </Link>

      {resumes.length === 0 ? (
        <p className="rounded border border-dashed p-4 text-sm text-gray-600">
          No applications tracked yet.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-2 pr-3">Company</th>
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Created</th>
              <th className="py-2 pr-3">Link</th>
              <th className="py-2 pr-3" />
            </tr>
          </thead>
          <tbody>
            {resumes.map((resume) => (
              <tr key={resume.id} className="border-b">
                <td className="py-2 pr-3">{resume.companyName}</td>
                <td className="py-2 pr-3">{resume.jobTitle}</td>
                <td className="py-2 pr-3">
                  <StatusSelect resumeId={resume.id} status={resume.status} />
                </td>
                <td className="py-2 pr-3 text-gray-600">
                  {resume.createdAt.toLocaleDateString()}
                </td>
                <td className="py-2 pr-3">
                  {resume.jobLink ? (
                    <a
                      href={resume.jobLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Posting
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/resumes/${resume.id}`} className="text-blue-600 underline">
                      View
                    </Link>
                    <form action={deleteResumeAction.bind(null, resume.id)}>
                      <button type="submit" className="text-red-600 underline">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

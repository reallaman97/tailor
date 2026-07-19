import { requireUser } from "@/lib/auth/require-user";
import { ImportFlow } from "./import-flow";

export default async function ImportResumePage() {
  await requireUser();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Import from an existing resume</h1>
      <p className="text-sm text-gray-600">
        Upload a PDF or DOCX resume. An AI model will extract your info into a draft you can
        review and edit before anything is saved to your profile.
      </p>

      <ImportFlow />
    </main>
  );
}

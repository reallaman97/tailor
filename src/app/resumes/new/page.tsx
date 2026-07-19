import { requireUser } from "@/lib/auth/require-user";
import { NewResumeForm } from "./new-resume-form";

export default async function NewResumePage() {
  await requireUser();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Track a new application</h1>
      <NewResumeForm />
    </main>
  );
}

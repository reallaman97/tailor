// Shared (non-server-action) types + helpers for the resume builder forms.
// These can't live in the "use server" action files, which may only export
// async server actions.

export type NewResumeValues = {
  companyName: string;
  jobTitle: string;
  jobLink: string;
  jobDescription: string;
};

// On success `resumeId` is returned so the form can download the PDF and prompt
// for proof of application. If the build fails, nothing is recorded in the
// tracker (the just-created row is rolled back) and only `error` + `values` are
// returned — `values` echoes the submitted fields so the form keeps them
// (React resets a <form action> after it runs) and the user can just retry.
export type NewResumeState =
  | { error?: string; resumeId?: string; values?: NewResumeValues; duplicateId?: string }
  | undefined;

export function readResumeValues(formData: FormData): NewResumeValues {
  return {
    companyName: String(formData.get("companyName") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    jobLink: String(formData.get("jobLink") ?? ""),
    jobDescription: String(formData.get("jobDescription") ?? ""),
  };
}

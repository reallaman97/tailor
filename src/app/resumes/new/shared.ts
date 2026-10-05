// Shared (non-server-action) types for the resume builder forms. These can't
// live in the "use server" action files, which may only export async server
// actions.

// Building is two steps (see src/lib/resumes/build.ts): the form's action
// validates the job and creates the application — returning `createdId` — and
// the page then runs the slow, stoppable build against it. A duplicate returns
// the existing application's id so the form can link to it.
export type CreateApplicationResult = { createdId?: string; error?: string; duplicateId?: string };

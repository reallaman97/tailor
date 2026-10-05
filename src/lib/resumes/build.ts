import { db } from "@/lib/db";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { scopeFilter, ResumeNotFoundError } from "@/lib/resumes/resumes";
import { classifyRoleTrack } from "@/lib/resumes/classify-role-track";
import { tailorResume, ProfileIncompleteError } from "@/lib/tailoring/tailor-resume";
import { GenerationStoppedError } from "@/lib/tailoring/generate";

// Building an application's resume, and canceling an application.
//
// A build is two requests: the form's server action validates the job and
// creates the application (fast — duplicate check, no tokens), then the page
// POSTs /api/resumes/[id]/build for the slow AI call. The build runs in a
// route handler, not a server action, because Next.js runs a page's server
// actions one at a time — a "Stop" click must not queue behind the build it's
// stopping — and because a route sees the browser abort the request, which
// cancels the in-flight DeepSeek call.

type Viewer = { id: string; role: string };

export class ApplicationCancelError extends Error {}

const TARGET_SELECT = {
  id: true,
  userId: true,
  jobTitle: true,
  jobDescription: true,
  statuses: true,
  screenshotMimeType: true,
  tailoredContentEnc: true,
} as const;

/** The application if the viewer may act on it: admins any, others within their profile scope. */
async function findTarget(viewer: Viewer, resumeId: string) {
  const where = hasTeamAdminPower(viewer.role) ? { id: resumeId } : { id: resumeId, ...(await scopeFilter(viewer.id)) };
  return db.resume.findFirst({ where, select: TARGET_SELECT });
}

export type BuildResult = { ok: true } | { ok: false; stopped?: boolean; error: string };

/**
 * Generates the tailored resume for a just-created application, classifying
 * its role track alongside (best-effort). Only an application that has never
 * been built and isn't canceled can be built — a page reload can't re-spend
 * tokens on one that already has its resume.
 *
 * If generation fails, the application is removed from the tracker (the user
 * fixes the problem and builds again). If the user stopped it, it's already
 * marked Canceled by cancelApplication and is kept.
 */
export async function buildApplication(viewer: Viewer, resumeId: string, signal?: AbortSignal): Promise<BuildResult> {
  const target = await findTarget(viewer, resumeId);
  if (!target) throw new ResumeNotFoundError();
  if (target.statuses.includes("CANCELED")) return { ok: false, stopped: true, error: "This application was canceled." };
  if (target.tailoredContentEnc) return { ok: true };

  try {
    await Promise.all([
      // Tailor as the application's owner — for an admin build that's the
      // profile's account, whose scope (and profile key) the resume belongs to.
      tailorResume(target.userId, resumeId, signal),
      classifyRoleTrack(target.jobTitle, target.jobDescription)
        .then((roleTrack) => (roleTrack !== "OTHER" ? db.resume.update({ where: { id: resumeId }, data: { roleTrack } }) : null))
        .catch(() => {}),
    ]);
    return { ok: true };
  } catch (err) {
    // Roll back a failed build, but never a canceled application — that one
    // the user chose to keep on record.
    await db.resume
      .deleteMany({ where: { id: resumeId, NOT: { statuses: { has: "CANCELED" } } } })
      .catch(() => {});
    if (err instanceof GenerationStoppedError || signal?.aborted) {
      return { ok: false, stopped: true, error: "Generation stopped." };
    }
    if (err instanceof ProfileIncompleteError) return { ok: false, error: err.message };
    console.error("Resume tailoring failed:", err);
    return { ok: false, error: `Tailoring failed: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}

/**
 * Marks an application Canceled — the candidate decided not to apply. It
 * stays on record (admins see it, and the tokens it used), but no longer
 * counts toward "one application per company". Once proof of application is
 * uploaded it was actually submitted, so only an admin can cancel it then.
 */
export async function cancelApplication(viewer: Viewer, resumeId: string): Promise<void> {
  const target = await findTarget(viewer, resumeId);
  if (!target) throw new ResumeNotFoundError();
  if (target.statuses.includes("CANCELED")) return;
  if (target.screenshotMimeType && !hasTeamAdminPower(viewer.role)) {
    throw new ApplicationCancelError(
      "Proof of application is already uploaded, so this was submitted — ask an admin to cancel it."
    );
  }
  await db.resume.update({ where: { id: resumeId }, data: { statuses: ["CANCELED"] } });
}

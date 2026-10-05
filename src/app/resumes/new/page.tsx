import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { listAllProfiles } from "@/lib/admin/profiles";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { getResume } from "@/lib/resumes/resumes";
import { getApplicationDetail } from "@/lib/admin/applications";
import { getProfileNames } from "@/lib/profile/personal-info";
import { getAssistData } from "@/lib/assist/store";
import { NewResumeForm } from "./new-resume-form";
import { AdminNewResumeForm } from "./admin-new-resume-form";
import { ApplicationWorkspace, type WorkspaceApplication } from "./application-workspace";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { getBaseResumeStatus } from "@/lib/base-resume/status";

// Resume generation (createResumeAction / admin build) runs the DeepSeek
// thinking-mode call inline — typically 40–90s, occasionally longer. 300s is
// the Vercel ceiling with Fluid compute (the default); the SDK call itself is
// capped at 240s (generate.ts) so it fails cleanly before this limit. The
// workstation's cover-letter / Ask AI actions also run on this route.
export const maxDuration = 300;

/**
 * The application whose workstation to show (`?app=<id>`), if the viewer may
 * open it and its resume has been built — the same access rule as its detail
 * page. Null otherwise (the builder form is shown instead).
 */
async function loadWorkspace(user: { id: string }, isSuperAdmin: boolean, appId: string) {
  const app = isSuperAdmin ? await getApplicationDetail(appId) : await getResume(user.id, appId);
  if (!app || !app.tailoredContentEnc) return null;

  const [assist, names] = await Promise.all([
    getAssistData(app.id, app.profileId),
    app.profileId ? getProfileNames([app.profileId]) : Promise.resolve(new Map<string, string>()),
  ]);
  const workspaceApp: WorkspaceApplication = {
    id: app.id,
    companyName: app.companyName,
    jobTitle: app.jobTitle,
    jobLink: app.jobLink,
    hasScreenshot: app.hasScreenshot,
    canceled: app.statuses.includes("CANCELED"),
    canCancel: !app.statuses.includes("CANCELED") && (isSuperAdmin || !app.hasScreenshot),
    candidateName: app.profileId ? (names.get(app.profileId) ?? null) : null,
  };
  return { app: workspaceApp, assist };
}

export default async function NewResumePage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  const [{ app: appId }, user] = await Promise.all([searchParams, requireResumePlatformAccess()]);
  const isSuperAdmin = hasTeamAdminPower(user.role);

  const workspace = appId ? await loadWorkspace(user, isSuperAdmin, appId) : null;

  if (workspace) {
    return (
      <AppShell userEmail={user.email} isSuperAdmin={isSuperAdmin} wide>
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Resume Builder"
            description="Everything for this application in one place — resume, cover letter, form answers, and proof."
          />
          <ApplicationWorkspace
            app={workspace.app}
            assist={workspace.assist}
            // Proof is uploaded by an account in the application's profile; an admin
            // building on someone's behalf isn't one (the upload is profile-scoped).
            canUploadProof={!isSuperAdmin}
          />
        </div>
      </AppShell>
    );
  }

  const buildableProfiles = isSuperAdmin
    ? (await listAllProfiles())
        .filter((p) => p.assignedUsers.length > 0)
        .map((p) => ({
          id: p.id,
          fullName: p.fullName,
          userCount: p.assignedUsers.length,
          hasBaseResume: p.baseResumeImportedAt !== null,
        }))
    : null;

  // A bidder can only build once an admin has imported their profile's base
  // resume — tailoring needs the full original resume to work from.
  const assignedProfileId = isSuperAdmin ? null : await getAssignedProfileId(user.id);
  const bidderBlocked = !isSuperAdmin && (!assignedProfileId || !(await getBaseResumeStatus(assignedProfileId)));

  return (
    <AppShell userEmail={user.email} isSuperAdmin={isSuperAdmin}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <PageHeader
          title="Resume Builder"
          description={
            isSuperAdmin
              ? "Build a tailored resume on behalf of any profile with an assigned account."
              : "Paste the company, title, and job description — build a tailored resume, then finish the application right here."
          }
        />
        {appId && (
          <Alert>That application isn&apos;t available here — it may not exist, or its resume wasn&apos;t built.</Alert>
        )}
        <Card>
          <CardContent className="pt-6">
            {isSuperAdmin && buildableProfiles ? (
              <AdminNewResumeForm profiles={buildableProfiles} />
            ) : bidderBlocked ? (
              <Alert>
                {assignedProfileId
                  ? "Your profile doesn't have a base resume yet. An administrator needs to upload your full resume before tailored resumes can be built."
                  : "Your profile hasn't been set up yet. Contact an administrator."}
              </Alert>
            ) : (
              <NewResumeForm />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

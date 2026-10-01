import { requireServiceAdmin } from "@/lib/auth/team-context";
import { getSettings } from "@/lib/settings";
import { SAMPLE_CANDIDATE } from "@/lib/tailoring/debug";
import { getResumePromptFingerprint } from "@/lib/tailoring/resume-prompt";
import { PlatformShell } from "@/components/platform-shell";
import { PageHeader } from "@/components/page-header";
import { TailoringDebugView } from "./tailoring-view";

const SAMPLE_JOB_DESCRIPTION = `Senior Backend Engineer

We're hiring a Senior Backend Engineer to design and scale our cloud platform. You'll build and operate microservices, own APIs end to end, and drive reliability.

Requirements:
- 6+ years building backend services in Go or Node.js
- Strong experience with Kubernetes, Docker, and AWS
- Designing REST/gRPC APIs and event-driven systems
- CI/CD, observability, and infrastructure as code (Terraform)
- PostgreSQL and performance tuning`;

export default async function TailoringDebugPage() {
  const ctx = await requireServiceAdmin();
  const settings = await getSettings(ctx.activeTeamId);
  const teamName = ctx.teams.find((t) => t.id === ctx.activeTeamId)?.name ?? null;

  return (
    <PlatformShell wide>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Resume tailoring debug"
          description="Run the real resume generation (managed prompt on DeepSeek) against a sample candidate and inspect the full response. Save the model to the active team when you're happy with it."
        />
        <TailoringDebugView
          teamName={teamName}
          defaultModel={settings.resumeModel}
          promptFingerprint={getResumePromptFingerprint()}
          deepSeekKeyConfigured={Boolean(process.env.DEEPSEEK_API_KEY?.trim())}
          sampleCandidateJson={JSON.stringify(SAMPLE_CANDIDATE, null, 2)}
          sampleJobDescription={SAMPLE_JOB_DESCRIPTION}
        />
      </div>
    </PlatformShell>
  );
}

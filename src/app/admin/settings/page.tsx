import { requireTeamAdmin } from "@/lib/auth/team-context";
import { getSettings } from "@/lib/settings";
import { AccountShell } from "@/components/account-shell";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const ctx = await requireTeamAdmin();
  const settings = await getSettings(ctx.activeTeamId);

  return (
    <AccountShell isSuperAdmin>
      <div className="flex flex-col gap-6">
        <PageHeader title="Settings" description="Configuration for your team — resume generation model, PDF template, and its own OpenAI key." />
        <SettingsForm settings={settings} />
      </div>
    </AccountShell>
  );
}

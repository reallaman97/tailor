import { requireSuperAdmin } from "@/lib/auth/require-user";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

export default async function AdminSettingsPage() {
  const admin = await requireSuperAdmin();
  const settings = await getSettings();

  return (
    <AppShell userEmail={admin.email} isSuperAdmin>
      <div className="flex flex-col gap-6">
        <PageHeader title="Settings" description="App-wide configuration for superadmins." />
        <SettingsForm settings={settings} />
      </div>
    </AppShell>
  );
}

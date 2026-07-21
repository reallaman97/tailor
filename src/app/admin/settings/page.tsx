import { requireSuperAdmin } from "@/lib/auth/require-user";
import { getSettings } from "@/lib/settings";
import { AccountShell } from "@/components/account-shell";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const settings = await getSettings();

  return (
    <AccountShell isSuperAdmin>
      <div className="flex flex-col gap-6">
        <PageHeader title="Settings" description="App-wide configuration for the Resume Platform." />
        <SettingsForm settings={settings} />
      </div>
    </AccountShell>
  );
}

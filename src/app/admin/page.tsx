import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { getAdminStats } from "@/lib/admin/stats";
import { AccountShell } from "@/components/account-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UsersIcon, SettingsIcon, FolderIcon, CalendarIcon, FileTextIcon, ArrowRightIcon } from "@/components/icons";

export default async function AdminPanelPage() {
  await requireSuperAdmin();
  const stats = await getAdminStats();

  const tiles = [
    { label: "Total users", value: stats.totalUsers },
    { label: "Pending approval", value: stats.pendingApprovals, highlight: stats.pendingApprovals > 0 },
    { label: "Managers", value: stats.usersByRole.MANAGER },
    { label: "Callers", value: stats.usersByRole.CALLER },
    { label: "Profiles", value: stats.totalProfiles },
    { label: "Applications", value: stats.totalApplications },
    { label: "Interviews", value: stats.totalInterviews },
    { label: "Bidders", value: stats.usersByRole.BIDDER },
  ];

  const sections = [
    {
      href: "/admin/users",
      title: "Users",
      description: "Create, edit, approve, assign roles, and remove accounts.",
      icon: UsersIcon,
    },
    {
      href: "/admin/settings",
      title: "Settings",
      description: "OpenAI model & key, resume template, and other app-wide config.",
      icon: SettingsIcon,
    },
    {
      href: "/admin/profiles",
      title: "Profiles",
      description: "Curate candidate profiles and assign them to accounts.",
      icon: FolderIcon,
    },
    {
      href: "/admin/templates",
      title: "Resume Templates",
      description: "Browse the 10 built-in PDF styles and assign one per profile.",
      icon: FileTextIcon,
    },
    {
      href: "/interview/settings",
      title: "Interview Settings",
      description: "Timezone, interview stages, statuses, and meeting types.",
      icon: CalendarIcon,
    },
    {
      href: "/dashboard",
      title: "Resume Dashboard",
      description: "Org-wide application analytics and the applications tracker.",
      icon: FileTextIcon,
    },
  ];

  return (
    <AccountShell isSuperAdmin wide>
      <div className="flex flex-col gap-6">
        <PageHeader title="Admin Panel" description="Overview and management for the whole platform." />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <Card key={t.label}>
              <CardContent className="pt-6">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.label}</p>
                <p className={t.highlight ? "mt-1 text-2xl font-semibold text-warning" : "mt-1 text-2xl font-semibold text-foreground"}>
                  {t.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className="group">
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <s.icon className="size-4" />
                    </span>
                    <CardTitle>{s.title}</CardTitle>
                  </div>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center gap-1 text-sm text-primary">
                    Open
                    <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AccountShell>
  );
}

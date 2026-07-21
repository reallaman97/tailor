"use client";

import { SidebarShell, type ShellNavLink } from "@/components/sidebar-shell";
import { LayoutDashboardIcon, FileTextIcon, SparklesIcon } from "@/components/icons";

const DASHBOARD: ShellNavLink = { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon };
const RESUME_BUILDER: ShellNavLink = { href: "/resumes/new", label: "Resume Builder", icon: SparklesIcon };
const APPLICATIONS: ShellNavLink = { href: "/resumes", label: "Applications", icon: FileTextIcon };

/**
 * Resume Platform's shell. Dashboard is superadmin-only (an org-wide aggregate,
 * not a personal view). "Your profile" and "Settings" no longer live in the nav
 * — they're merged into the My Account page, reached from the top-bar account
 * icon.
 *
 * `userEmail` is accepted for call-site compatibility but no longer displayed;
 * identity/account controls live in the top bar.
 */
export function AppShell({
  isSuperAdmin = false,
  wide = false,
  children,
}: {
  userEmail: string;
  isSuperAdmin?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const links = isSuperAdmin ? [DASHBOARD, RESUME_BUILDER, APPLICATIONS] : [RESUME_BUILDER, APPLICATIONS];

  return (
    <SidebarShell
      toolLabel="Resume Platform"
      toolHref={isSuperAdmin ? "/dashboard" : "/resumes"}
      links={links}
      wide={wide}
    >
      {children}
    </SidebarShell>
  );
}

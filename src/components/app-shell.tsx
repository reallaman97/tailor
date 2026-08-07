"use client";

import { SidebarShell, type ShellNavLink } from "@/components/sidebar-shell";
import { LayoutDashboardIcon, FileTextIcon, SparklesIcon, CheckCircleIcon, DollarSignIcon } from "@/components/icons";

const DASHBOARD: ShellNavLink = { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon };
const RESUME_BUILDER: ShellNavLink = { href: "/resumes/new", label: "Resume Builder", icon: SparklesIcon };
const APPLICATIONS: ShellNavLink = { href: "/resumes", label: "Applications", icon: FileTextIcon };
const CHECKS: ShellNavLink = { href: "/checks", label: "Application Checks", icon: CheckCircleIcon };
const RATES: ShellNavLink = { href: "/rates", label: "Bidder Rates", icon: DollarSignIcon };

/**
 * Resume Platform's shell. Dashboard is superadmin-only (an org-wide aggregate,
 * not a personal view). "Your profile" and "Settings" no longer live in the nav
 * — they're merged into the My Account page, reached from the top-bar account
 * icon.
 *
 * `userEmail` is accepted for call-site compatibility but no longer displayed;
 * identity/account controls live in the top bar.
 *
 * Both admins and bidders get a Dashboard link (admins → org-wide aggregate,
 * bidders → their personal applications-and-earnings view); admins additionally
 * get Application Checks and Bidder Rates.
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
  const links = isSuperAdmin
    ? [DASHBOARD, RESUME_BUILDER, APPLICATIONS, CHECKS, RATES]
    : [DASHBOARD, RESUME_BUILDER, APPLICATIONS];

  return (
    <SidebarShell
      toolLabel="Resume Platform"
      toolHref="/dashboard"
      links={links}
      wide={wide}
    >
      {children}
    </SidebarShell>
  );
}

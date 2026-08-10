"use client";

import { SidebarShell, type ShellNavLink } from "@/components/sidebar-shell";
import { UsersIcon, LayoutDashboardIcon, SparklesIcon } from "@/components/icons";

const TEAMS: ShellNavLink = { href: "/platform/teams", label: "Teams", icon: LayoutDashboardIcon };
const USERS: ShellNavLink = { href: "/platform/users", label: "Users", icon: UsersIcon };
const TAILORING: ShellNavLink = { href: "/platform/tailoring", label: "Tailoring Debug", icon: SparklesIcon };

/** Platform-owner (Service Real Admin) shell. */
export function PlatformShell({ wide = false, children }: { wide?: boolean; children: React.ReactNode }) {
  return (
    <SidebarShell toolLabel="Platform Admin" toolHref="/platform/teams" links={[TEAMS, USERS, TAILORING]} wide={wide}>
      {children}
    </SidebarShell>
  );
}

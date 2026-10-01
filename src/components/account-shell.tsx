"use client";

import { SidebarShell, type ShellNavLink } from "@/components/sidebar-shell";
import { UserIcon, SettingsIcon, UsersIcon, ShieldIcon, FileTextIcon } from "@/components/icons";

const MY_ACCOUNT: ShellNavLink = { href: "/account", label: "My Account", icon: UserIcon };
const ADMIN: ShellNavLink = { href: "/admin", label: "Admin Panel", icon: ShieldIcon };
const SETTINGS: ShellNavLink = { href: "/admin/settings", label: "Settings", icon: SettingsIcon };
const USERS: ShellNavLink = { href: "/admin/users", label: "Users", icon: UsersIcon };
const TEMPLATES: ShellNavLink = { href: "/admin/templates", label: "Templates", icon: FileTextIcon };

/**
 * Shell for the "My Account" area. Everyone gets their account page; a
 * superadmin additionally manages Settings, Users, and Templates from the same
 * sidebar. Profiles live in the Resume Platform sidebar instead (see
 * AppShell), next to the tools that build resumes from them.
 */
export function AccountShell({
  isSuperAdmin = false,
  wide = false,
  children,
}: {
  isSuperAdmin?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const links = isSuperAdmin ? [MY_ACCOUNT, ADMIN, USERS, TEMPLATES, SETTINGS] : [MY_ACCOUNT];

  return (
    <SidebarShell toolLabel="My Account" toolHref="/account" links={links} wide={wide}>
      {children}
    </SidebarShell>
  );
}

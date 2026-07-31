"use client";

import { SidebarShell, type ShellNavLink } from "@/components/sidebar-shell";
import { UserIcon, SettingsIcon, UsersIcon, FolderIcon, ShieldIcon, FileTextIcon } from "@/components/icons";

const MY_ACCOUNT: ShellNavLink = { href: "/account", label: "My Account", icon: UserIcon };
const ADMIN: ShellNavLink = { href: "/admin", label: "Admin Panel", icon: ShieldIcon };
const SETTINGS: ShellNavLink = { href: "/admin/settings", label: "Settings", icon: SettingsIcon };
const USERS: ShellNavLink = { href: "/admin/users", label: "Users", icon: UsersIcon };
const PROFILES: ShellNavLink = { href: "/admin/profiles", label: "Profiles", icon: FolderIcon };
const TEMPLATES: ShellNavLink = { href: "/admin/templates", label: "Templates", icon: FileTextIcon };

/**
 * Shell for the "My Account" area. Everyone gets their account page; a
 * superadmin additionally manages Settings, Users, and Profiles from the same
 * sidebar (these platform-admin tools now live under My Account rather than a
 * separate section).
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
  const links = isSuperAdmin ? [MY_ACCOUNT, ADMIN, USERS, PROFILES, TEMPLATES, SETTINGS] : [MY_ACCOUNT];

  return (
    <SidebarShell toolLabel="My Account" toolHref="/account" links={links} wide={wide}>
      {children}
    </SidebarShell>
  );
}

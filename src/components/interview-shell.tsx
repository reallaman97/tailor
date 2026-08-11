"use client";

import { SidebarShell, type ShellNavLink } from "@/components/sidebar-shell";
import { CalendarIcon, FileTextIcon, PlusIcon, SettingsIcon, UsersIcon, DollarSignIcon } from "@/components/icons";

const CALENDAR: ShellNavLink = { href: "/interview", label: "Calendar", icon: CalendarIcon };
const LIST: ShellNavLink = { href: "/interview/list", label: "Interviews", icon: FileTextIcon };
const AVAILABILITY: ShellNavLink = { href: "/interview/availability", label: "Availability", icon: UsersIcon };
const NEW: ShellNavLink = { href: "/interview/new", label: "New Interview", icon: PlusIcon };
const SETTINGS: ShellNavLink = { href: "/interview/settings", label: "Settings", icon: SettingsIcon };
const INVOICES: ShellNavLink = { href: "/invoices", label: "Invoices", icon: DollarSignIcon };

/**
 * Interview Management's shell. Callers get a read/act-only view (Calendar +
 * Interviews); Managers/Super Admins additionally get "New Interview" and
 * "Settings". Enforcement is server-side (requireInterviewManager); this only
 * decides which links to render.
 */
export function InterviewShell({
  isManager = false,
  wide = false,
  children,
}: {
  isManager?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const links = isManager
    ? [CALENDAR, LIST, AVAILABILITY, NEW, SETTINGS, INVOICES]
    : [CALENDAR, LIST, AVAILABILITY];

  return (
    <SidebarShell toolLabel="Interview Management" toolHref="/interview" links={links} wide={wide}>
      {children}
    </SidebarShell>
  );
}

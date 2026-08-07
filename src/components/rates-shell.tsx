"use client";

import { SidebarShell, type ShellNavLink } from "@/components/sidebar-shell";
import { DollarSignIcon } from "@/components/icons";

const RATES: ShellNavLink = { href: "/rates", label: "Bidder Rates", icon: DollarSignIcon };

/**
 * Standalone shell for the bidder-rate management page, reachable by team admins
 * (from the Resume Platform) and Managers (from Interview Management). Kept its
 * own shell since it spans both tools; the Home link returns to the hub.
 */
export function RatesShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarShell toolLabel="Bidder Rates" toolHref="/rates" links={[RATES]} wide>
      {children}
    </SidebarShell>
  );
}

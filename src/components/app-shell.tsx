"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import {
  LayoutDashboardIcon,
  UserIcon,
  LogOutIcon,
  SettingsIcon,
  UsersIcon,
  FolderIcon,
  FileTextIcon,
  SparklesIcon,
} from "@/components/icons";

type NavLink = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const DASHBOARD_LINK: NavLink = { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon };

// Dashboard is superadmin-only (it's an org-wide aggregate, not a personal
// view), so it's prepended separately rather than living in this list.
const MAIN_LINKS: NavLink[] = [
  { href: "/resumes/new", label: "Resume Builder", icon: SparklesIcon },
  { href: "/resumes", label: "Applications", icon: FileTextIcon },
];

// "Your profile" is a normal user's own read-only view of their assigned
// profile — a superadmin manages every profile from /admin/profiles instead.
const PROFILE_LINK: NavLink = { href: "/profile", label: "Profile", icon: UserIcon };

const ADMIN_LINKS: NavLink[] = [
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/profiles", label: "Profiles", icon: FolderIcon },
];

export function AppShell({
  userEmail,
  isSuperAdmin = false,
  wide = false,
  children,
}: {
  userEmail: string;
  isSuperAdmin?: boolean;
  /** Widens the content area for pages with unusually wide content (e.g. the admin tracker's many-column table). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => {
    // "/resumes/new" is a distinct nav item, so it must not also light up "/resumes".
    if (href === "/resumes") {
      return pathname === "/resumes" || (pathname?.startsWith("/resumes/") && !pathname.startsWith("/resumes/new"));
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  const homeHref = isSuperAdmin ? "/dashboard" : "/resumes";
  const mainLinks = isSuperAdmin ? [DASHBOARD_LINK, ...MAIN_LINKS] : [...MAIN_LINKS, PROFILE_LINK];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur-sm sm:px-6">
        <Link href={homeHref} className="shrink-0 text-sm font-semibold tracking-tight text-foreground">
          Resume Tailor
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {mainLinks.map((link) => (
            <TopNavLink key={link.href} link={link} active={isActive(link.href)} />
          ))}

          {isSuperAdmin && (
            <>
              <span className="mx-1 h-5 w-px shrink-0 bg-border" />
              {ADMIN_LINKS.map((link) => (
                <TopNavLink key={link.href} link={link} active={isActive(link.href)} />
              ))}
            </>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden max-w-[14rem] truncate text-xs text-muted-foreground md:inline">{userEmail}</span>
          <ThemeToggle />
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Log out">
              <LogOutIcon className="size-4" />
            </Button>
          </form>
        </div>
      </header>

      <main className={cn("mx-auto w-full flex-1 px-4 py-8 sm:px-8", wide ? "max-w-[100rem]" : "max-w-6xl")}>
        {children}
      </main>
    </div>
  );
}

function TopNavLink({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <link.icon className="size-4" />
      {link.label}
    </Link>
  );
}

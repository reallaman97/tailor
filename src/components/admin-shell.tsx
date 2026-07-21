"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";
import { cn } from "@/lib/utils";
import { LogOutIcon, UsersIcon, FolderIcon } from "@/components/icons";

type NavLink = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const ADMIN_NAV_LINKS: NavLink[] = [
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/profiles", label: "Profiles", icon: FolderIcon },
];

/**
 * Shell for the platform-wide admin pages (Users, Profiles) — distinct from
 * AppShell, which is Resume Platform's own shell. User/profile management
 * spans every tool, not just Resume Platform, so it gets its own breadcrumb
 * ("Cute Job Platform / Platform Administration") and nav rather than
 * borrowing Resume Platform's Dashboard/Resume Builder/Applications/Settings
 * tabs, which would misleadingly imply these pages live inside that tool.
 */
export function AdminShell({
  userEmail,
  wide = false,
  children,
}: {
  userEmail: string;
  /** Widens the content area for pages with unusually wide content (e.g. a many-column table). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex shrink-0 items-center gap-1.5">
          <Link href="/" className="flex items-center gap-1.5">
            <Logo className="size-5 rounded" />
            <span className="text-sm font-semibold tracking-tight text-muted-foreground hover:text-foreground">
              Cute Job Platform
            </span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-semibold tracking-tight text-foreground">Platform Administration</span>
        </div>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {ADMIN_NAV_LINKS.map((link) => (
            <TopNavLink key={link.href} link={link} active={isActive(link.href)} />
          ))}
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

      <Footer />
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

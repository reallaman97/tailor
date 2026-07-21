"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/auth/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";
import { usePersistedState } from "@/lib/use-persisted-state";
import { cn } from "@/lib/utils";
import { LogOutIcon, UserIcon, ChevronLeftIcon, HomeIcon } from "@/components/icons";

export type ShellNavLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

// Present in every sidebar so the platform home (tool hub) is always one click away.
const HOME_LINK: ShellNavLink = { href: "/", label: "Home", icon: HomeIcon };

/**
 * App layout: a full-width top bar (centered brand, account controls on the
 * right) over a collapsible left sidebar that holds the current tool's nav.
 * Collapsing hides the labels but keeps the icons, and the state is remembered.
 */
export function SidebarShell({
  toolLabel,
  toolHref,
  links,
  wide = false,
  children,
}: {
  toolLabel: string;
  toolHref: string;
  links: ShellNavLink[];
  wide?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = usePersistedState<boolean>("sidebar:collapsed", false);

  const isActive = (href: string) => {
    // "/resumes/new" is its own nav item, so it must not also light up "/resumes".
    if (href === "/resumes") {
      return pathname === "/resumes" || (pathname?.startsWith("/resumes/") && !pathname.startsWith("/resumes/new"));
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-card/80 px-4 backdrop-blur-sm">
        <div />
        <Link href="/" className="flex items-center gap-2 justify-self-center">
          <Logo className="size-6 rounded-md" />
          <span className="text-sm font-semibold tracking-tight text-foreground">Cute Job Platform</span>
        </Link>
        <div className="flex items-center gap-1 justify-self-end">
          <Link
            href="/account"
            aria-label="My account"
            title="My account"
            className={cn(
              "flex size-8 items-center justify-center rounded-md transition-colors",
              isActive("/account")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <UserIcon className="size-4" />
          </Link>
          <ThemeToggle />
          <ConfirmDialog
            title="Log out?"
            description="You'll need to sign in again to continue."
            confirmLabel="Log out"
            confirmVariant="primary"
            action={signOutAction}
            triggerVariant="ghost"
            triggerSize="icon"
            triggerLabel="Log out"
            triggerContent={<LogOutIcon className="size-4" />}
          />
        </div>
      </header>

      <div className="flex flex-1">
        <aside
          className={cn(
            "sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 border-r border-border bg-card/40 transition-[width] duration-200",
            collapsed ? "w-16" : "w-56"
          )}
        >
          <div className="flex h-full flex-col gap-1 p-2">
            <div className={cn("flex items-center gap-1 py-2", collapsed ? "justify-center" : "justify-between pl-2")}>
              {!collapsed && (
                <Link href={toolHref} className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {toolLabel}
                </Link>
              )}
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand" : "Collapse"}
                className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeftIcon className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {[HOME_LINK, ...links].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  title={link.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                    collapsed && "justify-center",
                    isActive(link.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <link.icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{link.label}</span>}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className={cn("mx-auto w-full flex-1 px-4 py-8 sm:px-8", wide ? "max-w-none" : "max-w-6xl")}>
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}

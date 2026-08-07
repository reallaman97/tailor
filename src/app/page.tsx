import { requireUser } from "@/lib/auth/require-user";
import { signOutAction } from "@/lib/auth/actions";
import { hasTeamAdminPower, isServiceAdmin } from "@/lib/auth/roles";
import { TOOLS, toolStatusFor } from "@/lib/tools";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToolCard } from "@/components/tool-card";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LogOutIcon, UserIcon } from "@/components/icons";
import Link from "next/link";

export default async function Home() {
  const user = await requireUser();
  const isSuperAdmin = hasTeamAdminPower(user.role);
  const serviceAdmin = isServiceAdmin(user.role);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <Logo className="size-6 rounded-md" />
          <span className="text-sm font-semibold tracking-tight text-foreground">Cute Job Platform</span>
        </div>
        <div className="flex-1" />
        <Link
          href="/account"
          aria-label="My account"
          title="My account"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cute Job Platform</h1>
            <p className="text-sm text-muted-foreground">
              Your toolkit for the job hunt — pick a tool to get started.
            </p>
          </div>
          {serviceAdmin && (
            <Link
              href="/platform/teams"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Platform Admin →
            </Link>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => {
            const status = toolStatusFor(user.role, tool);
            return (
              <ToolCard
                key={tool.key}
                icon={tool.icon}
                name={tool.name}
                description={tool.description}
                status={status}
                href={
                  status === "open"
                    ? tool.key === "resume-platform" && isSuperAdmin
                      ? "/dashboard"
                      : tool.href
                    : undefined
                }
              />
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}

import { requireUser } from "@/lib/auth/require-user";
import { signOutAction } from "@/lib/auth/actions";
import { TOOLS, toolStatusFor } from "@/lib/tools";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToolCard } from "@/components/tool-card";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LogOutIcon, UsersIcon, FolderIcon } from "@/components/icons";

export default async function Home() {
  const user = await requireUser();
  const isSuperAdmin = user.role === "SUPERADMIN";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <Logo className="size-6 rounded-md" />
          <span className="text-sm font-semibold tracking-tight text-foreground">Cute Job Platform</span>
        </div>
        <div className="flex-1" />
        <span className="hidden max-w-[14rem] truncate text-xs text-muted-foreground md:inline">{user.email}</span>
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
        <div className="mb-10 flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cute Job Platform</h1>
          <p className="text-sm text-muted-foreground">
            Your toolkit for the job hunt — pick a tool to get started.
          </p>
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

        {isSuperAdmin && (
          <div className="mt-12">
            <div className="mb-4 flex flex-col gap-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Platform administration</h2>
              <p className="text-sm text-muted-foreground">
                User and profile management span every tool, so they live here rather than inside any one of them.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ToolCard
                icon={UsersIcon}
                name="Users"
                description="Approve sign-ups, manage roles, and assign profiles."
                status="open"
                href="/admin/users"
              />
              <ToolCard
                icon={FolderIcon}
                name="Profiles"
                description="Manage every candidate profile shared across accounts."
                status="open"
                href="/admin/profiles"
              />
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

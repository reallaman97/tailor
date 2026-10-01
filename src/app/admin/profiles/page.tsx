import Link from "next/link";
import { requireTeamAdmin } from "@/lib/auth/team-context";
import { listAllProfiles } from "@/lib/admin/profiles";
import { deleteProfileAction } from "./actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { TrashIcon, PlusIcon } from "@/components/icons";

export default async function AdminProfilesPage() {
  const ctx = await requireTeamAdmin();
  const profiles = await listAllProfiles(ctx.activeTeamId ?? undefined);

  return (
    <AppShell userEmail={ctx.email} isSuperAdmin wide>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Profiles"
          description="Candidate profiles, each built from a full base resume. Open one to assign it to accounts or fine-tune it."
          action={
            <Link href="/admin/profiles/new" className={buttonVariants("primary", "sm")}>
              <PlusIcon className="size-4" />
              New profile
            </Link>
          }
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Assigned accounts</TableHead>
              <TableHead>Base resume</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-foreground">
                  {p.fullName ?? <span className="text-muted-foreground">Untitled profile</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.assignedUsers.length === 0
                    ? "Unassigned"
                    : p.assignedUsers.map((u) => u.email).join(", ")}
                </TableCell>
                <TableCell>
                  {p.baseResumeImportedAt ? (
                    <Badge variant="success">Imported {p.baseResumeImportedAt.toLocaleDateString()}</Badge>
                  ) : (
                    <Link href={`/admin/profiles/${p.id}`}>
                      <Badge variant="warning">Missing — upload</Badge>
                    </Link>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{p.createdAt.toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/admin/profiles/${p.id}`} className={buttonVariants("ghost", "sm")}>
                      Edit
                    </Link>
                    <ConfirmDialog
                      title="Delete this profile?"
                      description={`This permanently deletes ${p.fullName ?? "this profile"} and all of its work history, education, and skills. This cannot be undone.`}
                      action={deleteProfileAction.bind(null, p.id)}
                      triggerVariant="ghost"
                      triggerSize="icon"
                      triggerClassName="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      triggerLabel={`Delete ${p.fullName ?? "profile"}`}
                      triggerContent={<TrashIcon className="size-4" />}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {profiles.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No profiles yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}

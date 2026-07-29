import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { getUserForAdmin } from "@/lib/admin/users";
import { listAllProfiles } from "@/lib/admin/profiles";
import { AccountShell } from "@/components/account-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TrashIcon } from "@/components/icons";
import { EditUserForm, PasswordResetForm } from "./edit-user-form";
import { ProfileSelect } from "../profile-select";
import { deleteUserFromEditAction } from "./actions";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireSuperAdmin();

  const [user, profiles] = await Promise.all([getUserForAdmin(id), listAllProfiles()]);
  if (!user) notFound();

  const isSelf = user.id === admin.id;

  return (
    <AccountShell isSuperAdmin>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={user.username}
          description={user.email}
          action={
            <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Back to users
            </Link>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Identity, role, and approval.</CardDescription>
          </CardHeader>
          <CardContent>
            <EditUserForm user={user} isSelf={isSelf} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assigned profile</CardTitle>
            <CardDescription>The candidate profile this account uses in the Resume Platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileSelect
              userId={user.id}
              profileId={user.assignedProfileId}
              profiles={profiles.map((p) => ({ id: p.id, fullName: p.fullName }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>Set a new password for this account.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordResetForm userId={user.id} />
          </CardContent>
        </Card>

        {!isSelf && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle>Danger zone</CardTitle>
              <CardDescription>
                Permanently delete this account and its generated resumes. The assigned profile is untouched.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfirmDialog
                title="Delete this user?"
                description={`This permanently deletes ${user.email}'s account and all generated resumes. This cannot be undone.`}
                confirmLabel="Delete user"
                triggerVariant="destructive"
                triggerSize="md"
                triggerLabel={`Delete ${user.email}`}
                triggerContent={
                  <span className="flex items-center gap-1.5">
                    <TrashIcon className="size-4" />
                    Delete user
                  </span>
                }
                action={deleteUserFromEditAction.bind(null, user.id)}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AccountShell>
  );
}

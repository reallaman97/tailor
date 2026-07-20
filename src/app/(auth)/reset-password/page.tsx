import { ResetPasswordForm } from "./reset-password-form";
import { AuthCard } from "../auth-card";
import { Alert } from "@/components/ui/alert";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthCard title="Set a new password">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert variant="destructive">Missing reset token. Use the link from your email.</Alert>
      )}
    </AuthCard>
  );
}

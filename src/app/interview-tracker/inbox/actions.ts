"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { connectMailbox, disconnectMailbox, updateInboxEmail } from "@/lib/inbox/store";
import { searchApplications } from "@/lib/admin/application-search";

export type ConnectState = { error?: string; ok?: boolean } | undefined;

const connectSchema = z.object({
  email: z.email("Enter the Gmail address"),
  appPassword: z
    .string()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().length(16, "An app password is 16 letters (Google shows it in groups of four)")),
});

export async function connectMailboxAction(profileId: string, _prev: ConnectState, formData: FormData): Promise<ConnectState> {
  await requireSuperAdmin();
  const parsed = connectSchema.safeParse({ email: formData.get("email"), appPassword: formData.get("appPassword") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await connectMailbox(profileId, parsed.data.email, parsed.data.appPassword);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't connect the mailbox." };
  }
  revalidatePath("/interview-tracker/inbox");
  return { ok: true };
}

/** Form action for ConfirmDialog. */
export async function disconnectMailboxAction(profileId: string): Promise<void> {
  await requireSuperAdmin();
  await disconnectMailbox(profileId);
  revalidatePath("/interview-tracker/inbox");
}

const CATEGORIES = ["APPLICATION_RECEIVED", "REJECTION", "NEXT_STEP", "RECRUITER_OUTREACH", "CONVERSATION", "RESUME_REQUEST", "OTHER"] as const;
const patchSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  workMode: z.enum(["REMOTE", "HYBRID", "ONSITE", "UNKNOWN"]).optional(),
  resumeId: z.string().min(1).nullable().optional(),
  status: z.enum(["open", "done", "dismissed"]).optional(),
  needsAttention: z.boolean().optional(),
});

export async function updateInboxEmailAction(emailId: string, patch: z.input<typeof patchSchema>): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { error: "Invalid change." };
  await updateInboxEmail(emailId, parsed.data);
  revalidatePath("/interview-tracker/inbox");
  revalidatePath(`/interview-tracker/inbox/${emailId}`);
  return {};
}

/** Applications of this profile matching a search — for linking an email by hand. */
export async function findProfileApplicationsAction(
  profileId: string,
  query: string
): Promise<{ id: string; companyName: string; jobTitle: string; date: string }[]> {
  await requireSuperAdmin();
  const rows = await searchApplications(query);
  return rows
    .filter((r) => r.profileId === profileId)
    .slice(0, 10)
    .map((r) => ({ id: r.id, companyName: r.companyName, jobTitle: r.jobTitle, date: (r.appliedAt ?? r.createdAt).toISOString() }));
}

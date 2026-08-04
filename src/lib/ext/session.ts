import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TOOLS, canAccessTool } from "@/lib/tools";
import type { Role } from "@/lib/auth/require-user";

export type ExtUser = { id: string; email: string; role: Role };

/**
 * Authenticates a browser-extension API request using the SAME Auth.js session
 * cookie as the web app (the extension logs in through the normal credentials
 * flow and reuses the cookie). Returns null (→ the caller replies 401) rather
 * than redirecting, and — like requireResumePlatformAccess — re-checks the role
 * fresh from the DB and requires an approved account that may use the Resume
 * Platform (BIDDER or SUPERADMIN).
 */
export async function getExtUser(): Promise<ExtUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;

  const fresh = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, approved: true },
  });
  if (!fresh || !fresh.approved) return null;

  const resumePlatform = TOOLS.find((tool) => tool.key === "resume-platform")!;
  if (!canAccessTool(fresh.role, resumePlatform)) return null;

  return { id: session.user.id, email: session.user.email, role: fresh.role };
}

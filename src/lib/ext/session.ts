import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TOOLS, canAccessTool } from "@/lib/tools";
import { verifyExtToken } from "@/lib/ext/token";
import type { Role } from "@/lib/auth/require-user";

export type ExtUser = { id: string; email: string; role: Role };

/**
 * Authenticates a browser-extension API request. Prefers an
 * `Authorization: Bearer <token>` (issued by /api/ext/login), because a
 * cross-site extension request can't carry the SameSite=Lax session cookie;
 * falls back to the Auth.js session cookie for same-origin/web callers.
 *
 * Like requireResumePlatformAccess, it re-checks the role fresh from the DB and
 * requires an approved account that may use the Resume Platform (BIDDER or
 * SUPERADMIN). Returns null (→ the caller replies 401) rather than redirecting.
 */
export async function getExtUser(request?: Request): Promise<ExtUser | null> {
  let userId: string | undefined;

  const authorization = request?.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const uid = verifyExtToken(authorization.slice(7).trim());
    if (uid) userId = uid;
  }

  if (!userId) {
    const session = await auth();
    if (session?.user?.id) userId = session.user.id;
  }

  if (!userId) return null;

  const fresh = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, approved: true },
  });
  if (!fresh || !fresh.approved) return null;

  const resumePlatform = TOOLS.find((tool) => tool.key === "resume-platform")!;
  if (!canAccessTool(fresh.role, resumePlatform)) return null;

  return { id: userId, email: fresh.email, role: fresh.role };
}

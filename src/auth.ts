import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { consumeRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/request-ip";
import { resolveUserTeams, effectiveAccessRole, pickActiveTeam } from "@/lib/auth/team-resolve";

// Login is throttled per client IP, counting every attempt, so brute force is
// bounded no matter how the attempts interleave. Deliberately NOT keyed on the
// target email: an email-keyed lockout would let anyone lock a victim out of
// their own account by submitting bad passwords for their address.
const LOGIN_RATE_LIMIT = 20;
const LOGIN_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PASSWORD_LENGTH = 128; // cap Argon2 input — a huge password is a cheap CPU/memory DoS

/** Thrown from authorize() when credentials are correct but the account is still pending superadmin approval. */
export class AccountPendingApprovalError extends CredentialsSignin {
  code = "account-pending-approval";
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  // Trust the deployment's Host header. In production Auth.js otherwise rejects
  // every /api/auth request as UntrustedHost (breaking login) unless it detects
  // a known platform env. Behind a custom domain / proxy that auto-detection is
  // unreliable, so we set it explicitly. Safe: the host is controlled by our
  // hosting, and AUTH_SECRET still signs the session.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;
        if (password.length > MAX_PASSWORD_LENGTH) return null;

        // Consume a slot up front (atomic check-and-record), before the Argon2
        // verify, so a flood of parallel attempts can't slip past a stale count.
        const ip = request ? clientIpFromHeaders(request.headers) : "unknown";
        try {
          await consumeRateLimit(`login:ip:${ip}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS);
        } catch (err) {
          if (err instanceof RateLimitExceededError) return null; // ambiguous with wrong-password, by design
          throw err;
        }

        const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user) return null;

        const valid = await verifyPassword(user.passwordHash, password);
        if (!valid) return null;

        if (!user.approved) {
          throw new AccountPendingApprovalError();
        }

        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user?.id) {
        // Fresh sign-in (Node context, DB available). Bake in the active team
        // and the role the middleware gates on — defaulting to the user's first
        // team. Switching teams updates these via unstable_update (below).
        token.id = user.id;
        const { isServiceAdmin, globalRole, teams } = await resolveUserTeams(user.id);
        const active = pickActiveTeam(teams, null);
        token.activeTeamId = active?.id ?? null;
        token.role = effectiveAccessRole({ isServiceAdmin, globalRole, activeRole: active?.role ?? null });
      } else if (trigger === "update" && session && typeof session === "object") {
        // Team switch: the server action already computed the new team + role
        // (no DB touch here, so this stays edge-safe). See team-actions.ts.
        const patch = (session as { user?: { role?: unknown; activeTeamId?: unknown } }).user;
        if (patch) {
          if (typeof patch.role === "string") token.role = patch.role as typeof token.role;
          if (typeof patch.activeTeamId === "string" || patch.activeTeamId === null) {
            token.activeTeamId = patch.activeTeamId;
          }
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        // The role the middleware gates on: the caller's role in their ACTIVE
        // team (SERVICE_ADMIN keeps platform power in any team). Still fine for
        // cheap UI decisions too. Server actions/pages that need the freshest
        // per-team role read it from team-context (DB-backed).
        session.user.role = token.role as "SUPERADMIN" | "BIDDER" | "CALLER" | "MANAGER" | "SERVICE_ADMIN" | "TEAM_ADMIN";
        session.user.activeTeamId = (token.activeTeamId ?? null) as string | null;
      }
      return session;
    },
  },
});

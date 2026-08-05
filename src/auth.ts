import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { consumeRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/request-ip";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
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
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        // Convenience only, for cheap UI decisions (e.g. showing the admin nav
        // link) — never trusted for actual authorization. Every admin-gated
        // action re-checks the role fresh from the database; a role change
        // takes effect there immediately even though this claim is stale
        // until the next login.
        session.user.role = token.role as "SUPERADMIN" | "BIDDER" | "CALLER" | "MANAGER" | "SERVICE_ADMIN" | "TEAM_ADMIN";
      }
      return session;
    },
  },
});
